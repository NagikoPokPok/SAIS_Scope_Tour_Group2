const { Op } = require('sequelize');
const Team = require('../models/Team');
const TeamMember = require('../models/TeamMember');
const InvitationController = require('./invitation_controller'); // import nếu cần

exports.createTeam = async (req, res) => {
    // try {
    //     const { teamName } = req.body;
    //     if (!teamName) {
    //         return res.status(400).json({ message: 'Team name is required' });
    //     }
    //     const newTeam = await Team.create({ name: teamName });
    //     return res.status(201).json({
    //         message: 'Team created successfully!',
    //         data: newTeam
    //     });
    // } catch (error) {
    //     console.error('Error creating team:', error);
    //     return res.status(500).json({ message: 'Error creating team' });
    // }
    try {
        const { teamName, created_by, emails, host } = req.body;
        if (!teamName || !created_by) {
            return res.status(400).json({ message: 'Team name and created_by are required' });
        }
        const newTeam = await Team.create({ name: teamName, created_by });

        console.log('host:', host);
        // Gửi lời mời cho từng email (nếu có)
        if (Array.isArray(emails) && emails.length > 0) {
            for (const email of emails) {
                // Gọi hàm gửi lời mời (có thể dùng InvitationController hoặc gọi trực tiếp service)
                await InvitationController.sendInvitation({ body: { host, email, team_id: newTeam.team_id } }, { json: () => {}, status: () => ({ json: () => {} }) });
                // Hoặc gọi trực tiếp service gửi email nếu muốn đơn giản hơn
            }
        }

        return res.status(201).json({
            message: 'Team created successfully!',
            data: newTeam
        });
    } catch (error) {
        console.error('Error creating team:', error);
        return res.status(500).json({ message: 'Error creating team' });
    }
};

// Fetch teams (all or filtered by search)
exports.fetchTeams = async (req, res) => {
    // try {
    //     const searchQuery = req.query.search || '';
    //     console.log('Search query received:', searchQuery); // Debug log
    //     let teams;
    //     if (searchQuery.trim()) {
    //         teams = await Team.findAll({
    //             where: {
    //                 name: { [Op.like]: `%${searchQuery.trim()}%` }
    //             }
    //         });
    //         console.log('Filtered teams:', teams); // Debug log
    //     } else {
    //         teams = await Team.findAll();
    //         console.log('All teams:', teams); // Debug log
    //     }
    //     return res.status(200).json({ teams });
    // } catch (error) {
    //     console.error('Error fetching teams:', error);
    //     return res.status(500).json({ message: 'Error fetching teams' });
    // }
    try {
        const searchQuery = req.query.search || '';
        const created_by = req.query.created_by;
        if (!created_by) {
            return res.status(400).json({ message: 'created_by is required' });
        }
        let whereClause = { created_by };
        if (searchQuery.trim()) {
            whereClause.name = { [Op.like]: `%${searchQuery.trim()}%` };
        }
        const createdTeams = await Team.findAll({ where: whereClause });

        // 2. Lấy các team mà user là thành viên
        const memberships = await TeamMember.findAll({
            where: { user_id: created_by }
        });

        const teamIds = memberships.map(tm => tm.team_id);
        const memberTeams = teamIds.length > 0
            ? await Team.findAll({
                where: {
                    team_id: {
                        [Op.in]: teamIds
                    },
                    ...(searchQuery.trim() && {
                        name: { [Op.like]: `%${searchQuery.trim()}%` }
                    })
                }
              })
            : [];
        // 3. Gộp kết quả (tránh trùng lặp nếu user vừa là creator vừa là member)
        const allTeamsMap = new Map();
        [...createdTeams, ...memberTeams].forEach(team => {
            allTeamsMap.set(team.team_id, team);
        });

        const teams = Array.from(allTeamsMap.values());
        console.log('All teams:', teams); // Debug log
        console.log('createdTeams:', createdTeams); // Debug log
        console.log('memberTeams:', memberTeams); // Debug log
        return res.status(200).json({ teams });
    } catch (error) {
        console.error('Error fetching teams:', error);
        return res.status(500).json({ message: 'Error fetching teams' });
    }
};

// Delete team function
exports.deleteTeam = async (req, res) => {
    try {
      const { teamId } = req.params;
  
      // Kiểm tra xem team có tồn tại không
      const team = await Team.findByPk(teamId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
  
      // Xoá team (nếu có ràng buộc quan hệ, có thể cần xoá các thành viên trước)
      await Team.destroy({ where: { team_id: teamId } });
  
      return res.status(200).json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("Error deleting team:", error);
      return res.status(500).json({ message: "Error deleting team" });
    }
};

// Update team function
exports.updateTeam = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { teamName } = req.body;

        if (!teamId || !teamName) {
            return res.status(400).json({ message: 'Team ID and name are required' });
        }

        // Find team
        const team = await Team.findByPk(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Update team
        await Team.update({ name: teamName }, { where: { team_id: teamId } });

        return res.status(200).json({ message: 'Team updated successfully' });
    } catch (error) {
        console.error('Error updating team:', error);
        return res.status(500).json({ message: 'Error updating team' });
    }
};

module.exports = exports;