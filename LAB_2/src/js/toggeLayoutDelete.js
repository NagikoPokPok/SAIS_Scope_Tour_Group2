const layoutDelete = document.querySelector('.layout-delete-many-items');

function openLayoutDelete() {
    if (layoutDelete) {
        layoutDelete.classList.add('show');
    }
}

function closeLayoutDelete() {
    if (layoutDelete) {
        layoutDelete.classList.remove('show');
    }
}