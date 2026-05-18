// ===================================
// GAME DETAIL PAGE - NeonNexus
// ===================================

const EXCHANGE_RATE = 26000;
const SERVER_URL = (window.location.hostname === 'nenonexus-digital-game-store.web.app' || window.location.hostname === 'localhost') 
  ? '' 
  : 'https://nenonexus-digital-game-store.web.app';
let stripePublishableKeyCache = null;
let stripePublishableKeyPromise = null;
let stripeJsLoadPromise = null;

async function getStripePublishableKey() {
  if (stripePublishableKeyCache !== null) {
    return stripePublishableKeyCache;
  }

  if (!stripePublishableKeyPromise) {
    stripePublishableKeyPromise = fetch(`${SERVER_URL}/api/public-config`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => (data && data.stripePublishableKey ? String(data.stripePublishableKey).trim() : ''))
      .catch(() => '')
      .then((key) => {
        stripePublishableKeyCache = key;
        return key;
      });
  }

  return stripePublishableKeyPromise;
}

function ensureStripeJsLoaded() {
  if (typeof window.Stripe === 'function') {
    return Promise.resolve();
  }

  if (!stripeJsLoadPromise) {
    stripeJsLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        stripeJsLoadPromise = null;
        reject(new Error('Failed to load Stripe SDK.'));
      };
      document.head.appendChild(script);
    });
  }

  return stripeJsLoadPromise;
}

// Read URL params - support both query parameters and path parameters
function getParams() {
  const pathParts = window.location.pathname.split('/');
  let steamIDFromPath = null;
  
  // 1. Try clean URL pattern: /game/12345
  const gameIndex = pathParts.findIndex(part => part === 'game');
  if (gameIndex !== -1 && pathParts[gameIndex + 1]) {
    steamIDFromPath = pathParts[gameIndex + 1];
  }
  
  // 2. Try traditional path info pattern: /game.html/12345
  if (!steamIDFromPath) {
    const gameHtmlIndex = pathParts.findIndex(part => part === 'game.html');
    if (gameHtmlIndex !== -1 && pathParts[gameHtmlIndex + 1]) {
      steamIDFromPath = pathParts[gameHtmlIndex + 1];
    }
  }
  
  // Fallback to query parameters for other data
  const params = new URLSearchParams(window.location.search);
  
  return {
    dealID: params.get('dealID'),
    steamID: steamIDFromPath || params.get('steamID') || params.get('appid'),
    title: params.get('title'),
    price: params.get('price'),
    originalPrice: params.get('originalPrice'),
    savings: params.get('savings'),
    image: params.get('image'),
    rating: params.get('rating')
  };
}

// Read currency choice
const currentCurrency = localStorage.getItem('currency') || 'VND';

// Format currency
function formatPrice(amount) {
  if (currentCurrency === 'USD') {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount);
  }
  if (typeof CheapSharkAPI !== 'undefined') {
    return CheapSharkAPI.formatCurrency(amount);
  }
  const rounded = Math.ceil(amount / 1000) * 1000;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(rounded);
}

// Main init
document.addEventListener('DOMContentLoaded', async () => {
  const params = getParams();

  // Basic check for steamID (minimum required for API fetch)
  if (!params.steamID) {
    const loading = document.getElementById('game-loading');
    if (loading) {
      loading.innerHTML = `
        <i data-lucide="alert-circle" style="width: 48px; height: 48px; color: #f87171;"></i>
        <p style="margin-top: 1rem; color: #f87171; font-family: 'ROG Viet', sans-serif;">GAME NOT FOUND</p>
        <a href="../index.html" style="margin-top: 1rem; color: var(--accent-primary);">← Back to Store</a>
      `;
    }
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Set initial page title & breadcrumb (if title available in params)
  if (params.title) {
    document.title = `${params.title} - NeonNexus`;
    const breadcrumbEl = document.getElementById('breadcrumb-title');
    if (breadcrumbEl) breadcrumbEl.textContent = params.title;
  } else {
    document.title = "Loading Game... - NeonNexus";
  }

  try {
    // Fetch data with a strict timeout handled inside fetchSteamData
    const steamData = await fetchSteamData(params.steamID);
    
    // Render page - this hides the 'game-loading' spinner
    renderPage(params, steamData);
  } catch (error) {
    console.error(' Initialization error:', error);
    // Fallback: render basic info even if extended fetch fails
    renderPage(params, null);
  }

  // --- Cart & Checkout Initialization (Consolidated) ---
  const cartBtn = document.getElementById('cart-btn');
  if (cartBtn) cartBtn.addEventListener('click', openCart);
  
  const closeCartBtn = document.getElementById('close-cart-btn');
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
  
  const cartBackdrop = document.querySelector('.cart-backdrop');
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);

  const reqModalBackdrop = document.querySelector('#login-required-modal .login-modal-backdrop');
  const cancelReqBtn = document.getElementById('close-login-required-btn');
  const reqModal = document.getElementById('login-required-modal');
  
  if (reqModalBackdrop && reqModal) {
    reqModalBackdrop.addEventListener('click', () => {
      reqModal.classList.remove('active');
      setTimeout(() => reqModal.style.display = 'none', 300);
    });
  }
  if (cancelReqBtn && reqModal) {
    cancelReqBtn.addEventListener('click', () => {
      reqModal.classList.remove('active');
      setTimeout(() => reqModal.style.display = 'none', 300);
    });
  }

  const checkoutBtn = document.querySelector('.cart-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function() {
      if (cart.length === 0) return;
      openCheckoutModal();
    });
  }

  loadCart(currentUserId);
  if (window.lucide) lucide.createIcons();
});

