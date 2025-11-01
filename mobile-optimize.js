/****************************************************
 * 📱 Mobile scroll-hide optimization for sidebar
 ****************************************************/

let lastScrollY = 0;
const sidebar = document.getElementById('sidebar');

window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    if (window.innerWidth <= 768) { // 仅在手机端生效
        if (currentY > lastScrollY && currentY > 50) {
            // 向下滑动隐藏
            sidebar.style.transform = 'translateY(100%)';
            sidebar.style.opacity = '0';
        } else {
            // 向上滑动显示
            sidebar.style.transform = 'translateY(0)';
            sidebar.style.opacity = '1';
        }
    }
    lastScrollY = currentY;
});