const InvitationToken = require("../models/InvitationToken");
const crypto = require("crypto");

class InviteTokenService {
    static async generateToken(email, team_id, team_name) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Hết hạn sau 1h

        await InvitationToken.create({
            email,
            token,
            team_id,
            team_name,
            expires_at: expiresAt,
            used: false,
        });

        return token;
    }

    static async verifyToken(email, token) {
        const record = await InvitationToken.findOne({
            where: {
                email,
                token,
                used: false,
            },
        });

        if (!record || new Date() > record.expires_at) {
            return false;
        }

        return true;
    }

    static async markTokenUsed(email, token) {
        await InvitationToken.update({ used: true }, {
            where: { email, token }
        });
    }
}

module.exports = InviteTokenService;
