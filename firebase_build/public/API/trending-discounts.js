// ===================================
// TRENDING DISCOUNTS - FLASH SALE LOGIC
// ===================================

if (typeof _flashSaleCountdownInterval === 'undefined') {
  var _flashSaleCountdownInterval = null;
}

function _startFlashSaleCountdown() {
  if (_flashSaleCountdownInterval) clearInterval(_flashSaleCountdownInterval);

  function pad(n) { return String(n).padStart(2, '0'); }

  function update() {
    const timers = document.querySelectorAll('.dynamic-countdown-timer');
    if (timers.length === 0) return;
    
    const nowMs = Date.now();
    timers.forEach(timerEl => {
      const endTimestampMs = parseInt(timerEl.getAttribute('data-endtime'), 10) || 0;
      const diff = endTimestampMs - nowMs;
      if (diff <= 0) {
        timerEl.textContent = 'ENDED';
      } else {
        const days  = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins  = Math.floor((diff % 3600000) / 60000);
        const secs  = Math.floor((diff % 60000) / 1000);
        timerEl.textContent = `${pad(days)} : ${pad(hours)} : ${pad(mins)} : ${pad(secs)}`;
      }
    });
  }

  update();
  _flashSaleCountdownInterval = setInterval(update, 1000);
}

// Alias for backward compatibility with index.html
async function fetchFlashSaleDeal() {
  return await loadTrendingDiscounts();
}

