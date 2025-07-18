let currentPageAvailable = 1;
let currentPageSubmitted = 1;
let tasksPerPage = 5;
let socket = null;

// ===================== ĐỊNH NGHĨA SHOWNOTIFICATION TRƯỚC ======================
function showNotification(message, type = 'info') {
  console.log(`📢 Notification: ${message} (${type})`);
  
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} alert-dismissible fade show`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    min-width: 300px;
  `;
  notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 DOM loaded, initializing...");
  
  const urlParams = new URLSearchParams(window.location.search);
  const subjectId = urlParams.get("subjectId");
  const teamId = urlParams.get("teamId");
  const subjectName = urlParams.get("subjectName");

  console.log("📋 Page params:", { subjectId, teamId, subjectName });

  // Update page title with subject name
  if (subjectName) {
    const subjectNameSpan = document.querySelector('.subject-name');
    if (subjectNameSpan) {
      subjectNameSpan.textContent = decodeURIComponent(subjectName);
    }
    
    // Update page title
    document.title = `Tasks - ${decodeURIComponent(subjectName)} | Scope Tour`;
  }

  // Initialize WebSocket với debug chi tiết
  try {
    if (typeof io !== 'undefined') {
      console.log("🔌 Initializing Socket.IO connection...");
      
      socket = io('http://localhost:3000', {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      socket.on('connect', () => {
        console.log('✅ Socket connected with ID:', socket.id);
        socket.emit('join:room', { teamId, subjectId });
      });

      socket.on('room:joined', (data) => {
        console.log('🏠 Successfully joined room:', data);
        showNotification(`Connected to real-time updates`, 'success');
      });

      // Task event listeners với debouncing để tránh duplicate
      let lastTaskEventTime = 0;
      const EVENT_DEBOUNCE_MS = 1000; // 1 second

      socket.on('task:created', (data) => {
        const now = Date.now();
        if (now - lastTaskEventTime < EVENT_DEBOUNCE_MS) {
          console.log('🛡️ Duplicate task event detected, skipping...');
          return;
        }
        lastTaskEventTime = now;

        console.log('🔔 New task created event received:', data);
        if (data.teamId == teamId && data.subjectId == subjectId) {
          console.log('✅ Task event matches current page, refreshing...');
          TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted, true);
          showNotification('New task created!', 'success');
        }
      });

      socket.on('task:updated', (data) => {
        console.log('🔔 Task updated event received:', data);
        if (data.teamId == teamId && data.subjectId == subjectId) {
          TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted, true);
          showNotification('Task updated!', 'info');
        }
      });

      socket.on('task:deleted', (data) => {
        console.log('🔔 Task deleted event received:', data);
        if (data.teamId == teamId && data.subjectId == subjectId) {
          TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted, true);
          showNotification('Task deleted!', 'warning');
        }
      });

      socket.on('task:submitted', (data) => {
        console.log('🔔 Task submitted event received:', data);
        if (data.teamId == teamId && data.subjectId == subjectId) {
          TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted, true);
          showNotification('Task submitted!', 'success');
        }
      });

    } else {
      console.error('❌ Socket.IO library not loaded');
      showNotification('Real-time features not available - Socket.IO not loaded', 'danger');
    }
  } catch (error) {
    console.error('❌ Socket initialization error:', error);
    showNotification('Failed to initialize real-time features', 'danger');
  }

  // Test function để kiểm tra socket
  window.testSocket = function() {
    if (socket && socket.connected) {
      console.log('✅ Socket is connected');
      socket.emit('join:room', { teamId, subjectId });
    } else {
      console.log('❌ Socket is not connected');
    }
  };

  // ==================== UTILITY FUNCTIONS ====================
  const DateUtils = {
    formatDate(dateObj) {
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    },

    formatTime(dateObj) {
      let hours = dateObj.getHours();
      const mins = String(dateObj.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;
      return `${hours}:${mins} ${ampm}`;
    },

    getTaskStatus(task) {
      const today = new Date();
      const endDate = new Date(task.end_date); 
      const startDate = new Date(task.start_date); 

      if (endDate < today) {
        return "Overdue";
      } else if (today >= startDate && today <= endDate) {
        return "In progress";
      }
      return "Upcoming";
    }
  };

  // ==================== API FUNCTIONS ====================
  const API = {
    async fetchTasks(page = 1, limit = tasksPerPage, status = "", skipCache = "") {
  try {
    let url = `http://localhost:3000/api/task?subjectId=${subjectId}&teamId=${teamId}&page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    if (skipCache) url += skipCache;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch tasks");
    return await response.json();
  } catch (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
},

    async searchTasks(query, status = "", page = 1, limit = tasksPerPage) {
      try {
        let url = `http://localhost:3000/api/task?subjectId=${subjectId}&teamId=${teamId}&page=${page}&limit=${limit}`;
        if (query) url += `&search=${encodeURIComponent(query)}`;
        if (status) url += `&status=${status}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to search tasks");
        return await response.json();
      } catch (error) {
        console.error("Error searching tasks:", error);
        throw error;
      }
    },

    async createTask(taskData) {
      try {
        const response = await fetch("http://localhost:3000/api/task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskData),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Failed to create task");
        }
        return await response.json();
      } catch (error) {
        console.error("Error creating task:", error);
        throw error;
      }
    },

  async submitTask(taskId, userId = 1) { // Default userId, bạn có thể lấy từ session
    try {
      const response = await fetch(`http://localhost:3000/api/task/${taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to submit task");
      }
      return await response.json();
    } catch (error) {
      console.error("Error submitting task:", error);
      throw error;
    }
  },

    async updateTask(taskId, updateData) {
      try {
        const response = await fetch(`http://localhost:3000/api/task/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateData),
        });
        if (!response.ok) throw new Error("Failed to update task");
        return await response.json();
      } catch (error) {
        console.error("Error updating task:", error);
        throw error;
      }
    },

    async deleteTask(taskId) {
      try {
        const response = await fetch(`http://localhost:3000/api/task/${taskId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete task");
        return await response.json();
      } catch (error) {
        console.error("Error deleting task:", error);
        throw error;
      }
    }
  };

  // ==================== DOM CREATION FUNCTIONS ====================
  const TaskElements = {
    createAvailableTaskElement(task) {
      const container = document.createElement("div");
      container.className = "item-available-task container text-center p-0";
      container.dataset.taskId = task.task_id;

      const status = DateUtils.getTaskStatus(task);
const startDate = task.start_date ? DateUtils.formatDate(new Date(task.start_date)) : "No start date";
  const endDate = task.end_date ? DateUtils.formatDate(new Date(task.end_date)) : "No end date";

      container.innerHTML = `
        <div class="row w-100 gx-4 align-items-center justify-content-center my-3">
          <div class="col check-task">
            <input 
              class="checkbox-complete-task" 
              type="checkbox" 
              data-task-id="${task.task_id}"
            />
            <div class="task text-start">
              <span class="task-title fw-medium">${task.title}</span>
              <span class="task-desc fw-light text-secondary">
                ${task.description || ""}
              </span>
            </div>
          </div>
          <div class="col time-of-task">
            <span class="status-of-task fw-medium" data-status="${status}">
              ${status}
            </span>
            <div class="due-time fw-light">
              <span class="open-time text-secondary">${startDate}</span>
              <hr />
              <span class="end-time text-secondary">${endDate}</span>
            </div>
          </div>
          <div class="action-list col text-end d-flex justify-content-end align-items-center text-primary">
            <div class="row g-4">
              <div class="col fs-5 action-edit" data-task-id="${task.task_id}">
                <i class="fa-solid fa-pen-to-square"></i>
              </div>
              <div class="col fs-5 action-delete" data-task-id="${task.task_id}">
                <i class="fa-solid fa-trash-can"></i>
              </div>
              <div class="col fs-5 action-rank" data-task-id="${task.task_id}">
                <i class="fa-solid fa-ranking-star"></i>
              </div>
              <div class="col fs-5 action-comment" data-task-id="${task.task_id}">
                <i class="fa-solid fa-message"></i>
              </div>
            </div>
          </div>
        </div>
      `;

      // Add event listeners for task actions
      this.attachTaskEventListeners(container, task);
      return container;
    },

    createSubmittedTaskElement(task) {
      const container = document.createElement("div");
      container.className = "item-submitted-task container text-center p-0";
      container.dataset.taskId = task.task_id;

      const completedDate = task.completed_at ? new Date(task.completed_at) : new Date();
      const formattedDate = DateUtils.formatDate(completedDate);
      const formattedTime = DateUtils.formatTime(completedDate);

      container.innerHTML = `
        <div class="row w-100 gx-4 align-items-center justify-content-center my-3">
          <div class="col check-task">
            <div class="task text-start">
              <span class="task-title fw-medium">${task.title}</span>
              <span class="task-desc fw-light text-secondary">
                ${task.description || ""}
              </span>
            </div>
          </div>
          <div class="col time-of-task d-flex flex-column">
            <span class="status-of-task fw-medium" data-status="Completed">
              Completed
            </span>
            <span class="submitted-time fw-light text-secondary">
              ${formattedDate} ${formattedTime}
            </span>
          </div>
          <div class="action-list col text-end d-flex justify-content-end align-items-center text-primary">
            <div class="row g-4">
              <div class="col fs-5 action-delete" data-task-id="${task.task_id}">
                <i class="fa-solid fa-trash-can"></i>
              </div>
              <div class="col fs-5 action-rank" data-task-id="${task.task_id}">
                <i class="fa-solid fa-ranking-star"></i>
              </div>
              <div class="col fs-5 action-comment" data-task-id="${task.task_id}">
                <i class="fa-solid fa-message"></i>
              </div>
            </div>
          </div>
        </div>
      `;

      // Add event listeners for submitted task actions
      this.attachSubmittedTaskEventListeners(container, task);
      return container;
    },

    attachTaskEventListeners(container, task) {
      // Checkbox completion handler
      const checkbox = container.querySelector(".checkbox-complete-task");
      checkbox.addEventListener("change", async (e) => {
        if (e.target.checked) {
          await TaskManager.handleTaskSubmission(task.task_id);
        }
      });

      // Delete button handler
      const deleteBtn = container.querySelector(".action-delete");
      deleteBtn.addEventListener("click", () => {
        TaskManager.handleTaskDeletion(task.task_id);
      });

      // Edit button handler
      const editBtn = container.querySelector(".action-edit");
      editBtn.addEventListener("click", () => {
        TaskManager.handleTaskEdit(task.task_id);
      });

      // Rank button handler
      const rankBtn = container.querySelector(".action-rank");
      rankBtn.addEventListener("click", () => {
        window.location.href = '../views/ranking-user.html';
      });

      // Comment button handler
      const commentBtn = container.querySelector(".action-comment");
      commentBtn.addEventListener("click", () => {
        TaskManager.handleTaskComment(task.task_id);
      });
    },

    attachSubmittedTaskEventListeners(container, task) {
      // Delete button handler
      const deleteBtn = container.querySelector(".action-delete");
      deleteBtn.addEventListener("click", () => {
        TaskManager.handleTaskDeletion(task.task_id);
      });

      // Rank button handler
      const rankBtn = container.querySelector(".action-rank");
      rankBtn.addEventListener("click", () => {
        window.location.href = '../views/ranking-user.html';
      });

      // Comment button handler
      const commentBtn = container.querySelector(".action-comment");
      commentBtn.addEventListener("click", () => {
        TaskManager.handleTaskComment(task.task_id);
      });
    }
  };

  // ==================== MAIN TASK MANAGER ====================
  const TaskManager = {
    async loadTasks(pageAvailable = currentPageAvailable, pageSubmitted = currentPageSubmitted, skipCache = false) {
      try {
        // Kiểm tra nếu đang trong search mode thì không load tasks bình thường
        if (SearchManager.currentSearchQuery && !skipCache) {
          console.log('🔍 In search mode, skipping normal task load');
          return;
        }

        // Hide search UI elements khi load tasks bình thường
        SearchManager.hideSearchMode();

        // Thêm tham số skipCache vào URL nếu cần
        const skipCacheParam = skipCache ? '&skipCache=true' : '';
        
        // Lấy available tasks
        const { tasks: availableTasks, total: totalAvailable } = 
          await API.fetchTasks(pageAvailable, tasksPerPage, "not_completed", skipCacheParam);
        
        // Lấy submitted tasks
        const { tasks: submittedTasks, total: totalSubmitted } = 
          await API.fetchTasks(pageSubmitted, tasksPerPage, "completed", skipCacheParam);

        this.renderTasks(availableTasks, "available");
        this.renderTasks(submittedTasks, "submitted");

        this.renderAvailablePagination(totalAvailable);
        this.renderSubmittedPagination(totalSubmitted);
      } catch (error) {
        console.error("Failed to load tasks:", error);
        showNotification("Failed to load tasks: " + error.message, 'danger');
      }
    },

    async searchTasks(query) {
      try {
        const { tasks } = await API.searchTasks(query);
        this.renderTasks(tasks, "all");
      } catch (error) {
        alert("Failed to search tasks");
      }
    },
    renderTasks(tasks, taskType) {
  const availableContainer = document
    .getElementById("panelsStayOpen-collapseOne")
    .querySelector(".accordion-body");
  const submittedContainer = document
    .getElementById("panelsStayOpen-collapseTwo")
    .querySelector(".accordion-body");

  // Clear containers
  if (taskType === "available") {
    availableContainer.innerHTML = "";
    if (!tasks || tasks.length === 0) {
      availableContainer.innerHTML = "<p class='text-center'>No available tasks</p>";
      return;
    }
    tasks.forEach((task) => {
      availableContainer.appendChild(TaskElements.createAvailableTaskElement(task));
    });
  } else if (taskType === "submitted") {
    submittedContainer.innerHTML = "";
    if (!tasks || tasks.length === 0) {
      submittedContainer.innerHTML = "<p class='text-center'>No submitted tasks</p>";
      return;
    }
    tasks.forEach((task) => {
      submittedContainer.appendChild(TaskElements.createSubmittedTaskElement(task));
    });
  }
},

 renderAvailablePagination(totalCount) {
  const totalPages = Math.ceil(totalCount / tasksPerPage);
  const container = document.getElementById("pageNumbers");
  container.innerHTML = "";

  let pages = [];
  if (totalPages <= 1) {
    return;
  }
  if (currentPageAvailable === 1) {
    pages = [1, totalPages > 1 ? 2 : null].filter(Boolean);
  } else if (currentPageAvailable === totalPages) {
    pages = [totalPages - 1, totalPages].filter(p => p > 0);
  } else {
    pages = [currentPageAvailable - 1, currentPageAvailable, currentPageAvailable + 1];
  }

  pages.forEach(page => {
    const btn = document.createElement("button");
    btn.textContent = page;
    btn.className = `btn btn-sm ${page === currentPageAvailable ? 'btn-primary' : 'btn-outline-primary'}`;
    btn.onclick = async () => {
      if (page !== currentPageAvailable) {
        currentPageAvailable = page;
        // Check if searching
        if (SearchManager.currentSearchQuery) {
          await SearchManager.performSearch();
        } else {
          await TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
        }
      }
    };
    container.appendChild(btn);
  });

  // Cập nhật info dạng 1/n
  document.getElementById("pageInfo").textContent = `${currentPageAvailable} / ${totalPages}`;

   // GÁN LẠI SỰ KIỆN CHO NÚT ĐIỀU HƯỚNG
  document.getElementById("firstPageBtn").onclick = async () => {
    if (currentPageAvailable > 1) {
      currentPageAvailable = 1;
      if (SearchManager.currentSearchQuery) {
        await SearchManager.performSearch();
      } else {
        await TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
      }
    }
  };
  document.getElementById("prevPageBtn").onclick = async () => {
    if (currentPageAvailable > 1) {
      currentPageAvailable -= 1;
      if (SearchManager.currentSearchQuery) {
        await SearchManager.performSearch();
      } else {
        await TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
      }
    }
  };
  document.getElementById("nextPageBtn").onclick = async () => {
    if (currentPageAvailable < totalPages) {
      currentPageAvailable += 1;
      if (SearchManager.currentSearchQuery) {
        await SearchManager.performSearch();
      } else {
        await TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
      }
    }
  };
  document.getElementById("lastPageBtn").onclick = async () => {
    if (currentPageAvailable < totalPages) {
      currentPageAvailable = totalPages;
      if (SearchManager.currentSearchQuery) {
        await SearchManager.performSearch();
      } else {
        await TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
      }
    }
  };
},
    
    renderSubmittedPagination(totalCount) {
      const totalPages = Math.ceil(totalCount / tasksPerPage);
      const container = document.getElementById("pageNumbersSubmitted");
      container.innerHTML = "";

      let pages = [];
      if (totalPages <= 1) return;
      if (currentPageSubmitted === 1) {
        pages = [1, totalPages > 1 ? 2 : null].filter(Boolean);
      } else if (currentPageSubmitted === totalPages) {
        pages = [totalPages - 1, totalPages].filter(p => p > 0);
      } else {
        pages = [currentPageSubmitted - 1, currentPageSubmitted, currentPageSubmitted + 1];
      }

      pages.forEach(page => {
        const btn = document.createElement("button");
        btn.textContent = page;
        btn.className = `btn btn-sm ${page === currentPageSubmitted ? 'btn-primary' : 'btn-outline-primary'}`;
        btn.onclick = () => {
          if (page !== currentPageSubmitted) {
            currentPageSubmitted = page;
            TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
          }
        };
        container.appendChild(btn);
      });

      document.getElementById("pageInfoSubmitted").textContent = `${currentPageSubmitted} / ${totalPages}`;

      document.getElementById("firstPageSubmittedBtn").onclick = () => {
        if (currentPageSubmitted > 1) {
          currentPageSubmitted = 1;
          TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
        }
      };
      document.getElementById("prevPageSubmittedBtn").onclick = () => {
        if (currentPageSubmitted > 1) {
          currentPageSubmitted -= 1;
          TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
        }
      };
      document.getElementById("nextPageSubmittedBtn").onclick = () => {
        if (currentPageSubmitted < totalPages) {
          currentPageSubmitted += 1;
          TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
        }
      };
      document.getElementById("lastPageSubmittedBtn").onclick = () => {
        if (currentPageSubmitted < totalPages) {
          currentPageSubmitted = totalPages;
          TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted);
        }
      };
    },

    async handleTaskSubmission(taskId) {
    try {
        // Show confirmation dialog
      const confirmed = confirm("Are you sure you want to submit this task?");
      if (!confirmed) return;

      // Lấy user_id từ session hoặc localStorage, hoặc dùng default
      const userId = localStorage.getItem('currentUserId') || 1;
      
      await API.submitTask(taskId, userId);

      alert("Task submitted successfully!");
      await this.loadTasks();
    } catch (error) {
      alert("Failed to submit task: " + error.message);

      // Lưu vào localStorage nếu lỗi mạng
      if (!navigator.onLine) {
        let pendingSubmits = JSON.parse(localStorage.getItem("pendingTaskSubmits") || "[]");
        pendingSubmits.push({
          taskId,
          userId: localStorage.getItem('currentUserId') || 1,
          timestamp: Date.now()
        });
        localStorage.setItem("pendingTaskSubmits", JSON.stringify(pendingSubmits));
        alert("Task submission saved locally. It will be retried when you are online.");
      }
    }
  },

    async handleTaskDeletion(taskId) {
      try {
        const confirmed = confirm("Are you sure you want to delete this task?");
        if (!confirmed) return;

        await API.deleteTask(taskId);
        alert("Task deleted successfully!");
        
        // Thêm tham số skipCache=true để không lấy dữ liệu từ cache
        await this.loadTasks(currentPageAvailable, currentPageSubmitted, true);
      } catch (error) {
        alert("Failed to delete task: " + error.message);
      }
    },

    async loadTaskForEdit(taskId) {
    try {
      // Fetch task details
      const response = await fetch(`http://localhost:3000/api/task/${taskId}`);
      if (!response.ok) throw new Error("Failed to fetch task details");
      
      const task = await response.json();
      
      // Populate form fields
      document.getElementById("update-task-id").value = task.task_id;
      document.getElementById("update-task-name").value = task.title;
      document.getElementById("update-task-des").value = task.description || "";
      
      // Format dates for the date picker
      if (task.start_date && task.end_date) {
        const startDate = moment(task.start_date).format("DD/MM/YYYY hh:mm A");
        const endDate = moment(task.end_date).format("DD/MM/YYYY hh:mm A");
        document.getElementById("update-task-time").value = `${startDate} - ${endDate}`;
      }
      
      // Show the modal
      const modal = new bootstrap.Modal(document.getElementById("update-modal"));
      modal.show();
      
    } catch (error) {
      console.error("Error loading task for edit:", error);
      alert("Failed to load task details: " + error.message);
    }
  },

  async updateTask(taskId, taskData) {
    try {
      await API.updateTask(taskId, taskData);
      console.log("Task updated successfully");
      
      // Close modal and reset form
      this.closeUpdateModal();
      
      // Thêm tham số skipCache=true để không lấy dữ liệu từ cache
      await this.loadTasks(currentPageAvailable, currentPageSubmitted, true);
    } catch (error) {
      throw error;
    }
  },

  closeUpdateModal() {
    const modalEl = document.getElementById("update-modal");
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) {
      bsModal.hide();
    }

    // Clear form fields
    const form = document.getElementById("updateTaskForm");
    if (form) {
      form.reset();
    }
  },

  // Thêm hàm closeCreateModal vào TaskManager
  closeCreateModal() {
    const modalEl = document.getElementById("reg-modal");
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) {
      bsModal.hide();
    }

    // Clear form fields
    const titleInput = document.getElementById("modal-task-name");
    const descriptionInput = document.getElementById("modal-task-des");
    const timeRangeInput = document.getElementById("modal-task-time");
    
    if (titleInput) titleInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
    if (timeRangeInput) timeRangeInput.value = '';
  },

    async createTask(taskData) {
      try {
        console.log('🔨 Creating task with data:', taskData);
        
        // Đóng modal tạo task ngay lập tức
        this.closeCreateModal();
        
        // Hiển thị optimistic UI - task xuất hiện ngay lập tức
        const optimisticTask = {
          ...taskData,
          task_id: Date.now(),
          created_at: new Date().toISOString(),
          isOptimistic: true
        };
        
        // Thêm task vào UI ngay lập tức
        this.addOptimisticTask(optimisticTask);
        
        // Hiển thị thông báo thành công
        showSuccessModal('Task created successfully!');
        
        // Gửi request tạo task
        const response = await API.createTask(taskData);
        console.log('✅ Task created successfully:', response);
        
        // Reload tasks để cập nhật với data thực từ server
        setTimeout(() => {
          this.loadTasks(currentPageAvailable, currentPageSubmitted, true);
        }, 1000);
        
        return response;
        
      } catch (error) {
        console.error('❌ Error creating task:', error);
        
        // Nếu có lỗi, vẫn hiển thị thông báo thành công vì đã queue
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          showSuccessModal('Task created and will be synchronized when connection is restored!');
        } else {
          showErrorModal('Failed to create task: ' + (error.message || error));
        }
        
        throw error;
      }
    },

    // Thêm task vào UI optimistic
    addOptimisticTask(task) {
      const availableContainer = document
        .getElementById("panelsStayOpen-collapseOne")
        .querySelector(".accordion-body");
    
      if (!availableContainer) return;
    
      // Tạo element cho task
      const taskElement = TaskElements.createAvailableTaskElement(task);
    
      // Thêm class đặc biệt cho optimistic task
      taskElement.classList.add('optimistic-task');
      taskElement.style.opacity = '0.8';
      taskElement.style.borderLeft = '4px solid #ffc107';
    
      // Thêm vào đầu danh sách
      if (availableContainer.firstChild && availableContainer.firstChild.nodeName !== 'P') {
        availableContainer.insertBefore(taskElement, availableContainer.firstChild);
      } else {
        // Nếu container rỗng, xóa message "No tasks" và thêm task
        availableContainer.innerHTML = '';
        availableContainer.appendChild(taskElement);
      }
    },

    // Cập nhật handleTaskSubmission để sử dụng modal
    async handleTaskSubmission(taskId) {
      try {
        const confirmed = await this.showConfirmationModal(
          'Are you sure you want to submit this task?',
          'Submit Task'
        );
        
        if (!confirmed) return;

        const userId = localStorage.getItem('currentUserId') || 1;
        
        await API.submitTask(taskId, userId);

        showSuccessModal("Task submitted successfully!");
        await this.loadTasks();
      } catch (error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          showSuccessModal("Task submission saved and will be processed when connection is restored!");
        } else {
          showErrorModal("Failed to submit task: " + error.message);
        }

        // Lưu vào localStorage nếu lỗi mạng
        if (!navigator.onLine) {
          let pendingSubmits = JSON.parse(localStorage.getItem("pendingTaskSubmits") || "[]");
          pendingSubmits.push({
            taskId,
            userId: localStorage.getItem('currentUserId') || 1,
            timestamp: Date.now()
          });
          localStorage.setItem("pendingTaskSubmits", JSON.stringify(pendingSubmits));
        }
      }
    },

    // Cập nhật handleTaskDeletion
    async handleTaskDeletion(taskId) {
      try {
        const confirmed = await this.showConfirmationModal(
          'Are you sure you want to delete this task?',
          'Delete Task'
        );
        
        if (!confirmed) return;

        await API.deleteTask(taskId);
        showSuccessModal("Task deleted successfully!");
        
        await this.loadTasks(currentPageAvailable, currentPageSubmitted, true);
      } catch (error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('Network')) {
          showSuccessModal("Task deletion saved and will be processed when connection is restored!");
        } else {
          showErrorModal("Failed to delete task: " + error.message);
        }
      }
    },

    // Thêm hàm confirmation modal
    showConfirmationModal(message, title = 'Confirm') {
      return new Promise((resolve) => {
        const modalContainer = document.getElementById('modal-status-action-container');
        
        modalContainer.innerHTML = `
          <div class="modal fade" id="modal-confirmation-custom" tabindex="-1" aria-labelledby="modal-confirmation-title" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                <div class="modal-header">
                  <h5 class="modal-title d-flex align-items-center" id="modal-confirmation-title">
                    <i class="fa-solid fa-question-circle text-warning me-2"></i>
                    ${title}
                  </h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body text-center py-4">
                  <div class="mb-3">
                    <i class="fa-solid fa-question-circle text-warning" style="font-size: 3rem;"></i>
                  </div>
                  <p class="fs-5 mb-0">${message}</p>
                </div>
                <div class="modal-footer justify-content-center">
                  <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal" id="cancel-btn">
                    <i class="fa-solid fa-times me-2"></i>Cancel
                  </button>
                  <button type="button" class="btn btn-primary" id="confirm-btn">
                    <i class="fa-solid fa-check me-2"></i>Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        
        const modal = new bootstrap.Modal(document.getElementById('modal-confirmation-custom'));
        modal.show();
        
        document.getElementById('confirm-btn').addEventListener('click', () => {
          modal.hide();
          resolve(true);
        });
        
        document.getElementById('cancel-btn').addEventListener('click', () => {
          modal.hide();
          resolve(false);
        });
        
        document.getElementById('modal-confirmation-custom').addEventListener('hidden.bs.modal', function () {
          modalContainer.innerHTML = '';
          resolve(false);
        });
      });
    },

    // ...existing code...
  };

// Thêm hàm error modal
function showErrorModal(message, title = 'Error!') {
  const modalContainer = document.getElementById('modal-status-action-container');
  
  if (!modalContainer) {
    console.error('Modal container not found');
    return;
  }
  
  modalContainer.innerHTML = `
    <div class="modal fade" id="modal-error-notification" tabindex="-1" aria-labelledby="modal-error-title" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title d-flex align-items-center" id="modal-error-title">
              <i class="fa-solid fa-circle-exclamation me-2"></i>
              ${title}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body text-center py-4">
            <div class="mb-3">
              <i class="fa-solid fa-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
            </div>
            <p class="fs-5 mb-0">${message}</p>
          </div>
          <div class="modal-footer justify-content-center">
            <button type="button" class="btn btn-danger px-4" data-bs-dismiss="modal">
              <i class="fa-solid fa-times me-2"></i>Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const modal = new bootstrap.Modal(document.getElementById('modal-error-notification'));
  modal.show();
  
  document.getElementById('modal-error-notification').addEventListener('hidden.bs.modal', function () {
    modalContainer.innerHTML = '';
  });
}

// ==================== SEARCH FUNCTIONALITY ====================
  const SearchManager = {
  currentSearchQuery: "",
  isSearching: false,

  init() {
    const searchInput = document.getElementById("searchSubject");
    if (!searchInput) return;

    // Clear search button
    const clearSearchBtn = this.createClearSearchButton(searchInput);
    
    const debouncedSearch = this.debounce(async (query) => {
      this.currentSearchQuery = query.trim();
      await this.performSearch();
    }, 300); // Giảm debounce time

    searchInput.addEventListener("input", (e) => {
      const query = e.target.value;
      
      // Show/hide clear button
      if (query.length > 0) {
        clearSearchBtn.style.display = 'block';
      } else {
        clearSearchBtn.style.display = 'none';
      }

      // Nếu query rỗng, clear search ngay lập tức
      if (query.trim() === "") {
        this.clearSearchImmediate();
        return;
      }

      debouncedSearch(query);
    });

    searchInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.currentSearchQuery = searchInput.value.trim();
        await this.performSearch();
      }
      
      if (e.key === "Escape") {
        this.clearSearch();
      }
    });
  },

  createClearSearchButton(searchInput) {
    // Check if clear button already exists
    let clearBtn = document.getElementById("clearSearchBtn");
    if (clearBtn) return clearBtn;

    // Create clear button
    clearBtn = document.createElement("button");
    clearBtn.id = "clearSearchBtn";
    clearBtn.type = "button";
    clearBtn.className = "search-clear-btn";
    clearBtn.style.cssText = `
      position: absolute;
      right: 40px;
      top: 50%;
      transform: translateY(-50%);
      border: none;
      background: none;
      font-size: 16px;
      cursor: pointer;
      display: none;
      z-index: 10;
      color: #6c757d;
      padding: 4px;
    `;
    clearBtn.innerHTML = '<i class="fas fa-times"></i>';
    clearBtn.title = "Clear search";

    // Add click handler
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.clearSearch();
    });

    // Insert after search input
    const searchContainer = searchInput.parentElement;
    searchContainer.style.position = 'relative';
    searchContainer.appendChild(clearBtn);

    return clearBtn;
  },

  async performSearch() {
    if (this.isSearching) return;
    this.isSearching = true;

    try {
      if (!this.currentSearchQuery) {
        this.clearSearchImmediate();
        return;
      }

      this.showSearchMode();
      console.log('🔍 Searching for:', this.currentSearchQuery);

      // Search in both available and submitted tasks
      const [availableResults, submittedResults] = await Promise.all([
        API.searchTasks(this.currentSearchQuery, "not_completed", currentPageAvailable),
        API.searchTasks(this.currentSearchQuery, "completed", currentPageSubmitted)
      ]);

      // Render results
      TaskManager.renderTasks(availableResults.tasks, "available");
      TaskManager.renderTasks(submittedResults.tasks, "submitted");

      // Update pagination
      TaskManager.renderAvailablePagination(availableResults.total);
      TaskManager.renderSubmittedPagination(submittedResults.total);

      // Show search results info
      this.showSearchResults(availableResults.total + submittedResults.total);

    } catch (error) {
      console.error("Search failed:", error);
      showNotification("Search failed: " + error.message, 'danger');
    } finally {
      this.isSearching = false;
    }
  },

  clearSearchImmediate() {
    this.currentSearchQuery = "";
    this.hideSearchMode();
    
    // Reset to page 1 and reload normal tasks immediately
    currentPageAvailable = 1;
    currentPageSubmitted = 1;
    TaskManager.loadTasks(1, 1, true);
  },

  clearSearch() {
    const searchInput = document.getElementById("searchSubject");
    const clearBtn = document.getElementById("clearSearchBtn");
    
    if (searchInput) {
      searchInput.value = "";
      searchInput.focus();
    }
    
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }

    this.clearSearchImmediate();
  },

  showSearchMode() {
    // Hide search indicator if showing
    this.hideSearchIndicator();
    
    // Add search mode class to main container
    const taskContainer = document.getElementById("task");
    if (taskContainer) {
      taskContainer.classList.add("search-mode");
    }
  },

  hideSearchMode() {
    // Remove search mode class
    const taskContainer = document.getElementById("task");
    if (taskContainer) {
      taskContainer.classList.remove("search-mode");
    }
    
    // Hide all search-related elements
    this.hideSearchIndicator();
    this.hideSearchResults();
  },

  showSearchIndicator() {
    // Create or show search indicator (minimal)
    let indicator = document.getElementById("searchIndicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "searchIndicator";
      indicator.className = "search-indicator";
      indicator.innerHTML = `
        <div class="d-flex align-items-center justify-content-center py-2">
          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
          <span>Searching...</span>
        </div>
      `;
      
      // Insert before accordion
      const accordion = document.querySelector(".accordion");
      if (accordion) {
        accordion.parentElement.insertBefore(indicator, accordion);
      }
    } else {
      indicator.style.display = 'block';
    }
  },

  hideSearchIndicator() {
    const indicator = document.getElementById("searchIndicator");
    if (indicator) {
      indicator.style.display = 'none';
    }
  },

  showSearchResults(totalFound) {
    // Create or update search results info (more compact)
    let resultsInfo = document.getElementById("searchResultsInfo");
    if (!resultsInfo) {
      resultsInfo = document.createElement("div");
      resultsInfo.id = "searchResultsInfo";
      resultsInfo.className = "search-results-info";
      
      // Insert before accordion
      const accordion = document.querySelector(".accordion");
      if (accordion) {
        accordion.parentElement.insertBefore(resultsInfo, accordion);
      }
    }

    resultsInfo.innerHTML = `
      <div class="alert alert-info d-flex justify-content-between align-items-center mb-3">
        <span>
          <i class="fas fa-search me-2"></i>
          Found <strong>${totalFound}</strong> task(s) matching "<em>${this.currentSearchQuery}</em>"
        </span>
        <button type="button" class="btn btn-sm btn-outline-info" onclick="SearchManager.clearSearch()">
          <i class="fas fa-times me-1"></i>Clear
        </button>
      </div>
    `;
    resultsInfo.style.display = 'block';
  },

  hideSearchResults() {
    const resultsInfo = document.getElementById("searchResultsInfo");
    if (resultsInfo) {
      resultsInfo.style.display = 'none';
    }
  },

  debounce(fn, delay) {
    let handle = null;
    return (...args) => {
      clearTimeout(handle);
      handle = setTimeout(() => fn(...args), delay);
    };
  }
};


  // ==================== FORM HANDLERS ====================
  const FormManager = {
    init() {
      const createForm = document.getElementById("createTaskForm");
      if (createForm) {
      createForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleCreateTaskSubmission();
      });
    }
    
    const updateForm = document.getElementById("updateTaskForm");
    if (updateForm) {
      updateForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleUpdateTaskSubmission();
      });
    }

    // Add update button handler
    const updateBtn = document.getElementById("updateTaskBtn");
    if (updateBtn) {
      updateBtn.addEventListener("click", async () => {
        await this.handleUpdateTaskSubmission();
      });
    }
  },

