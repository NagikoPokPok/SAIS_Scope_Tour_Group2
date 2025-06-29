const { faker } = require('@faker-js/faker');
const Task = require('../models/Task');
const sequelize = require('../config/database');

async function seedTasks() {
  await sequelize.authenticate();
  console.log('DB connected!');

  const tasks = [];
  for (let i = 13; i < 100001; i++) {
    tasks.push({
      user_id: null,
      team_id: 1,
      subject_id: 1,
      title: i,
      description: faker.lorem.paragraph(),
      start_date: faker.date.between({ from: '2024-01-01', to: '2025-01-01' }),
      end_date: faker.date.between({ from: '2025-01-02', to: '2025-12-31' }),
      status: faker.helpers.arrayElement(['pending', 'completed', 'in_progress']),
      created_at: faker.date.past({ years: 2 }),
    });
  }

  await Task.bulkCreate(tasks);
  console.log('Seeded 10,000 tasks!');
  process.exit();
}

seedTasks().catch(err => {
  console.error(err);
  process.exit(1);
});