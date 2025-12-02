const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "appointments",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "adminProfile",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "service",
      required: true,
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "technician",
      required: true,
    },
    time: { type: String, required: true },
    date: { type: String, required: true },

    amount: { type: Number, required: true }, // in cents
    currency: { type: String, default: "usd" },
    paymentIntentId: { type: String },
    paymentMethodId: { type: String },
    stripeCustomerId: { type: String },

    paymentStatus: {
      type: String,
      enum: ["pending", "succeeded", "failed", "refunded", "partial_refunded"],
      default: "pending",
    },
    paymentDate: { type: Date },

    refundId: { type: String },
    refundedAmount: { type: Number, default: 0 },
    refundReason: { type: String },

    receiptUrl: { type: String },
    last4: { type: String },
    brand: { type: String },
    country: { type: String },
  },
  { timestamps: true }
);

const paymentModel = mongoose.model("Payment", paymentSchema);
module.exports = paymentModel;
