// ===================================
// IMAGE UTILITY FUNCTIONS (DIRECT LOAD - SAFEST & FASTEST)
// ===================================

/**
 * Trả thẳng link gốc của Steam. 
 * KHÔNG dùng proxy wsrv.nl nữa để tránh bị nhà mạng chặn (ERR_CONNECTION_CLOSED).
 */
function getProxiedImageUrl(imageUrl) {
  if (!imageUrl) return '';
  return imageUrl; 
}

/**
 * Trả về attribute tương thích cho thẻ img
 * Giữ nguyên referrerpolicy="no-referrer" để ảnh không bị từ chối truy cập
 * KHÔNG dùng crossorigin="anonymous" để tránh hoàn toàn lỗi CORS
 */
function getImageAttributes(imageUrl) {
  const isExternal = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
  
  if (isExternal) {
    return {
      referrerpolicy: 'no-referrer'
    };
  }
  return {};
}

/**
 * Hàm này được giữ lại cấu trúc cơ bản để các trang phụ (như game.html) 
 * gọi đến không bị báo lỗi "undefined function". 
 * Riêng trang chủ (index.js) đã được viết logic xử lý ảnh lỗi xịn hơn rất nhiều.
 */
function createImageErrorHandler(game) {
  return `
    this.onerror = function() {
      if (!this.dataset.fb1 && '${game.imageFallback || ''}') {
        this.dataset.fb1 = 'true';
        this.src = '${game.imageFallback}';
      } else if (!this.dataset.fb2 && '${game.imageFallback2 || ''}') {
        this.dataset.fb2 = 'true';
        this.src = '${game.imageFallback2}';
      } else {
        this.onerror = null; 
        this.src = 'https://placehold.co/616x353/1a1a1a/22d3ee?text=No+Image';
      }
    };
  `;
}

/**
 * Hàm xử lý chính cho các thành phần UI
 */
function processImageUrl(imageUrl, options = {}) {
  const { fallbackTitle = 'No+Image' } = options;
  
  // Dùng thẳng URL gốc, không qua proxy
  const processedUrl = imageUrl || `https://placehold.co/616x353/1a1a1a/22d3ee?text=${fallbackTitle}`;
  const attributes = getImageAttributes(processedUrl);
  
  return {
    url: processedUrl,
    attributes,
    fallbackUrl: `https://placehold.co/616x353/1a1a1a/22d3ee?text=${fallbackTitle}`
  };
}

// Export object toàn cục để các file JS khác có thể gọi được
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getProxiedImageUrl,
    getImageAttributes,
    createImageErrorHandler,
    processImageUrl
  };
} else {
  // BẮT BUỘC KHAI BÁO VÀO WINDOW
  window.ImageUtils = {
    getProxiedImageUrl,
    getImageAttributes,
    createImageErrorHandler,
    processImageUrl
  };
}