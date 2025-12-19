const express = require("express");
const orderController = require("../controllers/order");

const routes = express.Router();

routes.route('/')
    .post(orderController.createOrder)
    .get(orderController.getAllOrders)

routes.route('/:id')
    .patch(orderController.updateOrderStatus)
    .get(orderController.getAllOrders)

module.exports = routes;