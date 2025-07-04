// const bcrypt = require("bcrypt");

class UserController {
    static async register(username, password, confirmPassword) {
        if (!username || !password || !confirmPassword) {
            throw new Error("Vui lòng điền đầy đủ thông tin!");
        }
        if (password !== confirmPassword) {
            throw new Error("Mật khẩu xác nhận không khớp!");
        }

        let users = JSON.parse(localStorage.getItem("users")) || [];

        if (users.some(user => user.username === username)) {
            throw new Error("Tên đăng nhập đã tồn tại!");
        }

        // const hashedPassword = await bcrypt.hash(password, 10);
        // users.push({ username, password: hashedPassword });
        // localStorage.setItem("users", JSON.stringify(users));
        
        // Thêm tài khoản mới vào Local Storage
        try {
            // Hash mật khẩu
            const hashedPassword = await hashPassword(password);
            
            // Thêm tài khoản mới vào Local Storage với mật khẩu đã hash
            users.push({ username, password: hashedPassword });
            localStorage.setItem("users", JSON.stringify(users));
            
            alert("Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ.");
            toggleForms();
        } catch (error) {
            console.error("Lỗi khi hash mật khẩu:", error);
            errorMessage.textContent = "Đã xảy ra lỗi. Vui lòng thử lại.";
        }

        return "Đăng ký thành công!";
    }
}

   // Hàm hash mật khẩu bằng SHA-256
   async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    
    // Chuyển hash thành chuỗi hex
    return Array.from(new Uint8Array(hash))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
  }

module.exports = UserController;

