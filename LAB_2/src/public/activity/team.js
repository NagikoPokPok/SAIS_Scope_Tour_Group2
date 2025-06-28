document.addEventListener('DOMContentLoaded', function () {
  const colors = ['#E08963', '#5E96AE', '#f15f0e', '#A2C139']; // Màu luân phiên

  function renderTeams(teams, isSearch = false) {
      const teamList = document.getElementById('teamList');
      teamList.innerHTML = '';

      if (teams && teams.length > 0) {
          teams.forEach((team, index) => {
              const li = document.createElement('li');
              li.style.setProperty('--cardColor', colors[index % colors.length]);

              li.innerHTML = `
                  <a href="team-project.html?teamId=${team.team_id}" class="content">
                      <div class="icon">😁</div>
                      <div class="team-des">
                          <div class="title">${team.name}</div>
                      </div>
                  </a>
                  <div class="action container border-0 d-flex justify-content-end align-items-center">
                      <div class="row gap-4">
                          <div class="col fs-5 action-edit" data-team-id="${team.team_id}" data-team-name="${team.name}">
                              <i class="fa-solid fa-pen-to-square text-primary"></i>
                          </div>
                          <div class="col fs-5 action-delete" data-team-id="${team.team_id}">
                              <i class="fa-solid fa-trash-can text-primary"></i>
                          </div>
                      </div>
                  </div>
              `;
              teamList.appendChild(li);
          });

          document.querySelectorAll('.action-edit').forEach(button => {
              button.addEventListener('click', (event) => {
                  const teamId = event.currentTarget.getAttribute('data-team-id');
                  const teamName = event.currentTarget.getAttribute('data-team-name');
                  openUpdateModal(teamId, teamName);
              });
          });

          document.querySelectorAll('.action-delete').forEach(button => {
              button.addEventListener('click', async (event) => {
                  const teamId = event.currentTarget.getAttribute('data-team-id');
                  if (confirm("Are you sure you want to delete this team?")) {
                      await deleteTeam(teamId);
                  }
              });
          });
      } else {
          teamList.innerHTML = isSearch
              ? '<span>No teams match your search</span>'
              : '<span>No teams available</span>';
      }
  }


  

  // Fetch all team
  async function fetchAllTeams() {
      const teamList = document.getElementById('teamList');
      teamList.innerHTML = '<span>Loading...</span>';
      try {
          const response = await fetch('http://localhost:3000/api/team');
          if (!response.ok) throw new Error('Network response was not ok');
          const data = await response.json();
          renderTeams(data.teams, false);
      } catch (error) {
          console.error('Error fetching all teams:', error);
          teamList.innerHTML = `
          <div class="error-loading d-flex justify-content-center align-items-center flex-column">
              <img src="../public/img/main-img/error-loading.png" alt="error" class="img-status">
              <span class="text-status">Error loading</span>
          </div>
          `            
          ;
      }
  }

  // Delete team
  async function deleteTeam(teamId) {
      try {
          const response = await fetch(`http://localhost:3000/api/team/${teamId}`, {
              method: 'DELETE'
          });
          const result = await response.json();
          if (response.ok) {
              alert(result.message);
              fetchAllTeams(); // Làm mới danh sách team sau khi xóa
          } else {
              alert(result.message || "Failed to delete team.");
          }
      } catch (error) {
          console.error('Error deleting team:', error);
          alert("An error occurred while deleting the team.");
      }
  }

  // Update team
  function openUpdateModal(teamId, teamName) {
      document.getElementById('update-team-id').value = teamId;
      document.getElementById('update-team-name').value = teamName;

      const modal = new bootstrap.Modal(document.getElementById('update-modal'));
      modal.show();
  }

  async function updateTeam(event) {
      event.preventDefault();

      const teamId = document.getElementById('update-team-id').value;
      const teamName = document.getElementById('update-team-name').value.trim();

      if (!teamId || !teamName) {
          alert('Team ID or name is missing!');
          return;
      }

      try {
          const response = await fetch(`http://localhost:3000/api/team/${teamId}`, {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ teamName })
          });

          const result = await response.json();

          if (response.ok) {
              alert(result.message);
              fetchAllTeams(); // Refresh team list after update
              const modal = bootstrap.Modal.getInstance(document.getElementById('update-modal'));
              modal.hide();
          } else {
              alert(result.message || 'Failed to update team.');
          }
      } catch (error) {
          console.error('Error updating team:', error);
          alert('An error occurred while updating the team.');
      }
  }

  document.getElementById('updateTeamForm').addEventListener('submit', updateTeam);

      // Search teams based on query
      async function searchTeams(searchQuery) {
          const teamList = document.getElementById('teamList');
          teamList.innerHTML = '<span>Searching...</span>';
          try {
              const url = `http://localhost:3000/api/team?search=${encodeURIComponent(searchQuery.trim())}`;
              const response = await fetch(url);
              if (!response.ok) throw new Error('Network response was not ok');
              const data = await response.json();
              renderTeams(data.teams, true); // Pass isSearch=true for search-specific messaging
          } catch (error) {
              console.error('Error searching teams:', error);
              teamList.innerHTML = '<span>Error searching teams</span>';
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
      const searchInput = document.getElementById('searchTeam');
      if (searchInput) {
          const debouncedSearch = debounce(query => {
              const trimmedQuery = query.trim();
              if (trimmedQuery) {
                  searchTeams(trimmedQuery); // Search when there's a query
              } else {
                  fetchAllTeams(); // Fetch all teams only when search is cleared
              }
          }, 300);
  
          searchInput.addEventListener('input', () => {
              debouncedSearch(searchInput.value);
          });
  
          searchInput.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                  e.preventDefault();
                  const query = searchInput.value.trim();
                  if (query) {
                      searchTeams(query); // Immediate search on Enter
                  } else {
                      fetchAllTeams(); // Immediate fetch all on Enter when empty
                  }
              }
          });
      }

    const createTeamForm = document.getElementById('createTeamForm');
    if (createTeamForm) {
        createTeamForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const teamName = document.getElementById('modal-team-name').value.trim();
            if (!teamName) {
                alert('Team name is required.');
                return;
            }
            try {
                const response = await fetch('http://localhost:3000/api/team', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teamName })
                });
                const result = await response.json();
                if (response.ok) {
                    alert(result.message);
                    const currentQuery = searchInput.value.trim();
                    if (currentQuery) {
                        searchTeams(currentQuery); // Refresh with current search query
                    } else {
                        fetchAllTeams(); // Refresh full list if no search active
                    }
                    bootstrap.Modal.getInstance(document.getElementById('reg-modal')).hide();
                    createTeamForm.reset();
                } else {
                    alert(result.message || 'Failed to create team.');
                }
            } catch (error) {
                console.error('Error creating team:', error);
                alert('An error occurred while creating the team.');
            }
        });
    }

  fetchAllTeams();
});