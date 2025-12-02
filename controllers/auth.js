const UserModel = require("../models/user");
const JWT = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const OtpModel = require("../models/otp");
const bcrypt = require("bcryptjs");
const twilio = require("twilio");
require("dotenv").config();

async function signUpOrLoginWithGoogle(req, res) {
  try {
    const { email, username, FCMToken } = req.body;

    const validate = await UserModel.findOne({ email: email });

    if (validate) {
      if (validate.isDeleted == true) {
        return res.status(200).json({
          success: false,
          message: "User account is Deleted cannot Login",
        });
      }
      const token = JWT.sign(
        { _id: validate._id, email: validate.email },
        process.env.secretKey,
        { expiresIn: "5y" }
      );

      const safeUser = await UserModel.findByIdAndUpdate(
        { _id: validate._id },
        { $set: { FCMToken: FCMToken } },
        { new: true }
      ).select("-password");

      res.status(200).json({
        message: "Logged In successfully",
        success: true,
        data: safeUser,
        token,
      });
    } else {
      const password = process.env.socialAuthPassword;
      const hashPassword = await bcrypt.hash(password, 10);
      const signUp = new UserModel({
        email: email,
        password: hashPassword,
        username: username,
        FCMToken: FCMToken,
      });

      if (!signUp) {
        return res.status(200).json({
          message: "signUp failed",
          success: false,
        });
      } else {
        const result = await signUp.save();
        const data = await UserModel.findById(result._id).select("-password");

        const token = JWT.sign(
          {
            _id: signUp._id,
            email: signUp.email,
          },
          process.env.secretKey,
          { expiresIn: "1d" }
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

async function loginWithEmailOrPhone(req, res) {
  try {
    const { phone, email, password, FCMToken } = req.body;

    if (!email && !phone) {
      return res.status(200).json({
        success: false,
        message: "Phone number or email is required",
      });
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim(); 
      const user = await UserModel.findOne({ email: normalizedEmail });

      if (!user) {
        return res.status(200).json({
          success: false,
          message: "User not found ",
        });
      }

      if (user.isDeleted == true) {
        return res.status(200).json({
          success: false,
          message: "User account is Deleted cannot Login",
        });
      }

      const isPasswordMatch = await bcrypt.compare(password, user.password);

      if (!isPasswordMatch) {
        return res.status(200).json({
          success: false,
          message: "Incorrect password",
        });
      }

      const payload = {
        _id: user._id,
        username: user.username,
        email: user.email,
      };

      const token = JWT.sign(payload, process.env.secretKey, {
        expiresIn: "5y",
      });

      const safeUser = await UserModel.findByIdAndUpdate(
        { _id: user._id },
        { $set: { FCMToken: FCMToken } },
        { new: true }
      ).select("-password");

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: safeUser,
        token,
      });
    }

    if (phone) {
      const user = await UserModel.findOne({ phone: phone });

      if (!user) {
        return res.status(200).json({
          success: false,
          message: "User not found ",
        });
      }
      if (user.isDeleted == true) {
        return res.status(200).json({
          success: false,
          message: "User account is Deleted cannot Login",
        });
      }
      const safeUser = await UserModel.findByIdAndUpdate(
        { _id: user._id },
        { $set: { FCMToken: FCMToken } },
        { new: true }
      ).select("-password");

      const payload = {
        _id: user._id,
        phone: user.phone,
      };

      const token = JWT.sign(payload, process.env.secretKey, {
        expiresIn: "5y",
      });
      const otp = Math.floor(1000 + Math.random() * 9000);
      const existingOtp = await OtpModel.findOne({ EmailOrPhone: phone });

      if (existingOtp) {
        existingOtp.Otp = otp;
        await existingOtp.save();
      } else {
        await OtpModel.create({
          Otp: otp,
          EmailOrPhone: phone,
        });
      }

      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const message = await client.messages.create({
        body: `Your OTP is ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+${phone}`,
      });

      if (message?.sid) {
        return res.status(200).json({
          success: true,
          message: "OTP sent to your phone",
          phone: phone,
          otp,
          token: token,
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "Failed to send SMS OTP",
        });
      }
    }
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(400).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function SignupWithEmailOrPhoneandPassword(req, res) {
  const { email, phone, FCMToken } = req.body;

  try {
    const signJwt = JWT.sign(req.body, process.env.secretKey, {
      expiresIn: "5y",
    });

    const otp = Math.floor(1000 + Math.random() * 9000);

    if (email) {
      const normalizedEmail = email.toLowerCase().trim(); 
      const userData = await UserModel.findOne({ email: normalizedEmail });

      if (userData) {
        return res.status(200).json({
          message: "User already exists",
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

      const OtpSentEmail = await sendOtpOnMail(normalizedEmail, otp);
      if (OtpSentEmail.messageId) {
        res.send({
          success: true,
          message: "Otp sent to your email",
          token: signJwt,
          otp: otp,
        });
      } else {
        res.send({
          success: false,
          message: "Otp not send",
        });
      }
    }
    if (phone) {
      const userData = await UserModel.findOne({ phone: phone });

      if (userData) {
        return res.status(200).json({
          message: "User already exists",
          success: false,
        });
      }
      const existingOtp = await OtpModel.findOne({ EmailOrPhone: phone });

      if (existingOtp) {
        existingOtp.Otp = otp;
        await existingOtp.save();
      } else {
        await OtpModel.create({
          Otp: otp,
          EmailOrPhone: phone,
        });
      }

      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const message = await client.messages.create({
        body: `Your OTP is ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+${phone}`,
      });

      if (message?.sid) {
        return res.status(200).json({
          success: true,
          message: "OTP sent to your phone",
          token: signJwt,
          otp,
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "Failed to send SMS OTP",
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

async function VerifyOtpAndCreate(req, res) {
  try {
    const { token, otp, phone } = req.body;

    if (token && otp) {
      const getData = JWT.verify(token, process.env.secretKey);
      getData.email =getData.email.toLowerCase().trim();
      const identifier = getData.email || getData.phone;
      if (!identifier) {
        return res.status(200).json({
          success: false,
          message: "Email or Phone is missing in token",
        });
      }

      const VerifyOtpNow = await OtpModel.findOne({ EmailOrPhone: identifier });

      if (!VerifyOtpNow || VerifyOtpNow.Otp !== parseInt(otp)) {
        return res
          .status(200)
          .json({ success: false, message: "Invalid or expired OTP" });
      }
      if (getData.email) {
        const existingUser = await UserModel.findOne({ email: getData.email });

        if (existingUser) {
          return res.status(200).json({
            success: false,
            message: "A user with this email already exists.",
          });
        }
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(getData.password, salt);

        const createUser = new UserModel({
          email: getData.email,
          username: getData.username,
          password: hash,
          FCMToken: getData.FCMToken,
        });

        const result = await createUser.save();

        await OtpModel.deleteOne({ EmailOrPhone: identifier });

        const userById = await UserModel.findById(result._id).select(
          "-password"
        );
        const signJwt = JWT.sign(
          { _id: userById._id, email: userById.email },
          process.env.secretKey,
          {
            expiresIn: "5y",
          }
        );

        res.status(201).json({
          success: true,
          message: "User account created successfully via email",
          data: userById,
          token: signJwt,
        });
      }

      if (getData.phone) {
        const existingUser = await UserModel.findOne({ phone: getData.phone });

        if (existingUser) {
          return res.status(200).json({
            success: false,
            message: "A user with this phone number already exists.",
          });
        }

        const createUser = new UserModel({
          phone: getData.phone,
          username: getData.username,
          FCMToken: getData.FCMToken,
        });

        const result = await createUser.save();

        await OtpModel.deleteOne({ EmailOrPhone: identifier });

        const userById = await UserModel.findById(result._id).select(
          "-password"
        );
        const signJwt = JWT.sign(
          { _id: userById._id, phone: userById.phone },
          process.env.secretKey,
          {
            expiresIn: "5y",
          }
        );

        res.status(201).json({
          success: true,
          message: "User account created successfully via phone number",
          data: userById,
          token: signJwt,
        });
      }
    }

    if (phone && otp) {
      const existingUser = await UserModel.findOne({ phone: phone });

      if (existingUser) {
        if (existingUser.isDeleted == true) {
          return res.status(200).json({
            success: false,
            message: "User account is Deleted cannot Login",
          });
        }
        const VerifyOtpNow = await OtpModel.findOne({ EmailOrPhone: phone });

        if (!VerifyOtpNow || VerifyOtpNow.Otp !== parseInt(otp)) {
          return res
            .status(200)
            .json({ success: false, message: "Invalid or expired OTP" });
        } else {
          await OtpModel.deleteOne({ EmailOrPhone: phone });

          const payload = {
            _id: existingUser._id,
            phone: existingUser.phone,
          };
          const token = JWT.sign(payload, process.env.secretKey, {
            expiresIn: "5y",
          });

          res.status(200).json({
            success: true,
            message: "User login Successfully ",
            data: existingUser,
            token,
          });
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({ success: false, message: "Internal Server Error" });
  }
}

async function sendOtpOnMail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.appEmail,
        pass: process.env.appPassword,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.appEmail,
      to: email,
      subject: "Your OTP for Account Verification - Nail Warz",
      text: `Your One-Time Password (OTP) is ${otp}. Please use this code to verify your account. It will expire in 10 minutes.`,
      html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Welcome to Nail Warz!</h2>
                <p>Your One-Time Password (OTP) is:</p>
                <h1 style="color: #2e86de;">${otp}</h1>
                <p>Please enter this code in the app to verify your account.</p>
                <p><strong>Note:</strong> This OTP is valid for 10 minutes. Do not share it with anyone.</p>
                <br/>
                <p>Thank you,<br/>The Nail Warz Team</p>
              </div>
            `,
    });
    return info;
  } catch (error) {
    success: false, console.log("error", error);
    return error;
  }
}

async function updateUserById(req, res) {
  try {
    const { userId, ...updateFields } = req.body;

    let image = null;
    if (req.files && req.files.image && req.files.image[0]) {
      image = req.files.image[0].filename;
    }

    if (image) {
      updateFields.image = image;
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res
        .status(200)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(400).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

async function forgetPasswordOtpUser(req, res) {
  try {
    const { email } = req.body;
    const exist = await UserModel.findOne({email:email})
    if(!exist) return res.status(200).json({success:false,message:"User not found"})
    if(exist.isDeleted == true) return res.status(200).json({success:false,message:"User is already Deleted cannot forget password"})
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

    const send = await sendOtpOnMail(email, otp);
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


async function setNewPasswordByUser(req, res) {
  try {
    const { email, newPassword } = req.body;

    const isUser = await UserModel.findOne({ email: email });
    if (isUser) {
      const hashPassword = await bcrypt.hash(newPassword, 10);
      const updated = await UserModel.findOneAndUpdate(
        { email: email },
        { $set: { password: hashPassword } },
        { new: true }
      );
      if (!updated) {
        return res
          .status(200)
          .json({ success: false, message: "Password reset failed" });
      }
      const userData = await UserModel.findById(updated._id).select(
        "-password"
      );
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

async function deleteUser(req, res) {
  try {
    const { userId } = req.body;
    const salon = await UserModel.findByIdAndUpdate(
      { _id: userId },
      { $set: { isDeleted: true, image: null, username: null } },
      { new: true }
    );
    if (salon) {
      return res
        .status(200)
        .json({ success: true, message: "User deleted Sucessfully" });
    }
  } catch (error) {
    console.error("deleting User Error:", error);
    return res.status(400).json({
      success: false,
      message: "Server error while deleting User",
      error: error.message,
    });
  }
}

module.exports = {
  signUpOrLoginWithGoogle,
  loginWithEmailOrPhone,
  SignupWithEmailOrPhoneandPassword,
  VerifyOtpAndCreate,
  updateUserById,
  sendOtpOnMail,
  setNewPasswordByUser,
  deleteUser,
  forgetPasswordOtpUser
};
