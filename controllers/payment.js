const Stripe = require("stripe");
const Booking = require("../models/booking");
const Payment = require("../models/payment");
const User = require("../models/user");
const refundModel = require("../models/refund");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const createOrGetCustomer = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user)
      return res
        .status(200)
        .json({ success: false, message: "User not found" });

    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        phone: user.phone || undefined,
      });
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    res.status(200).json({
      success: true,
      stripeCustomerId: user.stripeCustomerId,
    });
  } catch (error) {
    console.error("Create customer error:", error);
    res.status(400).json({ success: false, message: "Internal Server Error" });
  }
};


const attachCard = async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const user = await User.findById(req.user._id);

    if (!paymentMethodId) {
      return res.status(200).json({ success: false, message: "PaymentMethodId is required" });
    }

    if (!user?.stripeCustomerId) {
      return res.status(200).json({ success: false, message: "No Stripe customer found" });
    }

    // 1️⃣ Retrieve details of the new payment method
    const newPM = await stripe.paymentMethods.retrieve(paymentMethodId);
    const newCard = newPM.card;

    // 2️⃣ Get existing payment methods for this customer
    const existingMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    // 3️⃣ Check if a card with same last4, brand and expiry already exists
    const duplicate = existingMethods.data.find((pm) =>
      pm.card.last4 === newCard.last4 &&
      pm.card.brand === newCard.brand &&
      pm.card.exp_month === newCard.exp_month &&
      pm.card.exp_year === newCard.exp_year
    );

    if (duplicate) {
      return res.status(200).json({
        success: false,
        message: "This card is already saved",
        existingPaymentMethodId: duplicate.id,
      });
    }

    // 4️⃣ Attach card if not duplicate
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripeCustomerId,
    });

    // 5️⃣ Optionally set as default
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    res.status(200).json({ success: true, paymentMethodId });
  } catch (err) {
    console.error("Attach card error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

const getSavedCards = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user?.stripeCustomerId) {
      return res.status(200).json({ success: true, data: [] });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    const cards = paymentMethods.data
      .sort((a, b) => b.created - a.created)
      .map((pm) => ({
        paymentMethodId: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      }));

    res.status(200).json({ success: true, data: cards });
  } catch (error) {
    console.error("Error fetching saved cards:", error);
    res.status(400).json({ success: false, message: "Internal Server Error" });
  }
};

