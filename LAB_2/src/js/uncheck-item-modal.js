function uncheckAllItemModalSort() {
    // Lấy tất cả các input radio trong modal có id "modal-sort"
    const radioButtons = document.querySelectorAll('#modal-sort input[type="radio"]');

    // Duyệt qua tất cả và bỏ chọn
    radioButtons.forEach(radio => {
        radio.checked = false;
    });
}

function uncheckAllItemModalFilter() {
    // Lấy tất cả các input radio trong modal có id "modal-sort"
    const checkboxButtons = document.querySelectorAll('#modal-filter input[type="checkbox"]');

    // Duyệt qua tất cả và bỏ chọn
    checkboxButtons.forEach(checkbox => {
        checkbox.checked = false;
    });
}