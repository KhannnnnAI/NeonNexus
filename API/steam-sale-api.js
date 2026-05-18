// ===================================
// STEAM SALE API MODULE
// ===================================

var SteamSaleAPI = (() => {
  // ---- Smart URL Routing ----
  var CHEAPSHARK_DIRECT_URL = 'https://www.cheapshark.com/api/1.0';
  var SERVER_URL = 'https://nenonexus-digital-game-store.web.app';
  var PROXY_URL = `${SERVER_URL}/api/cheapshark`;

  var BASE_URL = PROXY_URL;
  var useProxy = true;
  var serverChecked = false;

  async function checkServerAvailability() {
    if (serverChecked) return useProxy;

    try {
      var controller = new AbortController();
      var timeout = setTimeout(() => controller.abort(), 3000);
      await fetch(`${SERVER_URL}/api/cheapshark/deals?storeID=1&pageSize=1`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      useProxy = true;
      BASE_URL = PROXY_URL;
      console.log('Proxy server is available using proxy mode');
    } catch (err) {
      useProxy = false;
      BASE_URL = CHEAPSHARK_DIRECT_URL;
      console.warn('Proxy server unavailable switching to DIRECT CheapShark API mode');
    }
    serverChecked = true;
    return useProxy;
  }

  // Summer Sale 2026 Configuration (Khớp 100% chuẩn giờ SteamDB / Valve)
  const SUMMER_SALE_2026 = {
    name: "Summer Sale 2026",
    // Bắt đầu: Thứ 5, 25/06/2026 lúc 10:00 AM PT (Tức 00:00 ngày 26/06 giờ Việt Nam)
    startDate: new Date('2026-06-25T17:00:00Z'), 
    // Kết thúc: Thứ 5, 09/07/2026 lúc 10:00 AM PT
    endDate: new Date('2026-07-09T17:00:00Z'),   
    maxDiscount: 90,
    description: "Up to 90% off on AAA games"
  };

  // Cache configuration
  const SALE_CACHE_KEY = 'steam_summer_sale_2026_cache';
  const SALE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Get current sale information (Chỉ Cache dữ liệu Game Deals, không Cache thời gian)
  async function getCurrentSaleInfo() {
    await checkServerAvailability();
    
    let saleInfo = { ...SUMMER_SALE_2026 };

    // Check cache first
    const cachedData = localStorage.getItem(SALE_CACHE_KEY);
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      if (Date.now() - timestamp < SALE_CACHE_TTL_MS) {
        console.log('Using cached sale data for deals');
        saleInfo.featuredDeals = data.featuredDeals;
        return saleInfo;
      }
    }

    // Get fresh deals from CheapShark
    try {
      const dealsResponse = await fetch(`${BASE_URL}/deals?storeID=1&sortBy=DealRating&desc=1&pageSize=5`);
      if (dealsResponse.ok) {
        const deals = await dealsResponse.json();
        saleInfo.featuredDeals = deals.slice(0, 3).map(deal => ({
          title: deal.title,
          discount: deal.savings,
          price: deal.salePrice,
          originalPrice: deal.normalPrice,
          steamID: deal.steamAppID,
          url: `https://store.steampowered.com/app/${deal.steamAppID}`
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch featured deals:', error);
      saleInfo.featuredDeals = [];
    }

    // Cache the deals data
    localStorage.setItem(SALE_CACHE_KEY, JSON.stringify({
      data: { featuredDeals: saleInfo.featuredDeals },
      timestamp: Date.now()
    }));

    return saleInfo;
  }

  // Format time for countdown
  function formatCountdown(milliseconds) {
    if (milliseconds <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return {
      days: days,
      hours: hours % 24,
      minutes: minutes % 60,
      seconds: seconds % 60
    };
  }

  // Update countdown display in DOM
  function updateCountdown(elementId, saleInfo) {
    const countdownElement = document.getElementById(elementId);
    if (!countdownElement) return;

    const { days, hours, minutes, seconds } = formatCountdown(saleInfo.timeUntil);
    
    // Update time displays
    const daysElement = countdownElement.querySelector('#days');
    const hoursElement = countdownElement.querySelector('#hours');
    const minutesElement = countdownElement.querySelector('#minutes');
    const secondsElement = countdownElement.querySelector('#seconds');
    
    if (daysElement) daysElement.textContent = String(days).padStart(2, '0');
    if (hoursElement) hoursElement.textContent = String(hours).padStart(2, '0');
    if (minutesElement) minutesElement.textContent = String(minutes).padStart(2, '0');
    if (secondsElement) secondsElement.textContent = String(seconds).padStart(2, '0');

    // Update status text
    const titleElement = document.querySelector('.countdown-title');
    const descElement = document.querySelector('.countdown-desc');
    const timerTextElement = document.querySelector('.featured-sale-timer-text');
    
    if (titleElement) {
      titleElement.textContent = `🔥 ${saleInfo.name}`;
    }
    
    if (descElement) {
      descElement.textContent = saleInfo.description;
    }
    
    if (timerTextElement && saleInfo.statusText !== 'Sale has ended') {
      timerTextElement.textContent = `${saleInfo.statusText} ${new Date(saleInfo.endDate).toLocaleDateString()}`;
    }
  }

  // Start countdown timer
  async function startCountdown(elementId = 'countdown') {
    // Clear any existing interval to prevent overlapping
    if (window.steamSaleInterval) {
      clearInterval(window.steamSaleInterval);
    }
    
    // Fetch Deals & Info 1 lần duy nhất khi load hàm
    let saleInfo = await getCurrentSaleInfo();
    
    // Vòng lặp đếm ngược Real-time chạy độc lập mỗi giây
    window.steamSaleInterval = setInterval(() => {
      const now = new Date();
      const start = new Date(saleInfo.startDate);
      const end = new Date(saleInfo.endDate);

      // Tính toán Status và TimeUntil dựa trên thời gian thực
      if (now >= start && now <= end) {
        saleInfo.status = 'active';
        saleInfo.timeUntil = end - now;
        saleInfo.statusText = 'Sale ends in';
      } else if (now < start) {
        saleInfo.status = 'upcoming';
        saleInfo.timeUntil = start - now;
        saleInfo.statusText = 'Sale starts in';
      } else {
        saleInfo.status = 'ended';
        saleInfo.timeUntil = 0;
        saleInfo.statusText = 'Sale has ended';
        
        // Dừng vòng lặp và hiển thị thông báo kết thúc sự kiện
        clearInterval(window.steamSaleInterval);
        const countdownEl = document.getElementById(elementId);
        if(countdownEl) {
          countdownEl.innerHTML = "<span style='color: #ff00ff; font-family: \"ROG Lyons\", monospace; font-weight: bold; text-transform: uppercase;'>EVENT HAS ENDED</span>";
        }
      }

      // Chỉ cập nhật DOM nếu sự kiện chưa kết thúc
      if (saleInfo.status !== 'ended') {
        updateCountdown(elementId, saleInfo);
      }
    }, 1000);
  }

  // Public API
  return {
    getCurrentSaleInfo,
    startCountdown,
    formatCountdown,
    SUMMER_SALE_2026
  };
})();