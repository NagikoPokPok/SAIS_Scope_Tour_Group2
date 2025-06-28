document.getElementById("register-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("register-username").value.trim();
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const errorMessage = document.getElementById("error-message-rf");

    try {
        const response = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, confirmPassword })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message);
            document.getElementById("register-form").reset();
        } else {
            errorMessage.textContent = data.error;
        }
    } catch (error) {
        errorMessage.textContent = "Lỗi kết nối!";
    }
});
