document.addEventListener('DOMContentLoaded', function () {
    function updateTime() {
      const now = new Date();
      let hours = now.getHours();
      let minutes = now.getMinutes();
      let seconds = now.getSeconds();
      // Format with leading zeros if needed
      hours = hours < 10 ? '0' + hours : hours;
      minutes = minutes < 10 ? '0' + minutes : minutes;
      seconds = seconds < 10 ? '0' + seconds : seconds;
      const formattedTime = `${hours}:${minutes}`;
      // Update the time element
      const timeElement = document.querySelector('.header-time .time');
      if (timeElement) {
        timeElement.textContent = formattedTime;
      }
    }
    
    // Update immediately, then every second
    updateTime();
    setInterval(updateTime, 1000);

    // // Lấy tên user và cập nhật vào giao diện
    // fetch('/api/user/profile')
    //   .then(res => res.json())
    //   .then(data => {
    //       if (data && data.name) {
    //       document.getElementById('userName').textContent = data.name;
    //       }
    //   })
    //   .catch(() => {
    //       // Có thể giữ nguyên tên mặc định hoặc xử lý lỗi nếu muốn
    //   });

    // Khi user bấm nút đăng xuất
    // localStorage.removeItem('user');
    // window.location.href = "login.html";
  });
  