const express = require("express");
const UserController = require("../controllers/user_controller");
const router = express.Router();

router.post("/", UserController.createUser);
router.post("/send-otp", UserController.sendOTP);
router.post("/verify-otp", UserController.verifyOTP);

module.exports = router;