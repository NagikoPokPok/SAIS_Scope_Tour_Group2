const UserService = require("../services/user_service");
const sendInvitationEmail = require("../services/email_service");
const crypto = require("crypto"); // 🔥 Thêm để tạo token bảo mật

class InvitationController {
    static async sendInvitation(req, res) {
        console.log("📩 API /api/sendInvitation được gọi");
        console.log(req.body);
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false , message: "Email is required" });
        }

        try {
            // 📌 Kiểm tra xem email có tồn tại trong hệ thống không
            const user = await UserService.getUserByEmail(email);
            
            // 📌 Tạo link mời
            var inviteLink = `http://localhost:5500/src/views/login.html`;
            

            if (user) {
                // inviteLink = `http://localhost:5500/join?email=${encodeURIComponent(email)}`;
                // 🔥 Tạo token bảo mật
                const token = crypto.randomBytes(32).toString("hex");

                // 🔥 Lưu token vào database (có thể sử dụng Redis hoặc MySQL)
                await UserService.saveInviteToken(email, token);

                // 📌 Link mời với token
                inviteLink = `http://localhost:5500/join?email=${encodeURIComponent(email)}&token=${token}`;
            
            }
            
            console.log("Invite Link:", inviteLink);

            // 📩 Gửi email
            await sendInvitationEmail(email, inviteLink);
            res.json({ success: true, message: "Invitation sent successfully" });
        } catch (error) {
            console.error("Error sending invitation:", error);
            res.status(500).json({ success: false , message: "Failed to send invitation" });
        }
    }
}

module.exports = InvitationController;