// ==========================================
// FETCH FROM STEAM STORE API (via server proxy)
// ==========================================
async function fetchSteamData(steamAppID) {
  if (!steamAppID || steamAppID === 'Unknown' || steamAppID === 'N/A' || steamAppID === '0') return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const url = `${SERVER_URL}/api/steam/details?appid=${steamAppID}`;
    console.log(` Fetching Steam details for appid: ${steamAppID}`);
    const response = await fetch(url, { signal: controller.signal });
    const result = await response.json();
    clearTimeout(timeoutId);

    if (result && result.success && result.data) {
      console.log(` Steam data loaded:`, result.data.name);
      return result.data;
    }
    return null;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(' Steam API fetch timed out (8s). Proceeding with basic info.');
    } else {
      console.warn(' Steam API fetch failed:', error.message);
    }
    return null;
  }
}

// ==========================================
// RENDER PAGE
// ==========================================
function renderPage(params, steam) {
  const loading = document.getElementById('game-loading');
  const content = document.getElementById('game-content');

  loading.style.display = 'none';
  content.style.display = 'block';

  // === Title & Tags (outside hero, always visible) ===
  const displayTitle = (steam && steam.name) ? steam.name : (params.title || 'Unknown Game');
  document.getElementById('hero-title').textContent = displayTitle;
  
  // Update browser title if it was missing
  if (!params.title && steam && steam.name) {
    document.title = `${steam.name} - NeonNexus`;
    const breadcrumbEl = document.getElementById('breadcrumb-title');
    if (breadcrumbEl) breadcrumbEl.textContent = steam.name;
  }

  // === HERO: Steam Trailer Video or Fallback Image ===
  const heroEl = document.getElementById('game-hero');
  const heroImg = document.getElementById('hero-img');
  const sidebarImg = document.getElementById('sidebar-img');

  // Determine hero image fallback
  let heroImgSrc = params.image || '';
  if (steam && steam.header_image) {
    heroImgSrc = `${SERVER_URL}/api/steam/image?url=${encodeURIComponent(steam.header_image)}`;
  } else if (params.steamID && params.steamID !== 'Unknown') {
    heroImgSrc = `${SERVER_URL}/api/steam/image?appid=${params.steamID}`;
  }

  // Set sidebar thumbnail - try multiple sources with fallback chain
  const sidebarSources = [
    // 1st: Steam API header_image (has correct hash URL) via proxy
    (steam && steam.header_image)
      ? `${SERVER_URL}/api/steam/image?url=${encodeURIComponent(steam.header_image)}`
      : null,
    // 2nd: Try appid-based proxy
    (params.steamID && params.steamID !== 'Unknown')
      ? `${SERVER_URL}/api/steam/image?appid=${params.steamID}`
      : null,
    // 3rd: URL param image (custom image)
    params.image || null
  ].filter(Boolean);
  let sidebarTryIndex = 0;
  function trySidebarImage() {
    if (sidebarTryIndex < sidebarSources.length) {
      sidebarImg.src = sidebarSources[sidebarTryIndex];
      sidebarTryIndex++;
    }
  }
  sidebarImg.onerror = trySidebarImage;
  trySidebarImage();

  // Check if Steam has trailer videos (prefer global/English trailer deterministically)
  const rankedSteamTrailers = getRankedSteamTrailers(steam && steam.movies ? steam.movies : []);
  if (rankedSteamTrailers.length > 0) {
    setHeroAspectRatio(heroEl, '16 / 9');
    // Replace hero content with video player + full controls
    heroEl.innerHTML = `
      <img
        id="hero-video-placeholder"
        class="game-hero-img hero-video-placeholder"
        src="${heroImgSrc}"
        alt="${params.title}"
      />
      <video 
        id="hero-video" 
        class="game-hero-img hero-video-element" 
        autoplay 
        muted 
        playsinline
        poster="${heroImgSrc}"
      ></video>
      <div class="game-hero-overlay" style="pointer-events:none;"></div>
      <div id="hero-play-overlay" class="hero-play-overlay">
        <div class="play-circle"><i data-lucide="play"></i></div>
      </div>
      <div class="hero-video-controls">
        <div class="video-progress-wrap" id="video-progress-wrap">
          <div class="video-progress-bar" id="video-progress-bar"></div>
        </div>
        <div class="video-controls-row">
          <button id="video-play-btn" class="video-control-btn" title="Pause">
            <i data-lucide="pause"></i>
          </button>
          <span id="video-time" class="video-time">0:00 / 0:00</span>
          <div class="video-spacer"></div>
          <button id="video-sound-btn" class="video-control-btn" title="Mute/Unmute">
            <i data-lucide="volume-x"></i>
          </button>
        </div>
      </div>
    `;

    // === Wire up video controls ===
    const video = document.getElementById('hero-video');
    const playBtn = document.getElementById('video-play-btn');
    const soundBtn = document.getElementById('video-sound-btn');
    const progressWrap = document.getElementById('video-progress-wrap');
    const progressBar = document.getElementById('video-progress-bar');
    const timeDisplay = document.getElementById('video-time');
    const playOverlay = document.getElementById('hero-play-overlay');
    const videoPlaceholder = document.getElementById('hero-video-placeholder');

    let activeTrailerIndex = -1;
    let activeSourceIndex = -1;
    let activeSourceCandidates = [];
    let activeAttemptToken = '';
    let trailerLoadTimer = null;
    let steamPlaybackReady = false;

    function clearTrailerLoadTimer() {
      if (trailerLoadTimer) {
        clearTimeout(trailerLoadTimer);
        trailerLoadTimer = null;
      }
    }

    function tryNextSourceInTrailer() {
      activeSourceIndex += 1;

      if (activeSourceIndex >= activeSourceCandidates.length) {
        trySteamTrailerByIndex(activeTrailerIndex + 1);
        return;
      }

      const source = activeSourceCandidates[activeSourceIndex];
      const movie = rankedSteamTrailers[activeTrailerIndex];
      const token = `${activeTrailerIndex}:${activeSourceIndex}:${Date.now()}`;

      steamPlaybackReady = false;
      activeAttemptToken = token;

      if (videoPlaceholder) {
        videoPlaceholder.style.opacity = '1';
      }
      video.classList.remove('is-ready');
      video.removeAttribute('src');
      video.load();
      video.src = source.url;

 console.log(
        `Trying Steam trailer ${activeTrailerIndex + 1}/${rankedSteamTrailers.length}, source ${activeSourceIndex + 1}/${activeSourceCandidates.length}: ${movie.name || movie.id}`
      );

      video.load();
      video.play().catch(() => {});

      clearTrailerLoadTimer();
      trailerLoadTimer = setTimeout(() => {
        if (!steamPlaybackReady && activeAttemptToken === token) {
 console.warn(`Steam trailer source timeout: ${source.url}`);
          tryNextSourceInTrailer();
        }
      }, 4500);
    }

    function trySteamTrailerByIndex(index) {
      if (index >= rankedSteamTrailers.length) {
        clearTrailerLoadTimer();
 console.warn('No playable Steam trailer source found, using static image fallback.');
        fallbackToHeroImage(heroEl, heroImgSrc, params);
        return;
      }

      activeTrailerIndex = index;
      activeSourceIndex = -1;
      activeSourceCandidates = buildSteamMovieSourceCandidates(rankedSteamTrailers[index]);

      if (activeSourceCandidates.length === 0) {
        trySteamTrailerByIndex(index + 1);
        return;
      }

      tryNextSourceInTrailer();
    }
    // Format time helper
    function fmtTime(s) {
      if (isNaN(s)) return '0:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    // Play/Pause toggle
    function togglePlay() {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }

    // Update button icon on play/pause
    video.addEventListener('play', () => {
      playBtn.innerHTML = '<i data-lucide="pause"></i>';
      lucide.createIcons();
    });
    video.addEventListener('pause', () => {
      playBtn.innerHTML = '<i data-lucide="play"></i>';
      lucide.createIcons();
    });

    video.addEventListener('loadeddata', () => {
      steamPlaybackReady = true;
      clearTrailerLoadTimer();
      video.classList.add('is-ready');
      if (videoPlaceholder) {
        videoPlaceholder.style.opacity = '0';
      }
    });

    playBtn.addEventListener('click', togglePlay);

    // Click on video to play/pause
    video.addEventListener('click', () => {
      togglePlay();
      // Show center overlay briefly
      playOverlay.querySelector('.play-circle').innerHTML = video.paused
        ? '<i data-lucide="play"></i>'
        : '<i data-lucide="pause"></i>';
      playOverlay.classList.add('show');
      lucide.createIcons();
      setTimeout(() => playOverlay.classList.remove('show'), 600);
    });

    // Progress bar update
    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const pct = (video.currentTime / video.duration) * 100;
        progressBar.style.width = pct + '%';
        timeDisplay.textContent = fmtTime(video.currentTime) + ' / ' + fmtTime(video.duration);
      }
    });

    // Click to seek
    progressWrap.addEventListener('click', (e) => {
      const rect = progressWrap.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      video.currentTime = pct * video.duration;
    });

    // Drag to seek
    let isDragging = false;
    progressWrap.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = progressWrap.getBoundingClientRect();
      video.currentTime = ((e.clientX - rect.left) / rect.width) * video.duration;
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = progressWrap.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.currentTime = pct * video.duration;
    });
    document.addEventListener('mouseup', () => { isDragging = false; });

    // Sound toggle
    soundBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      soundBtn.innerHTML = video.muted
        ? '<i data-lucide="volume-x"></i>'
        : '<i data-lucide="volume-2"></i>';
      lucide.createIcons();
    });

    // If one source fails, try the next source in this movie first.
    video.addEventListener('error', () => {
      if (steamPlaybackReady) return;
 console.warn('Steam trailer source failed, trying next source...');
      tryNextSourceInTrailer();
    });

    // Start with best-ranked trailer
    trySteamTrailerByIndex(0);

    // Hide the separate trailer container since video is in hero
    document.getElementById('trailer-container').style.display = 'none';
  } else {
    // No Steam trailer available => keep static game image in hero.
    setHeroAspectRatio(heroEl, '16 / 9');
    setupHeroImage(heroImg, heroImgSrc, params);
  }

  // Hero tags (genres)
  const tagsContainer = document.getElementById('hero-tags');
  if (tagsContainer) {
    if (steam && steam.genres) {
      tagsContainer.innerHTML = steam.genres.map(g =>
        `<span class="game-tag">${g.description}</span>`
      ).join('');
    }
  }

  // === Price ===
  const price = parseFloat(params.price) || 0;
  const originalPrice = parseFloat(params.originalPrice) || 0;
  const savings = parseInt(params.savings) || 0;

  document.getElementById('price-current').textContent = formatPrice(price);
  if (savings > 0) {
    document.getElementById('price-original').textContent = formatPrice(originalPrice);
    document.getElementById('price-discount').textContent = `-${savings}%`;
  } else {
    document.getElementById('price-original').style.display = 'none';
    document.getElementById('price-discount').style.display = 'none';
  }

  // === Add to Cart ===
  document.getElementById('btn-add-cart').addEventListener('click', () => {
    const gameObj = {
      id: parseFloat(params.dealID?.replace('rawg_', '') || params.steamID) || params.title, // Clean ID for cart sync
      dealID: params.dealID,
      title: params.title,
      price: price,
      originalPrice: originalPrice,
      savings: savings,
      image: heroImgSrc || params.image,
      imageFallback: params.image,
      imageFallback2: sidebarImg.src,
      steamAppID: params.steamID,
      platform: 'STEAM',
      quantity: 1
    };

    addToCart(gameObj);
    
    // Show visual feedback on button
    const btn = document.getElementById('btn-add-cart');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check"></i> ADDED TO CART!';
    btn.style.background = '#16a34a';
    lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
      lucide.createIcons();
    }, 2000);
  });

  // === Steam Link ===
  const steamBtn = document.getElementById('btn-steam');
  const canOpenSteamStore = Boolean(steam && params.steamID && params.steamID !== 'Unknown' && params.steamID !== 'N/A');
  if (canOpenSteamStore) {
    steamBtn.style.display = 'flex';
    steamBtn.addEventListener('click', () => {
      window.open(`https://store.steampowered.com/app/${params.steamID}`, '_blank');
    });
  } else {
    steamBtn.style.display = 'none';
  }

  // === Info Card ===
  document.getElementById('info-rating').textContent = params.rating ? `⭐ ${params.rating}/5` : '—';
  document.getElementById('info-steamid').textContent = params.steamID || '—';

  if (steam) {
    // Use Steam data for info
    if (steam.release_date) {
      const releaseText = steam.release_date.date || (steam.release_date.coming_soon ? 'Coming Soon' : '—');
      document.getElementById('info-release').textContent = releaseText;
    }
    if (steam.developers && steam.developers.length > 0) {
      document.getElementById('info-developer').textContent = steam.developers[0];
    }
    if (steam.publishers && steam.publishers.length > 0) {
      document.getElementById('info-publisher').textContent = steam.publishers[0];
    }
    if (steam.metacritic) {
      document.getElementById('info-rating').textContent = `⭐ ${params.rating || '—'} | MC: ${steam.metacritic.score}`;
    }
  }

  // === Description (Steam only) ===
  const descEl = document.getElementById('game-description');
  if (steam && steam.about_the_game) {
    descEl.innerHTML = steam.about_the_game;
  } else if (steam && steam.short_description) {
    descEl.innerHTML = `<p>${steam.short_description}</p>`;
  } else {
    descEl.innerHTML = `<p style="color: var(--text-muted);">No description available for this game.</p>`;
  }
  normalizeDescriptionMedia(descEl);

  // === Screenshots (Steam only) ===
  let screenshots = [];
  if (steam && steam.screenshots && steam.screenshots.length > 0) {
    screenshots = steam.screenshots.map(ss => ss.path_full);
  }

  if (screenshots.length > 0) {
    document.getElementById('section-screenshots').style.display = 'block';
    const grid = document.getElementById('screenshots-grid');
    grid.innerHTML = screenshots.slice(0, 8).map(url =>
      `<div class="screenshot-item" data-src="${url}">
        <img src="${url}" alt="Screenshot" loading="lazy" onerror="this.parentElement.style.display='none'">
      </div>`
    ).join('');

    // Lightbox
    grid.querySelectorAll('.screenshot-item').forEach(item => {
      item.addEventListener('click', () => {
        const lightbox = document.getElementById('lightbox');
        document.getElementById('lightbox-img').src = item.dataset.src;
        lightbox.classList.add('active');
      });
    });
  }

  // === System Requirements (Steam only) ===
  let hasReqs = false;
  const reqSection = document.getElementById('section-requirements');
  const reqContent = document.getElementById('requirements-content');

  if (steam && steam.pc_requirements) {
    const hasMin = steam.pc_requirements.minimum;
    const hasRec = steam.pc_requirements.recommended;
    if (hasMin || hasRec) {
      hasReqs = true;
      reqSection.style.display = 'block';
      reqContent.innerHTML = `
        ${hasMin ? `<div class="req-column"><h4>MINIMUM</h4><div style="font-size:0.82rem;color:var(--text-secondary,#d1d5db);line-height:1.6;">${hasMin}</div></div>` : ''}
        ${hasRec ? `<div class="req-column"><h4>RECOMMENDED</h4><div style="font-size:0.82rem;color:var(--text-secondary,#d1d5db);line-height:1.6;">${hasRec}</div></div>` : ''}
      `;
    }
  }

  // Re-init all Lucide icons
  lucide.createIcons();

  // === Lightbox close ===
  document.getElementById('lightbox').addEventListener('click', () => {
    document.getElementById('lightbox').classList.remove('active');
  });
  document.getElementById('lightbox-close').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('lightbox').classList.remove('active');
  });
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function buildSteamMovieSourceCandidates(movie) {
  if (!movie) return [];

  const candidates = [];
  const seen = new Set();
  const pushSource = (url, type) => {
    if (!url || typeof url !== 'string') return;
    if (!/^https?:\/\//i.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, type });
  };

  // Prefer mp4 first for broader playback compatibility.
  // Some unreleased/new games expose movie URLs that only work on specific renditions.
  pushSource(movie.mp4 && movie.mp4.max, 'video/mp4');
  pushSource(movie.mp4 && movie.mp4['480'], 'video/mp4');
  pushSource(movie.webm && movie.webm.max, 'video/webm');
  pushSource(movie.webm && movie.webm['480'], 'video/webm');

  return candidates;
}

function getRankedSteamTrailers(movies) {
  if (!Array.isArray(movies) || movies.length === 0) return [];

  // Avoid "random" trailer order by ranking explicitly and picking best score.
  const ranked = movies
    .map((movie, index) => {
      const name = String(movie && movie.name ? movie.name : '').toLowerCase();
      const hasPlayableUrl = buildSteamMovieSourceCandidates(movie).length > 0;
      if (!hasPlayableUrl) {
        return null;
      }

      let score = 0;

      // Prefer English/global labels.
      if (/\b(english|global|worldwide|international)\b/.test(name)) score += 120;

      // Prefer official trailers first.
      if (/\bofficial trailer\b/.test(name)) score += 100;
      else if (/\blaunch trailer\b/.test(name)) score += 90;
      else if (/\btrailer\b/.test(name)) score += 80;
      else if (/\bannouncement\b/.test(name)) score += 60;

      // De-prioritize clearly localized non-English variants if they exist.
      if (/\b(japanese|korean|chinese|schinese|tchinese|thai|russian|spanish|french|german|italian|portuguese|turkish|polish|latam)\b/.test(name)) {
        score -= 120;
      }
      if (/[^\x00-\x7F]/.test(name)) {
        score -= 20;
      }

      // Prefer larger/global stable stream first (mp4 max fallback chain already handled).
      if (movie && movie.mp4 && movie.mp4.max) score += 10;

      return { movie, index, score };
    })
    .filter(Boolean)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));

  return ranked.map((entry) => entry.movie);
}

