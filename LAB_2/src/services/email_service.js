const nodemailer = require("nodemailer");

const sendInvitationEmail = async (recipientEmail, inviteLink) => {
    try {
        console.log('send email');
        let transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: "cuong2432004@gmail.com", // Thay bằng email của bạn
                pass: "qzqc vrwm czub unbr", // Thay bằng mật khẩu ứng dụng của bạn
            },
        });

        let mailOptions = {
            from: '"Your Website" <cuong2432004@gmail.com>',
            to: recipientEmail,
            subject: "You're Invited!",
            html: `
                <h2>Hello!</h2>
                <p>You have been invited to join our website. Click the button below to join:</p>
                <a href="${inviteLink}" style="display:inline-block; padding:10px 20px; color:white; background-color:blue; text-decoration:none; border-radius:5px;">
                    Join Now
                </a>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p>${inviteLink}</p>
            `,
        };

        let info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.response);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

module.exports = sendInvitationEmail;
