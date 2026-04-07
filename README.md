# 🎯 Scope Tour - Task Management System

## 📋 Tổng Quan Dự Án

**Scope Tour** là một ứng dụng quản lý task dành cho nhóm học tập/làm việc, cho phép người dùng tạo team, quản lý môn học (subjects), và theo dõi tiến độ công việc theo thời gian thực.

### 👥 Thành viên nhóm
- Bùi Thành Nghĩa
- Trần Quang Hiếu
- Huỳnh Đức Huy
- Võ Hùng Cường

---

## 🏗️ Kiến Trúc Hệ Thống

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js + Express.js |
| **Database** | MySQL (Sequelize ORM) |
| **Cache** | Redis (Upstash) |
| **Message Queue** | RabbitMQ (CloudAMQP) |
| **Real-time** | Socket.IO |
| **Email** | Nodemailer |
| **Frontend** | HTML/CSS/JavaScript |

### Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Login/     │  │   Team      │  │   Task      │  │   Chat      │         │
│  │  Signup     │  │ Management  │  │ Management  │  │  (Future)   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (Express.js)                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Routes: /api/login, /api/signup, /api/team, /api/task, /api/subject│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   CONTROLLERS    │  │   MIDDLEWARES    │  │   WEBSOCKET      │
│  ┌────────────┐  │  │  ┌────────────┐  │  │   HANDLER        │
│  │ Task       │  │  │  │ Auth       │  │  │  ┌────────────┐  │
│  │ Controller │  │  │  │ Middleware │  │  │  │ Socket.IO  │  │
│  ├────────────┤  │  │  ├────────────┤  │  │  │ Real-time  │  │
│  │ Team       │  │  │  │ Cache      │  │  │  │ Events     │  │
│  │ Controller │  │  │  │ Warming    │  │  │  └────────────┘  │
│  └────────────┘  │  │  └────────────┘  │  └──────────────────┘
└────────┬─────────┘  └──────────────────┘           │
         │                                           │
         ▼                                           │
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SERVICE LAYER                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Task        │  │ Task Queue  │  │ Team        │  │ Email       │         │
│  │ Service     │  │ Service     │  │ Service     │  │ Service     │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘         │
└─────────┼────────────────┼────────────────┼─────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA & MESSAGING LAYER                               │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │      MySQL         │  │      Redis         │  │     RabbitMQ       │     │
│  │  (Sequelize ORM)   │  │    (Caching)       │  │  (Message Queue)   │     │
│  │                    │  │                    │  │                    │     │
│  │  • User            │  │  • Task Cache      │  │  • task_operations │     │
│  │  • Team            │  │  • Session Data    │  │  • task_submissions│     │
│  │  • Subject         │  │  • Cache Warming   │  │  • cache_invalid.  │     │
│  │  • Task            │  │                    │  │                    │     │
│  │  • TaskCompleted   │  │                    │  │  Dead Letter Queue │     │
│  │  • TeamMember      │  │                    │  │  (Error Handling)  │     │
│  │  • InvitationToken │  │                    │  │                    │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
│                                                              │               │
│                                                              ▼               │
│                                                   ┌────────────────────┐     │
│                                                   │   QUEUE WORKER     │     │
│                                                   │   (Consumer)       │     │
│                                                   │                    │     │
│                                                   │  • Task Consumer   │     │
│                                                   │  • DB Monitoring   │     │
│                                                   │  • Auto Retry      │     │
│                                                   └────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Luồng Hoạt Động Hiện Tại

### 1. Luồng Tạo Task (Message Queue Pattern)

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Client  │───▶│  Controller  │───▶│ TaskQueue    │───▶│  RabbitMQ    │
│          │    │              │    │ Service      │    │  Queue       │
└──────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
     ▲                                                         │
     │                                                         ▼
     │          ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
     │          │  WebSocket   │◀───│ Task         │◀───│ Queue Worker │
     │          │  Emit Event  │    │ Consumer     │    │              │
     │          └──────┬───────┘    └──────────────┘    └──────────────┘
     │                 │                    │
     │                 ▼                    ▼
     │          ┌──────────────┐    ┌──────────────┐
     └──────────│  Real-time   │    │   MySQL      │
                │  Update UI   │    │   Database   │
                └──────────────┘    └──────────────┘
