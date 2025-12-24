const mongoose = require("mongoose");
const { CONTENT_STATUS_ARRAY, CONTENT_STATUS } = require("../constants/contentStatus");

const contentschema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, },
    address: { type: String, required: true },
    images: { type: [String], default: [] },
    social: {
        name: {
            type: String,
            required: [true, "Social name is required"]
        },
        platform: {
            type: String,
            required: [true, "Social platform is required"],
        }
    },
    status: {
        type: String,
        enum: CONTENT_STATUS_ARRAY,
        default: CONTENT_STATUS.PENDING
    }
}, { timestamps: true })

const Content = mongoose.model("Content", contentschema);
module.exports = Content;