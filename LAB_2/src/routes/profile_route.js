const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile_controller');
const multer = require('multer');

// Cấu hình multer để lưu file upload
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads'); // Thư mục chứa ảnh upload (đảm bảo thư mục này tồn tại)
  },
  filename: function(req, file, cb) {
    // Tạo tên file duy nhất
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Giả sử bạn có middleware xác thực (ví dụ: isAuthenticated)
const isAuthenticated = (req, res, next) => {
  if (req.user) return next();
  res.redirect('/login');
};

// Lấy trang profile
router.get('/', isAuthenticated, profileController.getProfile);

// Xử lý cập nhật profile (sử dụng middleware upload cho field "image")
router.post('/update', isAuthenticated, upload.single('image'), profileController.updateProfile);

module.exports = router;
