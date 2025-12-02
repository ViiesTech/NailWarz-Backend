const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema(
  {
    EmailOrPhone: {
      type: String,
    },
    Otp: {
      type: Number,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600,
    },
  },
  { timestamps: true }
);

const OtpModel = mongoose.model("Otp", OtpSchema);
module.exports = OtpModel;
