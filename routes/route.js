const express = require("express");
const uploads = require("../middleware/upload");

const AuthController = require("../controllers/auth");
const PostingController = require("../controllers/post");
const VotingController = require("../controllers/voting");
const adminController = require("../controllers/adminProfile");
const technicianController = require("../controllers/technician");
const serviceController = require("../controllers/service");
const bookingController = require("../controllers/booking");
const favouriteController = require("../controllers/favourite");
const notificationController = require("../controllers/notification");
const ratingController = require("../controllers/rating");
const superAdminController = require("../controllers/superAdmin");
const categoryController = require("../controllers/category");
const paymentController = require("../controllers/payment");
const refundController = require("../controllers/refund");
const battleController = require("../controllers/battle");
const salonCategoryController = require("../controllers/salonCategory");
const userAuth = require("../middleware/Auth_MiddleWare");
const bodyParser = require("body-parser");
const IsSuperAdmin = require("../middleware/superAdmin");

const routes = express.Router();


// User auth
routes.post("/signUpOrLoginWithGoogle", AuthController.signUpOrLoginWithGoogle);
routes.post("/SignupWithEmailOrPhoneandPassword", AuthController.SignupWithEmailOrPhoneandPassword);
routes.post("/VerifyOtpAndCreate", AuthController.VerifyOtpAndCreate);
routes.post("/loginWitheEmailAndPassword", AuthController.loginWithEmailOrPhone);
routes.post("/updateUserById", uploads.userUpload.fields([{ name: "image", maxCount: 1 }]), AuthController.updateUserById);
routes.post("/setNewPasswordByUser", AuthController.setNewPasswordByUser)
routes.post("/forgetPasswordOtpUser", AuthController.forgetPasswordOtpUser)
routes.post("/deleteUser", AuthController.deleteUser)


//notification
routes.get("/getNotificationsByUserId", notificationController.getNotificationsByUserId);
routes.get("/getNotificationsBySalonId", notificationController.getNotificationsBySalonId);

//Favourites
routes.post("/addFavouriteSalon", favouriteController.addFavouriteSalon);
routes.get("/getUserById", favouriteController.getUserById);
routes.get("/getAllFavSalonByUserId", favouriteController.getAllFavSalonByUserId);

//Post and voting routes
routes.post("/CreatePost", uploads.postUpload.single("Post_Image"), PostingController.CreatePost);
routes.post("/LikePost", PostingController.LikePost);
routes.post("/CommentPost", PostingController.CommentPost);
routes.post("/SharePost", PostingController.SharePost);
routes.get("/getAllPost", PostingController.getAllPost);
routes.get("/getPostById", PostingController.getPostById);

//Voting
routes.post("/VotePost", VotingController.VotePost);
routes.get("/getPollPosts", VotingController.getPollPosts);

//Salon
routes.post("/signUpAdmin", adminController.signUpAdmin);
routes.post("/loginAdmin", adminController.loginAdmin);
routes.post("/salonSignUpOrLoginWithGoogle", adminController.salonSignUpOrLoginWithGoogle);
routes.post("/updateAdminProfile", uploads.adminUpload.fields([{ name: "image", maxCount: 4 }]), adminController.updateAdminProfile);
routes.get("/getSalonByServiceNameOrLocation", adminController.getSalons);
routes.post("/updateSalonIsActive", adminController.updateSalonIsActive);
routes.post("/addOrRemoveCategoryId", adminController.addOrRemoveCategoryId);
routes.post("/rescheduleByAdmin", adminController.rescheduleByAdmin);
routes.get("/getSalons", adminController.getSalons);
routes.get("/getAdminById", adminController.getAdminById);
routes.post("/forgetPasswordOtp", adminController.forgetPasswordOtp)
routes.post("/verifyOtp", adminController.verifyOtp)
routes.post("/setNewPassword", adminController.setNewPassword)
routes.post("/deleteSalon", adminController.deleteSalon)

//Salon Category
routes.post("/createSalonCategory", salonCategoryController.createSalonCategory);
routes.post("/updateSalonCategory", salonCategoryController.updateSalonCategory);
routes.post("/deleteSalonCategory", salonCategoryController.deleteSalonCategory);
routes.get("/getSalonCategory", salonCategoryController.getSalonCategory);

