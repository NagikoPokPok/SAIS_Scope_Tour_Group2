const { Op } = require('sequelize');
const Team = require('../models/Team');

exports.createTeam = async (teamName) => {
    if (!teamName) {
        throw new Error('Team name is required');
    }
    const newTeam = await Team.create({ name: teamName });
    return newTeam;
};

exports.fetchTeams = async (searchQuery = '') => {
    let teams;
    if (searchQuery.trim()) {
        teams = await Team.findAll({
            where: {
                name: { [Op.like]: `%${searchQuery.trim()}%` }
            }
        });
    } else {
        teams = await Team.findAll();
    }
    return teams;
};

exports.deleteTeam = async (teamId) => {
    const team = await Team.findByPk(teamId);
    if (!team) {
        throw new Error('Team not found');
    }
    await Team.destroy({ where: { team_id: teamId } });
};

exports.updateTeam = async (teamId, teamName) => {
    if (!teamId || !teamName) {
        throw new Error('Team ID and name are required');
    }
    const team = await Team.findByPk(teamId);
    if (!team) {
        throw new Error('Team not found');
    }
    await Team.update({ name: teamName }, { where: { team_id: teamId } });
};