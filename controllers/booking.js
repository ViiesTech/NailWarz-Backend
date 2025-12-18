const bookingModel = require("../models/booking");
const walletModel = require("../models/wallet");
const salonModel = require("../models/adminProfile");
const notificationModel = require("../models/notification");
const moment = require("moment");
const sendNotification = require("../controllers/adminProfile");
const UserModel = require("../models/user");

async function createBooking(req, res) {
  try {
    let { userId, salonId, serviceId, technicianId, date, time, totalAmount } =
      req.body;

    const alreadyExist = await bookingModel.findOne({
      technicianId,
      date,
      time,
      status: "Accepted",
    });
    // console.log("first",alreadyExist)
    // return
    const alreadyBooked = await bookingModel.findOne({
      userId,
      date,
      time,
      status: "Accepted",
    });
    // console.log("first",alreadyBooked)
    // return

    if (alreadyExist || alreadyBooked) {
      return res.status(200).json({
        message: "Appointment already booked at this time",
        success: false,
      });
    } else {
      const booking = new bookingModel({
        userId,
        salonId,
        serviceId,
        technicianId,
        date,
        time,
        totalAmount,
      });

      const result = await booking.save();

      if (!result) {
        return res
          .status(200)
          .json({ message: "Error in booking appointment", success: false });
      }

      return res.status(200).json({
        message: "Successfully booked appointment",
        success: true,
        data: result,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
}

async function updateBooking(req, res) {
  try {
    const { bookingId, technicianId, time, date } = req.body;
    const updates = {};

    const booking = await bookingModel.findById(bookingId);
    if (!booking) {
      return res.status(200).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (technicianId) {
      booking.previousTechnicianId = booking.technicianId;
      updates.technicianId = technicianId;
      updates.reschedule = true;
    }
    if (time) {
      booking.previousTime = booking.time;
      updates.time = time;
      updates.reschedule = true;
    }
    if (date) {
      booking.previousDate = booking.date;
      updates.date = date;
      updates.reschedule = true;
    }

    await booking.save();

    const updatedBooking = await bookingModel.findByIdAndUpdate(
      bookingId,
      { $set: updates },
      { new: true }
    );

    if (updatedBooking) {
      if (updatedBooking.reschedule == true) {
        const updated = await bookingModel.findByIdAndUpdate(
          bookingId,
          { $set: { rescheduleStatus: "Accepted" } },
          { new: true }
        );
        return res.status(200).json({
          success: true,
          message: "Booking rescheduled successfully",
          data: updated,
        });
      } else {
        return res.status(200).json({
          success: true,
          message: "Booking rescheduled successfully",
          data: updatedBooking,
        });
      }
    } else {
      return res.status(200).json({
        success: false,
        message: "Failed to reschedule booking",
      });
    }
  } catch (error) {
    console.error("Error :", error);
    return res.status(400).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
}

async function updateBookingStatus(req, res) {
  try {
    const { bookingId, status, reason } = req.body;

    if (!bookingId || !status) return res.status(200).json({ success: false, message: "bookingId and status are required", });

    let canceledBy = status === "Canceled" ? "Salon" : undefined;

    const updatedBooking = await bookingModel.findByIdAndUpdate(
      bookingId,
      { $set: { status, canceledBy, reason } },
      { new: true }
    );

    if (!updatedBooking) return res.status(200).json({ success: false, message: "Booking not found", });

    let message = "";
    if (status === "Completed") {
      message = "Your appointment has been completed successfully.";
    } else if (status === "Canceled") {
      message = "Your appointment has been canceled.";

      try {
        const refund = await processRefund(updatedBooking.userId, bookingId, reason);
        if (!refund) {
          return res.status(200).json({
            success: false,
            message: "Refund could not be processed.",
          });
        }
      } catch (err) {
        console.error("Refund Error:", err);
        return res.status(400).json({
          success: false,
          message: "Error processing refund.",
          error: err.message,
        });
      }
    }

    const notification = new notificationModel({
      userId: updatedBooking.userId,
      bookingId: updatedBooking._id,
      salonId: updatedBooking.salonId,
      technicianId: updatedBooking.technicianId,
      serviceId: updatedBooking.serviceId,
      title: "Booking Update",
      message,
    });

    const savedNotification = await notification.save();

    sendNotification.sendNotificationToUser(savedNotification);

    return res.status(200).json({
      success: true,
      message: "Booking updated successfully.",
      data: updatedBooking,
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
}

async function updateBookingStatusByUser(req, res) {
  try {
    const { bookingId, status, reason } = req.body;

    let canceledBy;
    if (status == "Canceled") canceledBy = "User";

    const updatedBooking = await bookingModel.findByIdAndUpdate(
      bookingId,
      { $set: { status, canceledBy } },
      { new: true }
    );

    if (!updatedBooking) {
      return res.status(200).json({
        message: "Booking not found",
        success: false,
      });
    } else {
      if (updatedBooking.status == "Canceled") {
        const refund = await processRefund(
          updatedBooking.userId,
          bookingId,
          reason
        );

        if (!refund)
          return res
            .status(200)
            .json({ success: false, message: "Refund could not be processed" });

        const notification = new notificationModel({
          userId: updatedBooking.userId,
          bookingId: updatedBooking._id,
          salonId: updatedBooking.salonId,
          technicianId: updatedBooking.technicianId,
          serviceId: updatedBooking.serviceId,
          title: "New Message!",
          message: "User Canceled the appointment.",
        });
        const result = await notification.save();
        // sendNotification.sendNotificationToSalon(result)
      }

      return res.status(200).json({
        message: "Booking updated successfully",
        success: true,
        data: updatedBooking,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
}

async function getBookingById(req, res) {
  try {
    const { bookingId } = req.query;

    const booking = await bookingModel
      .findById(bookingId)
      .populate({
        path: "salonId",
        select: "-password",
      })
      .populate({
        path: "userId",
        select: "-password",
      })
      .populate("serviceId technicianId");

    if (!booking) {
      return res
        .status(200)
        .json({ message: "Booking not found", success: false });
    }

    return res.status(200).json({
      message: "Booking fetched successfully",
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
}

async function getBookingsByUserId(req, res) {
  try {
    const { userId } = req.query;

    const bookings = await bookingModel
      .find({ userId })
      .populate({
        path: "salonId",
        select: "-password",
      })
      .populate("serviceId technicianId");
    return res.status(200).json({
      message: "Bookings fetched successfully",
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
}

async function getBookingsByUserIdAndStatus(req, res) {
  try {
    const { userId, status } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    const bookings = await bookingModel
      .find(filter)
      .populate({
        path: "salonId",
        select: "-password",
      })
      .populate({
        path: "serviceId",
        populate: {
          path: "technicianId",
          // model:"technician"
        },
      })
      .populate("technicianId");

    if (bookings.length == 0) {
      return res.status(200).json({
        message: "Bookings not found",
        success: false,
        data: bookings,
      });
    } else {
      return res.status(200).json({
        message: "Bookings fetched successfully",
        success: true,
        data: bookings,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
}

async function getBookingsBySalonIdAndStatus(req, res) {
  try {
    const { salonId, status } = req.query;
    const filter = {};
    if (salonId) filter.salonId = salonId;
    if (status) filter.status = status;
    const bookings = await bookingModel
      .find(filter)
      .populate({
        path: "userId",
        select: "-password",
      })
      .populate("serviceId");

    if (bookings.length == 0) {
      return res.status(200).json({
        message: "Bookings not found",
        success: false,
        data: bookings,
      });
    } else {
      return res.status(200).json({
        message: "Bookings fetched successfully",
        success: true,
        data: bookings,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
}

async function getBookingsBySalonId(req, res) {
  try {
    const { salonId, date, time } = req.query;
    if (!salonId) return res.status(200).json({ success: false, message: "salonId is required", });

    const filter = { salonId };
    if (date) filter.date = date

    let bookings;

    // const bookings = await bookingModel
    //   .find(filter)
    //   .sort({ createdAt: -1 })
    //   .populate({path: "userId",select: "-password",})
    //   .populate("serviceId technicianId");

    if (time) {
      const start = moment(time, "hh:mm A");
      const end = moment(time, "hh:mm A").add(29, "minutes");

      // First fetch only salon + date (faster)
      bookings = await bookingModel
        .find(filter)
        .populate({ path: "userId", select: "-password" })
        .populate("serviceId technicianId");

      // Now filter by time range in JS
      bookings = bookings.filter((b) => {
        if (!b.time) return false;

        const bookingTime = moment(b.time, "hh:mm A");
        return bookingTime.isSameOrAfter(start) && bookingTime.isSameOrBefore(end);
      });

    } else {
      // No time filter → fetch all
      bookings = await bookingModel
        .find(filter)
        .populate({ path: "userId", select: "-password" })
        .populate("serviceId technicianId");
    }

    if (!bookings || bookings.length === 0) return res.status(200).json({ message: "No bookings found for this salon", success: false, data: [], });

    bookings.forEach(b => {
      console.log(b.time , b.date);
    });

    return res.status(200).json({ message: "Bookings fetched successfully", success: true, data: bookings, });

  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(400).json({ success: false, message: "Server Error", error: error.message, });
  }
};

async function getSalonMonthlyRevenue(req, res) {
  try {
    const { salonId, monthYear } = req.query; // example: "07-2025"

    if (!salonId || !monthYear) {
      return res.status(200).json({
        success: false,
        message: "salonId and monthYear (MM-YYYY) are required",
      });
    }

    // Parse month and year
    const [month, year] = monthYear.split("-").map(Number);

    const allAppointments = await bookingModel
      .find({
        salonId,
        status: { $in: ["Accepted", "Completed"] },
      })
      .populate("serviceId", "price")
      .populate("userId", "_id fullName email phone");

    // ✅ Track total unique customers (all-time)
    let totalCustomerMap = new Map();

    // ✅ Track month-wise revenue + customers
    let revenueByDate = {};
    let monthCustomerMap = new Map();
    let totalMonthRevenue = 0; // ✅ Track total month revenue

    allAppointments.forEach((appt) => {
      // --- Total Customers (all-time) ---
      if (appt.userId?._id) {
        totalCustomerMap.set(String(appt.userId._id), true);
      }

      // --- Month Customers ---
      const apptDate = moment(appt.date, "DD-MM-YYYY");
      if (
        apptDate.isValid() &&
        apptDate.month() + 1 === month &&
        apptDate.year() === year
      ) {
        const dateKey = apptDate.format("DD-MM-YYYY");
        const servicePrice = appt?.serviceId?.price || 0;

        // Revenue by date
        if (!revenueByDate[dateKey]) {
          revenueByDate[dateKey] = 0;
        }
        revenueByDate[dateKey] += servicePrice;

        // Track total month revenue
        totalMonthRevenue += servicePrice;

        // Month customers
        if (appt.userId?._id) {
          monthCustomerMap.set(String(appt.userId._id), true);
        }
      }
    });

    // ✅ Fill missing dates with 0 revenue
    const startOfMonth = moment(`01-${monthYear}`, "DD-MM-YYYY");
    const daysInMonth = startOfMonth.daysInMonth();
    let completeData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = moment(`${day}-${monthYear}`, "D-MM-YYYY").format(
        "DD-MM-YYYY"
      );
      completeData.push({
        date: dateKey,
        revenue: revenueByDate[dateKey] || 0,
      });
    }

    res.status(200).json({
      success: true,
      salonId,
      monthYear,
      totalCustomers: totalCustomerMap.size, // ✅ all-time unique customers
      monthCustomers: monthCustomerMap.size, // ✅ customers only in this month
      totalMonthRevenue, // ✅ NEW: sum of all day revenue in this month
      data: completeData, // ✅ day-wise revenue
    });
  } catch (error) {
    console.error("Get Salon Monthly Revenue error:", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
}

async function processRefund(userId, bookingId, reason) {
  const booking = await bookingModel.findById(bookingId);

  const refundAmount = booking.totalAmount;

  let wallet = await walletModel.findOne({ userId });

  if (!wallet)
    wallet = new walletModel({ userId, balance: 0, transactions: [] });

  wallet.balance += refundAmount;
  wallet.transactions.push({
    type: "refund",
    amount: refundAmount,
    description: `refund for booking ${bookingId} , The reason: ${reason}.`,
    bookingId,
  });

  await wallet.save();

  // System/App Error → just covered by platform (no vendor deduction)

  return { wallet, refundAmount };
}

async function paymentWithWallet(req, res) {
  try {
    const { userId, bookingAmount, bookingId } = req.body;
    const amount = +bookingAmount; // ✅ ensure it's always a number
    const wallet = await walletModel.findOne({ userId: userId });
    let payableAmount = amount;

    if (!wallet || wallet.balance <= 0) {
      return res.status(200).json({
        success: false,
        message: "No wallet balance available",
      });
    }

    // ✅ Check if balance is equal or greater than booking amount
    if (wallet.balance >= amount) {
      wallet.balance -= amount;
      payableAmount = 0;

      wallet.transactions.push({
        type: "debit",
        amount: amount,
        description: "Full payment via wallet credits",
      });

      await wallet.save();

      const booking = await bookingModel.findByIdAndUpdate(
        { _id: bookingId },
        { $set: { status: "Accepted" } },
        { new: true }
      );
      if (booking?.salonId) {
        const update = await salonModel.findByIdAndUpdate(
          { _id: booking.salonId },
          { $inc: { walletBalance: amount } }
        );
      }
      return res.status(200).json({
        success: true,
        message: "Payment Successful using wallet",
        payableAmount,
        booking,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }
  } catch (error) {
    console.error("error:", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
}

async function getWalletByUserId(req, res) {
  try {
    const { _id } = req.user;

    const user = await UserModel.findById(_id);
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "User not found",
      });
    }

    let wallet = await walletModel.findOne({ userId: _id });
    if (!wallet) {
      wallet = new walletModel({
        userId: _id,
        balance: 0,
        transactions: [],
      });
      await wallet.save();
    }

    return res.status(200).json({
      success: true,
      message: "Wallet fetched successfully",
      data: wallet,
    });
  } catch (error) {
    console.error("error:", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
}

module.exports = {
  createBooking,
  updateBooking,
  updateBookingStatus,
  getBookingById,
  getBookingsByUserId,
  getBookingsByUserIdAndStatus,
  getBookingsBySalonIdAndStatus,
  getBookingsBySalonId,
  getSalonMonthlyRevenue,
  updateBookingStatusByUser,
  paymentWithWallet,
  getWalletByUserId,
};
