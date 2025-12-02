const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: String,
    email: {
      type: String,
      lowercase: true,
    },
    phone: {
      type: Number,
    },
    password: {
      type: String,
    },
    image: {
      type: String,
    },
    stripeCustomerId: {
      type: String
    },
    favourite: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "adminProfile",
      },
    ],
    FCMToken:{
      type:String
    },
    notify:{
      type:Boolean,
      default:true
    },
    isDeleted:{
      type:Boolean,
      default:false
    }
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", UserSchema);
module.exports = UserModel;
