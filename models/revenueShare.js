const mongoose = require("mongoose");

const RevenueShareSchema = new mongoose.Schema(
    {
        superAdmin: { type: Number, required: true, min: 0, max: 100 },
        vendor: { type: Number, required: true, min: 0, max: 100 },
    },
    { timestamps: true }
);

const RevenueShare = mongoose.model("RevenueShare", RevenueShareSchema);
module.exports = RevenueShare;