function pickPreferredSteamTrailer(movies) {
  const ranked = getRankedSteamTrailers(movies);
  return ranked.length > 0 ? ranked[0] : null;
}

function setupHeroImage(heroImg, heroImgSrc, params) {
  const heroEl = heroImg ? heroImg.closest('.game-hero') : null;
  setHeroAspectRatio(heroEl, '16 / 9');
  heroImg.src = heroImgSrc;
  heroImg.alt = params.title;
  heroImg.onerror = function() {
    const fallbackSrc = params.image || 'https://placehold.co/1200x675/1a1a1a/22d3ee?text=No+Image';
    setHeroAspectRatio(heroEl, '16 / 9');
    this.src = fallbackSrc;
  };
}

function normalizeDescriptionMedia(container) {
  if (!container) return;

  // Force all media to stay inside the description panel.
  container.querySelectorAll('img, video, iframe, embed, object').forEach((el) => {
    el.removeAttribute('width');
    el.removeAttribute('height');
    el.style.maxWidth = '100%';
    el.style.width = '100%';
    el.style.height = 'auto';
    el.style.objectFit = 'contain';
    el.style.display = 'block';
    el.style.float = 'none';
  });

  // Steam markup can include fixed-width wrappers; keep them inside panel.
  container.querySelectorAll('*').forEach((el) => {
    const widthStyle = (el.style.width || '').toLowerCase();
    const minWidthStyle = (el.style.minWidth || '').toLowerCase();

    if (widthStyle.endsWith('px')) {
      const widthPx = Number.parseFloat(widthStyle);
      if (Number.isFinite(widthPx) && widthPx > 0) {
        el.style.maxWidth = '100%';
      }
    }

    if (minWidthStyle.endsWith('px')) {
      const minWidthPx = Number.parseFloat(minWidthStyle);
      if (Number.isFinite(minWidthPx) && minWidthPx > 0) {
        el.style.minWidth = '0';
      }
    }
  });
}

