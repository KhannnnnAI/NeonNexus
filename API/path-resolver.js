/**
 * NeonNexus Path Resolver
 * Tự động xử lý đường dẫn: Tuyệt đối (Localhost) vs Tương đối (File://)
 */
const PathResolver = {
    // Kiểm tra xem có đang chạy trên server (localhost) hay không
    isServer: () => {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' || 
               window.location.protocol.startsWith('http');
    },

    // Xác định tiền tố tương đối dựa trên vị trí thư mục hiện tại
    getRelativePrefix: () => {
        const path = window.location.pathname;
        if (path.includes('/html/') || path.includes('/dashboard/')) {
            return '../';
        }
        return './';
    },

    /**
     * Hàm chính để lấy đường dẫn đúng
     * @param {string} target - Đường dẫn mục tiêu (VD: 'account', 'API/index.js')
     */
    resolve: (target) => {
        if (!target) return target;

        // Tách query string nếu có
        const parts = target.split('?');
        const pathPart = parts[0];
        const queryPart = parts[1] ? '?' + parts[1] : '';

        // Chuẩn hóa: bỏ / ở đầu path
        let cleanTarget = pathPart.startsWith('/') ? pathPart.substring(1) : pathPart;
        
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isFirebase = window.location.hostname.includes('firebaseapp.com') || window.location.hostname.includes('web.app');

        // Map các route ảo sang file vật lý
        const routes = {
            '': 'index.html',
            'home': 'index.html',
            'account': 'html/account.html',
            'trending': 'html/trending.html',
            'event': 'html/event.html',
            'community': 'html/community.html',
            'support': 'html/support.html',
            'privacy-policy': 'html/privacy_policy.html',
            'terms-of-service': 'html/terms_of_service.html',
            'game': 'html/game.html',
            'keygen': 'html/keygen.html'
        };

        if (isFirebase) {
            // Trên Firebase: Dùng virtual route đẹp (VD: /trending)
            return '/' + cleanTarget + queryPart;
        } else if (isLocalhost) {
            // Trên Localhost (Live Server): Dùng đường dẫn file thật để tránh 404
            const mappedPath = routes[cleanTarget] || cleanTarget;
            return '/' + mappedPath + queryPart;
        } else {
            // Bản file:// (Offline)
            const prefix = PathResolver.getRelativePrefix();
            let finalPath = routes[cleanTarget] || cleanTarget;

            // Nếu đang ở thư mục con (../), và target trỏ vào html/ -> bỏ html/ đi
            if (prefix === '../' && finalPath.startsWith('html/')) {
                finalPath = finalPath.replace('html/', '');
            }

            return prefix + finalPath + queryPart;
        }
    }
};

// Tự động sửa tất cả các link trên trang khi load
document.addEventListener('DOMContentLoaded', () => {
    const fixLinks = () => {
        document.querySelectorAll('a[href^="/"]').forEach(link => {
            const originalHref = link.getAttribute('href');
            // Tránh fix lại nhiều lần
            if (link.dataset.pathFixed) return;
            
            link.href = PathResolver.resolve(originalHref);
            link.dataset.pathFixed = "true";
        });
    };

    fixLinks();
    
    // Hỗ trợ cả các link được tạo động sau này
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) fixLinks();
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
});

// Xuất ra toàn cục
window.url = PathResolver.resolve;
