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

    // Lấy thư mục gốc (Base Path) khi chạy localhost dưới dạng thư mục con (VD: /NeonNexus-main/)
    getBasePath: () => {
        const path = window.location.pathname;
        const segments = path.split('/');
        segments.pop(); // Loại bỏ tên file cuối cùng
        
        // Nếu segment cuối là html hoặc dashboard, loại bỏ để lấy thư mục gốc của project
        const lastSegment = segments[segments.length - 1];
        if (lastSegment === 'html' || lastSegment === 'dashboard') {
            segments.pop();
        }
        
        const base = segments.join('/');
        return base.endsWith('/') ? base : base + '/';
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
            'store': 'html/store.html',
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
            const basePath = PathResolver.getBasePath();
            const mappedPath = routes[cleanTarget] || cleanTarget;
            return basePath + mappedPath + queryPart;
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
// Xuất ra toàn cục
window.url = PathResolver.resolve;

// --- Cyber Preloader & Page Transitions Implementation ---
(function() {
    // Avoid running if already running
    if (window.TransitionsInitialized) return;
    window.TransitionsInitialized = true;

    const isStorePage = window.location.pathname.includes('store.html') || 
                        window.location.pathname.endsWith('/store');

    if (isStorePage) {
        initPreloader();
    } else {
        initEntranceTransitions();
    }

    // --- 1. Cyber Preloader for store.html ---
    function initPreloader() {
        // Inject CSS immediately into head
        const style = document.createElement('style');
        style.id = 'cyber-preloader-styles';
        style.innerHTML = `
            /* Preloader Overlay */
            #cyber-preloader {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: #0a0a0a;
                z-index: 100000;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                transition: opacity 0.8s cubic-bezier(0.77, 0, 0.175, 1), 
                            transform 0.8s cubic-bezier(0.77, 0, 0.175, 1), 
                            visibility 0.8s;
                font-family: 'ROG Lyons', 'Fira Code', monospace;
                overflow: hidden;
                transform: translateX(0);
            }

            #cyber-preloader.loaded {
                opacity: 0;
                transform: translateX(100%);
                visibility: hidden;
            }

            /* Background grid effect */
            #cyber-preloader::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: linear-gradient(rgba(0, 243, 255, 0.03) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(0, 243, 255, 0.03) 1px, transparent 1px);
                background-size: 40px 40px;
                background-position: center;
                pointer-events: none;
                animation: gridPulse 4s ease-in-out infinite;
            }

            @keyframes gridPulse {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 0.7; filter: hue-rotate(45deg); }
            }

            /* Container */
            .preloader-content {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1.5rem;
                z-index: 10;
            }

            /* Logo Rings */
            .logo-container {
                position: relative;
                width: 140px;
                height: 140px;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .outer-ring {
                position: absolute;
                width: 100%;
                height: 100%;
                border: 3px solid transparent;
                border-top-color: #00f3ff;
                border-bottom-color: #00f3ff;
                border-radius: 50%;
                animation: spinClockwise 2.5s linear infinite;
                box-shadow: 0 0 20px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(0, 243, 255, 0.1);
            }

            .inner-ring {
                position: absolute;
                width: 75%;
                height: 75%;
                border: 3px solid transparent;
                border-left-color: #ff00ff;
                border-right-color: #ff00ff;
                border-radius: 50%;
                animation: spinCounterClockwise 1.8s linear infinite;
                box-shadow: 0 0 15px rgba(255, 0, 255, 0.3), inset 0 0 15px rgba(255, 0, 255, 0.1);
            }

            .center-icon {
                font-size: 3rem;
                color: #fff;
                filter: drop-shadow(0 0 15px #00f3ff);
                animation: pulseIcon 1.5s ease-in-out infinite;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .center-icon svg {
                width: 3rem;
                height: 3rem;
                fill: none;
                stroke: #00f3ff;
                stroke-width: 2;
            }

            /* Text & Progress */
            .preloader-brand {
                font-size: 1.8rem;
                font-weight: 800;
                letter-spacing: 0.15em;
                color: #fff;
                text-shadow: 0 0 10px rgba(255, 255, 255, 0.3), 0 0 20px rgba(0, 243, 255, 0.5);
                margin: 0;
                text-transform: uppercase;
            }

            .preloader-brand span {
                color: #ff00ff;
                text-shadow: 0 0 10px rgba(255, 255, 255, 0.3), 0 0 20px rgba(255, 0, 255, 0.5);
            }

            .status-text {
                font-size: 0.75rem;
                color: #888;
                letter-spacing: 0.2em;
                text-transform: uppercase;
                height: 1.5em;
                margin-top: -0.5rem;
                font-weight: 500;
                animation: textFlicker 2s infinite;
            }

            .progress-bar-container {
                width: 260px;
                height: 4px;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 4px;
                overflow: hidden;
                position: relative;
                border: 1px solid rgba(0, 243, 255, 0.15);
                box-shadow: 0 0 10px rgba(0, 243, 255, 0.05);
            }

            .progress-bar-fill {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #00f3ff, #ff00ff);
                box-shadow: 0 0 15px #00f3ff;
                transition: width 0.1s cubic-bezier(0.1, 0.8, 0.25, 1);
            }

            /* Animations */
            @keyframes spinClockwise {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes spinCounterClockwise {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(-360deg); }
            }

            @keyframes pulseIcon {
                0%, 100% { transform: scale(1); filter: drop-shadow(0 0 12px #00f3ff); }
                50% { transform: scale(1.15); filter: drop-shadow(0 0 22px #00f3ff) drop-shadow(0 0 35px #00f3ff); }
            }

            @keyframes textFlicker {
                0%, 100% { opacity: 0.8; }
                50% { opacity: 0.5; }
                95% { opacity: 0.9; }
            }

            /* Content fade-in */
            body:not(.preloader-done) #app {
                opacity: 0;
            }

            body.preloader-done #app {
                opacity: 1;
                transition: opacity 0.8s ease;
            }

            /* ===================================
               LIGHT MODE OVERRIDES
               =================================== */
            html[data-theme="light"] #cyber-preloader {
                background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 50%, #dbeafe 100%);
            }

            html[data-theme="light"] #cyber-preloader::before {
                background-image: linear-gradient(rgba(14, 165, 233, 0.04) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(14, 165, 233, 0.04) 1px, transparent 1px);
                background-size: 40px 40px;
            }

            html[data-theme="light"] .outer-ring {
                border-top-color: #0ea5e9;
                border-bottom-color: #0ea5e9;
                box-shadow: 0 0 20px rgba(14, 165, 233, 0.2), inset 0 0 20px rgba(14, 165, 233, 0.05);
            }

            html[data-theme="light"] .inner-ring {
                border-left-color: #d946ef;
                border-right-color: #d946ef;
                box-shadow: 0 0 15px rgba(217, 70, 239, 0.2), inset 0 0 15px rgba(217, 70, 239, 0.05);
            }

            html[data-theme="light"] .center-icon {
                filter: drop-shadow(0 0 12px rgba(14, 165, 233, 0.3));
            }

            html[data-theme="light"] .center-icon svg {
                stroke: #0ea5e9;
            }

            html[data-theme="light"] .preloader-brand {
                color: #0f172a;
                text-shadow: 0 0 10px rgba(14, 165, 233, 0.2), 0 0 20px rgba(14, 165, 233, 0.1);
            }

            html[data-theme="light"] .preloader-brand span {
                color: #d946ef;
                text-shadow: 0 0 10px rgba(217, 70, 239, 0.2), 0 0 20px rgba(217, 70, 239, 0.1);
            }

            html[data-theme="light"] .status-text {
                color: #475569;
            }

            html[data-theme="light"] .progress-bar-container {
                background: rgba(15, 23, 42, 0.05);
                border-color: rgba(14, 165, 233, 0.2);
                box-shadow: 0 0 10px rgba(14, 165, 233, 0.03);
            }

            html[data-theme="light"] .progress-bar-fill {
                background: linear-gradient(90deg, #0ea5e9, #d946ef);
                box-shadow: 0 0 15px rgba(14, 165, 233, 0.3);
            }
        `;
        document.head.appendChild(style);

        // Dynamic HTML injection when body is created
        const observer = new MutationObserver((mutations, obs) => {
            if (document.body) {
                const preloader = document.createElement('div');
                preloader.id = 'cyber-preloader';
                preloader.innerHTML = `
                    <div class="preloader-content">
                        <div class="logo-container">
                            <div class="outer-ring"></div>
                            <div class="inner-ring"></div>
                            <div class="center-icon">
                                <!-- Zap SVG Icon -->
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                </svg>
                            </div>
                        </div>
                        <h1 class="preloader-brand">NEON<span>NEXUS</span></h1>
                        <div class="status-text" id="preloader-status">INITIALIZING SYSTEM...</div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" id="preloader-progress"></div>
                        </div>
                    </div>
                `;
                document.body.insertBefore(preloader, document.body.firstChild);
                obs.disconnect();
                
                // Start progress animation
                animateProgress();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // Progress bar animation logic
        function animateProgress() {
            const fill = document.getElementById('preloader-progress');
            const status = document.getElementById('preloader-status');
            const preloader = document.getElementById('cyber-preloader');
            
            if (!fill || !status || !preloader) return;

            let width = 0;
            const statusMessages = [
                'CONNECTING SECURE NETWORK...',
                'LOADING ASSETS...',
                'RESOLVING ROUTING...',
                'SYSTEM ONLINE'
            ];

            // Smooth incrementing interval
            const interval = setInterval(() => {
                if (width >= 100) {
                    clearInterval(interval);
                    finishPreloader();
                } else {
                    const step = width < 40 ? 4 : (width < 80 ? 2 : 0.8);
                    width += step;
                    if (width > 100) width = 100;
                    fill.style.width = width + '%';

                    if (width < 30) {
                        status.textContent = statusMessages[0];
                    } else if (width < 65) {
                        status.textContent = statusMessages[1];
                    } else if (width < 90) {
                        status.textContent = statusMessages[2];
                    } else {
                        status.textContent = statusMessages[3];
                    }
                }
            }, 30);

            // Backup load listener
            window.addEventListener('load', () => {
                clearInterval(interval);
                let fastWidth = width;
                const fastInterval = setInterval(() => {
                    if (fastWidth >= 100) {
                        clearInterval(fastInterval);
                        finishPreloader();
                    } else {
                        fastWidth += 8;
                        if (fastWidth > 100) fastWidth = 100;
                        fill.style.width = fastWidth + '%';
                        status.textContent = statusMessages[3];
                    }
                }, 15);
            });
            
            function finishPreloader() {
                setTimeout(() => {
                    preloader.classList.add('loaded');
                    document.body.classList.add('preloader-done');
                    
                    setTimeout(() => {
                        if (preloader.parentNode) {
                            preloader.parentNode.removeChild(preloader);
                        }
                    }, 600);
                }, 300);
            }
        }
    }

    // --- 2. Entrance transitions (fade-out-right) for secondary pages ---
    function initEntranceTransitions() {
        const style = document.createElement('style');
        style.id = 'cyber-entrance-styles';
        style.innerHTML = `
            /* Entrance Animation Keyframe named fade-out-right */
            @keyframes fade-out-right {
                from {
                    opacity: 0;
                    transform: translateX(40px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            /* Target layout blocks for staggered entrance on load */
            .page-sidebar,
            .trending-header,
            .event-hero,
            .community-hero,
            .support-header-section,
            .account-header,
            .game-detail-hero,
            .hero-banner,
            .trending-grid,
            .events-grid,
            .community-content,
            .support-topics-grid,
            .support-content-layout,
            .keys-grid,
            .game-detail-content,
            .legal-page-main,
            .privacy-page-container,
            .news-section {
                opacity: 0;
                animation: fade-out-right 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            /* Staggered Delays for secondary pages */
            .page-sidebar {
                animation-delay: 0.05s;
            }

            .trending-header,
            .event-hero,
            .community-hero,
            .support-header-section,
            .account-header,
            .game-detail-hero,
            .hero-banner {
                animation-delay: 0.15s;
            }

            .trending-grid,
            .events-grid,
            .community-content,
            .support-topics-grid,
            .support-content-layout,
            .keys-grid,
            .game-detail-content,
            .legal-page-main,
            .privacy-page-container,
            .news-section {
                animation-delay: 0.25s;
            }
        `;
        document.head.appendChild(style);
    }
})();
