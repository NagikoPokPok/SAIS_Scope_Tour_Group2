document.querySelector(".btn-login").addEventListener("click", async (event) => {
    event.preventDefault(); // Ngăn chặn gửi form nếu có lỗi

    const emailInput = document.querySelector("#edt_email");
    const email = emailInput.value.trim();
    const passwordInput = document.querySelector("#edt_password");
    const password = passwordInput.value;

    let isValid = true;

    // Ẩn tất cả lỗi trước khi kiểm tra
    document.querySelectorAll(".error").forEach(error => {
        error.style.display = "none";
    });

    // Kiểm tra email
    let emailError = document.getElementById("email_error");
    let emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
        emailError.textContent = "Email không được để trống!";
        emailError.style.display = "block";
        isValid = false;
    } else if (!emailRegex.test(email)) {
        emailError.textContent = "Email không hợp lệ!";
        emailError.style.display = "block";
        isValid = false;
    }

    // Kiểm tra password
    let passwordError = document.getElementById("password_error");
    if (!password) {
        passwordError.textContent = "Mật khẩu không được để trống!";
        passwordError.style.display = "block";
        isValid = false;
    } else if (password.length < 6) {
        passwordError.textContent = "Mật khẩu phải có ít nhất 6 ký tự!";
        passwordError.style.display = "block";
        isValid = false;
    }

    // Ngăn gửi request nếu có lỗi
    if (!isValid) {
        return;
    }

    console.log("📩 Dữ liệu gửi đi:", { email, password }); // Kiểm tra email có bị undefined không?

    try {
        const response = await fetch("http://localhost:3000/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        // Kiểm tra lỗi HTTP
        if (!response.ok) {
            alert("Lỗi đăng nhập! Kiểm tra email/mật khẩu.");
            console.log(response);
            return;
        }

        const data = await response.json();

        if (data.success) {
            window.location.href = "list-goal-team.html";
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối máy chủ!");
        console.error("Lỗi:", error);
    }
});