async handleCreateTaskSubmission() {
  const titleInput = document.getElementById("modal-task-name");
  const descriptionInput = document.getElementById("modal-task-des");
  const timeRangeInput = document.getElementById("modal-task-time");

  const title = titleInput?.value?.trim() || "";
  const description = descriptionInput?.value?.trim() || "";
  const timeRangeStr = timeRangeInput?.value?.trim() || "";

  // Validation
  if (!title) {
    alert("Please enter a title.");
    return;
  }

  if (!timeRangeStr) {
    alert("Please select a date and time.");
    return;
  }

  console.log("Raw time range input:", timeRangeStr);

  let startDateISO = null;
  let endDateISO = null;

  try {
    const dateRangeParts = timeRangeStr.split(' - ');
    
    if (dateRangeParts.length === 2) {
      const startDateStr = dateRangeParts[0].trim();
      const endDateStr = dateRangeParts[1].trim();
      
      let startMoment = moment(startDateStr, "DD/MM/YYYY hh:mm A");
      if (!startMoment.isValid()) {
        startMoment = moment(startDateStr, "DD/MM/YYYY h:mm A");
      }
      if (!startMoment.isValid()) {
        startMoment = moment(startDateStr, "MM/DD/YYYY hh:mm A");
      }
      
      let endMoment = moment(endDateStr, "DD/MM/YYYY hh:mm A");
      if (!endMoment.isValid()) {
        endMoment = moment(endDateStr, "DD/MM/YYYY h:mm A");
      }
      if (!endMoment.isValid()) {
        endMoment = moment(endDateStr, "MM/DD/YYYY hh:mm A");
      }
      
      if (startMoment.isValid() && endMoment.isValid()) {
        startDateISO = startMoment.toISOString();
        endDateISO = endMoment.toISOString();
      } else {
        throw new Error("Invalid date format");
      }
    }
  } catch (error) {
    console.error("Date parsing error:", error);
    alert("Invalid date/time format. Please check your input.");
    return;
  }

  if (!startDateISO || !endDateISO) {
    alert("Please provide valid start and end dates.");
    return;
  }

    // Validate dates
    const now = new Date();
    const startDate = new Date(startDateISO);
    const currentDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    
    if (startDateOnly < currentDateOnly) {
      alert("Start date cannot be in the past. Please select a current or future date.");
      return;
    }
    
    if (startDateOnly.getTime() === currentDateOnly.getTime()) {
      if (startDate < now) {
        alert("Start time cannot be in the past. Please select a current or future time.");
        return;
      }
    }

    if (new Date(endDateISO) <= new Date(startDateISO)) {
      alert("End date must be after start date.");
      return;
    }

    const payload = {
      subject_id: parseInt(subjectId, 10),
      team_id: parseInt(teamId, 10),
      title: title,
      description: description,
      start_date: startDateISO,
      end_date: endDateISO,
      status: 'pending'
    };

    if (!payload.subject_id || !payload.team_id) {
      alert("Missing subject or team information.");
      return;
    }

    console.log("Final payload being sent:", payload);

    try {
      await TaskManager.createTask(payload);
    } catch (error) {
      console.error("Task creation error:", error);
      alert("Failed to create task: " + (error.message || error));
    }
  },

  async handleUpdateTaskSubmission() {
    const taskIdInput = document.getElementById("update-task-id");
    const titleInput = document.getElementById("update-task-name");
    const descriptionInput = document.getElementById("update-task-des");
    const timeRangeInput = document.getElementById("update-task-time");

    const taskId = taskIdInput?.value;
    const title = titleInput?.value?.trim() || "";
    const description = descriptionInput?.value?.trim() || "";
    const timeRangeStr = timeRangeInput?.value?.trim() || "";

    // Validation
    if (!taskId) {
      alert("Task ID is missing.");
      return;
    }

    if (!title) {
      alert("Please enter a title.");
      return;
    }

    console.log("Raw time range input:", timeRangeStr); // Debug log

    let startDateISO = null;
    let endDateISO = null;

    // Parse dates if provided
    if (timeRangeStr) {
      try {
        const dateRangeParts = timeRangeStr.split(' - ');
        
        if (dateRangeParts.length === 2) {
          const startDateStr = dateRangeParts[0].trim();
          const endDateStr = dateRangeParts[1].trim();
          
          console.log("Start date string:", startDateStr);
          console.log("End date string:", endDateStr);
          
          // Try different moment.js parsing formats
          let startMoment = moment(startDateStr, "DD/MM/YYYY hh:mm A");
          if (!startMoment.isValid()) {
            startMoment = moment(startDateStr, "DD/MM/YYYY h:mm A");
          }
          if (!startMoment.isValid()) {
            startMoment = moment(startDateStr, "MM/DD/YYYY hh:mm A");
          }
          
          let endMoment = moment(endDateStr, "DD/MM/YYYY hh:mm A");
          if (!endMoment.isValid()) {
            endMoment = moment(endDateStr, "DD/MM/YYYY h:mm A");
          }
          if (!endMoment.isValid()) {
            endMoment = moment(endDateStr, "MM/DD/YYYY hh:mm A");
          }
          
          if (startMoment.isValid() && endMoment.isValid()) {
            startDateISO = startMoment.toISOString();
            endDateISO = endMoment.toISOString();
          } else {
            throw new Error("Invalid date format");
          }
        }
      } catch (error) {
        console.error("Date parsing error:", error);
        alert("Invalid date/time format. Please check your input.");
        return;
      }

      // Validate that end date is after start date
      if (startDateISO && endDateISO && new Date(endDateISO) <= new Date(startDateISO)) {
        alert("End date must be after start date.");
        return;
      }
    }

    // Build payload for update
    const payload = {
      title: title,
      description: description,
    };

    // Only include dates if they were provided and parsed successfully
    if (startDateISO) payload.start_date = startDateISO;
    if (endDateISO) payload.end_date = endDateISO;

    console.log("Update payload being sent:", payload); // Debug log

    try {
      await TaskManager.updateTask(taskId, payload);
      alert("Task updated successfully!");
    } catch (error) {
      console.error("Task update error:", error);
      alert("Failed to update task: " + (error.message || error));
    }
  }
};

