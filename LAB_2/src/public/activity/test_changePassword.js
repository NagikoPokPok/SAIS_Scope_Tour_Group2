async function changePassword() {
    let oldPassword = document.getElementById("oldPassword").value;
    let newPassword = document.getElementById("newPassword").value;
    let confirmPassword = document.getElementById("confirmPassword").value;

    const userLogged = JSON.parse(localStorage.getItem("loggedInUser"));

    let storedPassword = userLogged.password; // Giả sử mật khẩu cũ là 123456 (cần thay thế bằng cách kiểm tra thực tế)
    // const confirmPass = await hashPassword(oldPassword);
    
    if ((await hashPassword(oldPassword)) !== storedPassword) {
        alert("Mật khẩu cũ không đúng!");
        return;
    }
    
    if (newPassword.length < 6) {
        alert("Mật khẩu mới phải có ít nhất 6 ký tự!");
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert("Xác nhận mật khẩu không khớp!");
        return;
    }


    // Bước 1: Lấy danh sách user từ localStorage
    let users = JSON.parse(localStorage.getItem("users")) || [];

    // Bước 2: Tìm user cần cập nhật
    let userIndex = users.findIndex(user => user.username === userLogged.username);

    if (userIndex === -1) {
        console.log("Không tìm thấy người dùng!");
        return;
    }

    // Bước 3: Cập nhật mật khẩu
    users[userIndex].password = await hashPassword(newPassword);

    // Bước 4: Lưu danh sách đã cập nhật vào localStorage
    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("loggedInUser", JSON.stringify(users[userIndex]));
    
    alert("Mật khẩu đã được thay đổi thành công!");
    
    //clear input
    const inputs = document.querySelectorAll("input");
    inputs.forEach(input => input.value = "");

}

// Hàm hash mật khẩu bằng SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    
    // Chuyển hash thành chuỗi hex
    return Array.from(new Uint8Array(hash))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
  }