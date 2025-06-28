
      // Tải modal.html vào modal-container
      fetch("./component/modal-status-action-fail.html")
        .then(response => response.text())
        .then(html => {
          document.getElementById("modal-status-action-container").innerHTML = html;
          
          // Ẩn tiêu đề mặc định để tránh nhấp nháy
          const modalTitleElement = document.querySelector("#modal-success-action .modal-title");
          if (modalTitleElement) {
            modalTitleElement.style.visibility = "hidden"; // Ẩn tiêu đề ngay khi tải
          }
        });
    
      // Hàm hiển thị modal với tiêu đề tùy chỉnh
      function showModal(title = "Default Title") {
        setTimeout(() => {
          const modalTitleElement = document.querySelector("#modal-success-action .modal-title");
          if (modalTitleElement) {
            modalTitleElement.innerText = title;
            modalTitleElement.style.visibility = "visible"; // Hiển thị lại tiêu đề sau khi cập nhật
            new bootstrap.Modal(document.getElementById("modal-success-action")).show();
          } else {
            console.error("Không tìm thấy phần tử modal-title!");
          }
        }, 300); // Đợi modal tải hoàn tất trước khi thay đổi tiêu đề
      }
    