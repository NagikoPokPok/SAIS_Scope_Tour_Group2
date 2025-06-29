let currentPageAvailable = 1;
let currentPageSubmitted = 1;
let tasksPerPage = 5;
document.addEventListener("DOMContentLoaded", function () {
  // ==================== INITIALIZATION ====================
  const urlParams = new URLSearchParams(window.location.search);
  const subjectId = urlParams.get("subjectId");
  const teamId = urlParams.get("teamId");
  const subjectName = urlParams.get("subjectName");

  // Display subject name in header
  if (subjectName) {
    const headerEl = document.querySelector(".subject-name");
    if (headerEl) headerEl.textContent = subjectName;
  }

  // Validate required parameters
  if (!subjectId || !teamId) {
    console.error("Missing subjectId or teamId in URL.");
    alert("Cannot load tasks: Missing subject or team information.");
    return;
  }

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
      const dueDate = new Date(task.due_date);
      const createdDate = new Date(task.created_at);

      if (dueDate < today) {
        return "Overdue";
      } else if (today >= createdDate && today <= dueDate) {
        return "In progress";
      }
      return "Upcoming";
    }
  };

  // ==================== API FUNCTIONS ====================
  const API = {
    async fetchTasks(page = 1, limit = tasksPerPage, status = "") {
      // try {
      //   const response = await fetch(
      //     `http://localhost:3000/api/task?subjectId=${subjectId}&teamId=${teamId}&page=${page}&limit=${limit}`
      //   );
      //   if (!response.ok) throw new Error("Failed to fetch tasks");
      //   return await response.json();
      // } catch (error) {
      //   console.error("Error fetching tasks:", error);
      //   throw error;
      // }
      try {
        let url = `http://localhost:3000/api/task?subjectId=${subjectId}&teamId=${teamId}&page=${page}&limit=${limit}`;
        if (status) url += `&status=${status}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch tasks");
        return await response.json();
      } catch (error) {
        console.error("Error fetching tasks:", error);
        throw error;
      }
    },

    async searchTasks(query) {
      try {
        const response = await fetch(
          `http://localhost:3000/api/task?subjectId=${subjectId}&teamId=${teamId}&search=${encodeURIComponent(query)}`
        );
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

    async submitTask(taskId) {
      try {
        const response = await fetch(`http://localhost:3000/api/task/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            status: "completed",
            completed_at: new Date().toISOString()
          }),
        });
        if (!response.ok) throw new Error("Failed to submit task");
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
      const createdDate = DateUtils.formatDate(new Date(task.created_at));
      const dueDate = DateUtils.formatDate(new Date(task.due_date));

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
              <span class="open-time text-secondary">${createdDate}</span>
              <hr />
              <span class="end-time text-secondary">${dueDate}</span>
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
    // async loadTasks(page = 1) {
    //   // try {
    //   //   const { tasks } = await API.fetchTasks();
    //   //   this.renderTasks(tasks, "all");
    //   // } catch (error) {
    //   //   alert("Failed to load tasks");
    //   // }
    // },
    // async loadTasks() {
    //   try {
    //     const { tasks } = await API.fetchTasks();

    //     // Tách riêng
    //     const allAvailableTasks = tasks.filter((t) => t.status !== "completed");
    //     const allSubmittedTasks = tasks.filter((t) => t.status === "completed");

    //     // Gán lưu lại nếu cần dùng lại
    //     this.allAvailableTasks = allAvailableTasks;
    //     this.allSubmittedTasks = allSubmittedTasks;

    //     // Phân trang available
    //     const startA = (currentPageAvailable - 1) * tasksPerPage;
    //     const paginatedAvailable = allAvailableTasks.slice(startA, startA + tasksPerPage);

    //     // Phân trang submitted
    //     const startS = (currentPageSubmitted - 1) * tasksPerPage;
    //     const paginatedSubmitted = allSubmittedTasks.slice(startS, startS + tasksPerPage);

    //     // Render từng loại
    //     this.renderTasks(paginatedAvailable, "available");
    //     this.renderTasks(paginatedSubmitted, "submitted");

    //     // Render phân trang
    //     this.renderAvailablePagination(allAvailableTasks.length);
    //     this.renderSubmittedPagination(allSubmittedTasks.length);
    //   } catch (error) {
    //     alert("Failed to load tasks");
    //     console.error(error);
    //   }
    // },
    async loadTasks(pageAvailable = currentPageAvailable, pageSubmitted = currentPageSubmitted) {
      try {
        // Lấy available tasks
        const { tasks: availableTasks, total: totalAvailable } = await API.fetchTasks(pageAvailable, tasksPerPage, "not_completed");
        // Lấy submitted tasks
        const { tasks: submittedTasks, total: totalSubmitted } = await API.fetchTasks(pageSubmitted, tasksPerPage, "completed"); // Nếu API hỗ trợ lọc status

        this.renderTasks(availableTasks, "available");
        this.renderTasks(submittedTasks, "submitted");

        this.renderAvailablePagination(totalAvailable);
        this.renderSubmittedPagination(totalSubmitted);
      } catch (error) {
        alert("Failed to load tasks");
        console.error(error);
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

    // renderTasks(tasks, taskType) {
    //   const availableContainer = document
    //     .getElementById("panelsStayOpen-collapseOne")
    //     .querySelector(".accordion-body");
    //   const submittedContainer = document
    //     .getElementById("panelsStayOpen-collapseTwo")
    //     .querySelector(".accordion-body");

    //   // Clear containers
    //   if (taskType === "available" || taskType === "all") {
    //     availableContainer.innerHTML = "";
    //   }
    //   if (taskType === "submitted" || taskType === "all") {
    //     submittedContainer.innerHTML = "";
    //   }

    //   if (!tasks || tasks.length === 0) {
    //     this.renderEmptyState(availableContainer, submittedContainer, taskType);
    //     return;
    //   }

    //   // Partition tasks by status
    //   const availableTasks = tasks.filter((t) => t.status !== "completed");
    //   const submittedTasks = tasks.filter((t) => t.status === "completed");

    //   // Paginate available
    //   const startA = (currentPageAvailable - 1) * tasksPerPage;
    //   const endA = startA + tasksPerPage;
    //   const paginatedAvailable = availableTasks.slice(startA, endA);

    //   // Paginate submitted
    //   const startS = (currentPageSubmitted - 1) * tasksPerPage;
    //   const endS = startS + tasksPerPage;
    //   const paginatedSubmitted = submittedTasks.slice(startS, endS);

    //   // Render available tasks
    //   if (taskType === "available" || taskType === "all") {
    //     if (paginatedAvailable.length > 0) {
    //       paginatedAvailable.forEach((task) => {
    //         availableContainer.appendChild(TaskElements.createAvailableTaskElement(task));
    //       });
    //     } else {
    //       availableContainer.innerHTML = "<p class='text-center'>No available tasks</p>";
    //     }
    //   }

    //   // Render submitted tasks
    //   if (taskType === "submitted" || taskType === "all") {
    //     if (paginatedSubmitted.length > 0) {
    //       paginatedSubmitted.forEach((task) => {
    //         submittedContainer.appendChild(TaskElements.createSubmittedTaskElement(task));
    //       });
    //     } else {
    //       submittedContainer.innerHTML = "<p class='text-center'>No submitted tasks</p>";
    //     }
    //   }

      
    // },
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
      const pageInfo = document.getElementById("pageInfo");

      if (!container) return;
      container.innerHTML = "";

      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = `btn btn-sm ${i === currentPageAvailable ? 'btn-primary' : 'btn-outline-primary'}`;
        btn.onclick = () => {
          currentPageAvailable = i;
          TaskManager.loadTasks();
        };
        container.appendChild(btn);
      }

      if (pageInfo) pageInfo.textContent = `${currentPageAvailable} / ${totalPages}`;

      document.getElementById("firstPageBtn").onclick = () => TaskManager.loadTasks(1);
      document.getElementById("prevPageBtn").onclick = () => {
        if (currentPageAvailable > 1) TaskManager.loadTasks(currentPageAvailable - 1);
      };
      document.getElementById("nextPageBtn").onclick = () => {
        if (currentPageAvailable < totalPages) TaskManager.loadTasks(currentPageAvailable + 1);
      };
      document.getElementById("lastPageBtn").onclick = () => TaskManager.loadTasks(totalPages);
    },

    // renderSubmittedPagination(totalCount) {
    //   const totalPages = Math.ceil(totalCount / tasksPerPage);
    //   const container = document.getElementById("pageNumbersSubmitted");
    //   const pageInfo = document.getElementById("submittedPageInfo");

    //   if (!container) return;
    //   container.innerHTML = "";

    //   for (let i = 1; i <= totalPages; i++) {
    //     const btn = document.createElement("button");
    //     btn.textContent = i;
    //     btn.className = `btn btn-sm ${i === currentPageSubmitted ? 'btn-primary' : 'btn-outline-primary'}`;
    //     btn.onclick = () => {
    //       currentPageSubmitted = i;
    //       TaskManager.loadTasks();
    //     };
    //     container.appendChild(btn);
    //   }

    //   if (pageInfo) pageInfo.textContent = `${currentPageSubmitted} / ${totalPages}`;

    //   document.getElementById("firstPageSubmittedBtn").onclick = () => TaskManager.loadTasks(1);
    //   document.getElementById("prevPageSubmittedBtn").onclick = () => {
    //     if (currentPageSubmitted > 1) TaskManager.loadTasks(currentPageSubmitted - 1);
    //   };
    //   document.getElementById("nextPageSubmittedBtn").onclick = () => {
    //     if (currentPageSubmitted < totalPages) TaskManager.loadTasks(currentPageSubmitted + 1);
    //   };
    //   document.getElementById("lastPageSubmittedBtn").onclick = () => TaskManager.loadTasks(totalPages);
    // },
    renderSubmittedPagination(totalCount) {
    const totalPages = Math.ceil(totalCount / tasksPerPage);
    const container = document.getElementById("pageNumbersSubmitted");
    const pageInfo = document.getElementById("submittedPageInfo");

    if (!container) return;
    container.innerHTML = "";

    // Đoạn này cần tạo các nút số trang như phần available
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.className = `btn btn-sm ${i === currentPageSubmitted ? 'btn-primary' : 'btn-outline-primary'}`;
      btn.onclick = () => {
        currentPageSubmitted = i;
        TaskManager.loadTasks(currentPageAvailable, i);
      };
      container.appendChild(btn);
    }

    if (pageInfo) pageInfo.textContent = `${currentPageSubmitted} / ${totalPages}`;

    document.getElementById("firstPageSubmittedBtn").onclick = () => TaskManager.loadTasks(currentPageAvailable, 1);
    document.getElementById("prevPageSubmittedBtn").onclick = () => {
      if (currentPageSubmitted > 1) TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted - 1);
    };
    document.getElementById("nextPageSubmittedBtn").onclick = () => {
      if (currentPageSubmitted < totalPages) TaskManager.loadTasks(currentPageAvailable, currentPageSubmitted + 1);
    };
    document.getElementById("lastPageSubmittedBtn").onclick = () => TaskManager.loadTasks(currentPageAvailable, totalPages);
},

    updatePageInfo(current, total) {
      const pageInfo = document.getElementById("pageInfo");
      if (pageInfo) {
        pageInfo.textContent = `${current} / ${total}`;
      }
    },

    renderPagination(totalPages) {
      const pageContainer = document.getElementById("pageNumbers");
      if (!pageContainer) return;

      pageContainer.innerHTML = "";

      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'}`;
        btn.addEventListener("click", () => {
          this.loadTasks(i);
        });
        pageContainer.appendChild(btn);
      }
    },

    attachPaginationListeners(totalPages) {
      const firstBtn = document.getElementById("firstPageBtn");
      const prevBtn = document.getElementById("prevPageBtn");
      const nextBtn = document.getElementById("nextPageBtn");
      const lastBtn = document.getElementById("lastPageBtn");

      if (!firstBtn || !prevBtn || !nextBtn || !lastBtn) return;

      firstBtn.onclick = () => {
        if (currentPage > 1) this.loadTasks(1);
      };

      prevBtn.onclick = () => {
        if (currentPage > 1) this.loadTasks(currentPage - 1);
      };

      nextBtn.onclick = () => {
        if (currentPage < totalPages) this.loadTasks(currentPage + 1);
      };

      lastBtn.onclick = () => {
        if (currentPage < totalPages) this.loadTasks(totalPages);
      };
    },


    renderEmptyState(availableContainer, submittedContainer, taskType) {
      if (taskType === "available" || taskType === "all") {
        availableContainer.innerHTML = "<p class='text-center'>No available tasks</p>";
      }
      if (taskType === "submitted" || taskType === "all") {
        submittedContainer.innerHTML = "<p class='text-center'>No submitted tasks</p>";
      }
    },

    async handleTaskSubmission(taskId) {
      try {
        // Show confirmation dialog
        const confirmed = confirm("Are you sure you want to submit this task?");
        if (!confirmed) return;

        await API.submitTask(taskId);
        
        // Show success message
        alert("Task submitted successfully!");
        
        // Reload tasks to reflect changes
        await this.loadTasks();
      } catch (error) {
        alert("Failed to submit task: " + error.message);
      }
    },

    async handleTaskDeletion(taskId) {
      try {
        const confirmed = confirm("Are you sure you want to delete this task?");
        if (!confirmed) return;

        await API.deleteTask(taskId);
        alert("Task deleted successfully!");
        await this.loadTasks();
      } catch (error) {
        alert("Failed to delete task: " + error.message);
      }
    },

    handleTaskEdit(taskId) {
      // You can implement edit functionality here
      console.log("Edit task:", taskId);
      // For now, just show an alert
      alert("Edit functionality to be implemented");
    },

    handleTaskComment(taskId) {
      // You can implement comment functionality here
      console.log("Comment on task:", taskId);
      // For now, just show an alert
      alert("Comment functionality to be implemented");
    },

    async createTask(taskData) {
      try {
        await API.createTask(taskData);
        console.log("Task created successfully");
        
        // Close modal and reset form
        this.closeCreateModal();
        
        // Reload tasks
        await this.loadTasks();
      } catch (error) {
        throw error;
      }
    },

    closeCreateModal() {
      const modalEl = document.getElementById("reg-modal");
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) {
        bsModal.hide();
      }

      // Clear form fields
      const form = document.getElementById("createTaskForm");
      if (form) {
        form.reset();
      }
    }
  };

  // ==================== SEARCH FUNCTIONALITY ====================
  const SearchManager = {
    init() {
      const searchInput = document.getElementById("searchSubject");
      if (!searchInput) return;

      const debouncedSearch = this.debounce((query) => {
        const trimmed = query.trim();
        if (trimmed) {
          TaskManager.searchTasks(trimmed);
        } else {
          TaskManager.loadTasks();
        }
      }, 300);

      searchInput.addEventListener("input", () => {
        debouncedSearch(searchInput.value);
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const trimmed = searchInput.value.trim();
          if (trimmed) {
            TaskManager.searchTasks(trimmed);
          } else {
            TaskManager.loadTasks();
          }
        }
      });
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
      if (!createForm) return;

      createForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleCreateTaskSubmission();
      });
    },

    async handleCreateTaskSubmission() {
      const titleInput = document.getElementById("modal-task-name");
      const descriptionInput = document.getElementById("modal-task-des");
      const dueDateInput = document.getElementById("modal-task-time");

      const title = titleInput.value.trim();
      const description = descriptionInput.value.trim();
      const dueDateStr = dueDateInput.value.trim();

      // Validation
      if (!title) {
        alert("Please enter a title.");
        return;
      }

      // Parse date using moment.js
      let dueDateISO = null;
      if (dueDateStr) {
        const m = moment(dueDateStr, "DD/MM/YYYY hh:mm A");
        if (!m.isValid()) {
          alert("Invalid date/time format.");
          return;
        }
        dueDateISO = m.toISOString();
      }

      // Build payload
      const payload = {
        subject_id: subjectId,
        team_id: teamId,
        title: title,
        description: description,
        due_date: dueDateISO,
      };

      try {
        await TaskManager.createTask(payload);
      } catch (error) {
        alert("Failed to create task: " + error.message);
      }
    }
  };

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