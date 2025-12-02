const technicianModel = require("../models/technician");
const bookingModel = require("../models/booking");
const mongoose = require("mongoose");
const serviceModel = require("../models/service");
const moment = require("moment");

const createTechnician = async (req, res) => {
  try {
    const image = req.file?.filename || null;
    const workingDays = JSON.parse(req.body.workingDays);
    const technician = new technicianModel({ ...req.body, image: image });
    technician.workingDays = workingDays;
    const savedTechnician = await technician.save();

    res.status(200).json({ success: true, data: savedTechnician });
  } catch (error) {
    console.error("Create technician error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

const updateTechnician = async (req, res) => {
  try {
    const { id } = req.body;
    let technicianData = { ...req.body };

    if (req.body.workingDays && typeof req.body.workingDays === "string") {
      technicianData.workingDays = JSON.parse(req.body.workingDays);
    }

    delete technicianData.notAvailable;

    if (req.file?.filename) {
      technicianData.image = req.file.filename;
    }

    let updated = await technicianModel.findByIdAndUpdate(
      id,
      { $set: technicianData },
      { new: true }
    );

    if (!updated) {
      return res
        .status(200)
        .json({ success: false, message: "Technician not found" });
    }

    if (req.body.notAvailable) {
      let notAvailableData = req.body.notAvailable;

      if (typeof notAvailableData === "string") {
        notAvailableData = JSON.parse(notAvailableData);
      }

      if (!Array.isArray(notAvailableData)) {
        return res.status(400).json({
          success: false,
          message: "notAvailable must be an array of objects",
        });
      }

      notAvailableData = notAvailableData.map((slot) => ({
        ...slot,
        date: moment(slot.date, ["DD-MM-YYYY", "DD-MM-YY"]).format("DD-MM-YY"),
      }));

      updated = await technicianModel.findByIdAndUpdate(
        id,
        { $push: { notAvailable: { $each: notAvailableData } } },
        { new: true }
      );

      const today = moment().startOf("day");
      updated.notAvailable = updated.notAvailable.filter((slot) =>
        moment(slot.date, "DD-MM-YY").isSameOrAfter(today, "day")
      );
      await updated.save();
    }
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update technician error:", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

const getTechnicianById = async (req, res) => {
  try {
    const { id, date } = req.query;
    const technician = await technicianModel.findById(id);
    if (!technician) {
      return res
        .status(200)
        .json({ success: false, message: "Technician not found" });
    }
    const filter = {};
    if (id) filter.technicianId = id;
    if (date) filter.date = date;
    const technicianAppointments = await bookingModel.find(filter);

    const statusCounts = {
      Pending: 0,
      Accepted: 0,
      Completed: 0,
      Canceled: 0,
    };

    technicianAppointments.forEach((booking) => {
      if (statusCounts.hasOwnProperty(booking.status)) {
        statusCounts[booking.status] += 1;
      }
    });

    res.status(200).json({
      success: true,
      data: { technician, technicianAppointments, statusCounts },
    });
  } catch (error) {
    console.error("Get technician error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

const getAllTechniciansBySalonId = async (req, res) => {
  try {
    const { salonId } = req.query;
    const technicians = await technicianModel
      .find({ salonId })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: technicians });
  } catch (error) {
    console.error("Get all by salonId error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

const updateTechnicianIsActive = async (req, res) => {
  try {
    const { workingDayId, isActive } = req.body;

    const day = await technicianModel.findOneAndUpdate(
      { "workingDays._id": workingDayId },
      { $set: { "workingDays.$.isActive": isActive } },
      { new: true }
    );

    if (!day) {
      return res
        .status(200)
        .json({ success: false, message: "workingDay not found" });
    } else {
      return res.status(200).json({
        success: true,
        message: "workingDay updated",
        data: day,
      });
    }
  } catch (error) {
    console.error("error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

const getAvailableTechnician = async (req, res) => {
  try {
    const { serviceId, time, date } = req.query; // time in format: "09:00 AM"

    // 1️⃣ Get service and assigned technicians
    const service = await serviceModel.findById(serviceId);
    if (!service) {
      return res
        .status(200)
        .json({ success: false, message: "Service not found" });
    }
    const serviceTech = service.technicianId;

    // 2️⃣ Get booked technicians for same date & time
    const bookedTechIds = await bookingModel.distinct("technicianId", {
      serviceId,
      time,
      date,
      status: "Accepted",
    });

    // 3️⃣ Get technicians assigned to service but not booked
    let availableTechDetails = await technicianModel.find({
      _id: { $in: serviceTech, $nin: bookedTechIds },
    });

    if (!availableTechDetails.length) {
      return res
        .status(200)
        .json({ success: false, message: "No technicians found" });
    }

    // 4️⃣ Convert the requested time to a moment object
    const requestedTime = moment(time, "hh:mm A"); // e.g., "02:00 PM"

    // 5️⃣ Get the day of week from the requested date
    const requestedDay = moment(date, "DD-MM-YYYY").format("dddd"); // e.g., "Monday"

    // 6️⃣ Filter technicians by schedule for that day and time
    availableTechDetails = availableTechDetails.filter((tech) => {
      const todaySchedule = tech.workingDays.find(
        (day) => day.day === requestedDay && day.isActive
      );
      if (!todaySchedule) return false;

      const start = moment(todaySchedule.startTime, "hh:mm A");
      const end = moment(todaySchedule.endTime, "hh:mm A");
      const breakStart = moment(todaySchedule.breakStart, "hh:mm A");
      const breakEnd = moment(todaySchedule.breakEnd, "hh:mm A");

      // ✅ Allow if exactly at startTime
      if (requestedTime.isSame(start, "minute")) return true;

      // ❌ Do NOT allow if exactly at endTime
      if (requestedTime.isSame(end, "minute")) return false;

      // ❌ Do NOT allow if exactly at breakStart
      if (requestedTime.isSame(breakStart, "minute")) return false;

      // ✅ Allow if exactly at breakEnd
      if (requestedTime.isSame(breakEnd, "minute")) return true;

      // ✅ Normal case: within working hours and not in break
      const isWithinWorkingHours = requestedTime.isBetween(
        start,
        end,
        null,
        "()"
      );
      const isInBreak = requestedTime.isBetween(
        breakStart,
        breakEnd,
        null,
        "[]"
      );

      return isWithinWorkingHours && !isInBreak;
    });

    if (!availableTechDetails.length) {
      return res.status(200).json({
        success: false,
        message: "No technicians available for this time",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Available technicians for requested time",
      data: availableTechDetails,
    });
  } catch (error) {
    console.error("Get available technicians error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
};

async function deleteTechnician(req,res) {
  try {
    const {technicianId} = req.body
    const technician = await technicianModel.findById({_id:technicianId})
    if(technician.isDeleted ==true){
      return res.status(200).json({success:false ,message:"Technician already deleted"})
    }
    const salon = await technicianModel.findByIdAndUpdate({_id:technicianId},{$set:{isDeleted:true ,image:null ,fullName:null}},{new:true})
    if(salon){
      return res.status(200).json({success:true,message:"Technician deleted Sucessfully"})
    }
  } catch (error) {
    console.error("deleting Technician Error:", error);
    return res
      .status(400)
      .json({
        success: false,
        message: "Server error while deleting Technician",
        error: error.message,
      });

  }
}

module.exports = {
  createTechnician,
  updateTechnician,
  getTechnicianById,
  getAllTechniciansBySalonId,
  updateTechnicianIsActive,
  getAvailableTechnician,
  deleteTechnician
};
