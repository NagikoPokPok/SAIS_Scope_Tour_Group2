const multer = require('multer');
const path = require('path');

// Cấu hình lưu file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/'); // Lưu ảnh vào thư mục public/uploads/
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); // Tạo tên file duy nhất
    }
});

// Kiểm tra định dạng file
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'), false);
    }
};

// Giới hạn kích thước file (2MB)
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, 
    fileFilter: fileFilter
});

module.exports = upload;
