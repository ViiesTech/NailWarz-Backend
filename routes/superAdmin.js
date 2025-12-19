const express = require("express");
const superAdminController = require("../controllers/superAdmin");
const IsSuperAdmin = require("../middleware/superAdmin");
const { productUpload } = require("../middleware/upload");

const routes = express.Router();

routes.post("/signUp", superAdminController.signUpSuperAdmin);
routes.post("/login", superAdminController.loginSuperAdmin);

routes.route('/dashboard')
    .get(IsSuperAdmin, superAdminController.getDashboatdStats)

routes.route('/user')
    .get(superAdminController.getAllUser)

routes.route('/vendor')
    .get(superAdminController.getAllVendor)

routes.route('/vendor/:id')
    .get(superAdminController.getSingleVendor)
    .delete(superAdminController.deleteVendor)

routes.route('/revenueShare')
    .post(superAdminController.upsertRevenueShare)

routes.route('/payout')
    .post(superAdminController.payVendor)

routes.route('/connectVendorAccount')
    .post(superAdminController.connectVendorAccount)

routes.route('/balance')
    .get(superAdminController.getStripeBalance)

routes.route('/product')
    .post(productUpload.array("images", 5), superAdminController.addProduct)
    .get(superAdminController.getAllProducts)

routes.route('/product/:id')
    .patch(productUpload.array("images", 5), superAdminController.updateProduct)
    .delete(superAdminController.deleteProduct)
    .get(superAdminController.getAllProducts)

module.exports = routes;