// Technician
routes.post("/createTechnician", uploads.technicianUpload.single("image"), technicianController.createTechnician);
routes.post("/updateTechnician", uploads.technicianUpload.single("image"), technicianController.updateTechnician);
routes.post("/updateTechnicianIsActive", technicianController.updateTechnicianIsActive);
routes.get("/getTechnicianById", technicianController.getTechnicianById);
routes.get("/getAllTechniciansBySalonId", technicianController.getAllTechniciansBySalonId);
routes.get("/getAvailableTechnician", technicianController.getAvailableTechnician);
routes.post("/deleteTechnician", technicianController.deleteTechnician)


// services
routes.post("/createService", uploads.serviceUpload.fields([{ name: "images", maxCount: 4 }]), serviceController.createService);
routes.post("/updateService", uploads.serviceUpload.fields([{ name: "images", maxCount: 4 }]), serviceController.updateService);
routes.post("/deleteService", serviceController.deleteService);
routes.get("/getServiceById", serviceController.getServiceById);
routes.get("/getAllServicesBySalonId", serviceController.getAllServicesBySalonId);

//Appointments
routes.post("/createBooking", bookingController.createBooking);
routes.post("/updateBooking", bookingController.updateBooking);
routes.post("/updateBookingStatus", bookingController.updateBookingStatus);
routes.post("/updateBookingStatusByUser", bookingController.updateBookingStatusByUser);
routes.post("/paymentWithWallet", bookingController.paymentWithWallet);
routes.get("/getBookingById", bookingController.getBookingById);
routes.get("/getBookingsByUserIdAndStatus", bookingController.getBookingsByUserIdAndStatus);
routes.get("/getBookingsBySalonIdAndStatus", bookingController.getBookingsBySalonIdAndStatus);
routes.get("/getBookingsBySalonId", bookingController.getBookingsBySalonId);
routes.get("/getSalonMonthlyRevenue", bookingController.getSalonMonthlyRevenue);
routes.get("/getWalletByUserId", userAuth, bookingController.getWalletByUserId);


//Rating
routes.post("/giveRatingToSalon", ratingController.giveRatingToSalon);
routes.get("/getRatingBySalonOrStar", ratingController.getRatingBySalonOrStar);
routes.get("/getRatingByRatingId", ratingController.getRatingByRatingId);

//superAdmin
// routes.post("/signUpSuperAdmin", superAdminController.signUpSuperAdmin);
// routes.post("/loginSuperAdmin", superAdminController.loginSuperAdmin);
// routes.route('/dashboard')
//     .get(IsSuperAdmin, superAdminController.getDashboatdStats)
// routes.route('/user')
//     .get(superAdminController.getAllUser)
// routes.route('/vendor')
//     .get(superAdminController.getAllVendor)
// routes.route('/vendor/:id')
//     .get(superAdminController.getSingleVendor)

//category
routes.post("/createCategory", categoryController.createCategory);
routes.post("/updateCategory", categoryController.updateCategory);
routes.post("/deleteCategory", categoryController.deleteCategory);
routes.get("/getAllCategories", categoryController.getAllCategories);

//Stripe Payment
routes.post("/createOrGetCustomer", userAuth, paymentController.createOrGetCustomer);
routes.post("/attachCard", userAuth, paymentController.attachCard);
routes.get("/getSavedCards", userAuth, paymentController.getSavedCards);
routes.post("/createPaymentIntent", userAuth, paymentController.createPaymentIntent);
routes.post("/refundPayment", paymentController.refundPayment);
// routes.post(
//   "/handleStripeWebhook",
//   bodyParser.raw({ type: "application/json" }),
//   paymentController.handleStripeWebhook
// );

//Refund
routes.post("/applyForRefund", refundController.applyForRefund);
routes.post("/updateRefundStatus", refundController.updateRefundStatus);
routes.get("/getRefundById", refundController.getRefundById);
routes.get("/getAllRefund", refundController.getAllRefund);


//Battle
routes.post("/createBattle", uploads.battleUpload.array("salonImage"), battleController.createBattle);
routes.post("/updateWholeBattle", uploads.battleUpload.single("salonImage"), battleController.updateWholeBattle);
routes.post("/addOrRemoveVotes", battleController.addOrRemoveVotes);
routes.post("/deleteBattle", battleController.deleteBattle);
routes.get("/getBattleById", battleController.getBattleById);
routes.get("/getAllBattle", battleController.getAllBattle);

module.exports = routes;
