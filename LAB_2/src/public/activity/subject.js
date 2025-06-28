document.addEventListener("DOMContentLoaded", function () {
    const colors = ["#E08963", "#5E96AE", "#f15f0e", "#A2C139"];
    const urlParams = new URLSearchParams(window.location.search);
    const teamId = urlParams.get('teamId');
    // Function to render subjects dynamically
    function renderSubjects(subjects, isSearch = false) {
        const subjectList = document.getElementById("SubjectList");
        subjectList.innerHTML = ""; // Xóa danh sách cũ
    
        if (subjects && subjects.length > 0) {
            subjects.forEach((subject, index) => {
                const li = document.createElement("li");
                li.style.setProperty("--cardColor", colors[index % colors.length]); // Luân phiên màu sắc
    
                li.innerHTML = `
                    <a href="team-task.html?teamId=${subject.team_id}&subjectId=${subject.subject_id}" class="content">
                        <div class="icon">😁</div>
                        <div class="subject-des">
                            <div class="title">${subject.name}</div>
                            <span class="body text-body-light">${subject.description || "No description available"}</span>
                        </div>
                    </a>
                    <div class="action container border-0 d-flex justify-content-end align-items-center">
                        <div class="row gap-4">
                            <div class="col fs-5 action-add-member">
                                <i class="fa-solid fa-user-plus text-primary"></i>
                            </div>
                            <div class="col fs-5 action-edit" data-subject-id="${subject.subject_id}" data-subject-name="${subject.name}">
                                <i class="fa-solid fa-pen-to-square text-primary"></i>
                            </div>
                            <div class="col fs-5 action-delete" data-subject-id="${subject.subject_id}">
                                <i class="fa-solid fa-trash-can text-primary"></i>
                            </div>
                        </div>
                    </div>
                `;
    
                subjectList.appendChild(li);
            });
    
            // Delete Subject event
            document.querySelectorAll(".action-delete").forEach((button) => {
                button.addEventListener("click", async (event) => {
                    const subjectId = event.currentTarget.getAttribute("data-subject-id");
                    if (subjectId && confirm("Are you sure you want to delete this subject?")) {
                        await deleteSubject(subjectId);
                    } else {
                        console.error("Invalid subject ID:", subjectId);
                    }
                });
            });

            // Update Subject event
            document.querySelectorAll('.action-edit').forEach((button) => {
                button.addEventListener("click", (event) => {
                    const subjectId = event.currentTarget.getAttribute("data-subject-id");
                    const subjectName = event.currentTarget.getAttribute("data-subject-name");
                    openUpdateSubjectModal(subjectId, subjectName);
                });
            });
            
        } else {
            subjectList.innerHTML = isSearch
                ? "<li>No subjects match your search</li>"
                : "<li>No subjects available</li>";
        }
    }

    // Fetch all Subjects
    async function fetchAllSubjects() {
        const SubjectList = document.getElementById("SubjectList");
        SubjectList.innerHTML = "<li>Loading...</li>";
        try {
          let url = "http://localhost:3000/api/subject";
          if (teamId) {
            url += `?teamId=${teamId}`;
          }
          const response = await fetch(url);
          if (!response.ok) throw new Error("Network response was not ok");
          const data = await response.json();
          renderSubjects(data.Subjects, false);
        } catch (error) {
          console.error("Error fetching all Subjects:", error);
          SubjectList.innerHTML = "<li>Error loading Subjects</li>";
        }
      }
      

    // Search Subjects based on query
    async function searchSubjects(searchQuery) {
        const SubjectList = document.getElementById("SubjectList");
        SubjectList.innerHTML = "<li>Searching...</li>";

        const urlParams = new URLSearchParams(window.location.search);
        const teamId = urlParams.get('teamId');

        try {
            let url = `http://localhost:3000/api/Subject?search=${encodeURIComponent(
                searchQuery.trim()
            )}`;

            if (teamId) {
                url += `&teamId=${encodeURIComponent(teamId)}`; // Append teamId if available
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();
            renderSubjects(data.Subjects, true); // Pass isSearch=true for search-specific messaging
        } catch (error) {
            console.error("Error searching Subjects:", error);
            SubjectList.innerHTML = "<li>Error searching Subjects</li>";
        }
    }

    // Debounce helper to limit API calls
    function debounce(func, delay) {
        let timeout;
        return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
        };
    }

    // Setup search functionality
    const searchInput = document.getElementById("searchSubject");
    if (searchInput) {
        const debouncedSearch = debounce((query) => {
        const trimmedQuery = query.trim();
        if (trimmedQuery) {
            searchSubjects(trimmedQuery); // Search when there's a query
        } else {
            fetchAllSubjects(); // Fetch all Subjects only when search is cleared
        }
        }, 300);

        searchInput.addEventListener("input", () => {
            debouncedSearch(searchInput.value);
        });

        searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
            searchSubjects(query); // Immediate search on Enter
            } else {
            fetchAllSubjects(); // Immediate fetch all on Enter when empty
            }
        }
        });
    }

    const params = new URLSearchParams(window.location.search);
    const currentTeamId = params.get('teamId');
    // Create subject
    const createSubjectForm = document.getElementById("createSubjectForm");
    if (createSubjectForm) {
      createSubjectForm.addEventListener("submit", async (event) => {
        event.preventDefault();
  
        const subjectName = document.getElementById("modal-subject-name").value.trim();
        const subjectDesc = document.getElementById("modal-subject-des").value.trim();
  
        if (!subjectName) {
          alert("Subject name is required.");
          return;
        }
        if (!currentTeamId) {
          alert("No team ID found in the URL! Cannot create subject for a specific team.");
          return;
        }
  
        try {
          const response = await fetch("http://localhost:3000/api/subject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subjectName,
              description: subjectDesc,
              teamId: currentTeamId
            })
          });
  
          const result = await response.json();
          if (response.ok) {
            alert(result.message);
            const currentQuery = searchInput.value.trim();
            if (currentQuery) {
                searchSubjects(currentQuery); // Refresh with current search query
            } else {
                fetchAllSubjects(); // Refresh full list if no search active
            }
            bootstrap.Modal.getInstance(
                document.getElementById("reg-modal")
            ).hide();
            createSubjectForm.reset();
          } else {
            alert(result.message || "Failed to create Subject.");
          }
        } catch (error) {
          console.error("Error creating Subject:", error);
          alert("An error occurred while creating the Subject.");
        }
      });
    }

    async function deleteSubject(subjectId) {
        try {
        const response = await fetch(
            `http://localhost:3000/api/subject/${subjectId}`,
            {
            method: "DELETE",
            }
        );
        const result = await response.json();
        if (response.ok) {
            alert(result.message);
            fetchAllSubjects(); // Refresh list after deletion
        } else {
            alert(result.message || "Failed to delete subject.");
        }
        } catch (error) {
        console.error("Error deleting subject:", error);
        alert("An error occurred while deleting the subject.");
        }
    }

    function openUpdateSubjectModal(subjectId, subjectName) {
        // Set the hidden input with subject ID
        document.getElementById('update-subject-id').value = subjectId;
        // Set the subject name input field
        document.getElementById('update-subject-name').value = subjectName;
        // Optionally, clear or pre-fill description; here we clear it
        document.getElementById('update-subject-description').value = "";
    
        // Show the update modal
        const modal = new bootstrap.Modal(document.getElementById('updateSubjectModal'));
        modal.show();
    }

    document
        .getElementById('updateSubjectForm')
        .addEventListener('submit', async function(event) {
            event.preventDefault();
        
            const subjectId = document.getElementById('update-subject-id').value;
            const subjectName = document.getElementById('update-subject-name').value.trim();
            const description = document.getElementById('update-subject-description').value.trim();
        
            if (!subjectId || !subjectName) {
                alert('Subject ID and name are required!');
                return;
            }
        
            try {
                const response = await fetch(`http://localhost:3000/api/subject/${subjectId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ subjectName, description })
                });
                const result = await response.json();
                if (response.ok) {
                    alert(result.message);
                    fetchAllSubjects(); // Refresh subject list (assuming fetchAllSubjects() exists)
                    const modal = bootstrap.Modal.getInstance(document.getElementById('updateSubjectModal'));
                    modal.hide();
                } else {
                    alert(result.message || 'Failed to update subject.');
                }
            } catch (error) {
                console.error('Error updating subject:', error);
                alert('An error occurred while updating the subject.');
            }
        });
    

    // Initial load of all Subjects
    fetchAllSubjects();
});
