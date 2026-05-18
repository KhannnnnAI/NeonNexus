// ===================================
// NEONNEXUS - STEAM GAME STORE
// ===================================

// --- STATE VARIABLES ---
let activeCategory = "All";
let searchQuery = "";
let cart = [];
let isCartOpen = false;
let currentUserId = 'guest';

// Helper: kiểm tra xem userId có phải là Guest hay không
function isGuestId(id) {
  return !id || id === 'guest' || String(id).startsWith('guest_');
}

// ========================================
// SMART API BASE DETECTION
// ========================================
function getAPIBase() {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  // Running on Firebase (production or preview)
  if (hostname.includes('web.app') || hostname.includes('firebaseapp.com')) {
    return ''; // Same origin (Firebase serves both frontend & backend)
  }
  
  // Running on localhost - try local server first
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Use localhost server (port 5000)
    return `${protocol}//${hostname}:5000`;
  }
  
  // Default to Firebase (for other deployments)
  return 'https://nenonexus-digital-game-store.web.app';
}

const API_BASE = getAPIBase(); 

let stripePublishableKeyCache = null;
let stripePublishableKeyPromise = null;
let stripeJsLoadPromise = null;

async function getStripePublishableKey() {
  if (stripePublishableKeyCache !== null) return stripePublishableKeyCache;
  if (!stripePublishableKeyPromise) {
    stripePublishableKeyPromise = fetch(`${API_BASE}/api/public-config`, { cache: 'no-store' })
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
  if (typeof window.Stripe === 'function') return Promise.resolve();
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

// API & Pagination
let games = [];
let filteredGames = [];
let isLoading = true;
let isLoadingMore = false;
let apiError = null;
let currentPage = 0;

// --- UTILITY FUNCTIONS ---
const formatCurrency = (amount) => {
  return CheapSharkAPI.formatCurrency(amount);
};

async function saveCart() {
  const cartKey = `cart_${currentUserId}`;
  localStorage.setItem(cartKey, JSON.stringify(cart));
  if (!isGuestId(currentUserId) && window.firebaseCart) {
    try { await window.firebaseCart.saveCart(currentUserId, cart); } 
    catch (error) {}
  }
}

async function loadCart(userId) {
  const cartKey = `cart_${userId}`;
  let cartItems = [];
  let loadedFromFirebase = false;
  
  if (!isGuestId(userId) && window.firebaseCart && window.firebaseCart.isAvailable()) {
    try {
      const firebaseItems = await window.firebaseCart.loadCart(userId);
      if (firebaseItems && firebaseItems.length > 0) {
        const promises = firebaseItems.map(async (item) => {
          try {
            const details = await CheapSharkAPI.getDealDetails(item.dealID || item.id);
            return { ...details, quantity: item.quantity };
          } catch (error) { return null; }
        });
        const results = await Promise.all(promises);
        cartItems = results.filter(item => item !== null); 
        loadedFromFirebase = true;
      }
    } catch (error) {}
  }
  
  if (!loadedFromFirebase) {
    const savedCart = localStorage.getItem(cartKey);
    if (savedCart) {
      try { cartItems = JSON.parse(savedCart); } catch (error) { cartItems = []; }
    } else { cartItems = []; }
  }
  
  cart = cartItems; updateCartUI();
}

function addToCart(game) {
  if (currentUserId === 'guest') {
    const modal = document.getElementById('login-required-modal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => { modal.classList.add('active'); lucide.createIcons(); }, 10);
    }
    return; 
  }
  const existing = cart.find(item => item.id === game.id);
  if (existing) { existing.quantity += 1; } else { cart.push({ ...game, quantity: 1 }); }
  saveCart(); updateCartUI(); openCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart(); updateCartUI();
}

function updateQuantity(id, change) {
  const item = cart.find(item => item.id === id);
  if (item) {
    item.quantity = Math.max(1, item.quantity + change);
    saveCart(); updateCartUI();
  }
}

function getCartTotal() { return cart.reduce((total, item) => total + (item.price * item.quantity), 0); }
function getCartItemCount() { return cart.reduce((acc, item) => acc + item.quantity, 0); }

function updateCartUI() {
  const cartItemCount = getCartItemCount();
  const cartBadge = document.getElementById('cart-badge');
  const cartHeaderCount = document.getElementById('cart-header-count');
  
  if (cartItemCount > 0) {
    cartBadge.textContent = cartItemCount; cartBadge.style.display = 'flex';
  } else { cartBadge.style.display = 'none'; }
  if (cartHeaderCount) { cartHeaderCount.textContent = cartItemCount; }
  renderCart();
}

function openCart() {
  isCartOpen = true; document.getElementById('cart-drawer').style.display = 'flex'; renderCart();
}

function closeCart() {
  isCartOpen = false; document.getElementById('cart-drawer').style.display = 'none';
}

function renderCart() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total-amount');
  
  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty">EMPTY_CONTAINER</div>';
  } else {
    cartItems.innerHTML = ''; 
    
    cart.forEach(item => {
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      
      const thumb = (item.thumb || item.thumbnail || '').replace(/'/g, "\\'");
      const fb1 = (item.imageFallback || '').replace(/'/g, "\\'");
      const fb2 = (item.imageFallback2 || '').replace(/'/g, "\\'");
      const errHandler = `if(!this.dataset.f0 && '${thumb}'){ this.dataset.f0='1'; this.src='${thumb}'; } else if(!this.dataset.f1 && '${fb1}'){ this.dataset.f1='1'; this.src='${fb1}'; } else if(!this.dataset.f2 && '${fb2}'){ this.dataset.f2='1'; this.src='${fb2}'; } else { this.onerror=null; this.src='https://placehold.co/120x45/1a1a1a/22d3ee?text=No+Img'; }`;
      
      cartItem.innerHTML = `
        <img src="${item.image}" class="cart-item-image" alt="${item.title}" referrerpolicy="no-referrer" onerror="${errHandler}">
        <div class="cart-item-content">
          <h4 class="cart-item-title">${item.title}</h4>
          <p class="cart-item-price">${formatCurrency(item.price)}</p>
          <div class="cart-item-controls">
            <div class="quantity-controls">
              <button class="quantity-btn" data-action="decrease" data-id="${item.id}"><i data-lucide="minus" class="quantity-icon"></i></button>
              <span class="quantity-value">${item.quantity}</span>
              <button class="quantity-btn" data-action="increase" data-id="${item.id}"><i data-lucide="plus" class="quantity-icon"></i></button>
            </div>
            <button class="remove-btn" data-action="remove" data-id="${item.id}"><i data-lucide="trash-2" class="remove-icon"></i></button>
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
  cartTotal.textContent = formatCurrency(getCartTotal());
}

// --- FILTER FUNCTIONS ---
function filterGames() {
  filteredGames = games.filter(game => {
    const matchesCategory = activeCategory === "All" || game.category === activeCategory;
    const matchesSearch = searchQuery === "" || game.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  renderProducts();
}

// --- RENDER FUNCTIONS ---
function renderCategories() {
  const categoriesContainer = document.getElementById('categories');
  categoriesContainer.innerHTML = '';
  
  const navItems = [
    { label: 'STEAM', value: 'All' },
    { label: 'DLC', value: 'DLC' },
    { label: 'SOFTWARE', value: 'Software' },
    { label: 'WALLET CODE', value: 'WalletCode' }
  ];
  
  navItems.forEach(item => {
    const button = document.createElement('button');
    const isActive = activeCategory === item.value;
    button.className = `category-btn ${isActive ? 'active' : 'inactive'}`; 
    button.textContent = item.label;
    
    button.onclick = async () => {
      activeCategory = item.value; searchQuery = ""; document.getElementById('search-input').value = "";
      renderCategories(); currentPage = 0; await loadGames(0); updateLoadMoreVisibility();
    };
    categoriesContainer.appendChild(button);
  });
}

function renderProducts(options = {}) {
  const productsGrid = document.getElementById('products-grid');
  const gameCountText = document.getElementById('game-count-text');
  const opts = { append: false, items: null, ...options };
  
  if (!productsGrid) return;
  if (!opts.append) { productsGrid.innerHTML = ''; }
  const gamesToRender = opts.items || filteredGames;
  
  if (gamesToRender.length === 0 && !isLoading && !opts.append) {
    productsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 0; color: #6b7280; font-family: 'Courier New', monospace;">
        <i data-lucide="inbox" style="width: 4rem; height: 4rem; margin: 0 auto 1.5rem; color: #4b5563;"></i>
        <p style="font-size: 1.25rem; margin-bottom: 0.5rem; color: #e5e7eb;">This game is not available in the store</p>
      </div>
    `;
    if (gameCountText) gameCountText.textContent = `SHOWING: 0 GAMES`; lucide.createIcons(); return;
  }
  
  gamesToRender.forEach(game => {
    const card = document.createElement('div');
    card.className = 'product-card'; card.setAttribute('data-category', game.category);
    
    // XỬ LÝ LỖI MẤT ẢNH (RACE CONDITION) TRỰC TIẾP TRONG THẺ HTML BẰNG INLINE ONERROR
    const thumb = (game.thumb || game.thumbnail || '').replace(/'/g, "\\'");
    const fb1 = (game.imageFallback || '').replace(/'/g, "\\'");
    const fb2 = (game.imageFallback2 || '').replace(/'/g, "\\'");
    const errHandler = `if(!this.dataset.f0 && '${thumb}'){ this.dataset.f0='1'; this.src='${thumb}'; } else if(!this.dataset.f1 && '${fb1}'){ this.dataset.f1='1'; this.src='${fb1}'; } else if(!this.dataset.f2 && '${fb2}'){ this.dataset.f2='1'; this.src='${fb2}'; } else { this.onerror=null; this.src='https://placehold.co/616x353/1a1a1a/22d3ee?text=No+Image'; }`;
    
    card.innerHTML = `
      <div class="product-image-wrapper">
        <img 
          src="${game.image}" 
          alt="${game.title}" 
          class="product-image" 
          id="img-${game.id}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="${errHandler}"
        >
        ${game.savings > 0 ? `<div class="discount-badge"><i data-lucide="percent" class="discount-icon"></i>-${game.savings}%</div>` : ''}
        <div class="store-badges">
          <span class="store-badge">${game.platform}</span>
          ${game.flagUrl ? `<img src="${game.flagUrl}" alt="" style="width:24px;height:16px;border-radius:3px;object-fit:cover;vertical-align:middle;margin-left:4px;">` : ''}
        </div>
      </div>
      
      <div class="product-content">
        <div class="product-header">
          <span class="product-category">${game.category}</span>
          <div class="product-rating"><i data-lucide="star" class="rating-star"></i>${game.rating}</div>
        </div>
        <h3 class="product-title" title="${game.title}">${game.title}</h3>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top: 0.25rem; min-height: 24px;">
            ${game.category !== 'WalletCode' ? `<div class="steam-id" style="font-size: 0.75rem; color: #6b7280;">ID: ${game.steamAppID || 'Unknown'}</div>` : '<div></div>'}
        </div>
        <div class="product-footer">
          <div class="product-price-wrapper">
            ${game.savings > 0 ? `<span class="product-original-price">${formatCurrency(game.originalPrice)}</span>` : ''}
            <span class="product-price">${formatCurrency(game.price)}</span>
          </div>
          <button class="add-to-cart-btn" data-game-id="${game.id}"><i data-lucide="plus" class="add-icon"></i></button>
        </div>
      </div>
    `;
    
    card.querySelector('.add-to-cart-btn').addEventListener('click', (e) => { e.stopPropagation(); addToCart(game); });
    
    const handleRedirect = () => {
        if (game.category === 'WalletCode') return;
        const params = new URLSearchParams({
          title: game.title || '', dealID: game.dealID || '', steamID: game.steamAppID || '',
          price: game.price || 0, originalPrice: game.originalPrice || 0, savings: game.savings || 0,
          image: game.image || '', rating: game.rating || ''
        });
        
        // Sử dụng window.url để tự động fix đường dẫn (ví dụ: /html/game.html ở local)
        const baseUrl = (typeof window.url === 'function') ? window.url('/game') : '/game';
        window.location.href = `${baseUrl}?${params.toString()}`;
    };

    const imgWrapper = card.querySelector('.product-image-wrapper'); const titleEl = card.querySelector('.product-title');
    imgWrapper.style.cursor = 'pointer'; titleEl.style.cursor = 'pointer';
    imgWrapper.addEventListener('click', handleRedirect); titleEl.addEventListener('click', handleRedirect);
    
    productsGrid.appendChild(card);

  });

  if (gameCountText) {
    if (opts.append) {
      const totalCards = productsGrid.querySelectorAll('.product-card').length; gameCountText.textContent = `SHOWING: ${totalCards} GAMES`;
    } else {
      gameCountText.textContent = `SHOWING: ${filteredGames.length} GAMES`;
    }
  }
  lucide.createIcons();
}

function updateLoadMoreVisibility() {
  const loadMoreContainer = document.getElementById('load-more-container'); const filterNotice = document.getElementById('filter-notice');
  if (!loadMoreContainer) return;
  if (activeCategory === "All" && searchQuery === "") {
    loadMoreContainer.style.display = 'block'; if (filterNotice) filterNotice.style.display = 'none'; document.getElementById('load-more-btn').style.display = 'inline-flex';
  } else {
    loadMoreContainer.style.display = 'none';
    if (games.length > 0 && activeCategory !== "All" && filterNotice) {
       filterNotice.style.display = 'block';
       if (activeCategory === "WalletCode") { filterNotice.textContent = ":: ALL WALLET CODES DISPLAYED ::"; }
       else if (activeCategory === "DLC") { filterNotice.textContent = ":: ALL DLC DISPLAYED ::"; }
       else { filterNotice.textContent = ":: END OF RECOMMENDED GAMES ::"; }
    }
  }
}

// --- API FUNCTIONS ---
async function loadGames(pageNumber) {
  const isFirstLoad = pageNumber === 0;
  let newGames = []; 
  
  if (isFirstLoad) { isLoading = true; showLoadingState(); } 
  else { isLoadingMore = true; updateLoadMoreButton(true); }
  
  try {
    if (activeCategory === "WalletCode") {
      newGames = GiftCodeAPI.getGiftCodes();
    } else if (activeCategory === "Software") {
      newGames = SoftwareAPI.getSoftwareList();
    } else if (activeCategory === "DLC") {
      newGames = DLCAPI.getDLCList();
    } else if (activeCategory === "All") {
      newGames = await CheapSharkAPI.getGames(pageNumber);
    } else {
      const genreSlug = CheapSharkAPI.GENRE_SLUGS[activeCategory];
      const shownTitles = new Set(games.map(g => g.title.toLowerCase()));
      let uniqueNewGames = []; let page = Math.floor(Math.random() * 20) + 1; let attempts = 0;
      
      while (uniqueNewGames.length < 30 && attempts < 5) {
        const pageGames = await CheapSharkAPI.fetchGamesByGenre(genreSlug, page, 40);
        if (pageGames.length === 0) break;
        const newUnique = pageGames.filter(game => !shownTitles.has(game.title.toLowerCase()));
        uniqueNewGames.push(...newUnique); page++; attempts++;
      }
      newGames = uniqueNewGames.slice(0, 30);
    }
    
    if (newGames.length === 0) { updateLoadMoreButton(false); return; }
    
    if (isFirstLoad) { games = newGames; filteredGames = games; } 
    else {
      games = [...games, ...newGames];
      if (activeCategory === "All" && searchQuery === "") { filteredGames = games; } 
      else if (activeCategory !== "All") { filteredGames = [...filteredGames, ...newGames]; }
    }
  } catch (error) {
    if (isFirstLoad) { 
      console.error('[LoadGames Error]', error);
      const errorMsg = `Failed to load games: ${error.message || 'Unknown error'}
      
API Base: ${API_BASE}
Server URL: ${CheapSharkAPI.SERVER_URL || 'unknown'}

Troubleshooting:
1. Check if server is running (npm start)
2. Check browser console for more details
3. Try refreshing the page`;
      apiError = error.message; 
      showErrorState(errorMsg); 
    }
  } finally {
    if (isFirstLoad) {
      isLoading = false; hideLoadingState(); renderCategories(); renderProducts(); updateLoadMoreVisibility();
    } else {
      isLoadingMore = false; renderProducts({ append: true, items: newGames }); updateLoadMoreButton(false);
    }
  }
}

function handleLoadMore() { currentPage++; loadGames(currentPage); }

function updateLoadMoreButton(loading) {
  const btn = document.getElementById('load-more-btn'); 
  if (!btn) return;
  const icon = btn.querySelector('.load-more-icon'); const text = document.getElementById('load-more-text');
  if (loading) {
    btn.disabled = true; if (icon) { icon.setAttribute('data-lucide', 'loader-2'); icon.style.animation = 'spin 1s linear infinite'; } if (text) text.textContent = 'Loading_Data...';
  } else {
    btn.disabled = false; if (icon) { icon.setAttribute('data-lucide', 'arrow-down-circle'); icon.style.animation = 'none'; } if (text) text.textContent = 'Load_More_Games';
  }
  lucide.createIcons();
}

function showLoadingState() {
  const el = document.getElementById('loading-state'); if (el) el.style.display = 'flex'; 
  const pg = document.getElementById('products-grid'); if (pg) pg.style.display = 'none'; 
  const es = document.getElementById('error-state'); if (es) es.style.display = 'none'; 
  const sd = document.getElementById('status-dot'); if (sd) sd.className = 'status-dot loading';
}
function hideLoadingState() {
  const el = document.getElementById('loading-state'); if (el) el.style.display = 'none'; 
  const pg = document.getElementById('products-grid'); if (pg) pg.style.display = 'grid'; 
  const sd = document.getElementById('status-dot'); if (sd) sd.className = 'status-dot';
}
function showErrorState(message) {
  const errorElement = document.getElementById('error-message');
  const errorState = document.getElementById('error-state');
  const formattedMessage = message.replace(/\n/g, '<br>');
  if (errorElement) { errorElement.innerHTML = formattedMessage; errorElement.style.whiteSpace = 'pre-wrap'; }
  if (errorState) { errorState.style.display = 'flex'; }
  const ls = document.getElementById('loading-state'); if (ls) ls.style.display = 'none'; 
  const pg = document.getElementById('products-grid'); if (pg) pg.style.display = 'none';
}

// --- HERO CAROUSEL FUNCTIONS ---
let heroCarouselTimer = null; let currentSlide = 0; let totalSlides = 0;

async function fetchNewReleases() {
  return [
    { name: "PRAGMATA", steamAppID: 3357650, discount_percent: 0, header_image: "https://4kwallpapers.com/images/walls/thumbs_3t/24943.jpg", large_capsule_image: "https://4kwallpapers.com/images/walls/thumbs_3t/24943.jpg", desc: "Embark on an unforgettable journey through a dystopian lunar world in Capcom's breathtaking new sci-fi action-adventure." },
    { name: "Resident Evil Requiem", steamAppID: 3764200, discount_percent: 0, header_image: "https://image.api.playstation.com/vulcan/ap/rnd/202512/1205/74bb57eb10447ae35775f625271f202360bae45cb3572da5.jpg", large_capsule_image: "https://image.api.playstation.com/vulcan/ap/rnd/202512/1205/74bb57eb10447ae35775f625271f202360bae45cb3572da5.jpg", desc: "The next terrifying chapter in the legendary survival horror franchise." },
    { name: "EA SPORTS FC™ 26", steamAppID: 3405690, discount_percent: 0, header_image: "https://wallpapercave.com/wp/wp15596619.jpg", large_capsule_image: "https://wallpapercave.com/wp/wp15596619.jpg", desc: "Experience the future of football with unparalleled realism and gameplay." },
    { name: "Forza Horizon 6", steamAppID: 2483190, discount_percent: 0, header_image: "https://images8.alphacoders.com/140/thumb-1920-1405619.jpg", large_capsule_image: "https://images8.alphacoders.com/140/thumb-1920-1405619.jpg", desc: "Explore breathtaking open worlds and drive the world's greatest cars." }
  ];
}

function renderHeroCarousel(games) {
  const inner = document.getElementById('hero-carousel-inner'); const indicators = document.getElementById('carousel-indicators');
  if (!inner || !indicators || !games || games.length === 0) return;
  totalSlides = games.length; inner.innerHTML = ''; indicators.innerHTML = '';
  const cp = document.getElementById('carousel-prev'); if (cp) cp.style.display = 'flex'; 
  const cn = document.getElementById('carousel-next'); if (cn) cn.style.display = 'flex'; 
  indicators.style.display = 'flex';
  
  games.forEach((game, index) => {
    const slide = document.createElement('div'); slide.className = `carousel-item ${index === 0 ? 'active' : ''}`;
    const steamUrl = game.steamAppID ? `https://store.steampowered.com/app/${game.steamAppID}` : '#';
    slide.innerHTML = `<a href="${steamUrl}" target="_blank" style="display: block; width: 100%; height: 100%; text-decoration: none;"><img src="${game.header_image || game.large_capsule_image}" alt="${game.name}" fetchpriority="${index === 0 ? 'high' : 'auto'}" class="hero-image" style="opacity: 1;" /></a>`;
    inner.appendChild(slide);
    const dot = document.createElement('button'); dot.className = `indicator-dot ${index === 0 ? 'active' : ''}`;
    dot.setAttribute('data-slide-to', index); dot.addEventListener('click', () => goToSlide(index)); indicators.appendChild(dot);
  });
  lucide.createIcons(); startHeroCarousel();
}

function goToSlide(index) {
  const slides = document.querySelectorAll('.carousel-item'); const dots = document.querySelectorAll('.indicator-dot');
  if (slides.length === 0) return;
  if (index < 0) index = slides.length - 1; if (index >= slides.length) index = 0;
  slides[currentSlide].classList.remove('active'); if (dots[currentSlide]) dots[currentSlide].classList.remove('active');
  currentSlide = index; slides[currentSlide].classList.add('active'); if (dots[currentSlide]) dots[currentSlide].classList.add('active'); startHeroCarousel();
}

function nextHeroSlide() { goToSlide(currentSlide + 1); }
function prevHeroSlide() { goToSlide(currentSlide - 1); }
function startHeroCarousel() { if (heroCarouselTimer) clearInterval(heroCarouselTimer); heroCarouselTimer = setInterval(nextHeroSlide, 5000); }

async function initHeroCarousel() {
  const newReleases = await fetchNewReleases();
  if (newReleases && newReleases.length > 0) {
    renderHeroCarousel(newReleases);
    const prevBtn = document.getElementById('carousel-prev'); const nextBtn = document.getElementById('carousel-next');
    if (prevBtn) prevBtn.addEventListener('click', () => { prevHeroSlide(); startHeroCarousel(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { nextHeroSlide(); startHeroCarousel(); });
    const carouselEl = document.getElementById('hero-carousel');
    let touchStartX = 0, touchEndX = 0;
    if (carouselEl) {
      carouselEl.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
      carouselEl.addEventListener('touchend', (e) => { touchEndX = e.changedTouches[0].screenX; handleSwipe(); }, { passive: true });
    }
    function handleSwipe() {
      const swipeThreshold = 50;
      if (touchEndX < touchStartX - swipeThreshold) { nextHeroSlide(); startHeroCarousel(); } 
      else if (touchEndX > touchStartX + swipeThreshold) { prevHeroSlide(); startHeroCarousel(); }
    }
  }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
  // CRITICAL: Wait for auth hydration to finish before proceeding with index.js initialization
  if (window.waitForFirebaseAuth) {
    console.log('index.js: Waiting for auth ready...');
    await window.waitForFirebaseAuth(2000); 
  }

  loadCart('guest');
  
  window.addEventListener('user-login', (event) => { 
    const { userId } = event.detail; 
    console.log('index.js: Received user-login event:', userId);
    currentUserId = userId; 
    loadCart(userId); 
  });
  
  window.addEventListener('user-logout', () => { 
    console.log('index.js: Received user-logout event');
    currentUserId = 'guest'; 
    loadCart('guest'); 
  });

  // Sync initial state if auth already resolved
  if (window.__dashboardCurrentUser) {
    const userId = window.__dashboardCurrentUser.uid;
    if (userId) {
      console.log('index.js: Auth already resolved, syncing user:', userId);
      currentUserId = userId;
      loadCart(userId);
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key === `cart_${currentUserId}`) {
      loadCart(currentUserId);
    }
  });
      
  if (!window.IS_PRIVACY_PAGE && document.getElementById('products-grid')) {
    loadGames(0);
    initHeroCarousel(); 
    if (typeof fetchFlashSaleDeal === 'function') fetchFlashSaleDeal(); 
  }

  let searchTimeout; const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
      searchQuery = e.target.value.trim(); clearTimeout(searchTimeout);
      if (searchQuery.length === 0) { filteredGames = games; renderProducts(); updateLoadMoreVisibility(); return; }
      if (searchQuery.length < 2) return;
      searchTimeout = setTimeout(async () => {
        try {
          const grid = document.getElementById('products-grid');
          if (grid) grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 4rem 0;"><i data-lucide="loader-2" style="width: 3rem; height: 3rem; color: #22d3ee; animation: spin 1s linear infinite;"></i><p style="color: #22d3ee; font-family: 'Courier New', monospace; margin-top: 1rem;">SEARCHING...</p></div>`;
          lucide.createIcons();
          const searchResults = await CheapSharkAPI.searchGames(searchQuery);
          if (searchResults.length > 0) { filteredGames = searchResults; } else { filteredGames = []; }
          renderProducts(); if (document.getElementById('load-more-container')) document.getElementById('load-more-container').style.display = 'none';
        } catch (error) { filteredGames = []; renderProducts(); }
      }, 500); 
    });
  }
  
  const cartBtn = document.getElementById('cart-btn'); const closeCartBtn = document.getElementById('close-cart-btn'); const cartBackdrop = document.querySelector('.cart-backdrop');
  if (cartBtn) cartBtn.addEventListener('click', openCart);
  if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);
  
  const loginRequiredModal = document.getElementById('login-required-modal'); 
  const closeLoginRequiredBtn = document.getElementById('close-login-required-btn'); 
  const loginRequiredGoogleBtn = document.getElementById('login-required-google-btn'); 
  const loginRequiredSteamBtn = document.getElementById('login-required-steam-btn'); 
  const loginRequiredBackdrop = loginRequiredModal ? loginRequiredModal.querySelector('.login-modal-backdrop') : null;
  if (loginRequiredModal && closeLoginRequiredBtn) closeLoginRequiredBtn.addEventListener('click', () => { loginRequiredModal.style.display = 'none'; loginRequiredModal.classList.remove('active'); });
  if (loginRequiredModal && loginRequiredBackdrop) loginRequiredBackdrop.addEventListener('click', () => { loginRequiredModal.style.display = 'none'; loginRequiredModal.classList.remove('active'); });
  if (loginRequiredModal && loginRequiredGoogleBtn) loginRequiredGoogleBtn.addEventListener('click', () => { loginRequiredModal.style.display = 'none'; document.getElementById('google-login-btn').click(); });
  if (loginRequiredModal && loginRequiredSteamBtn) loginRequiredSteamBtn.addEventListener('click', () => { loginRequiredModal.style.display = 'none'; document.getElementById('steam-login-btn').click(); });
  
  const logoBtn = document.getElementById('logo-btn');
  if (logoBtn) logoBtn.addEventListener('click', () => { window.location.href = window.location.pathname; });

  // CHECKOUT LOGIC
  let selectedPaymentMethod = null;
  let stripe, elements, cardNumber, cardExpiry, cardCvc;

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

  async function updateCheckoutTotals() {
    let total = getCartTotal();
    const itemCount = getCartItemCount();
    let discountPercent = 0, discountAmount = 0, finalTotal = total, tierName = 'Member';

    if (currentUserId && !isGuestId(currentUserId) && window.firebaseCart && window.firebaseCart.getUserMembership) {
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

    const subtotalRow = document.getElementById('checkout-subtotal-row');
    if (subtotalRow) {
      subtotalRow.style.display = discountPercent > 0 ? 'flex' : 'none';
      document.getElementById('checkout-subtotal').textContent = formatCurrency(total);
    }
    const discountRow = document.getElementById('checkout-discount-row');
    if (discountRow) {
      discountRow.style.display = discountPercent > 0 ? 'flex' : 'none';
      document.getElementById('checkout-discount-label').textContent = `${tierName} Discount (-${discountPercent * 100}%):`;
      document.getElementById('checkout-discount-amount').textContent = `-${formatCurrency(discountAmount)}`;
    }

    const formattedTotal = formatCurrency(finalTotal);
    const ids = ['checkout-total-amount', 'card-total', 'vietqr-total', 'vietqr-amount', 'momo-total', 'momo-amount', 'zalopay-total', 'zalopay-amount'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = formattedTotal; });

    const countIds = {
      'card-items-count': `${itemCount} items`,
      'momo-items-count': `${itemCount} items`,
      'zalopay-items-count': `${itemCount} items`
    };
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
  const checkoutOverlay = document.querySelector('.checkout-modal-overlay');
  if (checkoutOverlay) checkoutOverlay.addEventListener('click', closeCheckoutModal);

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

      if (currentUserId && !isGuestId(currentUserId) && window.firebaseCart && window.firebaseCart.getUserMembership) {
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
        const response = await fetch(`${API_BASE}/api/create-payment-intent`, {
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
        const response = await fetch(`${API_BASE}/api/create-momo-payment`, {
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
        const response = await fetch(`${API_BASE}/api/create-zalopay-payment`, {
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
        const response = await fetch(`${API_BASE}/api/create-payos-payment`, {
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
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      lucide.createIcons();
    }
    requestAnimationFrame(() => notification.classList.add('active'));
    setTimeout(() => { if (notification.parentElement) { notification.classList.remove('active'); setTimeout(() => notification.remove(), 300); } }, 3000);
  }

  document.querySelector('.cart-checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) {
      showNotification('Cart is empty!', 'warning');
      return;
    }
    openCheckoutModal();
  });
});