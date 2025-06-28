document.addEventListener("DOMContentLoaded", function () {
    const lockImages = document.querySelectorAll(".lock-img");
    const modal = document.getElementById("pet-modal");
    const modalPetImg = document.getElementById("modal-pet-img");
    const modalPetName = document.getElementById("modal-pet-name");
    const unlockButton = document.getElementById("unlock-btn");

    let currentPetContainer = null; // Lưu pet đang được mở modal

    lockImages.forEach(lock => {
        lock.addEventListener("click", function () {
            currentPetContainer = this.closest(".pet"); // Lưu pet hiện tại
            const petImg = currentPetContainer.querySelector(".pet-img").src;
            const petName = currentPetContainer.querySelector(".pet-name").textContent;

            modalPetImg.src = petImg;
            modalPetName.textContent = petName;

            modal.style.display = "flex";
        });
    });

    // Đóng modal khi nhấn "X"
    document.querySelector(".close").addEventListener("click", function () {
        modal.style.display = "none";
    });

    // Đóng modal khi nhấn ra ngoài
    window.addEventListener("click", function (e) {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });

    // Xử lý khi nhấn Unlock
    unlockButton.addEventListener("click", function () {
        if (currentPetContainer) {
            const petImg = currentPetContainer.querySelector(".pet-img");
            const lockImg = currentPetContainer.querySelector(".lock-img");

            petImg.style.opacity = "1"; // Hiển thị pet rõ ràng
            lockImg.style.display = "none"; // Ẩn biểu tượng khóa

            modal.style.display = "none"; // Đóng modal
        }
    });
});