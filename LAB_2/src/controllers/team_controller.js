const { Op } = require('sequelize');
const Team = require('../models/Team');

exports.createTeam = async (req, res) => {
    try {
        const { teamName } = req.body;
        if (!teamName) {
            return res.status(400).json({ message: 'Team name is required' });
        }
        const newTeam = await Team.create({ name: teamName });
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
    try {
        const searchQuery = req.query.search || '';
        console.log('Search query received:', searchQuery); // Debug log
        let teams;
        if (searchQuery.trim()) {
            teams = await Team.findAll({
                where: {
                    name: { [Op.like]: `%${searchQuery.trim()}%` }
                }
            });
            console.log('Filtered teams:', teams); // Debug log
        } else {
            teams = await Team.findAll();
            console.log('All teams:', teams); // Debug log
        }
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