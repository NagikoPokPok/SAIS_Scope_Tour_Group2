

document.addEventListener("DOMContentLoaded", function () {
    const closeIcon = document.querySelector(".close-icon");
    const chatContainer = document.querySelector(".chat-container");
    const messageInput = document.getElementById("messageInput");

    loadMessages();

    // Sự kiện đóng cửa sổ chat khi nhấn vào icon đóng
    closeIcon.addEventListener("click", function () {
        chatContainer.style.display = "none"; 
    });

    // Sự kiện gửi tin nhắn khi bấm Enter
    messageInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault(); // Ngăn xuống dòng trong ô input
            sendMessage();
        }
    });
});

function sendMessage() {
    const input = document.getElementById("messageInput");
    const chatBox = document.getElementById("chatBox");
    const messageText = input.value.trim();

    if (messageText !== "") {
        // Tạo tin nhắn gửi đi
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", "sent");
        messageElement.innerText = messageText;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
        saveMessage(messageText, "sent");
        input.value = "";

        // Giả lập tin nhắn phản hồi từ người khác sau 0.1 giây
        setTimeout(() => receiveMessage("Hello bro.", "Huy"), 100);
    }
}

function receiveMessage(text, nameReceived = "User") {
    const chatBox = document.getElementById("chatBox");

    // Tạo container cho tin nhắn nhận được
    const messageContainer = document.createElement("div");
    messageContainer.classList.add("message-container");

    // Tạo phần hiển thị tên người gửi
    const nameElement = document.createElement("p");
    nameElement.classList.add("sender-name");
    nameElement.innerText = nameReceived;

    // Tạo nội dung tin nhắn
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", "received");
    messageElement.innerText = text;

    // Gắn tên người gửi + tin nhắn vào container
    messageContainer.appendChild(nameElement);
    messageContainer.appendChild(messageElement);

    // Thêm vào khung chat
    chatBox.appendChild(messageContainer);
    chatBox.scrollTop = chatBox.scrollHeight; // Cuộn xuống tin nhắn mới nhất

    saveMessage(text, "received", nameReceived);
}

function saveMessage(text, type, sender = "You") {
    let messages = JSON.parse(localStorage.getItem("chatMessages")) || [];
    messages.push({ text, type, sender });
    localStorage.setItem("chatMessages", JSON.stringify(messages));
}

function loadMessages() {
    const chatBox = document.getElementById("chatBox");
    chatBox.innerHTML = "";
    let messages = JSON.parse(localStorage.getItem("chatMessages")) || [];

    messages.forEach(msg => {
        const messageContainer = document.createElement("div");
        messageContainer.classList.add("message-container");

        if (msg.type === "sent") {
            messageContainer.classList.add("sent-container"); // Căn phải cho tin nhắn gửi đi
        }

        const nameElement = document.createElement("p");
        if(msg.type !=="sent"){
            nameElement.classList.add("sender-name");
            nameElement.innerText = msg.sender;
        }
        

        const messageElement = document.createElement("div");
        messageElement.classList.add("message", msg.type);
        messageElement.innerText = msg.text;

        messageContainer.appendChild(nameElement);
        messageContainer.appendChild(messageElement);
        chatBox.appendChild(messageContainer);
    });

    chatBox.scrollTop = chatBox.scrollHeight;

    
}

function deleteMessage(index) {
    let messages = JSON.parse(localStorage.getItem("chatMessages")) || [];

    if (index >= 0 && index < messages.length) {
        messages.splice(index, 1); // Xóa phần tử tại vị trí index
        localStorage.setItem("chatMessages", JSON.stringify(messages)); // Cập nhật lại localStorage
    }
}

window.onload = function(){

    const user = JSON.parse(localStorage.getItem("loggedInUser")); // Lấy thông tin người dùng
    let profiles = JSON.parse(localStorage.getItem("profile")) || [];
    const profile = [profiles].find(profile => profile.email === user.username);
    console.log(profile.name);
    
    
    document.getElementById("youImage").src = profile.image;
    document.getElementById("name").textContent  = profile.name;
}