function fallbackToHeroImage(heroEl, heroImgSrc, params) {
  if (!heroEl) return;

  setHeroAspectRatio(heroEl, '16 / 9');
  heroEl.innerHTML = `
    <img class="game-hero-img" src="${heroImgSrc}" alt="${params.title}"
         onerror="this.src='${params.image || 'https://placehold.co/1200x675/1a1a1a/22d3ee?text=No+Image'}'">
    <div class="game-hero-overlay"></div>
  `;
  lucide.createIcons();
}

function setHeroAspectRatio(heroEl, ratio) {
  if (!heroEl) return;
  heroEl.style.setProperty('--hero-aspect-ratio', ratio || '16 / 9');
}

// ==========================================
// CART LOGIC (Ported from index.js) 
// ==========================================

let cart = [];
let isCartOpen = false;
let currentUserId = 'guest';

// Save cart to localStorage and Firebase
async function saveCart() {
  const cartKey = `cart_${currentUserId}`;
  localStorage.setItem(cartKey, JSON.stringify(cart));
  
  if (currentUserId !== 'guest' && window.firebaseCart) {
    try {
      await window.firebaseCart.saveCart(currentUserId, cart);
    } catch (error) {
 console.warn(' Firebase sync failed');
    }
  }
}

// Load cart from localStorage
async function loadCart(userId) {
  const cartKey = `cart_${userId}`;
  let cartItems = [];
  let loadedFromFirebase = false;
  
  if (userId !== 'guest' && window.firebaseCart && window.firebaseCart.isAvailable()) {
    try {
      const firebaseItems = await window.firebaseCart.loadCart(userId);
      if (firebaseItems && firebaseItems.length > 0) {
        // Fetch full details
        const promises = firebaseItems.map(async (item) => {
          try {
            const details = await CheapSharkAPI.getDealDetails(item.dealID || item.id);
            return { ...details, quantity: item.quantity };
          } catch (error) {
            return null;
          }
        });
        const results = await Promise.all(promises);
        cartItems = results.filter(item => item !== null);
        loadedFromFirebase = true;
      }
    } catch (error) {
 console.warn(' Firebase loaded failed');
    }
  }
  
  if (!loadedFromFirebase) {
    const savedCart = localStorage.getItem(cartKey);
    if (savedCart) {
      try {
        cartItems = JSON.parse(savedCart);
      } catch (error) {
        cartItems = [];
      }
    }
  }
  cart = cartItems;
  updateCartUI();
}

