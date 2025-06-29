const Task = require('../models/Task');
const sequelize = require('../config/database');

async function deleteExceptFirst12() {
  await sequelize.authenticate();
  console.log('DB connected!');

  // Lấy 12 task_id nhỏ nhất
  const first12 = await Task.findAll({
    order: [['task_id', 'ASC']],
    limit: 12,
    attributes: ['task_id']
  });
  const keepIds = first12.map(t => t.task_id);

  // Xóa tất cả task_id không nằm trong 12 dòng đầu
  await Task.destroy({
    where: {
      task_id: { [require('sequelize').Op.notIn]: keepIds }
    }
  });

  console.log('Đã xóa tất cả task trừ 12 dòng đầu!');
  process.exit();
}

deleteExceptFirst12().catch(err => {
  console.error(err);
  process.exit(1);
});