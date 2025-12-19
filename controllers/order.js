const { ORDER_STATUS_ARRAY } = require("../constants/orderStatus");
const Order = require("../models/order");
const Product = require("../models/product");
const { sendOrderConfirmationEmail } = require("../utils/orderPlaceEmail");

const createOrder = async (req, res) => {
    try {
        const { customer, products, payment, notes } = req.body;

        // Validate required fields
        if (!customer || !products || products.length === 0) {
            return res.status(400).json({ success: false, message: "Customer and products are required" });
        }

        //check product stock
        for (const item of products) {
            const product = await Product.findById(item._id);

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product not found: ${item._id}`
                });
            }

            // Check stock
            if (product.stock < item.qty) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.name}`
                });
            }
        }

        // 2️⃣ Stock subtract (safe after validation)
        for (const item of products) {
            await Product.findByIdAndUpdate(
                item._id,
                { $inc: { stock: -item.qty } },
                { new: true }
            );
        }

        // Create new order instance
        const newOrder = new Order({
            customer,
            products,
            payment,
            notes
        });

        // Save order (pre-save hook will auto-generate orderNumber and total)
        const savedOrder = await newOrder.save();

        sendOrderConfirmationEmail(savedOrder.customer.email, savedOrder);

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            order: savedOrder
        });
    } catch (error) {
        console.error("Create Order Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while creating order",
            error: error.message
        });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !ORDER_STATUS_ARRAY.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid order status" });
        }

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false, message: "Order not found"
            });
        }

        order.status = status;
        await order.save();

        return res.status(200).json({
            success: true, message: "Order status updated successfully", order
        });
    } catch (error) {
        console.error("update Order Status Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while creating order",
            error: error.message
        });
    }
};

const getAllOrders = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, orderNumber, customerName } = req.query;

        // 1️⃣ If id is provided → return single order
        if (id) {
            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }
            return res.status(200).json({
                success: true,
                message: "Order fetched successfully",
                order
            });
        }

        // Build filter
        let filter = {};
        if (status) filter.status = { $regex: status, $options: "i" };

        if (orderNumber) filter.orderNumber = { $regex: orderNumber, $options: "i" };

        if (customerName) filter["customer.name"] = { $regex: customerName, $options: "i" };

        const orders = await Order.find(filter).sort({ createdAt: -1 }) // latest first

        const statsAgg = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    pendingOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                    },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                    },
                    totalRevenue: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$total", 0] }
                    }
                }
            }
        ]);

        const stats = statsAgg[0] || {
            totalOrders: 0,
            pendingOrders: 0,
            completedOrders: 0,
            totalRevenue: 0
        };

        return res.status(200).json({
            success: true,
            message: "Orders fetched successfully",
            stats,
            orders
        });

    } catch (error) {
        console.error("Get All Orders Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

module.exports = { createOrder, updateOrderStatus, getAllOrders };