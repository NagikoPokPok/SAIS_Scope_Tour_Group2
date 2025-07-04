const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "cuong2432004@gmail.com",
        pass: "qzqc vrwm czub unbr",
    },
});

const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

const sendOTPEmail = async (recipientEmail, otp) => {
    try {
        let mailOptions = {
            from: '"Your App" <your-email@gmail.com>',
            to: recipientEmail,
            subject: "Your OTP Code",
            html: `<p>Your OTP code is: <b>${otp}</b></p>`,
        };

        let info = await transporter.sendMail(mailOptions);
        console.log("📩 OTP Email sent: " + info.response);
    } catch (error) {
        console.error("❌ Error sending OTP email:", error);
    }
};

module.exports = { sendOTPEmail, generateOTP };