function addToCart(game) {
  if (currentUserId === 'guest') {
    const modal = document.getElementById('login-required-modal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('active');
        lucide.createIcons();
      }, 10);
    }
    return;
  }
  
  const existing = cart.find(item => item.id === game.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...game, quantity: 1 });
  }
  saveCart();
  updateCartUI();
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  updateCartUI();
}

function updateQuantity(id, change) {
  const item = cart.find(item => item.id === id);
  if (item) {
    item.quantity = Math.max(1, item.quantity + change);
    saveCart();
    updateCartUI();
  }
}

function getCartTotal() {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function updateCartUI() {
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartBadge = document.getElementById('cart-badge');
  const cartHeaderCount = document.getElementById('cart-header-count');
  
  if (cartItemCount > 0) {
    if(cartBadge) {
      cartBadge.textContent = cartItemCount;
      cartBadge.style.display = 'flex';
    }
  } else {
    if(cartBadge) cartBadge.style.display = 'none';
  }
  
  if (cartHeaderCount) {
    cartHeaderCount.textContent = cartItemCount;
  }
  
  renderCart();
}

function openCart() {
  isCartOpen = true;
  document.getElementById('cart-drawer').style.display = 'flex';
  renderCart();
}

function closeCart() {
  isCartOpen = false;
  document.getElementById('cart-drawer').style.display = 'none';
}

function renderCart() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total-amount');
  if(!cartItems || !cartTotal) return;

  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty">EMPTY_CONTAINER</div>';
  } else {
    cartItems.innerHTML = '';
    cart.forEach(item => {
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      
      const priceStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(item.price);

      cartItem.innerHTML = `
        <img src="${item.image}" class="cart-item-image" alt="${item.title}">
        <div class="cart-item-content">
          <h4 class="cart-item-title">${item.title}</h4>
          <p class="cart-item-price">${priceStr}</p>
          <div class="cart-item-controls">
            <div class="quantity-controls">
              <button class="quantity-btn" data-action="decrease" data-id="${item.id}">
                <i data-lucide="minus" class="quantity-icon"></i>
              </button>
              <span class="quantity-value">${item.quantity}</span>
              <button class="quantity-btn" data-action="increase" data-id="${item.id}">
                <i data-lucide="plus" class="quantity-icon"></i>
              </button>
            </div>
            <button class="remove-btn" data-action="remove" data-id="${item.id}">
              <i data-lucide="trash-2" class="remove-icon"></i>
            </button>
          </div>
        </div>
      `;
      cartItem.querySelector('[data-action="decrease"]').onclick = () => updateQuantity(item.id, -1);
      cartItem.querySelector('[data-action="increase"]').onclick = () => updateQuantity(item.id, 1);
      cartItem.querySelector('[data-action="remove"]').onclick = () => removeFromCart(item.id);
      cartItems.appendChild(cartItem);
    });
    lucide.createIcons();
  }
  
  const totalStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(getCartTotal());
  cartTotal.textContent = totalStr;
}

