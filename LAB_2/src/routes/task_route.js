// task_route.js
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task_controller');

router.post('/', taskController.createTask);
router.get('/', taskController.getTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

router.post('/:id/submit', taskController.submitTask);

module.exports = router;