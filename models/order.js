const mongoose = require("mongoose");
const moment = require("moment");
const { ORDER_STATUS_ARRAY, ORDER_STATUS } = require("../constants/orderStatus");

// Define schema for a single product in the order
const orderProductSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    images: { type: [String], default: [] },
    qty: { type: Number, required: true, min: 1 }
});

// Define schema for customer details
const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: {
        street: { type: String, required: true },
        city: { type: String },
        state: { type: String },
        postalCode: { type: String },
        country: { type: String }
    }
});

// Main order schema
const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            unique: true
        },
        customer: { type: customerSchema, required: true },
        products: { type: [orderProductSchema], required: true },
        total: { type: Number, required: true, min: 0 },
        status: {
            type: String,
            enum: ORDER_STATUS_ARRAY,
            default: ORDER_STATUS.PENDING
        },
        payment: {
            stripePaymentId: { type: String },
            amount: { type: Number },
            currency: { type: String },
            status: { type: String },
            paymentMethod: { type: String }
        },
        deliveryDate: {
            type: Date,
            default: function () {
                return moment().add(7, "days").toDate();
            }
        },
        notes: { type: String }
    },
    { timestamps: true }
);

// Auto-calculate total and generate orderNumber before saving
orderSchema.pre("validate", function (next) {

    // 🚫 Run only when creating new order
    if (!this.isNew) return next();

    // ✅ Calculate total
    if (this.products && this.products.length > 0) {
        this.total = this.products.reduce(
            (sum, p) => sum + (p.price * p.qty),
            0
        );
    }

    // ✅ Generate orderNumber once
    if (!this.orderNumber) {
        const idPart = this._id.toString().substring(0, 6).toUpperCase();
        const randomPart = Math.floor(100 + Math.random() * 900);
        this.orderNumber = `NW-${moment().format("YYYY")}-${idPart}${randomPart}`;
    }

    next();
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
