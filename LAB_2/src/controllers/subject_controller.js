const { Op } = require('sequelize');
const Subject = require('../models/Subject');

exports.createSubject = async (req, res) => {
  try {
    const { subjectName, description, teamId } = req.body; // Receive teamId from request
    if (!subjectName) {
      return res.status(400).json({ message: 'Subject name is required' });
    }
    if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required' });
    }
    // Create the new subject including team_id
    const newSubject = await Subject.create({ 
      name: subjectName,
      description: description || null,
      team_id: teamId
    });
    return res.status(201).json({
      message: 'Subject created successfully!',
      data: newSubject
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    return res.status(500).json({ message: 'Error creating Subject' });
  }
};

// Fetch subjects (with optional search by name)
exports.fetchSubjects = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const teamId = req.query.teamId; // Retrieve teamId from query parameters
    let whereClause = {};

    // If a teamId is provided, filter by that team
    if (teamId) {
      whereClause.team_id = teamId;
    }

    // If a search query is provided, add a filter on the subject name
    if (searchQuery.trim()) {
      whereClause.name = { [Op.like]: `%${searchQuery.trim()}%` };
    }

    const subjects = await Subject.findAll({ where: whereClause });
    return res.status(200).json({ Subjects: subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({ message: 'Error fetching Subjects' });
  }
};



exports.deleteSubject = async (req, res) => {
  try {
      const { subjectId } = req.params;

      if (!subjectId) {
          return res.status(400).json({ message: "Invalid subject ID" });
      }

      // Check subject exists
      const subject = await Subject.findByPk(subjectId);
      if (!subject) {
          return res.status(404).json({ message: "Subject not found" });
      }

      // Delete subject
      await Subject.destroy({ where: { subject_id: subjectId } });

      return res.status(200).json({ message: "Subject deleted successfully" });
  } catch (error) {
      console.error("Error deleting subject:", error);
      return res.status(500).json({ message: "Error deleting subject" });
  }
};

// Update subject function
exports.updateSubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { subjectName, description } = req.body;

    if (!subjectId || !subjectName) {
      return res.status(400).json({ message: 'Subject ID and name are required' });
    }

    const subject = await Subject.findByPk(subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    await Subject.update(
      { name: subjectName, description: description || subject.description },
      { where: { subject_id: subjectId } }
    );

    return res.status(200).json({ message: 'Subject updated successfully' });
  } catch (error) {
    console.error('Error updating subject:', error);
    return res.status(500).json({ message: 'Error updating subject' });
  }
};


module.exports = exports;
