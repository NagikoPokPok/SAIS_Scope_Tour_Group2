const User = require('../models/User');
const path = require('path');

exports.getProfile = async (req, res) => {
  try {
    // Lấy thông tin user dựa vào id từ req.user (đã được xác thực)
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).send('User not found');
    res.render('profile', { user });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.user_id);
    if (!user) return res.status(404).send('User not found');

    // Nếu có file upload (hình ảnh)
    if (req.file) {
      // Ví dụ lưu đường dẫn hình ảnh, bạn có thể điều chỉnh theo cấu hình của mình
      user.user_img = '/uploads/' + req.file.filename;
    }
    // Cập nhật các trường thông tin
    user.user_name = req.body.name || user.user_name;
    user.email = req.body.email || user.email;

    await user.save();
    res.redirect('/profile');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};