```

**Chi tiết luồng:**
1. **Client gửi request** tạo task qua REST API
2. **Controller** nhận request, tạo optimistic response
3. **TaskQueueService** đẩy message vào RabbitMQ queue
4. **Queue Worker** consume message từ queue
5. **TaskConsumer** xử lý:
   - Kiểm tra database connection
   - Lưu task vào MySQL
   - Invalidate Redis cache
   - Emit WebSocket event
6. **Client** nhận real-time update qua Socket.IO

### 2. Luồng Cache với Redis

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐
│  Client  │───▶│  Controller  │───▶│ Check Redis  │
│  GET     │    │  getTasks()  │    │   Cache      │
└──────────┘    └──────────────┘    └──────┬───────┘
                                           │
                      ┌────────────────────┼────────────────────┐
                      │                    │                    │
                      ▼ Cache Hit          ▼ Cache Miss         ▼ DB Error
               ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
               │ Return       │    │ Query MySQL  │    │ Fallback to  │
               │ Cached Data  │    │ Update Cache │    │ Cache Data   │
               └──────────────┘    └──────────────┘    └──────────────┘
```

### 3. Luồng Database Resilience

```
┌──────────────────────────────────────────────────────────────┐
│                    DATABASE MONITOR                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Check Connection Every 5 Seconds                   │    │
│  │                                                     │    │
│  │  Connected ──────▶ Emit 'connected' event           │    │
│  │  Disconnected ───▶ Emit 'disconnected' event        │    │
│  │                                                     │    │
│  │  • Messages requeue khi DB offline                  │    │
│  │  • Auto-process khi DB reconnect                    │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Cấu Trúc Database (ERD)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      USER       │       │      TEAM       │       │    SUBJECT      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ user_id (PK)    │──┐    │ team_id (PK)    │──┬───▶│ subject_id (PK) │
│ email           │  │    │ name            │  │    │ name            │
│ password        │  │    │ group_img       │  │    │ description     │
│ user_name       │  │    │ created_by (FK) │◀─┤    │ team_id (FK)    │
│ phone_number    │  │    │ created_at      │  │    │ created_at      │
│ user_img        │  │    └─────────────────┘  │    └────────┬────────┘
│ otp             │  │                         │             │
│ otp_expiry      │  │                         │             │
│ created_at      │  │                         │             ▼
└────────┬────────┘  │    ┌─────────────────┐  │    ┌─────────────────┐
         │           │    │   TEAM_MEMBER   │  │    │      TASK       │
         │           │    ├─────────────────┤  │    ├─────────────────┤
         │           ├───▶│ team_id (PK,FK) │◀─┘    │ task_id (PK)    │
         │           │    │ team_name       │       │ user_id (FK)    │
         └───────────┼───▶│ user_id (PK,FK) │       │ team_id (FK)    │
                     │    │ role            │       │ subject_id (FK) │
                     │    │ joined_at       │       │ title           │
                     │    └─────────────────┘       │ description     │
                     │                              │ start_date      │
                     │    ┌─────────────────┐       │ end_date        │
                     │    │ TASK_COMPLETED  │       │ status          │
                     │    ├─────────────────┤       │ created_at      │
                     │    │ id (PK)         │       └────────┬────────┘
                     └───▶│ task_id (FK)    │◀───────────────┘
                          │ user_id (FK)    │
                          │ completed_date  │
                          └─────────────────┘

┌─────────────────┐
│INVITATION_TOKEN │
├─────────────────┤
│ token_id (PK)   │
│ email           │
│ token           │
│ expires_at      │
│ used            │
│ team_id (FK)    │
│ created_at      │
└─────────────────┘
```

---

## 📁 Cấu Trúc Thư Mục

```
LAB_2/
├── src/
│   ├── config/
│   │   ├── database.js      # Sequelize MySQL config
│   │   ├── rabbitmq.js      # RabbitMQ queues & exchanges
│   │   └── websocket.js     # Socket.IO events config
│   │
│   ├── consumers/
│   │   └── task_consumer.js # Message queue consumer
│   │
│   ├── controllers/
│   │   ├── task_controller.js
│   │   ├── team_controller.js
│   │   ├── user_controller.js
│   │   └── ...
│   │
│   ├── middlewares/
│   │   ├── auth.js           # JWT authentication
│   │   ├── cache_warming.js  # Redis cache warming
│   │   └── ...
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Team.js
│   │   ├── Subject.js
│   │   ├── Task.js
│   │   ├── TaskCompleted.js
│   │   ├── TeamMember.js
│   │   ├── InvitationToken.js
│   │   └── associations.js
│   │
│   ├── routes/
│   │   ├── task_route.js
│   │   ├── team_route.js
│   │   ├── login_route.js
│   │   └── ...
│   │
│   ├── services/
│   │   ├── task_service.js
│   │   ├── task_queue_service.js
│   │   ├── team_service.js
│   │   ├── email_service.js
│   │   └── ...
│   │
│   ├── utils/
│   │   ├── database_monitor.js   # DB connection monitoring
│   │   ├── rabbitmq_client.js    # RabbitMQ client
│   │   ├── redis_client.js       # Redis client
│   │   └── websocket_handler.js  # Socket.IO handler
│   │
│   ├── public/                   # Static files
│   ├── views/                    # HTML templates
│   ├── server.js                 # Main Express server
│   └── queue_worker.js           # Standalone queue worker
│
├── package.json
└── .env
```

