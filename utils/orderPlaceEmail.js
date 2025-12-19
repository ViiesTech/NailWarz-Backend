const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const moment = require('moment')

// Create transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.appEmail,
        pass: process.env.appPassword,
    }
});

/**
 * Send order confirmation email using direct string replacement
 * @param {string} to - recipient email
 * @param {object} order - order object
 */
const sendOrderConfirmationEmail = async (to, order) => {
    try {
        // Load HTML template
        const templatePath = path.join(__dirname, "../template/orderPlace.html");
        let html = fs.readFileSync(templatePath, "utf-8");

        // Replace placeholders
        html = html.replace(/{{customerName}}/g, order.customer.name)
            .replace(/{{orderNumber}}/g, order.orderNumber)
            .replace(/{{orderDate}}/g, moment(order.createdAt).format("DD-MMM-YYYY hh:mm:ss A"))
            .replace(/{{total}}/g, order.total.toFixed(2))
            .replace(/{{customerStreet}}/g, order.customer.address.street || "")
            .replace(/{{customerCity}}/g, order.customer.address.city || "")
            .replace(/{{customerState}}/g, order.customer.address.state || "")
            .replace(/{{customerPostalCode}}/g, order.customer.address.postalCode || "")
            .replace(/{{customerCountry}}/g, order.customer.address.country || "")
            .replace(/{{customerPhone}}/g, order.customer.phone)
            .replace(/{{paymentAmount}}/g, order.payment.amount.toFixed(2))
            .replace(/{{paymentMethod}}/g, order.payment.paymentMethod)
            .replace(/{{paymentStatus}}/g, order.payment.status)
            .replace(/{{websiteURL}}/g, process.env.WEBSITE_URL || "https://yourwebsite.com");

        const productRows = order.products.map(p => `
  <tr>
    <td>${p.name}</td>
    <td>${p.sku}</td>
    <td>${p.qty}</td>
    <td>$${p.price.toFixed(2)}</td>
  </tr>
`).join("");

        html = html.replace(/{{productRows}}/g, productRows);

        // Send email
        await transporter.sendMail({
            from: `"NailWarz" <${process.env.appEmail}>`,
            to,
            subject: `Order Confirmation - ${order.orderNumber}`,
            html
        });

        console.log(`Order confirmation email sent to ${to}`);
    } catch (error) {
        console.error("Error sending order confirmation email:", error);
    }
};

module.exports = { sendOrderConfirmationEmail };