async function loadTrendingDiscounts() {
  const CACHE_KEY = 'flash_sale_deal_v17';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // Try reading from cache first
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && cached.time && (Date.now() - cached.time < CACHE_TTL) && cached.data) {
        _applyFlashSaleDeal(cached.data);
        return;
      }
    }
  } catch (_) {}

  const STEAM_URL = 'https://store.steampowered.com/api/featuredcategories/?cc=us&l=en';

  // ─── Reliable server-side endpoints (no CORS issues at all) ────────────────
  const isHosted = window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com');
  const FIREBASE_STEAM = isHosted ? '/api/steam/featured' : 'https://nenonexus-digital-game-store.web.app/api/steam/featured';
  const LOCAL_PROXY    = 'http://localhost:3001/steam-featured';

  let data = null;

  // ── TIER 0-A: Firebase Cloud Functions (always on, no setup needed) ─────────
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 10000); // 10 seconds timeout
    const resp = await fetch(FIREBASE_STEAM, { signal: ctrl.signal });
    clearTimeout(tid);
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.specials) {
        data = json;
        console.log('[FlashSale] ✓ Firebase Functions success');
      } else {
        console.warn('[FlashSale] Firebase returned data but missing specials object:', json);
      }
    } else {
      console.warn(`[FlashSale] Firebase fetch failed with status ${resp.status}`);
    }
  } catch (err) {
    console.warn('[FlashSale] Firebase fetch exception:', err.message);
  }

  // ── TIER 0-B: Local Node.js proxy (steam-proxy.js) — if Railway is down ───
  if (!data) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 2000);
      const resp = await fetch(LOCAL_PROXY, { signal: ctrl.signal });
      clearTimeout(tid);
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.specials) {
          data = json;
          console.log('[FlashSale] ✓ Local proxy success (localhost:3001)');
        }
      }
    } catch (_) {}
  }

  // ── TIER 1: allorigins.win JSONP (script tag — bypasses CORS) ──────────────
  if (!data) {
    data = await new Promise((resolve) => {
      const cbName = '__ao_' + Date.now();
      const proxyUrl = 'https://api.allorigins.win/get?url='
        + encodeURIComponent(STEAM_URL) + '&callback=' + cbName;
      const s   = document.createElement('script');
      const tid = setTimeout(() => { cleanup(); resolve(null); }, 6000);

      function cleanup() {
        clearTimeout(tid);
        delete window[cbName];
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      window[cbName] = function(res) {
        cleanup();
        try {
          const parsed = res && res.contents ? JSON.parse(res.contents) : null;
          resolve(parsed && parsed.specials ? parsed : null);
        } catch(_) { resolve(null); }
      };
      s.onerror = () => { cleanup(); resolve(null); };
      s.src = proxyUrl;
      document.body.appendChild(s);
    });
    if (data) console.log('[FlashSale] ✓ allorigins JSONP success');
  }

  // ── TIER 2: fetch via cors.eu.org (Access-Control-Allow-Origin: *) ─────────
  if (!data) {
    for (const proxyUrl of [
      'https://cors.eu.org/' + STEAM_URL,
      'https://api.allorigins.win/get?url=' + encodeURIComponent(STEAM_URL),
    ]) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(proxyUrl, { signal: ctrl.signal });
        clearTimeout(tid);
        if (resp.ok) {
          let json = await resp.json();
          if (json && typeof json.contents === 'string') json = JSON.parse(json.contents);
          if (json && json.specials) {
            data = json;
            console.log('[FlashSale] ✓ Fetch proxy success');
            break;
          }
        }
      } catch (_) {}
    }
  }

  // ── Process Steam data if we got it ────────────────────────────────────────

  try {
    if (!data || !data.specials) throw new Error('All Steam endpoints failed');

    const specials = data.specials?.items || [];
    if (specials.length === 0) throw new Error('No Steam specials');

    // Filter: prefer AAA (original price >= $40 = 4000 cents), meaningful discount
    let candidates = specials.filter(g =>
      g.discounted &&
      g.original_price >= 4000 &&
      g.discount_percent >= 20
    );
    if (candidates.length === 0)
      candidates = specials.filter(g => g.discounted && g.original_price >= 2000);
    if (candidates.length === 0)
      candidates = specials.filter(g => g.discounted);
    if (candidates.length === 0) throw new Error('No discounted items');

    candidates.sort((a, b) =>
      b.discount_percent - a.discount_percent ||
      b.original_price  - a.original_price
    );

    const top5 = candidates.slice(0, 5).map(g => ({
      source:             'steam',
      title:              g.name,
      steamAppID:         g.id,
      finalPrice:         (g.final_price   / 100).toFixed(2),
      originalPrice:      (g.original_price / 100).toFixed(2),
      savings:            g.discount_percent,
      discountExpiration: (g.discount_expiration || 0) * 1000,
      imageUrl:  'https://cdn.akamai.steamstatic.com/steam/apps/' + g.id + '/header.jpg',
      thumb:     g.header_image || ''
    }));

    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data: top5 })); } catch (_) {}
    _applyFlashSaleDeal(top5);
    return;

  } catch (steamErr) {
    console.warn('[FlashSale] Steam data failed:', steamErr.message);
    console.warn('[FlashSale] All live endpoints failed, using static fallback');

    // ── TIER 4: Hardcoded static fallback — always works, no network needed ───
    const now   = new Date();
    const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17, 0, 0, 0));
    if (now.getTime() >= reset.getTime()) reset.setUTCDate(reset.getUTCDate() + 1);
    const exp = reset.getTime();

    _applyFlashSaleDeal([
      { title: 'Cyberpunk 2077',         steamAppID: 1091500, savings: 50, finalPrice: '29.99', originalPrice: '59.99', discountExpiration: exp, imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg', thumb: '' },
      { title: 'Elden Ring',             steamAppID: 1245620, savings: 40, finalPrice: '35.99', originalPrice: '59.99', discountExpiration: exp, imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg', thumb: '' },
      { title: 'Red Dead Redemption 2',  steamAppID: 1174180, savings: 67, finalPrice: '19.79', originalPrice: '59.99', discountExpiration: exp, imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1174180/header.jpg', thumb: '' },
      { title: 'The Witcher 3: Wild Hunt',steamAppID: 292030, savings: 70, finalPrice: '14.99', originalPrice: '49.99', discountExpiration: exp, imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/header.jpg',  thumb: '' },
      { title: 'Grand Theft Auto V',     steamAppID: 271590, savings: 75, finalPrice: '7.49',  originalPrice: '29.99', discountExpiration: exp, imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg',  thumb: '' },
    ]);
  }
}

function _applyFlashSaleDeal(deals) {
  if (!deals || (Array.isArray(deals) && deals.length === 0)) return;
  const dealsArray = Array.isArray(deals) ? deals : [deals];
  const listContainer = document.getElementById('discount-games-list'); if (!listContainer) return;

  const now = new Date(); const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17, 0, 0, 0));
  if (now.getTime() >= reset.getTime()) reset.setUTCDate(reset.getUTCDate() + 1); const defaultEndTime = reset.getTime();

  // Detect mobile device and load mobile CSS if needed
  const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile && !document.getElementById('mobile-styles-css')) {
    const mobileCSS = document.createElement('link');
    mobileCSS.id = 'mobile-styles-css';
    mobileCSS.rel = 'stylesheet';
    mobileCSS.href = '/css/mobile.css';
    document.head.appendChild(mobileCSS);
  }

  listContainer.innerHTML = dealsArray.map(deal => {
    let endTime = deal.discountExpiration; if (!endTime || endTime <= Date.now()) endTime = defaultEndTime;
    const fallbackImage = deal.thumb || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${deal.steamAppID}/header.jpg`;

    // Production-ready URL generation - link directly to Steam
    const gameUrl = `https://store.steampowered.com/app/${deal.steamAppID}`;

    // Always render original desktop version - mobile CSS will handle responsive
    return `
      <div class="event-card event-card-sale" style="cursor: pointer; margin-bottom: 16px;" onclick="window.location.href='${gameUrl}'">
        <img src="${deal.imageUrl}" alt="${deal.title}" class="event-card-bg" onerror="this.onerror=null; this.src='${fallbackImage}';">
        <div class="event-card-overlay"></div>
        <div class="event-card-content">
          <div class="event-sale-meta"><span class="event-sale-badge">SALE -${deal.savings}%</span><span class="event-sale-price">$${deal.finalPrice} (was $${deal.originalPrice})</span></div>
          <h4 class="event-card-title">${deal.title.toUpperCase()}</h4>
          <div class="event-countdown"><i data-lucide="clock" class="event-clock-icon"></i><span class="dynamic-countdown-timer" data-endtime="${endTime}">-- : -- : -- : --</span></div>
        </div>
      </div>
    `;
  }).join('');

  _startFlashSaleCountdown(); if (window.lucide) window.lucide.createIcons();
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadTrendingDiscounts,
        _startFlashSaleCountdown,
        _applyFlashSaleDeal
    };
}
