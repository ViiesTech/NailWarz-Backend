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

const sendContentSelectEmail = async (content) => {
    try {
        // Load HTML template
        const templatePath = path.join(__dirname, "../template/contentSelect.html");
        let html = fs.readFileSync(templatePath, "utf-8");

        // Replace placeholders
        html = html.replace(/{{name}}/g, content.name)

        // Send email
        await transporter.sendMail({
            from: `"NailWarz" <${process.env.appEmail}>`,
            to: content.email,
            subject: `Content Selected`,
            html
        });

        console.log(`Content Selected email sent to ${content.email}`);
    } catch (error) {
        console.error("Error sending Content Selected email:", error);
    }
};

module.exports = { sendContentSelectEmail };
