const ORDER_STATUS = {
    PENDING: "pending",
    PROCESSING: "processing",
    SHIPPED: "shipped",
    DELIVERED: "delivered",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    RETURNED: "returned"
};

const ORDER_STATUS_ARRAY = Object.values(ORDER_STATUS);

module.exports = {
    ORDER_STATUS,
    ORDER_STATUS_ARRAY
};