const toggleButton = document.getElementById('toggle-btn')
const sidebar = document.getElementById('sidebar')
const elementActive = document.getElementsByClassName('sub-menu')

function toggleSidebar(){
  sidebar.classList.toggle('close')
  toggleButton.classList.toggle('rotate')

  closeAllSubMenus()
}

function toggleSubMenu(button){

  // B1: Khi click vào một menu ( <=> menu đó chưa có class show)
  // B2: Đóng tất cả menu lại
  // B3: Gán class show vào menu mới click đó
  // B4: Sau khi gán class thì sub menu sẽ được mở
  if(!button.nextElementSibling.classList.contains('show')){
    closeAllSubMenus()
  }

  button.nextElementSibling.classList.toggle('show')
  button.classList.toggle('rotate')

  if(sidebar.classList.contains('close')){
    // Đọc cách sử dụng toggle
    sidebar.classList.toggle('close')
    toggleButton.classList.toggle('rotate')
  }
}

// Khi đóng sub menu => remove show + rotate icon
function closeAllSubMenus(){
  Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
    ul.classList.remove('show')
    ul.previousElementSibling.classList.remove('rotate')
  })
}

// Đảm bảo showSubMenu được định nghĩa
function showSubMenu() {
  // Tìm tất cả class có tên sub-menu
  const elementActive = document.querySelectorAll('.sub-menu');
  // Duyệt qua tất cả sub-menu tìm được
  for (let i = 0; i < elementActive.length; i++) {
    // Với mỗi sub-menu, tìm tất cả con của sub-menu có class active
    const activeChildren = elementActive[i].querySelectorAll('.active');
    // Tìm thằng nằm trước sub-menu, chính là nút button cần được rotate
    const prev = elementActive[i].previousElementSibling;

    // Kiểm tra xem có class con nào của sub-menu có active hay không
    if (activeChildren.length > 0 && prev) {
      // Nếu có thì sub-menu sẽ show ra và button sẽ được rotate
      elementActive[i].classList.add('show');
      prev.classList.add('rotate');
      break;
    }
  }
}

// Gọi hàm khi DOM đã sẵn sàng
document.addEventListener("DOMContentLoaded", showSubMenu);