function retryPendingTaskSubmits() {
  if (!navigator.onLine) return;
  let pendingSubmits = JSON.parse(localStorage.getItem("pendingTaskSubmits") || "[]");
  if (pendingSubmits.length === 0) return;

  pendingSubmits.sort((a, b) => a.timestamp - b.timestamp);

  (async () => {
    for (const item of pendingSubmits) {
      try {
        await API.submitTask(item.taskId, item.userId);
      } catch (e) {
        continue;
      }
      pendingSubmits = pendingSubmits.filter(x => x.taskId !== item.taskId);
      localStorage.setItem("pendingTaskSubmits", JSON.stringify(pendingSubmits));
      await TaskManager.loadTasks();
    }
  })();
}

// Lắng nghe sự kiện online
window.addEventListener("online", retryPendingTaskSubmits);

// Gọi thử khi khởi động
retryPendingTaskSubmits();

  // ==================== INITIALIZATION ====================
  function init() {
    // Initialize all managers
    SearchManager.init();
    FormManager.init();
    
    // Load initial tasks
    TaskManager.loadTasks();
  }

  // Start the application
  init();
});

// Thêm hàm hiển thị modal success có sẵn
function showSuccessModal(message, title = 'Success!') {
  const modalContainer = document.getElementById('modal-status-action-container');
  
  if (!modalContainer) {
    console.error('Modal container not found');
    return;
  }
  
  modalContainer.innerHTML = `
    <div class="modal fade" id="modal-success-notification" tabindex="-1" aria-labelledby="modal-success-title" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title d-flex align-items-center" id="modal-success-title">
              <i class="fa-solid fa-circle-check me-2"></i>
              ${title}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body text-center py-4">
            <div class="mb-3">
              <i class="fa-solid fa-check-circle text-success" style="font-size: 3rem;"></i>
            </div>
            <p class="fs-5 mb-0">${message}</p>
          </div>
          <div class="modal-footer justify-content-center">
            <button type="button" class="btn btn-success px-4" data-bs-dismiss="modal">
              <i class="fa-solid fa-thumbs-up me-2"></i>OK
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  const modal = new bootstrap.Modal(document.getElementById('modal-success-notification'));
  modal.show();
  
  setTimeout(() => {
    modal.hide();
  }, 3000);
  
  document.getElementById('modal-success-notification').addEventListener('hidden.bs.modal', function () {
    modalContainer.innerHTML = '';
  });
}