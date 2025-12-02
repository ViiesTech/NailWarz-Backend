const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "adminProfile",
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "service",
    },
    totalAmount:{
      type:Number,
      default:0
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "technician",
    },
    time: {
      type: String,
    },
    date: {
      type: String,
    },
    previousTechnicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "technician",
    },
    previousTime: {
      type: String,
    },
    previousDate: {
      type: String,
    },
    reschedule:{
      type:Boolean,
      default:false
    },
    rescheduleStatus:{
     type:String,
     enum:["Pending","Accepted"]
    },
    status: {
      type: String,
      enum: ["Pending","Accepted", "Completed", "Canceled"],
      default: "Pending",
    },
    canceledBy:{
      type:String,
      enum:["User","Salon"]
    }
  },
  { timestamps: true }
);

const bookingModel = mongoose.model("appointments", appointmentSchema);
module.exports = bookingModel;
