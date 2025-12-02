const adminProfileModel = require("../models/adminProfile");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const notificationModel = require("../models/notification");
const bookingModel = require("../models/booking");
const authFunc = require("../controllers/auth");
const OtpModel = require("../models/otp");
const UserModel = require("../models/user");
const admin = require("../firebase/firebase");

async function salonSignUpOrLoginWithGoogle(req, res) {
  try {
    const { email,FCMToken } = req.body;

    const validate = await adminProfileModel.findOne({ email: email });

    if (validate) {
      if (validate.isDeleted == true) {
        return res.status(200).json({
          success: false,
          message: "Salon account is Deleted cannot Login",
        });
      }
      const token = jwt.sign(
        { _id: validate._id, email: validate.email },
        process.env.secretKey,
        { expiresIn: "5y" }
      );

      const salon = await adminProfileModel.findByIdAndUpdate({ _id: validate._id},{$set:{FCMToken:FCMToken }},{new:true}).select(
        "-password"
      );

      res.status(200).json({
        message: "Logged In successfully",
        success: true,
        data: salon,
        token,
      });
    } else {
      const password = process.env.socialAuthPassword;
      const hashPassword = await bcrypt.hash(password, 10);
      const signUp = new adminProfileModel({
        email: email,
        password: hashPassword,
        FCMToken:FCMToken
      });

      if (!signUp) {
        return res.status(200).json({
          message: "signUp failed",
          success: false,
        });
      } else {
        const result = await signUp.save();
        const data = await adminProfileModel.findById(result._id).select("-password");

        const token = jwt.sign(
          {
            _id: signUp._id,
            email: signUp.email,
          },
          process.env.secretKey,
          { expiresIn: "7d" }
        );
        res.status(200).json({
          message: "sucessfully SignUp ",
          data: data,
          token,
          success: true,
        });
      }
    }
  } catch (error) {
    console.error("signUpOrLoginWithGoogle failed:", error);
    return res.status(400).json({
      message: "Something went wrong",
      success: false,
      error: error.message,
    });
  }
}

