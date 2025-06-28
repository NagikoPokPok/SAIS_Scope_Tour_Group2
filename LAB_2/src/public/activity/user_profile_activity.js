document.addEventListener("DOMContentLoaded", () => {
    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("phone");
    const imageInput = document.getElementById("image");
    const profileImage = document.querySelector(".profile-image img");
    
    // Lấy dữ liệu người dùng từ server
    fetch("/api/user-profile/load", {
        method: "GET",
        credentials: "include"
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            nameInput.value = data.user.user_name;
            emailInput.value = data.user.email;
            phoneInput.value = data.user.phone_number;
            if (data.user.user_img) {
                profileImage.src = data.user.user_img;
            }
        }
    })
    .catch(error => console.error("Lỗi tải hồ sơ:", error));

    // Xử lý cập nhật hồ sơ
    document.getElementById(".saveProfile").addEventListener("click", () => {
        const formData = new FormData();
        formData.append("user_name", nameInput.value);
        formData.append("email", emailInput.value);
        formData.append("phone_number", phoneInput.value);
        if (imageInput.files[0]) {
            formData.append("image", imageInput.files[0]);
        }

        fetch("/api/user-profile/update", {
            method: "POST",
            body: formData,
            credentials: "include"
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert("Cập nhật thành công!");
                location.reload();
            } else {
                alert("Lỗi cập nhật: " + data.message);
            }
        })
        .catch(error => console.error("Lỗi cập nhật hồ sơ:", error));
    });
});
