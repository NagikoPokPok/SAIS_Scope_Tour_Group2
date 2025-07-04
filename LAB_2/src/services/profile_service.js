const User = require('../models/User');

exports.getProfile = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'user_name', 'email', 'user_img']
        });

        if (!user) return { error: "User not found" };
        return user;
    } catch (error) {
        return { error: "Server error" };
    }
};

exports.updateProfile = async (userId, userData) => {
    try {
        const user = await User.findByPk(userId);
        if (!user) return { error: "User not found" };

        user.user_name = userData.name || user.user_name;
        user.email = userData.email || user.email;
        if (userData.image) user.user_img = userData.image;

        await user.save();
        return { success: "Profile updated successfully" };
    } catch (error) {
        return { error: "Server error" };
    }
};
