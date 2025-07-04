const User = require("../models/User");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

class UserService {
    // Lấy thông tin người dùng bằng Email
    static async getUserByEmail(email) {
        try {
            return await User.findOne({ where: { email } });
        } catch (error) {
            console.error("Lỗi khi lấy người dùng theo email:", error);
            throw error;
        }
    }

    // Lấy thông tin người dùng bằng ID
    static async getUserById(userId) {
        try {
            return await User.findByPk(userId);
        } catch (error) {
            console.error("Lỗi khi lấy người dùng theo ID:", error);
            throw error;
        }
    }

    // Cập nhật mật khẩu cho người dùng
    static async updatePassword(userId, newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            const [updated] = await User.update({ password: hashedPassword }, { where: { user_id: userId } });
            return updated > 0; // Trả về true nếu cập nhật thành công
        } catch (error) {
            console.error("Lỗi khi cập nhật mật khẩu:", error);
            throw error;
        }
    }

    // Tạo người dùng mới
    static async createUser(email, name, password) {
        try {
            password = await bcrypt.hash(password, 10); // Mã hóa mật khẩu
            return await User.create({email, name, password});
        } catch (error) {
            console.error("Lỗi khi tạo người dùng:", error);
            throw error;
        }
    }

    // Cập nhật profile cho người dùng
    static async updateProfile(userId, name, image) {
        try {
            const [updated] = await User.update({ user_name: name, user_image: image}, { where: { user_id: userId } });
            return updated > 0; // Trả về true nếu cập nhật thành công
        } catch (error) {
            console.error("Lỗi khi cập nhật mật khẩu:", error);
            throw error;
        }
    }

    // Lưu OTP tạm thời
    static async saveOTP(email, otp) {
        try {
            const user = await User.findOne({ where: { email } });
            if (user) {
                user.otp = otp;
                user.otp_expiry = new Date(Date.now() + 5 * 60 * 1000); // OTP hết hạn sau 5 phút
                await user.save();
            } else {
                console.error("Email không tồn tại!");
            }
        } catch (error) {
            console.error("Lỗi khi lưu OTP:", error);
        }
    }

    // Xác thực OTP
    static async verifyOTP(email, otp) {
        try {
            const user = await User.findOne({ where: { email } });
            if (!user || user.otp !== otp) return false;
            if (new Date() > user.otp_expiry) return false; // OTP hết hạn
            return true;
        } catch (error) {
            console.error("Lỗi khi xác thực OTP:", error);
            return false;
        }
    }
}

module.exports = UserService;