const createPaymentIntent = async (req, res) => {
  try {
    const { bookingId, amount, currency, saveCard, paymentMethodId } = req.body;

    if (!bookingId || !amount) {
      return res.status(200).json({ success: false, message: "BookingId and amount are required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(200).json({ success: false, message: "Booking not found" });
    }

    const user = await User.findById(req.user._id);
    if (!user?.stripeCustomerId) {
      return res.status(200).json({ success: false, message: "Stripe customer not found" });
    }

    // Create PaymentIntent
    const paymentIntentData = {
      amount: Math.round(amount * 100), // cents
      currency: currency || "usd",
      customer: user.stripeCustomerId,
      setup_future_usage: saveCard ? "off_session" : undefined,
      automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never"  // it is for local
     }
    };

    if (paymentMethodId) {
      paymentIntentData.payment_method = paymentMethodId;
      paymentIntentData.confirm = true;
    }

    let paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    // If requires authentication, wait until complete
    if (paymentIntent.status === "requires_action" || paymentIntent.status === "processing") {
      console.log("⏳ Waiting for payment to complete...");

      let attempts = 0;
      while (attempts < 6) { // check every 5s, max 30s
        await new Promise(resolve => setTimeout(resolve, 5000));
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);

        if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
          break;
        }
        attempts++;
      }

      // If after polling it’s still not succeeded or processing → cancel it
      if (paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
        await stripe.paymentIntents.cancel(paymentIntent.id);
        return res.status(200).json({
          success: false,
          message: "Payment cancelled due to no confirmation",
          status: paymentIntent.status
        });
      }
    }

    // Save result to DB if succeeded
    if (paymentIntent.status === "succeeded") {
      await Payment.create({
        bookingId,
        userId: booking.userId,
        salonId: booking.salonId,
        serviceId: booking.serviceId,
        technicianId: booking.technicianId,
        time: booking.time,
        date: booking.date,
        amount,
        currency: currency || "usd",
        paymentIntentId: paymentIntent.id,
        stripeCustomerId: user.stripeCustomerId,
        paymentMethodId: paymentMethodId || null,
        paymentStatus: "succeeded"
      });

      booking.status = "Accepted";
      await booking.save();

      return res.status(200).json({
        success: true,
        message: "Payment successful",
        clientSecret: paymentIntent.client_secret
      });
    }

    return res.status(200).json({
      success: false,
      message: `Payment status: ${paymentIntent.status}`,
      clientSecret: paymentIntent.client_secret
    });

  } catch (error) {
    console.error("Stripe createPaymentIntent error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res
      .status(200)
      .send({ success: false, message: "Invalid Stripe signature" });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const paymentMethod =
          pi.charges.data[0]?.payment_method_details?.card || {};
        const receiptUrl = pi.charges.data[0]?.receipt_url;

        const payment = await Payment.findOneAndUpdate(
          { paymentIntentId: pi.id },
          {
            paymentStatus: "succeeded",
            paymentDate: new Date(),
            receiptUrl,
            last4: paymentMethod.last4,
            brand: paymentMethod.brand,
            country: paymentMethod.country,
          },
          { new: true }
        );

        if (payment) {
          await Booking.findByIdAndUpdate(payment.bookingId, {
            status: "Accepted",
          });
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        await Payment.findOneAndUpdate(
          { paymentIntentId: pi.id },
          { paymentStatus: "failed" }
        );
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ success: true, received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(400).json({ success: false, message: "Internal Server Error" });
  }
};

const refundPayment = async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;

    if (!paymentId) {
      return res
        .status(200)
        .json({ success: false, message: "PaymentId is required" });
    }

    const payment = await Payment.findById({_id: paymentId });
    if (!payment || payment.paymentStatus !== "succeeded") {
      // console.log("payment",payment)
      return res
        .status(200)
        .json({ success: false, message: "Invalid or unpaid payment" });
    }

    if (amount && amount > payment.amount) {
      return res
        .status(200)
        .json({
          success: false,
          message: "Refund amount exceeds payment amount",
        });
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment.paymentIntentId,
      amount: amount || undefined,
      reason: reason || undefined,
    });

    payment.refundId = refund.id;
    payment.refundedAmount = amount || payment.amount;
    payment.refundReason = reason || null;
    payment.paymentStatus =
      amount && amount < payment.amount ? "partial_refunded" : "refunded";
    await payment.save();
   
   const refundStatus = await refundModel.findOneAndUpdate({paymentId:paymentId ,status:"Approved"}) 
    res.status(200).json({ success: true, refund });
  } catch (error) {
    console.error("Refund error:", error);
    res.status(400).json({ success: false, message: "Internal Server Error" });
  }
};



module.exports = {
  createOrGetCustomer,
  attachCard,
  getSavedCards,
  createPaymentIntent,
  handleStripeWebhook,
  refundPayment,
};


// const attachCard = async (req, res) => {
//   try {
//     const { paymentMethodId } = req.body;
//     const user = await User.findById(req.user._id);

//     if (!paymentMethodId) {
//       return res
//         .status(200)
//         .json({ success: false, message: "PaymentMethodId is required" });
//     }

//     if (!user?.stripeCustomerId) {
//       return res
//         .status(200)
//         .json({ success: false, message: "No Stripe customer found" });
//     }

//     // Attach payment method to customer
//     await stripe.paymentMethods.attach(paymentMethodId, {
//       customer: user.stripeCustomerId,
//     });

//     // Optional: Set as default
//     await stripe.customers.update(user.stripeCustomerId, {
//       invoice_settings: { default_payment_method: paymentMethodId },
//     });

//     res.status(200).json({ success: true, paymentMethodId });
//   } catch (err) {
//     console.error("Attach card error:", err);
//     res.status(400).json({ success: false, message: err.message });
//   }
// };
