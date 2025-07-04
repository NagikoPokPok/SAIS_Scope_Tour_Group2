const UserController = require("../controllers/register_controller.js");

function registerRoutes(app) {
    app.post("/register", async (req, res) => {
        try {
            const { username, password, confirmPassword } = req.body;
            const message = await UserController.register(username, password, confirmPassword);
            res.status(200).json({ message });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });
}

// Xuất module theo chuẩn CommonJS
module.exports = registerRoutes;