---

## 🚀 Hướng Dẫn Cài Đặt

### Prerequisites
- Node.js >= 18
- MySQL
- Redis (hoặc Upstash Redis)
- RabbitMQ (hoặc CloudAMQP)

### Environment Variables (.env)
```env
# Database
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
DB_HOST=your_host
DB_PORT=3306

# Redis
REDIS_URL=rediss://your-redis-url

# RabbitMQ
RABBITMQ_URL=amqps://your-rabbitmq-url

# JWT
JWT_SECRET=your_secret_key
```

### Installation
```bash
# Clone repository
git clone https://github.com/NagikoPokPok/Scope_Tour_Group2.git

# Install dependencies
npm install

# Start main server
npm start

# Start queue worker (separate terminal)
npm run worker

# Development mode
npm run dev
npm run worker:dev
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | User login |
| POST | `/api/signup` | User registration |
| GET | `/api/task` | Get tasks (với pagination, search, filter) |
| POST | `/api/task` | Create new task |
| PUT | `/api/task/:id` | Update task |
| DELETE | `/api/task/:id` | Delete task |
| POST | `/api/task/:id/submit` | Submit task |
| GET | `/api/team` | Get teams |
| POST | `/api/team` | Create team |
| GET | `/api/subject` | Get subjects |
| POST | `/api/subject` | Create subject |
| POST | `/api/join` | Join team via invitation |

---

## 🔮 Tính Năng Dự Định (Future)

### Phase 1: Enhanced Features
```
┌─────────────────────────────────────────────────────────────┐
│  📱 Mobile Responsive Design                                │
│  📊 Dashboard Analytics & Charts                            │
│  🔔 Push Notifications                                      │
│  📎 File Attachments for Tasks                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Communication Features
```
┌─────────────────────────────────────────────────────────────┐
│  💬 Real-time Team Chat                                     │
│  📹 Video Call Integration                                  │
│  📧 Email Notifications for Deadlines                       │
│  🔗 Third-party Integrations (Google Calendar, Slack)       │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Advanced Features
```
┌─────────────────────────────────────────────────────────────┐
│  🐾 Gamification System (Pets, Streaks, Rewards)            │
│  📈 AI-powered Task Recommendations                         │
│  📊 Performance Analytics & Reports                         │
│  🔐 Role-based Access Control (RBAC)                        │
└─────────────────────────────────────────────────────────────┘
```

### Planned Architecture Improvements
```
┌───────────────────────────────────────────────────────────────────────────┐
│                        FUTURE ARCHITECTURE                                │
│                                                                           │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   │
│  │   React/    │   │   API       │   │  Microser-  │   │  Kubernetes │   │
│  │   Vue.js    │   │   Gateway   │   │  vices      │   │  Deployment │   │
│  │   Frontend  │   │   (Kong)    │   │  Pattern    │   │             │   │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   │
│                                                                           │
│  Services to be extracted:                                               │
│  • User Service        • Task Service                                    │
│  • Team Service        • Notification Service                            │
│  • Chat Service        • Analytics Service                               │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Key Design Patterns

### 1. **Message Queue Pattern**
- Asynchronous task processing
- Database resilience (auto-retry khi DB offline)
- Dead Letter Queue cho error handling

### 2. **Cache-Aside Pattern**
- Redis caching với TTL
- Cache warming on startup
- Automatic cache invalidation

### 3. **Optimistic UI Updates**
- Immediate UI feedback
- Background synchronization
- Eventual consistency

### 4. **Event-Driven Architecture**
- Real-time updates via WebSocket
- Pub/Sub pattern cho task events
- Room-based notifications

---

## 📝 License

MIT License - See LICENSE file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