// Global Auth Event Listeners
window.addEventListener('user-login', (e) => {
  currentUserId = e.detail.userId;
  loadCart(currentUserId);
  
  const reqModal = document.getElementById('login-required-modal');
  if (reqModal) {
    reqModal.classList.remove('active');
    setTimeout(() => reqModal.style.display = 'none', 300);
  }
});

window.addEventListener('user-logout', () => {
  currentUserId = 'guest';
  cart = [];
  saveCart();
  updateCartUI();
});

// Initialization handled in the top-level DOMContentLoaded listener

  // ===================================
  // CHECKOUT MODAL LOGIC
  // ===================================

  let selectedPaymentMethod = null;

  function openCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.classList.add('active');
    updateCheckoutTotals();
    showPaymentSelection();
    lucide.createIcons();
    setTimeout(() => {
      initStripeElements().catch((error) => {
 console.warn('Stripe init failed:', error);
      });
    }, 100);
  }

  function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.classList.remove('active');
    selectedPaymentMethod = null;
  }

  function getCartItemCount() {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }

  async function updateCheckoutTotals() {
    let total = getCartTotal();
    const itemCount = getCartItemCount();
    let discountPercent = 0, discountAmount = 0, finalTotal = total, tierName = 'Member';

    if (currentUserId && currentUserId !== 'guest' && window.firebaseCart && window.firebaseCart.getUserMembership) {
      try {
        const membership = await window.firebaseCart.getUserMembership(currentUserId);
        if (membership && membership.discount > 0) {
          discountPercent = membership.discount;
          tierName = membership.tier;
          discountAmount = total * discountPercent;
          finalTotal = total - discountAmount;
        }
 } catch (err) { console.warn('Membership check failed:', err); }
    }

    const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(Math.ceil(v / 1000) * 1000);

    const subtotalRow = document.getElementById('checkout-subtotal-row');
    const subtotalEl = document.getElementById('checkout-subtotal');
    if (discountPercent > 0 && subtotalRow) {
      subtotalRow.style.display = 'flex';
      subtotalEl.textContent = fmt(total);
    } else if (subtotalRow) {
      subtotalRow.style.display = 'none';
    }

    const discountRow = document.getElementById('checkout-discount-row');
    const discountLabel = document.getElementById('checkout-discount-label');
    const discountVal = document.getElementById('checkout-discount-amount');
    if (discountPercent > 0 && discountRow) {
      discountRow.style.display = 'flex';
      discountLabel.textContent = `${tierName} Discount (-${discountPercent * 100}%):`;
      discountVal.textContent = `-${fmt(discountAmount)}`;
    } else if (discountRow) {
      discountRow.style.display = 'none';
    }

    const formattedTotal = fmt(finalTotal);
    const ids = ['checkout-total-amount', 'card-total', 'vietqr-total', 'vietqr-amount', 'momo-total', 'momo-amount', 'zalopay-total', 'zalopay-amount'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = formattedTotal; });

    const countIds = { 'card-items-count': `${itemCount} items`, 'momo-items-count': `${itemCount} items`, 'zalopay-items-count': `${itemCount} items` };
    Object.entries(countIds).forEach(([id, text]) => { const el = document.getElementById(id); if (el) el.textContent = text; });

    const orderId = 'NEONORDER' + Date.now().toString().slice(-6);
    const vqc = document.getElementById('vietqr-content'); if (vqc) vqc.textContent = orderId;
    const mti = document.getElementById('momo-transaction-id'); if (mti) mti.textContent = 'TRANS_NX' + Date.now().toString().slice(-6);
    const zti = document.getElementById('zalopay-transaction-id'); if (zti) zti.textContent = 'TRANS_ZP' + Date.now().toString().slice(-6);
  }

  function showPaymentSelection() {
    document.querySelectorAll('.checkout-section').forEach(s => s.classList.remove('active'));
    document.getElementById('payment-selection').classList.add('active');
    const continueBtn = document.getElementById('checkout-continue-btn');
    continueBtn.disabled = true;
    document.getElementById('continue-btn-text').textContent = 'SELECT METHOD';
    document.getElementById('checkout-back-btn').style.display = 'none';
    lucide.createIcons();
  }

  function showPaymentForm(method) {
    document.querySelectorAll('.checkout-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${method}-form`).classList.add('active');
    const continueBtn = document.getElementById('checkout-continue-btn');
    continueBtn.disabled = false;
    if (method === 'card') document.getElementById('continue-btn-text').textContent = 'PAY NOW';
    else if (method === 'vietqr') document.getElementById('continue-btn-text').textContent = 'PAY WITH QR';
    else document.getElementById('continue-btn-text').textContent = 'CONFIRM PAYMENT';
    document.getElementById('checkout-back-btn').style.display = 'flex';
    lucide.createIcons();
  }

  // Payment method selection
  document.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', function() {
      document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');
      selectedPaymentMethod = this.dataset.method;
      document.getElementById('checkout-continue-btn').disabled = false;
      document.getElementById('continue-btn-text').textContent = 'CONTINUE';
    });
  });

  // Continue button
  document.getElementById('checkout-continue-btn').addEventListener('click', function() {
    if (this.disabled) return;
    const activeSection = document.querySelector('.checkout-section.active');
    if (activeSection.id === 'payment-selection') {
      if (selectedPaymentMethod) {
        if (['momo', 'vietqr', 'zalopay'].includes(selectedPaymentMethod)) {
          processPayment();
        } else {
          showPaymentForm(selectedPaymentMethod);
        }
      }
    } else {
      processPayment();
    }
  });

  // Back button
  document.getElementById('checkout-back-btn').addEventListener('click', () => showPaymentSelection());

  // Close button
  document.getElementById('close-checkout-btn').addEventListener('click', closeCheckoutModal);

  // Overlay close
  document.querySelector('.checkout-modal-overlay').addEventListener('click', closeCheckoutModal);

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('checkout-modal');
      if (modal.classList.contains('active')) closeCheckoutModal();
    }
  });

  function finishCheckout() {
    cart = [];
    saveCart();
    updateCartUI();
    closeCheckoutModal();
    closeCart();
    const keygenUrl = (typeof window.url === 'function') ? window.url('/keygen') : 'keygen.html';
    window.location.href = keygenUrl;
  }

  async function processPayment() {
    const continueBtn = document.getElementById('checkout-continue-btn');
    const btnText = document.getElementById('continue-btn-text');
    const originalText = btnText.textContent;
    continueBtn.disabled = true;

    localStorage.setItem('purchasedItems', JSON.stringify(cart));

    try {
      let amount = Math.round(getCartTotal());

      if (currentUserId && currentUserId !== 'guest' && window.firebaseCart && window.firebaseCart.getUserMembership) {
        try {
          const membership = await window.firebaseCart.getUserMembership(currentUserId);
          if (membership && membership.discount > 0) {
            amount = Math.round(amount - (amount * membership.discount));
          }
        } catch (err) { /* proceed full price */ }
      }

      // STRIPE CARD
      if (selectedPaymentMethod === 'card') {
        if (!stripe || !cardNumber) {
          await initStripeElements();
        }
        if (!stripe || !cardNumber) {
          throw new Error('Card payment is not available right now.');
        }

        btnText.textContent = 'PROCESSING...';
        const response = await fetch(`${SERVER_URL}/api/create-payment-intent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, currency: 'vnd' })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        const result = await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: { card: cardNumber, billing_details: { name: document.getElementById('card-holder').value || 'Guest' } }
        });
        if (result.error) {
          showNotification(result.error.message, 'error');
          continueBtn.disabled = false; btnText.textContent = originalText;
        } else if (result.paymentIntent.status === 'succeeded') {
          showNotification('Card payment successful!', 'success');
          finishCheckout();
        }
        return;
      }

      // MOMO
      if (selectedPaymentMethod === 'momo') {
        btnText.textContent = 'REDIRECTING TO MOMO...';
        const pathParts = window.location.pathname.split('/'); pathParts.pop();
        const basePath = pathParts.join('/');
        const redirectUrl = `${window.location.origin}${basePath}/keygen`;
        const products = cart.map(i => i.title).join(', ');
        const description = products.length > 50 ? products.substring(0, 47) + '...' : products;
        const response = await fetch(`${SERVER_URL}/api/create-momo-payment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, redirectUrl, description })
        });
        const data = await response.json();
        if (data.payUrl) { cart = []; saveCart(); localStorage.setItem('payment_method', 'momo'); window.location.href = data.payUrl; }
        else throw new Error('Could not receive MoMo payment link');
        return;
      }

      // ZALOPAY
      if (selectedPaymentMethod === 'zalopay') {
        btnText.textContent = 'REDIRECTING TO ZALOPAY...';
        const pathParts = window.location.pathname.split('/'); pathParts.pop();
        const basePath = pathParts.join('/');
        const redirectUrl = `${window.location.origin}${basePath}/keygen`;
        const products = cart.map(i => i.title).join(', ');
        const description = products.length > 50 ? products.substring(0, 47) + '...' : products;
        const response = await fetch(`${SERVER_URL}/api/create-zalopay-payment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, redirectUrl, products, description })
        });
        const data = await response.json();
        if (data.order_url) { cart = []; saveCart(); localStorage.setItem('payment_method', 'zalopay'); window.location.href = data.order_url; }
        else throw new Error(data.return_message || 'Could not receive ZaloPay payment link');
        return;
      }

      // VIETQR / PAYOS
      if (selectedPaymentMethod === 'vietqr') {
        btnText.textContent = 'GENERATING QR CODE...';
        const pathParts = window.location.pathname.split('/'); pathParts.pop();
        const basePath = pathParts.join('/');
        const redirectUrl = `${window.location.origin}${basePath}/keygen`;
        const cancelUrl = window.location.href;
        const response = await fetch(`${SERVER_URL}/api/create-payos-payment`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, returnUrl: redirectUrl, cancelUrl })
        });
        const data = await response.json();
        if (data.checkoutUrl) { cart = []; saveCart(); localStorage.setItem('payment_method', 'vietqr'); window.location.href = data.checkoutUrl; }
        else throw new Error('Could not receive VietQR payment link');
        return;
      }

      // Fallback mock
      btnText.textContent = 'PROCESSING...';
      setTimeout(() => { showNotification('Payment successful!', 'success'); finishCheckout(); }, 2000);

    } catch (error) {
 console.error('Payment Error:', error);
      showNotification(error.message || 'Server connection error', 'error');
      continueBtn.disabled = false;
      btnText.textContent = originalText;
    }
  }

  // STRIPE ELEMENTS
  let stripe, elements, cardNumber, cardExpiry, cardCvc;

  async function initStripeElements() {
    if (cardNumber) return;
    const [publishableKey] = await Promise.all([
      getStripePublishableKey(),
      ensureStripeJsLoaded()
    ]);
    if (!publishableKey) {
      throw new Error('Stripe publishable key is missing.');
    }
    if (typeof window.Stripe !== 'function') {
      throw new Error('Stripe SDK is unavailable.');
    }
    stripe = window.Stripe(publishableKey);
    elements = stripe.elements();
    const style = {
      base: { color: '#fff', fontFamily: '"Roboto", sans-serif', fontSize: '16px', iconColor: '#22d3ee', '::placeholder': { color: '#94a3b8' } },
      invalid: { color: '#ef4444', iconColor: '#ef4444' }
    };
    cardNumber = elements.create('cardNumber', { style }); cardNumber.mount('#card-number');
    cardExpiry = elements.create('cardExpiry', { style }); cardExpiry.mount('#card-expiry');
    cardCvc = elements.create('cardCvc', { style }); cardCvc.mount('#card-cvv');
  }

  // Notification Helper
  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.custom-notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    let iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : type === 'warning' ? 'alert-triangle' : 'info';
    notification.innerHTML = `
      <i data-lucide="${iconName}" class="notification-icon"></i>
      <div class="notification-content">
        <div class="notification-title">${type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : type === 'success' ? 'Success' : 'Information'}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">
        <i data-lucide="x" style="width:16px;height:16px;"></i>
      </button>
    `;
    document.body.appendChild(notification);
    lucide.createIcons();
    requestAnimationFrame(() => notification.classList.add('active'));
    setTimeout(() => { if (notification.parentElement) { notification.classList.remove('active'); setTimeout(() => notification.remove(), 300); } }, 3000);
  }
