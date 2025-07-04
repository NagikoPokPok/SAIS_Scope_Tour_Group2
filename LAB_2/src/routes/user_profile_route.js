const express = require("express");
const UserController = require("../controllers/user_controller");
const router = express.Router();

router.post("/load", UserController.getUser);
router.post("/update", UserController.updateProfile);

module.exports = router;