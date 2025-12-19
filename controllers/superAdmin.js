const superAdminProfile = require("../models/superAdmin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const walletModel = require("../models/wallet");
const UserModel = require("../models/user");
const battleModel = require("../models/battle");
const AppointmentModel = require("../models/booking");
const adminProfileModel = require("../models/adminProfile");
const RevenueShare = require("../models/revenueShare");
const VendorPayout = require("../models/vendorPayout");
const Stripe = require("stripe");
const Product = require("../models/product");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function signUpSuperAdmin(req, res) {
  try {
    const { email, password } = req.body;
    const validate = await superAdminProfile.findOne({ email: email });
    if (validate) {
      return res
        .status(200)
        .json({ message: "email already exist", success: false });
    } else {
      const hashPassword = await bcrypt.hash(password, 10);
      const signUp = new superAdminProfile({
        email: email,
        password: hashPassword,
      });
      if (!signUp) {
        return res.status(200).json({
          message: "signUp failed",
          success: false,
        });
      } else {
        const result = await signUp.save();
        const data = await superAdminProfile
          .findById(result._id)
          .select("-password");

        const token = jwt.sign(
          {
            _id: signUp._id,
            email: signUp.email,
          },
          process.env.secretKey,
          { expiresIn: "5y" }
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
    console.error("signUp failed:", error);
    return res.status(400).json({
      message: "Something went wrong",
      success: false,
      error: error.message,
    });
  }
}

async function loginSuperAdmin(req, res) {
  try {
    const { email, password } = req.body;

    const user = await superAdminProfile.findOne({ email });
    if (!user) {
      return res.status(200).json({
        success: false,
        message: "User does not exist",
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
      email: user.email,
    };

    const token = jwt.sign(payload, process.env.secretKey, {
      expiresIn: "5y",
    });

    const safeUser = await superAdminProfile
      .findByIdAndUpdate({ _id: user._id }, { $set: { isVerified: true } }, { new: true })
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


async function upsertRevenueShare(req, res) {
  try {
    const { superAdmin, vendor } = req.body;

    if (superAdmin + vendor !== 100) {
      return res.status(400).json({
        success: false,
        message: "Super admin and vendor share must total 100%",
      });
    }

    const revenueShare = await RevenueShare.findOneAndUpdate(
      {}, // IMPORTANT: empty filter = single document
      {
        $set: {
          superAdmin,
          vendor,
        },
      },
      {
        new: true,
        upsert: true,      // create if not exists
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true, message: "Revenue share saved successfully", revenueShare,
    });
  } catch (error) {
    console.error("upsertRevenueShare error:", error);
    res.status(400).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
}

function calculateMonthlyChange(currentValue, lastMonthValue, label) {
  let percentChange = 0;
  let message = "";

  if (lastMonthValue === 0) {
    message = `No ${label.toLowerCase()} last month`;
  } else {
    percentChange = ((currentValue - lastMonthValue) / lastMonthValue) * 100;

    if (percentChange > 0) {
      message = `↑ +${percentChange.toFixed(1)}% from last month`;
    } else if (percentChange < 0) {
      message = `↓ ${percentChange.toFixed(1)}% compared to last month`;
    } else {
      message = `No change from last month`;
    }
  }

  return {
    current: Number(currentValue.toFixed(2)),
    lastMonth: Number(lastMonthValue.toFixed(2)),
    percentChange: Number(percentChange.toFixed(2)),
    message
  };
}

async function getVendorRevenueStats(salonId) {
  const startOfDay = moment().startOf("day");
  const endOfDay = moment().endOf("day");

  const startOfWeek = moment().startOf("week");
  const endOfWeek = moment().endOf("week");

  const startOfMonth = moment().startOf("month");
  const endOfMonth = moment().endOf("month");

  // ---- DATABASE AGGREGATION ----
  const appointments = await AppointmentModel.find({
    status: "Completed",
    salonId
  });

  let dailyRevenue = 0;
  let weeklyRevenue = 0;
  let monthlyRevenue = 0;

  appointments.forEach(app => {

    // Convert "17-12-2025" → moment object
    const [DD, MM, YYYY] = app.date.split("-");
    const appointmentDate = moment(`${YYYY}-${MM}-${DD}`, "YYYY-MM-DD");

    if (!appointmentDate.isValid()) return;

    // ---- Daily Revenue ----
    if (appointmentDate.isBetween(startOfDay, endOfDay, "day", "[]")) {
      dailyRevenue += app.totalAmount;
    }

    // ---- Weekly Revenue ----
    if (appointmentDate.isBetween(startOfWeek, endOfWeek, "day", "[]")) {
      weeklyRevenue += app.totalAmount;
    }

    // ---- Monthly Revenue ----
    if (appointmentDate.isBetween(startOfMonth, endOfMonth, "day", "[]")) {
      monthlyRevenue += app.totalAmount;
    }

  });

  return {
    dailyRevenue,
    weeklyRevenue,
    monthlyRevenue
  };
}

async function calculateRevenueSummary(totalRevenue, vendorId) {
  const revenueShare = await RevenueShare.findOne();

  const platformFeePercent = revenueShare?.superAdmin || 0;
  const vendorSharePercent = revenueShare?.vendor || 0;

  const vendorPayout = await VendorPayout.findOne({ vendor: vendorId });

  const totalPaidAmount = vendorPayout?.totalPaidAmount || 0;
  const payoutHistory = vendorPayout?.payoutHistory || [];

  const remainingRevenue = Math.max(totalRevenue - totalPaidAmount, 0);

  // 4️⃣ Calculate on remaining revenue
  const platformFeeAmount = (remainingRevenue * platformFeePercent) / 100;
  const vendorShareAmount = (remainingRevenue * vendorSharePercent) / 100;

  return {
    totalRevenue,

    totalPaidAmount,

    remainingRevenue,

    platformFee: {
      percent: platformFeePercent,
      amount: platformFeeAmount
    },

    vendorShare: {
      percent: vendorSharePercent,
      amount: vendorShareAmount
    },

    totalPayoutPending: vendorShareAmount,

    payoutHistory
  };
}


async function getDashboatdStats(req, res) {
  try {
    const now = moment();
    const startOfCurrentMonth = now.clone().startOf("month").toDate();
    const startOfLastMonth = now.clone().subtract(1, "month").startOf("month").toDate();
    const endOfLastMonth = now.clone().startOf("month").toDate();

    // 🚀 Updated: APPOINTMENT AGGREGATION instead of payment
    const summary = await AppointmentModel.aggregate([
      { $match: { status: "Completed" } }, // only completed appointments
      {
        $facet: {
          totalRevenue: [
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
          ],
          lastMonth: [
            { $match: { createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
          ],
          currentMonth: [
            { $match: { createdAt: { $gte: startOfCurrentMonth } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
          ]
        }
      }
    ]);

    const walletAgg = await walletModel.aggregate([{
      $group: { _id: null, totalBalance: { $sum: "$balance" } }
    }]);  // in cents

    const userSummary = await UserModel.aggregate([
      {
        $facet: {
          totalUsers: [{ $count: "count" }],
          lastMonth: [
            { $match: { createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth } } },
            { $count: "count" }
          ],
          currentMonth: [
            { $match: { createdAt: { $gte: startOfCurrentMonth } } },
            { $count: "count" }
          ]
        }
      }
    ]);

    const activeBattlesCount = await battleModel.countDocuments({ status: "Start" });

    // 📌 Extract revenue values from APPOINTMENTS
    const totalRevenue = summary[0].totalRevenue[0]?.total || 0;
    const currentRevenue = summary[0].currentMonth[0]?.total || 0;
    const lastMonthRevenue = summary[0].lastMonth[0]?.total || 0;

    const totalWalletBalance = (walletAgg[0]?.totalBalance || 0) / 100; // convert to $

    const revenueStats = calculateMonthlyChange(currentRevenue, lastMonthRevenue, label = 'Revenue');

    // User stats
    const totalUsers = userSummary[0].totalUsers[0]?.count || 0;
    const currentUsers = userSummary[0].currentMonth[0]?.count || 0;
    const lastMonthUsers = userSummary[0].lastMonth[0]?.count || 0;
    const userStats = calculateMonthlyChange(currentUsers, lastMonthUsers, label = 'User');

    return res.status(200).json({
      success: true,
      message: "Dashboard stats",
      stats: {
        totalRevenue, // total revenue using completed appointment  
        revenueChange: revenueStats,
        walletBalance: Number(totalWalletBalance.toFixed(2)), // total wallet balance using wallet collection 
        totalUsers, // total user using user collection
        userChange: userStats,
        activeBattles: activeBattlesCount // total battle that status is Start
      }
    });

  } catch (error) {
    console.error("getDashboatdStats error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getAllUser(req, res) {
  try {
    const { search } = req.query;

    // --- Filtered users list ---
    let filter = {};
    if (search) {
      const regex = new RegExp(search, "i"); // case-insensitive
      filter = {
        $or: [
          { username: regex },
          { email: regex }
        ]
      };
    }

    const users = await UserModel.find(filter).select("-password").populate([
      { path: 'favourite', select: 'salonName phoneNumber description _id image' }
    ]);

    // --- Stats calculation (always for all users/appointments) ---
    const allAppointmentAgg = await AppointmentModel.aggregate([
      { $group: { _id: "$userId", totalAppointments: { $sum: 1 } } }
    ]);
    const allAppointmentMap = {};
    allAppointmentAgg.forEach(a => {
      allAppointmentMap[a._id.toString()] = a.totalAppointments;
    });

    const completedAgg = await AppointmentModel.aggregate([
      { $match: { status: "Completed" } },
      { $group: { _id: "$userId", totalSpend: { $sum: "$totalAmount" } } }
    ]);
    const completedMap = {};
    completedAgg.forEach(c => {
      completedMap[c._id.toString()] = c.totalSpend;
    });

    // --- Prepare filtered users response ---
    const usersWithStats = users.map(user => {
      const userId = user._id.toString();
      return {
        ...user.toObject(),
        orderCount: allAppointmentMap[userId] || 0,
        totalSpend: completedMap[userId] || 0
      };
    });

    // --- Stats for all users (ignore search) ---
    const allUsers = await UserModel.find(); // all users, no filter
    let totalOrders = 0;
    let totalRevenue = 0;
    allUsers.forEach(user => {
      const userId = user._id.toString();
      totalOrders += allAppointmentMap[userId] || 0;
      totalRevenue += completedMap[userId] || 0;
    });

    const stats = {
      totalUser: allUsers.length,
      activeUser: allUsers.filter(u => !u.isDeleted).length,
      totalOrders,
      totalRevenue
    };

    // --- Add message based on search result ---
    const message = usersWithStats.length > 0
      ? (search ? `Users matching '${search}' fetched` : "All users fetched")
      : (search ? `No user found with '${search}'` : "No users found");

    return res.status(200).json({
      success: true, message, stats, users: usersWithStats
    });

  } catch (error) {
    console.error("getAllUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}
async function getAllVendor(req, res) {
  try {
    const { search } = req.query;

    // --- Filtered vendors for search ---
    let filter = {};
    if (search) {
      const regex = new RegExp(search, "i"); // case-insensitive
      filter = {
        $or: [
          { salonName: regex },
          { email: regex }
        ]
      };
    }

    const vendors = await adminProfileModel.find(filter).populate([
      { path: 'categoryId' },
      { path: 'salonCategoryId' }
    ]);

    // --- Aggregate completed appointments for all vendors ---
    const completedAppointmentsAgg = await AppointmentModel.aggregate([
      { $match: { status: "Completed" } },
      {
        $group: {
          _id: "$salonId",
          totalRevenue: { $sum: "$totalAmount" }
        }
      }
    ]);

    const revenueMap = {};
    completedAppointmentsAgg.forEach(a => {
      revenueMap[a._id.toString()] = a.totalRevenue;
    });

    // --- Attach totalRevenue to filtered vendors ---
    const vendorsWithRevenue = vendors.map(vendor => {
      const vendorId = vendor._id.toString();
      return {
        ...vendor.toObject(),
        totalRevenue: revenueMap[vendorId] || 0
      };
    });

    // --- Stats for all vendors (ignore search) ---
    const allVendors = await adminProfileModel.find(); // all vendors
    const statsTotalRevenue = allVendors.reduce((acc, v) => {
      const vId = v._id.toString();
      return acc + (revenueMap[vId] || 0);
    }, 0);

    const stats = {
      totalVendor: allVendors.length,
      activeVendor: allVendors.filter(v => !v.isDeleted).length,
      totalRevenue: statsTotalRevenue
    };

    // --- Response message ---
    const message = vendorsWithRevenue.length > 0
      ? (search ? `Vendors matching '${search}' fetched` : "All vendors fetched")
      : (search ? `No vendors found with '${search}'` : "No vendors found");

    return res.status(200).json({
      success: true,
      message,
      stats,
      vendors: vendorsWithRevenue
    });

  } catch (error) {
    console.error("getAllVendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getSingleVendor(req, res) {
  try {
    const { id } = req.params;

    // 1️⃣ Fetch the vendor by ID
    const vendor = await adminProfileModel.findById(id).populate([
      { path: 'categoryId' },
      { path: 'salonCategoryId' }
    ]);

    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });


    // 2️⃣ Aggregate completed appointments for this vendor
    const completedAppointmentsAgg = await AppointmentModel.aggregate([
      { $match: { status: "Completed", salonId: vendor._id } },
      { $group: { _id: "$salonId", totalRevenue: { $sum: "$totalAmount" } } }
    ]);

    const totalRevenue = completedAppointmentsAgg[0]?.totalRevenue || 0;

    const revenueStats = await getVendorRevenueStats(id)
    const revenueSummary = await calculateRevenueSummary(totalRevenue, id);

    // 3️⃣ Return vendor with totalRevenue
    return res.status(200).json({
      success: true,
      message: "Vendor fetched successfully",
      revenueStats,
      revenueSummary,
      vendor: {
        ...vendor.toObject(),
        totalRevenue
      }
    });

  } catch (error) {
    console.error("getSingleVendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function payVendor(req, res) {
  try {
    const { vendor, amount, remarks } = req.body;

    // 1️⃣ Basic validation
    if (!vendor || !amount) {
      return res.status(400).json({
        success: false, message: "vendorId and amount are required"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false, message: "Amount must be greater than zero"
      });
    }

    // 2️⃣ Check vendor exists
    const vendorExist = await adminProfileModel.findById(vendor);
    if (!vendorExist) {
      return res.status(404).json({
        success: false, message: "Vendor not found"
      });
    }

    if (!vendorExist.stripeAccountId) {
      return res.status(404).json({
        success: false, message: "Vendor Stripe account not connected"
      });
    }

    const vendorStripeId = vendorExist.stripeAccountId;

    const vendorStripeAccount = await stripe.accounts.retrieve(vendorStripeId);
    if (!vendorStripeAccount.charges_enabled) {
      return res.status(400).json({
        success: false,
        message: "Vendor has not completed Stripe onboarding yet. Cannot pay."
      });
    }

    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // amount in cents
      currency: "usd",                  // adjust currency if needed
      destination: vendorStripeId,
    });

    // 3️⃣ Generate transactionId
    const transactionId = transfer.id;

    // 4️⃣ Update payout record (UPSERT)
    let payout = await VendorPayout.findOne({ vendor });

    // 3️⃣ If not exists → create
    if (!payout) {
      payout = await VendorPayout.create({
        vendor,
        totalPaidAmount: amount,
        payoutHistory: [
          {
            amount,
            transactionId,
            remarks,
            payoutMethod: "BankTransfer",
            status: "Paid"
          }
        ]
      });
    }
    // 4️⃣ If exists → update
    else {
      payout.totalPaidAmount += amount;
      payout.payoutHistory.push({
        amount,
        transactionId,
        remarks,
        payoutMethod: "BankTransfer",
        status: "Paid"
      });

      await payout.save();
    }

    return res.status(200).json({
      success: true,
      message: "Vendor payout successful",
      payout: {
        vendor,
        totalPaidAmount: payout.totalPaidAmount,
        lastTransaction: payout.payoutHistory[payout.payoutHistory.length - 1]
      }
    });

  } catch (error) {
    console.error("payVendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function deleteVendor(req, res) {
  try {
    const { id } = req.params;

    // 1️⃣ Check vendor exists
    const vendor = await adminProfileModel.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false, message: "Vendor not found"
      });
    }

    // 2️⃣ If already deleted
    if (vendor.isDeleted) {
      return res.status(400).json({
        success: false, message: "Vendor is already deleted"
      });
    }

    // 3️⃣ Soft delete
    vendor.isDeleted = true;
    await vendor.save();

    return res.status(200).json({
      success: true,
      message: "Vendor deleted successfully"
    });

  } catch (error) {
    console.error("deleteVendor error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}


async function connectVendorAccount(req, res) {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ success: false, message: "Vendor email is required" });

    const vendor = await adminProfileModel.findOne({ email });

    if (!vendor) return res.status(400).json({ success: false, message: "Vendor not found" });

    // 2️⃣ If already connected, return existing onboarding link
    if (vendor.stripeAccountId) {
      const accountLink = await stripe.accountLinks.create({
        account: vendor.stripeAccountId,
        refresh_url: "https://nail-warz.vercel.app/auth/login",
        return_url: "https://nail-warz.vercel.app/dashboard",
        type: "account_onboarding",
      });

      return res.json({
        success: true,
        message: "Vendor already connected",
        vendorStripeAccountId: vendor.stripeAccountId,
        onboardingUrl: accountLink.url,
      });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email,
      capabilities: { transfers: { requested: true } },
    });

    vendor.stripeAccountId = account.id;
    await vendor.save();

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: "https://nail-warz.vercel.app/auth/login",
      return_url: "https://nail-warz.vercel.app/dashboard",
      type: "account_onboarding",
    });

    return res.json({
      vendorStripeAccountId: account.id,
      onboardingUrl: accountLink.url,
    });

  } catch (error) {
    console.error("connectVendorAccount error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function getStripeBalance(req, res) {
  try {
    const balance = await stripe.balance.retrieve();

    // Available aur pending amounts in USD (convert from cents)
    const available = balance.available.map((b) => ({
      amount: b.amount / 100,
      currency: b.currency,
      source_types: b.source_types,
    }));

    const pending = balance.pending.map((b) => ({
      amount: b.amount / 100,
      currency: b.currency,
      source_types: b.source_types,
    }));

    return res.status(200).json({
      success: true,
      balance: {
        available,
        pending,
        livemode: balance.livemode,
      },
    });
  } catch (error) {
    console.error("getStripeBalance error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function addProduct(req, res) {
  try {
    let { name, sku, category, price, stock, unitType, isActive } = req.body;

    price = Number(price);
    stock = Number(stock);
    isActive = isActive === "false" ? false : true;

    if (!name) return res.status(400).json({ success: false, message: "Name is required" });
    if (!sku) return res.status(400).json({ success: false, message: "sku is required" });
    if (!price) return res.status(400).json({ success: false, message: "price is required" });
    if (!unitType) return res.status(400).json({ success: false, message: "unitType is required" });

    if (typeof category === "string") {
      try {
        category = JSON.parse(category);
      } catch (err) {
        return res.status(400).json({ success: false, message: "Category must be a valid JSON array" });
      }
    }

    if (!category || !Array.isArray(category) || category.length === 0) {
      return res.status(400).json({ success: false, message: "At least one category is required" });
    }

    const existingProduct = await Product.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") }
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false, message: "Product with this name already exists"
      });
    }

    const images = req.files
      ? req.files.map(file => `${file.filename}`)
      : [];

    const product = new Product({
      name, sku, category: category, price, stock: stock || 0,
      unitType, isActive: isActive, images
    });

    await product.save(); // pre-hook will update status automatically

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product
    });

  } catch (error) {
    console.error("addProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    let { name, sku, category, price, stock, unitType, isActive } = req.body;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    const updateData = {};

    if (price !== undefined) price = Number(price);
    if (stock !== undefined) stock = Number(stock);
    if (typeof isActive !== "undefined") isActive = isActive === "false" ? false : true;

    // 🔹 Category parse from string if needed
    if (category !== undefined) {
      if (typeof category === "string") {
        try {
          category = JSON.parse(category);
        } catch (err) {
          return res.status(400).json({ success: false, message: "Category must be a valid JSON array" });
        }
      }
      if (!Array.isArray(category) || category.length === 0) {
        return res.status(400).json({ success: false, message: "At least one category is required" });
      }
    }

    // 🔹 Assign updated fields
    if (name !== undefined) updateData.name = name;
    if (sku !== undefined) updateData.sku = sku;
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = price;
    if (stock !== undefined) updateData.stock = stock;
    if (unitType !== undefined) updateData.unitType = unitType;
    if (typeof isActive !== "undefined") updateData.isActive = isActive;

    // 🔹 Handle images (replace old with new if provided)
    if (req.files && req.files.length > 0) {
      const images = req.files.map(file => `${file.filename}`);
      updateData.images = images; // replace old array
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No fields provided to update" });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });

  } catch (error) {
    console.error("updateProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or already deleted"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      product
    });

  } catch (error) {
    console.error("softDeleteProduct error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function getAllProducts(req, res) {
  try {
    const { id } = req.params;
    const { search , status } = req.query;

    if (id) {
      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found"
        });
      }

      return res.status(200).json({
        success: true,
        product
      });
    }

    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } }, // case-insensitive
        { sku: { $regex: search, $options: "i" } }
      ];
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    // 1️⃣ Get all products
    const products = await Product.find(filter).sort({ createdAt: -1 });

    const summary = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          inStock: {
            $sum: {
              $cond: [{ $eq: ["$status", "inStock"] }, 1, 0]
            }
          },
          lowStock: {
            $sum: {
              $cond: [{ $eq: ["$status", "lowStock"] }, 1, 0]
            }
          },
          outOfStock: {
            $sum: {
              $cond: [{ $eq: ["$status", "outOfStock"] }, 1, 0]
            }
          }
        }
      }
    ]);

    const counts = summary[0] || {
      totalProducts: 0,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0
    };

    return res.status(200).json({
      success: true,
      counts,
      products
    });

  } catch (error) {
    console.error("getAllProducts error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}



module.exports = {
  signUpSuperAdmin, loginSuperAdmin, getDashboatdStats, getAllUser, getAllVendor, getSingleVendor, upsertRevenueShare,
  payVendor, deleteVendor, connectVendorAccount, getStripeBalance, addProduct, updateProduct, deleteProduct, getAllProducts
}
