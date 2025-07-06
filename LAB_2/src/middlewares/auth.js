const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const token = req.cookies.token; // Lấy token từ cookie

    if (!token) {
        return res.redirect('/login'); // Chưa đăng nhập thì chuyển về trang login
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Gán user vào req để các controller có thể sử dụng
        next(); // Chuyển tiếp đến middleware hoặc controller tiếp theo
    } catch (error) {
        res.redirect('/login');
    }
};
