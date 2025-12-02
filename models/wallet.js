const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    unique: true,
  },
  balance: { type: Number, default: 0 },
  transactions: [
    {
      type: {
        type: String,
        enum: ["credit", "debit", "refund", "booking"],
      },
      amount: Number,
      description: String,
      bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "appointments",
      },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

const walletModel = mongoose.model("Wallet", walletSchema);

module.exports = walletModel;
