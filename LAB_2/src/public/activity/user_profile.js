

function triggerFileInput() {
    document.getElementById("image").click();
}

function handleChange(event) {
    const file = event.target.files[0];
    if (file) {
        alert("Bạn đã chọn: " + file.name);
        // Hoặc hiển thị ảnh vừa chọn
        const reader = new FileReader();
        reader.onload = function(e) {
            document.querySelector(".profile-image img").src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function save(){
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value;
    const image = document.getElementById("image_preview");
    
    let profile = {
        email: email,
        name: name,
        image: image.getAttribute('src')
    }
    localStorage.setItem('profile', JSON.stringify(profile));
    alert("successful")
    
  }

window.onload = function () {
    const user = JSON.parse(localStorage.getItem("loggedInUser")); // Lấy thông tin người dùng
    let profiles = JSON.parse(localStorage.getItem("profile")) || []; // Lấy danh sách hồ sơ từ localStorage

    // Kiểm tra xem user có trong danh sách profile không
    let userProfile = [profiles].find(profile => profile.email === user.username);

    if (!userProfile) {
        // Nếu không có, tạo hồ sơ mặc định
        userProfile = {
            email: user.username,
            name: "New User",
            image: "" // Không có ảnh mặc định
        };
        profiles.push(userProfile);
        localStorage.setItem("profile", JSON.stringify(profiles)); // Lưu lại
    }

    // Hiển thị dữ liệu lên giao diện
    document.getElementById("name").value = userProfile.name;
    document.getElementById("email").value = userProfile.email;

    if (userProfile.image) {
        document.getElementById("image_preview").src = userProfile.image;
    }

    console.log(userProfile.name);
    console.log(userProfile.email);
    console.log(userProfile.image);
    
};