async function signUpAdmin(req, res) {
  const { email ,FCMToken } = req.body;

  try {
    const signJwt = jwt.sign(req.body, process.env.secretKey, {
      expiresIn: "5y",
    });

    const otp = Math.floor(1000 + Math.random() * 9000);

    if (email) {
      const normalizedEmail = email.toLowerCase().trim(); 
      const userData = await adminProfileModel.findOne({ email: normalizedEmail });

      if (userData) {
        return res.status(200).json({
          message: "Salon already exists",
          success: false,
        });
      }
      const getOtp = await OtpModel.findOne({ EmailOrPhone: normalizedEmail });

      if (getOtp) {
        getOtp.Otp = otp;
        await getOtp.save();
      } else {
        await OtpModel.create({
          Otp: otp,
          EmailOrPhone: normalizedEmail,
        });
      }

      const OtpSentEmail = await authFunc.sendOtpOnMail(normalizedEmail, otp);
      if (OtpSentEmail) {
        return res.status(200).json({
          success: true,
          message: "Otp sent to your email",
          token: signJwt,
          otp: otp,
        });
      } else {
        res.status(200).json({
          success: false,
          message: "Otp not send",
        });
      }
    }
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(400).json({
      success: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
}


async function loginAdmin(req, res) {
  try {
    const { email, password ,FCMToken} = req.body;
    const normalizedEmail = email.toLowerCase().trim(); 

    const user = await adminProfileModel.findOne({email: normalizedEmail,});
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Salon does not exist",
      });
    }
    if (user.isDeleted == true) {
      return res.status(200).json({
        success: false,
        message: "Salon account is Deleted cannot Login",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(200).json({
        message: "Incorrect password",
        success: false,
      });
    }

    const payload = {
      _id: user._id,
      username: user.username,
      email: user.email,
    };

    const token = jwt.sign(payload, process.env.secretKey, {
      expiresIn: "5y",
    });

    const safeUser = await adminProfileModel
      .findByIdAndUpdate({_id:user._id},{$set:{FCMToken:FCMToken}},{new:true})
      .select("-password");

    res.status(200).json({
      message: "Login successful",
      success: true,
      data: safeUser,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(400).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
}

async function updateAdminProfile(req, res) {
  try {
    const { id, ...userData } = req.body;

    const files = req.files;
    if (req.body.latitude && req.body.longitude) {
      userData.location = {
        type: "Point",
        coordinates: [
          parseFloat(req.body.longitude),
          parseFloat(req.body.latitude),
        ],
        locationName: req.body.locationName,
      };
    }
    if (req.body.workingDays) {
      userData.workingDays = JSON.parse(req.body.workingDays);
    }
    const existingProfile = await adminProfileModel.findById(id);
    if (!existingProfile) {
      return res.status(200).json({
        message: "Admin profile not found",
        success: false,
      });
    }
    if (files?.image?.length) {
      const existingImages = existingProfile.image || [];
      const newImageNames = files?.image?.map((file) => file.filename) || [];

      const retainedImages = existingImages.filter((img) =>
        newImageNames.includes(img)
      );
      const addedImages = newImageNames.filter(
        (img) => !existingImages.includes(img)
      );

      userData.image = [...retainedImages, ...addedImages];
    } else {
      userData.image = existingProfile.image;
    }
    userData.isUpdated = true;

    if (userData.categoryId) {
      userData.categoryId = JSON.parse(userData.categoryId);
    }

    const updatedProfile = await adminProfileModel
      .findByIdAndUpdate(id, { $set: userData }, { new: true })
      .select("-password");

    if (!updatedProfile) {
      return res.status(200).json({
        message: "Admin profile is not updated",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Admin profile updated",
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    console.error("Update error:", error);
    return res.status(400).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
}

async function getSalons(req, res) {
  try {
    const {
      latitude,
      longitude,
      categoryId,
      locationName,
      salonName,
      bussinessAddress,
    } = req.query;

    const filter = {};

    if (salonName) {
      filter.salonName = { $regex: salonName, $options: "i" };
    }

    if (bussinessAddress) {
      filter.bussinessAddress = { $regex: bussinessAddress, $options: "i" };
    }
    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (locationName) {
      filter.$or = [
        { "location.locationName": { $regex: locationName, $options: "i" } },
        { locationName: { $regex: locationName, $options: "i" } },
      ];
    }

    if (longitude && latitude) {
      filter.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: 10000,
        },
      };
    }
    console.log("first", filter.location);
    const result = await adminProfileModel
      .find(filter)
      .select("-password")
      .sort({ avgRating: -1 })
      .populate("categoryId");

    if (result.length === 0) {
      return res.status(200).json({
        message: "Salon not found",
        success: false,
        data: [],
      });
    }

    return res.status(200).json({
      message: "Salon(s) found",
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in getSalonByServiceNameOrLocation:", error);
    return res.status(400).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
}

async function getAdminById(req, res) {
  try {
    const { salonId } = req.query;
    const salon = await adminProfileModel
      .findById({ _id: salonId })
      .select("-password")
      .populate("categoryId")
      .populate("salonCategoryId")

    if (!salon) {
      return res
        .status(200)
        .json({ success: false, message: "salon not found" });
    } else {
      return res.status(200).json({ success: true, data: salon });
    }
  } catch (error) {
    console.error("Get salon Error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
}

async function updateSalonIsActive(req, res) {
  try {
    const { workingDayId, isActive } = req.body;

    const day = await adminProfileModel.findOneAndUpdate(
      { "workingDays._id": workingDayId },
      { $set: { "workingDays.$.isActive": isActive } },
      { new: true }
    );

    if (!day) {
      return res
        .status(200)
        .json({ success: false, message: "workingDay not found" });
    } else {
      return res.status(200).json({
        success: true,
        message: "workingDay updated",
        data: day,
      });
    }
  } catch (error) {
    console.error("error:", error);
    res
      .status(400)
      .json({ success: false, message: "Server Error", error: error.message });
  }
}

async function addOrRemoveCategoryId(req, res) {
  try {
    const { salonId, categoryId } = req.body;

    if (!salonId || !categoryId) {
      return res.status(200).json({
        success: false,
        message: "adminId and categoryId are required",
      });
    }

    const admin = await adminProfileModel.findById(salonId);
    if (!admin) {
      return res.status(200).json({
        success: false,
        message: "Admin not found",
      });
    }

    const exists = admin.categoryId.some(
      (catId) => catId.toString() === categoryId.toString()
    );

    let updatedAdmin;

    if (exists) {
      // console.log("first", exists)
      updatedAdmin = await adminProfileModel.findByIdAndUpdate(
        salonId,
        { $pull: { categoryId: categoryId } },
        { new: true }
      );
    } else {
      updatedAdmin = await adminProfileModel.findByIdAndUpdate(
        salonId,
        { $addToSet: { categoryId: categoryId } },
        { new: true }
      );
    }

    await updatedAdmin.populate("categoryId");

    return res.status(200).json({
      success: true,
      message: exists ? "Category removed" : "Category added",
      data: updatedAdmin,
    });
  } catch (error) {
    console.error("Category toggle error:", error);
    return res.status(400).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

async function rescheduleByAdmin(req, res) {
  try {
    const { bookingId, userId, salonId } = req.body;

    const notification = new notificationModel({
      bookingId,
      userId,
      salonId,
      title: "Appointment Reschedule Request",
      message: `Kindly reschedule your appointment at your convenience.`,
      type: "Reschedule",
    });

    const result = await notification.save();
    const user = await UserModel.findById(userId)
    if(user.notify == true) sendNotificationToUser(result);
    if (!result) {
      return res
        .status(200)
        .json({ success: false, message: "Reschedule not applied." });
    }

    const booking = await bookingModel.findByIdAndUpdate(
      bookingId,
      { $set: { rescheduleStatus: "Pending" } },
      { new: true }
    );

    if (!booking) {
      return res.status(200).json({
        success: false,
        message: "Booking not found while applying reschedule.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reschedule applied successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Reschedule Error:", error);
    return res.status(400).json({
      success: false,
      message: "Server error while applying reschedule.",
      error: error.message,
    });
  }
}

async function forgetPasswordOtp(req, res) {
  try {
    const { email } = req.body;
    
    const exist = await adminProfileModel.findOne({ email: email });
    if (!exist)
      return res
        .status(200)
        .json({ success: false, message: "Salon not found" });
    if (exist.isDeleted == true)
      return res
        .status(200)
        .json({
          success: false,
          message: " Salon is already Deleted cannot forget password",
        });
    const otp = Math.floor(1000 + Math.random() * 9000);
    const genOtp = await OtpModel.findOne({ EmailOrPhone: email });
    if (genOtp) {
      genOtp.Otp = otp;
      await genOtp.save();
    } else {
      await OtpModel.create({
        Otp: otp,
        EmailOrPhone: email,
      });
    }

    const send = await authFunc.sendOtpOnMail(email, otp);
    if (send) {
      return res.status(200).json({
        success: true,
        message: "Forget password Otp Sent to your email",
        data: { email, otp },
      });
    } else {
      return res.status(200).json({ success: false, message: "Otp not sent" });
    }
  } catch (error) {
    console.error(" Error:", error);
    return res.status(400).json({
      success: false,
      message: "Server error while sending Otp",
      error: error.message,
    });
  }
}

async function verifyOtp(req, res) {
  try {
    const { email, Otp ,token } = req.body;
    if(email && Otp){
    const verify = await OtpModel.findOne({ EmailOrPhone: email, Otp: Otp });
    if (verify) {
      await OtpModel.findOneAndDelete({ EmailOrPhone: email });
      return res
        .status(200)
        .json({ success: true, message: "Otp verify Successfuly" });
    } else {
      return res.status(200).json({ success: false, message: "Invalid Otp" });
    }
  }
  if(token && Otp){
   const signUpToken = jwt.verify(token ,process.env.secretKey)
   const email = signUpToken.email.toLowerCase().trim();
   if(email){
    const verify = await OtpModel.findOne({EmailOrPhone:email ,Otp :Otp})
    if(verify){

      await OtpModel.findOneAndDelete({EmailOrPhone:email})
      const exist =await adminProfileModel.findOne({email:email})
      if(exist) return res.status(200).json({success:false ,message:"Salon already Created on this email"})
      
      const hashPassword= await bcrypt.hash(signUpToken.password,10)
      const salon = await adminProfileModel.create({
        email:email,
        password:hashPassword,
        FCMToken:signUpToken.FCMToken
      })
     if(salon){
      const Token =jwt.sign({_id:salon._id,email:salon.email},process.env.secretKey ,{expiresIn:"7d"})
      return res.status(200).json({success:true,message:"Successfully Salon account created",data:{email:email,_id:salon._id} ,token:Token})
     }else{
      return res.status(200).json({success:true,message:"Salon account not Created"})
     }
    }else {
      return res.status(200).json({ success: false, message: "Invalid Otp" });
    }
   }
  }
  } catch (error) {
    console.error(" Error:", error);
    return res.status(400).json({
      success: false,
      message: "Server error while veryfying Otp",
      error: error.message,
    });
  }
}

async function setNewPassword(req, res) {
  try {
    const { email, newPassword } = req.body;

    const isUser = await adminProfileModel.findOne({ email: email });
    if (isUser) {
      const hashPassword = await bcrypt.hash(newPassword, 10);
      const updated = await adminProfileModel.findOneAndUpdate(
        { email: email },
        { $set: { password: hashPassword } },
        { new: true }
      );
      if (!updated) {
        return res
          .status(200)
          .json({ success: false, message: "Password reset failed" });
      }
      const userData = await adminProfileModel
        .findById(updated._id)
        .select("-password");
      return res.status(200).json({
        success: true,
        message: "Password reset successfully",
        data: userData,
      });
    }
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(400).json({
      success: false,
      message: "Server error while setting password",
      error: error.message,
    });
  }
}

async function deleteSalon(req, res) {
  try {
    const { salonId } = req.body;
    const salon = await adminProfileModel.findByIdAndUpdate(
      { _id: salonId },
      { $set: { isDeleted: true, image: null, salonName: null } },
      { new: true }
    );
    if (salon) {
      return res
        .status(200)
        .json({ success: true, message: "Salon deleted Sucessfully" });
    }
  } catch (error) {
    console.error("deleting Salon Error:", error);
    return res.status(400).json({
      success: false,
      message: "Server error while deleting salon",
      error: error.message,
    });
  }
}

async function sendNotificationToUser(notificationData) {
  const { userId, title, message } = notificationData;

  const user = await UserModel.findById(userId);
  if (!user?.FCMToken) {
    console.log(" No FCM Token Found for User!");
    return;
  }

  const payload = {
    token: user.FCMToken,
    notification: {
      title,
      body: message,
    },
  };

  try {
    const response = await admin.messaging().send(payload);
    console.log(" Notification Sent!", response);
  } catch (error) {
    console.error(" Error while Sending Notification:", error);
  }
}

async function sendNotificationToSalon(notificationData) {
  const { salonId, title, message } = notificationData;

  const salon = await adminProfileModel.findById(salonId);
  if (!salon?.FCMToken) {
    console.log(" No FCM Token Found for Salon!");
    return;
  }

  const payload = {
    token: salon.FCMToken,
    notification: {
      title,
      body: message,
    },
  };

  try {
    const response = await admin.messaging().send(payload);
    console.log(" Notification Sent!", response);
  } catch (error) {
    console.error(" Error while Sending Notification:", error);
  }
}

module.exports = {
  signUpAdmin,
  loginAdmin,
  updateAdminProfile,
  getSalons,
  getAdminById,
  updateSalonIsActive,
  addOrRemoveCategoryId,
  rescheduleByAdmin,
  forgetPasswordOtp,
  verifyOtp,
  setNewPassword,
  sendNotificationToUser,
  deleteSalon,
  salonSignUpOrLoginWithGoogle,
  sendNotificationToSalon
};

// async function rescheduleByAdmin(req, res) {
//   try {
//     const { bookingId, userId, salonId } = req.body;
//     const notification = await notificationModel({
//       bookingId: bookingId,
//       userId: userId,
//       salonId: salonId,
//       type: "Reschedule",
//     });
//     const result= await notification.save()
//     if (!result) {
//       return res
//         .status(200)
//         .json({ success: false, message: "Reschedule not appllied" });
//     } else {
//       const booking = await bookingModel.findByIdAndUpdate(
//         { _id: bookingId },
//         { $set: { rescheduleStatus: "Pending" } }
//       );
//       if (booking) {
//         return res
//           .status(200)
//           .json({
//             success: true,
//             message: "Reshedulled applied ",
//             data: result,
//           });
//       }
//     }
//   } catch (error) {
//     console.error(" error:", error);
//     return res.status(400).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }
