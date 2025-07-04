const express = require("express");
const InvitationController = require("../controllers/invitation_controller");

const router = express.Router();

// 📩 API gửi email mời
router.post("/", InvitationController.sendInvitation);

module.exports = router;
