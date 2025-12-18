const mongoose = require("mongoose");

const payoutHistorySchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true
    },

    payoutDate: {
      type: Date,
      default: Date.now
    },

    payoutMethod: {
      type: String,
      enum: ["BankTransfer", "Cash", "Wallet", "Stripe", "Other"],
      default: "BankTransfer"
    },

    transactionId: {
      type: String
    },

    remarks: {
      type: String
    },

    status: {
      type: String,
      enum: ["Paid", "Reversed"],
      default: "Paid"
    }
  },
  { _id: false }
);

const vendorPayoutSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "adminProfile",
      unique: true,       // 🔥 ONE document per vendor
      required: true
    },

    totalPaidAmount: {
      type: Number,
      default: 0 
    },

    payoutHistory: [payoutHistorySchema]
  },
  { timestamps: true }
);

const VendorPayout = mongoose.model("VendorPayout", vendorPayoutSchema);

module.exports = VendorPayout;
