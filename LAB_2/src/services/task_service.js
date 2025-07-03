const { Op } = require('sequelize');
const Task = require('../models/Task');

const getWhereClause = (subjectId, teamId, search, status) => {
  let whereClause = {};
  if (subjectId) whereClause.subject_id = subjectId;
  if (teamId) whereClause.team_id = teamId;
  if (search && search.trim()) {
    whereClause.title = { [Op.like]: `%${search.trim()}%` };
  }
  if (status === "completed") {
    whereClause.status = "completed";
  } else if (status === "not_completed") {
    whereClause.status = { [Op.ne]: "completed" };
  }
  return whereClause;
};

exports.createTask = async (data) => {
  return await Task.create({
    ...data,
    status: 'pending'
  });
};

exports.getTasks = async ({ subjectId, teamId, search, status, page = 1, limit = 5 }) => {
  const whereClause = getWhereClause(subjectId, teamId, search, status);
  const offset = (page - 1) * limit;
  return await Task.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['created_at', 'DESC']]
  });
};

exports.getTaskById = async (id) => {
  return await Task.findByPk(id);
};

exports.updateTask = async (id, updateData) => {
  const task = await Task.findByPk(id);
  if (!task) return null;
  await task.update(updateData);
  return task;
};

exports.deleteTask = async (id) => {
  const task = await Task.findByPk(id);
  if (!task) return null;
  const { team_id, subject_id } = task;
  await task.destroy();
  return { team_id, subject_id };
};