// ===================================
// NEONNEXUS - STEAM GAME STORE
// ===================================

// --- STATE VARIABLES ---
let activeCategory = "All";
let searchQuery = "";
let cart = [];
let isCartOpen = false;
let currentUserId = 'guest'; // Track current user for cart persistence

// API Base URL (Dynamic for Dev vs Prod)
// If localhost, point to local Node server. If production (Firebase), use relative path.
// API Base URL (Dynamic for Dev vs Prod)
// If Live Server (port 5500) or File, use localhost:3000 (New Unified Server Port). 
// If acting as Unified Server (port 3000) or Prod, use relative path.
const API_BASE = (window.location.port === '5500' || window.location.protocol === 'file:')
  ? 'http://localhost:5000'
  : ''; 

// Currency state
let currentCurrency = localStorage.getItem('currency') || 'VND';
const EXCHANGE_RATE = 26000; // 1 USD = 26,000 VND

// Theme state
let currentTheme = localStorage.getItem('theme') || 'dark';

// Initialize theme on load
document.documentElement.setAttribute('data-theme', currentTheme);

// API & Pagination
let games = [];
let filteredGames = [];
let isLoading = true;
let isLoadingMore = false;
let apiError = null;
let currentPage = 0;

// --- THEME MANAGEMENT ---
function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
  
  // Update icon
  const themeIcon = document.getElementById('theme-icon');
  themeIcon.setAttribute('data-lucide', currentTheme === 'dark' ? 'sun' : 'moon');
  lucide.createIcons();
}

// --- UTILITY FUNCTIONS ---
const formatCurrency = (amount) => {
  if (currentCurrency === 'USD') {
    const usdAmount = amount / EXCHANGE_RATE;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(usdAmount);
  } else {
    // VND
    return CheapSharkAPI.formatCurrency(amount);
  }
};

// Currency functions
function switchCurrency(currency) {
  currentCurrency = currency;
  localStorage.setItem('currency', currency);
  
  // Update button text
  document.getElementById('current-currency').textContent = currency;
  
  // Update active state
  document.querySelectorAll('.currency-option').forEach(opt => {
    opt.classList.remove('active');
    if (opt.dataset.currency === currency) {
      opt.classList.add('active');
    }
  });
  
  // Swap game prices to the selected currency's native Steam prices
  const allGames = [...games, ...filteredGames];
  const seen = new Set();
  for (const game of allGames) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    
    if (game.steamPriceLoaded) {
      if (currency === 'USD') {
        game.price = game.salePriceUSD;
        game.originalPrice = game.normalPriceUSD;
      } else {
        game.price = game.salePriceVND;
        game.originalPrice = game.normalPriceVND;
      }
    } else {
      // Fallback for games without Steam price (use old exchange rate math)
      if (currency === 'USD') {
        game.price = game.salePriceVND ? game.salePriceVND / EXCHANGE_RATE : game.price / EXCHANGE_RATE;
        game.originalPrice = game.normalPriceVND ? game.normalPriceVND / EXCHANGE_RATE : game.originalPrice / EXCHANGE_RATE;
      }
      // VND is the default so no conversion needed for non-Steam games
    }
  }
  
  // Re-render products with new currency
  renderProducts();
  renderCart();
}

function toggleCurrencyDropdown() {
  const dropdown = document.getElementById('currency-dropdown');
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
}

// Save cart to localStorage and Firebase
async function saveCart() {
  const cartKey = `cart_${currentUserId}`;
  
  // Always save to localStorage for instant access
  localStorage.setItem(cartKey, JSON.stringify(cart));
  
  // If logged in (not guest), also save to Firebase
  if (currentUserId !== 'guest' && window.firebaseCart) {
    try {
      const success = await window.firebaseCart.saveCart(currentUserId, cart);
      if (success) {
        console.log('☁️ Cart synced to Firebase');
      }
    } catch (error) {
      console.warn('⚠️ Firebase sync failed, using localStorage only');
    }
  }
}

// Load cart from localStorage
async function loadCart(userId) {
  const cartKey = `cart_${userId}`;
  let cartItems = [];
  let loadedFromFirebase = false;
  
  // Strategy: Try Firebase first for logged-in users, fallback to localStorage
  if (userId !== 'guest' && window.firebaseCart && window.firebaseCart.isAvailable()) {
    try {
      console.log('📡 Attempting to load cart from Firebase...');
      const firebaseItems = await window.firebaseCart.loadCart(userId);
      
      if (firebaseItems && firebaseItems.length > 0) {
        console.log(`📥 Loading ${firebaseItems.length} items from Firebase...`);
        
        // Fetch full details from API for each item
        const promises = firebaseItems.map(async (item) => {
          try {
            const details = await CheapSharkAPI.getDealDetails(item.dealID || item.id);
            return { ...details, quantity: item.quantity };
          } catch (error) {
            console.error('Failed to fetch game details:', item.dealID, error);
            return null;
          }
        });
        
        const results = await Promise.all(promises);
        cartItems = results.filter(item => item !== null); // Remove failed items
        
        loadedFromFirebase = true;
        console.log(`✅ Cart loaded from Firebase + API: ${cartItems.length} items`);
      }
    } catch (error) {
      console.warn('⚠️ Firebase load failed, trying localStorage', error);
    }
  }
  
  // Fallback to localStorage if Firebase didn't work or no cloud data
  if (!loadedFromFirebase) {
    const savedCart = localStorage.getItem(cartKey);
    
    if (savedCart) {
      try {
        cartItems = JSON.parse(savedCart);
        console.log(`📥 Cart loaded from localStorage: ${cartItems.length} items`);
      } catch (error) {
        console.error('Error parsing cart from localStorage:', error);
        cartItems = [];
      }
    } else {
      console.log(`📥 No saved cart for user: ${userId}`);
      cartItems = [];
    }
  }
  
  cart = cartItems;
  updateCartUI();
}

function addToCart(game) {
  // Check if user is logged in
  if (currentUserId === 'guest') {
    // Show custom login required popup
    const modal = document.getElementById('login-required-modal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('active');
        lucide.createIcons(); // Re-init icons in modal
      }, 10);
    }
    
    return; // Don't add to cart
  }
  
  // User is logged in - proceed with adding to cart
  const existing = cart.find(item => item.id === game.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...game, quantity: 1 });
  }
  saveCart(); // Save after adding
  updateCartUI();
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart(); // Save after removing
  updateCartUI();
}

function updateQuantity(id, change) {
  const item = cart.find(item => item.id === id);
  if (item) {
    item.quantity = Math.max(1, item.quantity + change);
    saveCart(); // Save after quantity update
    updateCartUI();
  }
}

function getCartTotal() {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function getCartItemCount() {
  return cart.reduce((acc, item) => acc + item.quantity, 0);
}

function updateCartUI() {
  const cartItemCount = getCartItemCount();
  const cartBadge = document.getElementById('cart-badge');
  const cartHeaderCount = document.getElementById('cart-header-count');
  
  if (cartItemCount > 0) {
    cartBadge.textContent = cartItemCount;
    cartBadge.style.display = 'flex';
  } else {
    cartBadge.style.display = 'none';
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
  
  if (cart.length === 0) {
    cartItems.innerHTML = '<div class="cart-empty">EMPTY_CONTAINER</div>';
  } else {
    cartItems.innerHTML = ''; // Clear items
    
    cart.forEach(item => {
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      
      const imgId = `cart-img-${item.id}`;
      
      cartItem.innerHTML = `
        <img src="${item.image}" class="cart-item-image" alt="${item.title}" id="${imgId}">
        <div class="cart-item-content">
          <h4 class="cart-item-title">${item.title}</h4>
          <p class="cart-item-price">${formatCurrency(item.price)}</p>
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
      
      // Attach event listeners for buttons
      cartItem.querySelector('[data-action="decrease"]').onclick = () => updateQuantity(item.id, -1);
      cartItem.querySelector('[data-action="increase"]').onclick = () => updateQuantity(item.id, 1);
      cartItem.querySelector('[data-action="remove"]').onclick = () => removeFromCart(item.id);
      
      // Attach image error handler - use class selector to avoid invalid ID selector errors
      const imgEl = cartItem.querySelector('.cart-item-image');
      if (imgEl) {
        imgEl.onerror = function() {
           // Fallback logic specific to cart (might need smaller images, but using same fallbacks is fine)
           if (this.src !== item.imageFallback && item.imageFallback) {
             this.src = item.imageFallback;
           } else if (this.src !== item.imageFallback2 && item.imageFallback2) {
             this.src = item.imageFallback2;
           } else {
             this.src = 'https://placehold.co/120x45/1a1a1a/22d3ee?text=No+Img';
           }
        };
      }
      
      cartItems.appendChild(cartItem);
    });
    
    // Re-initialize Lucide icons for new cart items
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
    { label: 'WALLET CODE', value: 'WalletCode' }
  ];
  
  navItems.forEach(item => {
    const button = document.createElement('button');
    const isActive = activeCategory === item.value;
    button.className = `category-btn ${isActive ? 'active' : 'inactive'}`; 
    button.textContent = item.label;
    
    button.onclick = async () => {
      activeCategory = item.value;
      searchQuery = "";
      document.getElementById('search-input').value = "";
      
      // Re-render buttons to update active state
      renderCategories();
      
      // Load games for the selected category
      currentPage = 0; // Reset page
      await loadGames(0);
      
      // Update load more visibility
      updateLoadMoreVisibility();
    };
    
    categoriesContainer.appendChild(button);
  });
}

function renderProducts(options = {}) {
  const productsGrid = document.getElementById('products-grid');
  const gameCountText = document.getElementById('game-count-text');
  
  // Default options
  const opts = { append: false, items: null, ...options };
  
  // If not appending, clear the grid
  if (!opts.append) {
    productsGrid.innerHTML = '';
  }
  
  // Determine which games to render
  const gamesToRender = opts.items || filteredGames;
  
  if (gamesToRender.length === 0 && !isLoading && !opts.append) {
    productsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 0; color: #6b7280; font-family: 'Courier New', monospace;">
        <i data-lucide="inbox" style="width: 4rem; height: 4rem; margin: 0 auto 1.5rem; color: #4b5563;"></i>
        <p style="font-size: 1.25rem; margin-bottom: 0.5rem; color: #e5e7eb;">This game is not available in the store</p>
        <p style="color: #6b7280; font-size: 0.875rem;">Please contact us for more information</p>
      </div>
    `;
    gameCountText.textContent = `SHOWING: 0 GAMES`;
    lucide.createIcons();
    return;
  }
  
  // Render cards immediately without waiting for extra API calls
  gamesToRender.forEach(game => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-category', game.category); // Add for CSS styling
    
    // Initial image (fallback or standard)
    let initialImage = game.image;
    
    card.innerHTML = `
      <div class="product-image-wrapper">
        <img 
          src="${initialImage}" 
          alt="${game.title}" 
          class="product-image" 
          id="img-${game.id}"
          loading="lazy"
        >
        
        ${game.savings > 0 ? `
          <div class="discount-badge">
            <i data-lucide="percent" class="discount-icon"></i>
            -${game.savings}%
          </div>
        ` : ''}
        
        <div class="store-badges">
          <span class="store-badge">${game.platform}</span>
          ${game.flagUrl ? `<img src="${game.flagUrl}" alt="" style="width:24px;height:16px;border-radius:3px;object-fit:cover;box-shadow:0 1px 3px rgba(0,0,0,0.4);vertical-align:middle;margin-left:4px;">` : ''}
        </div>
        

      </div>
      
      <div class="product-content">
        <div class="product-header">
          <span class="product-category">${game.category}</span>
          <div class="product-rating">
            <i data-lucide="star" class="rating-star"></i>
            ${game.rating}
          </div>
        </div>
        
        <h3 class="product-title" title="${game.title}">${game.title}</h3>
        
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top: 0.25rem; min-height: 24px;">
            ${game.category !== 'WalletCode' ? `<div class="steam-id" style="font-size: 0.75rem; color: #6b7280;">ID: ${game.steamAppID || 'Unknown'}</div>` : '<div></div>'}
            
            <!-- Trailer Button (Hidden for Wallet Codes) -->
            ${game.category !== 'WalletCode' ? `
            <button class="trailer-btn" title="Watch Trailer" data-game-title="${game.title}">
               TRAILER
            </button>
            ` : ''}
        </div>
        
        <div class="product-footer">
          <div class="product-price-wrapper">
            ${game.savings > 0 ? `
              <span class="product-original-price">${formatCurrency(game.originalPrice)}</span>
            ` : ''}
            <span class="product-price">${formatCurrency(game.price)}</span>
          </div>
          
          <button class="add-to-cart-btn" data-game-id="${game.id}">
            <i data-lucide="plus" class="add-icon"></i>
          </button>
        </div>
      </div>
    `;
    
    // Add event listener for this card's add to cart button
    const addBtn = card.querySelector('.add-to-cart-btn');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent bubbling
      addToCart(game);
    });
    
    // Redirect logic function - Navigate to Game Detail page
    const handleRedirect = () => {
        // Wallet codes don't redirect
        if (game.category === 'WalletCode') {
            console.log('Wallet codes - Add to cart to purchase');
            return;
        }
        
        // Build URL params for game detail page
        const params = new URLSearchParams({
          title: game.title || '',
          dealID: game.dealID || '',
          steamID: game.steamAppID || '',
          price: game.price || 0,
          originalPrice: game.originalPrice || 0,
          savings: game.savings || 0,
          image: game.image || '',
          rating: game.rating || ''
        });
        
        window.location.href = `html/game.html?${params.toString()}`;
    };

    // Attach redirect to Image and Title
    const imgWrapper = card.querySelector('.product-image-wrapper');
    const titleEl = card.querySelector('.product-title');

    imgWrapper.style.cursor = 'pointer';
    titleEl.style.cursor = 'pointer';

    imgWrapper.addEventListener('click', handleRedirect);
    titleEl.addEventListener('click', handleRedirect);
    
    // Handle image errors programmatically
    const imgElement = card.querySelector(`#img-${game.id}`);
    if (imgElement) {
      imgElement.onerror = function() {
        // Try fallback 1 (Thumbnail)
        if (this.src !== game.imageFallback && game.imageFallback) {
          this.src = game.imageFallback;
        } 
        // Try fallback 2 (Capsule / Placeholder)
        else if (this.src !== game.imageFallback2 && game.imageFallback2) {
          this.src = game.imageFallback2;
        }
        // Final fallback to a colored placeholder if all else fails
        else {
           this.src = 'https://placehold.co/616x353/1a1a1a/22d3ee?text=No+Image';
        }
      };
    }
    
    // Append card immediately
    productsGrid.appendChild(card);

    // Attach Trailer Button Event Listener
    const trailerBtn = card.querySelector('.trailer-btn');
    if (trailerBtn) {
      trailerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTrailer(game.title);
      });
    }
  });

  // Update count based on actual rendered cards
  if (opts.append) {
    // Count the actual cards in the DOM
    const totalCards = productsGrid.querySelectorAll('.product-card').length;
    gameCountText.textContent = `SHOWING: ${totalCards} GAMES`;
  } else {
    // Use filteredGames length for initial/filter renders
    gameCountText.textContent = `SHOWING: ${filteredGames.length} GAMES`;
  }
  
  // Initialize icons
  lucide.createIcons();
}

function updateLoadMoreVisibility() {
  const loadMoreContainer = document.getElementById('load-more-container');
  const filterNotice = document.getElementById('filter-notice');
  
  // Show load more ONLY if "All" category (as requested)
  // When filtering by specific genre or viewing gift cards, we hide load more
  if (activeCategory === "All" && searchQuery === "") {
    loadMoreContainer.style.display = 'block';
    filterNotice.style.display = 'none'; 
    document.getElementById('load-more-btn').style.display = 'inline-flex';
  } else {
    // Hide load more when filtering by genre, search, or viewing gift cards
    loadMoreContainer.style.display = 'none';
    
    // Optional: Show a notice if games were found but load more is disabled
    if (games.length > 0 && activeCategory !== "All") {
       filterNotice.style.display = 'block';
       if (activeCategory === "WalletCode") {
         filterNotice.textContent = ":: ALL WALLET CODES DISPLAYED ::";
       } else {
         filterNotice.textContent = ":: END OF RECOMMENDED GAMES ::";
       }
    }
  }
}

// --- API FUNCTIONS ---
async function loadGames(pageNumber) {
  const isFirstLoad = pageNumber === 0;
  let newGames = []; // Declare outside try block so it's accessible in finally
  
  if (isFirstLoad) {
    isLoading = true;
    showLoadingState();
  } else {
    isLoadingMore = true;
    updateLoadMoreButton(true);
  }
  
  try {
    if (activeCategory === "WalletCode") {
      // Special handling for Wallet Codes
      console.log(`🎁 Loading Steam Wallet Codes...`);
      newGames = GiftCodeAPI.getGiftCodes();
      console.log(`✅ Loaded ${newGames.length} wallet codes`);
      
    } else if (activeCategory === "All") {
      // Normal behavior for "All"
      newGames = await CheapSharkAPI.getGames(pageNumber);
    } else {
      // For specific genres, fetch MORE random games from RAWG
      const genreSlug = CheapSharkAPI.GENRE_SLUGS[activeCategory];
      console.log(`📥 Loading MORE ${activeCategory} games...`);
      
      // Use similar random page strategy to find new games
      const shownTitles = new Set(games.map(g => g.title.toLowerCase()));
      let uniqueNewGames = [];
      let page = Math.floor(Math.random() * 20) + 1; // Random start again
      let attempts = 0;
      
      // Fetch batch of ~30 more games
      while (uniqueNewGames.length < 30 && attempts < 5) {
        const pageGames = await CheapSharkAPI.fetchGamesByGenre(genreSlug, page, 40);
        if (pageGames.length === 0) break;
        
        const newUnique = pageGames.filter(game => !shownTitles.has(game.title.toLowerCase()));
        uniqueNewGames.push(...newUnique);
        page++;
        attempts++;
      }
      
      newGames = uniqueNewGames.slice(0, 30);
    }
    
    if (newGames.length === 0) {
      console.log('No more games to load');
      updateLoadMoreButton(false); // Stop spinning
      return;
    }
    
    if (isFirstLoad) {
      games = newGames;
      filteredGames = games; // Only set filteredGames on first load
    } else {
      games = [...games, ...newGames];
      // When loading more...
      if (activeCategory === "All" && searchQuery === "") {
         filteredGames = games;
      } else if (activeCategory !== "All") {
         // If we are in a genre, we just fetched specific games, so append them to filteredGames too
         // FilteredGames should currently hold the genre games
         filteredGames = [...filteredGames, ...newGames];
      }
    }
    
    console.log(`✅ Total games loaded: ${games.length}`);
    
  } catch (error) {
    console.error('❌ Error loading games:', error);
    if (isFirstLoad) {
      apiError = error.message;
      showErrorState(error.message);
    }
  } finally {
    if (isFirstLoad) {
      isLoading = false;
      hideLoadingState();
      renderCategories();
      renderProducts();
      updateLoadMoreVisibility();
    } else {
      isLoadingMore = false;
      // Render new games, appending them to the grid
      renderProducts({ append: true, items: newGames });
      updateLoadMoreButton(false);
    }
  }
}

function handleLoadMore() {
  currentPage++;
  loadGames(currentPage);
}

function updateLoadMoreButton(loading) {
  const btn = document.getElementById('load-more-btn');
  const icon = btn.querySelector('.load-more-icon');
  const text = document.getElementById('load-more-text');
  
  if (loading) {
    btn.disabled = true;
    icon.setAttribute('data-lucide', 'loader-2');
    icon.style.animation = 'spin 1s linear infinite';
    text.textContent = 'Loading_Data...';
  } else {
    btn.disabled = false;
    icon.setAttribute('data-lucide', 'arrow-down-circle');
    icon.style.animation = 'none';
    text.textContent = 'Load_More_Games';
  }
  
  lucide.createIcons();
}

function showLoadingState() {
  document.getElementById('loading-state').style.display = 'flex';
  document.getElementById('products-grid').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('status-dot').className = 'status-dot loading';
}

function hideLoadingState() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('products-grid').style.display = 'grid';
  document.getElementById('status-dot').className = 'status-dot';
}

function showErrorState(message) {
  document.getElementById('error-state').style.display = 'flex';
  document.getElementById('error-message').textContent = message;
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('products-grid').style.display = 'none';
}



// --- TRAILER MODAL FUNCTIONS ---
// --- TRAILER MODAL FUNCTIONS ---
async function openTrailer(gameTitle) {
  const modal = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-iframe');
  const titleEl = document.getElementById('trailer-title');
  // Create or select error container
  let errorContainer = document.getElementById('trailer-error-message');
  if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.id = 'trailer-error-message';
      errorContainer.style.cssText = 'position:absolute; inset:0; display:none; align-items:center; justify-content:center; color:#ff4444; font-size:1.2rem; background:#000; text-align:center; padding:1rem;';
      iframe.parentNode.insertBefore(errorContainer, iframe);
  }
  
  if (!modal || !iframe) return;
  
  // Reset UI state
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
  titleEl.textContent = `${gameTitle} - TRAILER`;
  iframe.src = '';
  iframe.style.display = 'block';
  errorContainer.style.display = 'none';
  errorContainer.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Searching...';
  
  try {
    const trailer = await TrailerAPI.getTrailer(gameTitle);
    
    // Check if modal still open (user might have closed it while loading)
    if (modal.style.display === 'none') return;

    if (trailer && trailer.embedUrl) {
      iframe.src = trailer.embedUrl;
    } else {
       // TRAILER NOT FOUND
       iframe.style.display = 'none';
       errorContainer.style.display = 'flex';
       errorContainer.innerHTML = `
         <div style="display:flex; flex-direction:column; align-items:center; gap:10px; font-family: 'ROG Lyons', sans-serif;">
            <i data-lucide="video-off" style="width:48px; height:48px; opacity:0.7;"></i>
            <span>No trailer available for this game.</span>
         </div>
       `;
       lucide.createIcons(); // Refresh icons in the error message
    }
  } catch (error) {
    console.error('Failed to load trailer:', error);
    iframe.style.display = 'none';
    errorContainer.style.display = 'flex';
    errorContainer.textContent = 'Network Error: Unable to verify trailer.';
  }
}

function closeTrailer() {
  const modal = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-iframe');
  
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.style.display = 'none';
      if (iframe) iframe.src = ''; // Stop video
    }, 300);
  }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
  // Load guest cart on initial load
  loadCart('guest');
  
  // Listen for user login events from auth.js
  window.addEventListener('user-login', (event) => {
    const { userId } = event.detail;
    currentUserId = userId;
    console.log('🔓 User logged in, switching to user cart:', userId);
    loadCart(userId);
  });
  
  // Listen for user logout events from auth.js
  window.addEventListener('user-logout', () => {
    console.log('🔒 User logged out, switching to guest cart');
    currentUserId = 'guest';
    loadCart('guest');
  });
  
  // Currency fixed to VND
  
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  
  // Set initial icon
  themeIcon.setAttribute('data-lucide', currentTheme === 'dark' ? 'sun' : 'moon');
  
  themeToggle.addEventListener('click', toggleTheme);


  
  // Initial load - only on index page
  if (!window.IS_PRIVACY_PAGE && document.getElementById('products-grid')) {
    loadGames(0);
  }
  


  // Trailer Modal Events
  document.getElementById('close-trailer-btn').addEventListener('click', closeTrailer);
  document.querySelector('.trailer-modal-backdrop').addEventListener('click', closeTrailer);
  
  // Search with API
  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', async (e) => {
    searchQuery = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (searchQuery.length === 0) {
      // If empty, show all games
      filteredGames = games;
      renderProducts();
      updateLoadMoreVisibility();
      return;
    }
    
    if (searchQuery.length < 2) {
      // Wait for at least 2 characters
      return;
    }
    
    // Debounce API call
    searchTimeout = setTimeout(async () => {
      try {
        // Show loading
        document.getElementById('products-grid').innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 0;">
            <i data-lucide="loader-2" style="width: 3rem; height: 3rem; color: #22d3ee; animation: spin 1s linear infinite;"></i>
            <p style="color: #22d3ee; font-family: 'Courier New', monospace; margin-top: 1rem;">SEARCHING...</p>
          </div>
        `;
        lucide.createIcons();
        
        console.log(`🔍 Searching API for: "${searchQuery}"`);
        const searchResults = await CheapSharkAPI.searchGames(searchQuery);
        
        if (searchResults.length > 0) {
          // Use search results
          filteredGames = searchResults;
          console.log(`✅ Found ${searchResults.length} games`);
        } else {
          // No results
          filteredGames = [];
          console.log(`ℹ️ No games found for "${searchQuery}"`);
        }
        
        renderProducts();
        
        // Hide load more when searching
        document.getElementById('load-more-container').style.display = 'none';
        
      } catch (error) {
        console.error('Search error:', error);
        filteredGames = [];
        renderProducts();
      }
    }, 500); // 500ms debounce
  });
  
  // Cart buttons
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('close-cart-btn').addEventListener('click', closeCart);
  document.querySelector('.cart-backdrop').addEventListener('click', closeCart);
  
  // Login Required Modal handlers
  const loginRequiredModal = document.getElementById('login-required-modal');
  const closeLoginRequiredBtn = document.getElementById('close-login-required-btn');
  const loginRequiredBackdrop = loginRequiredModal.querySelector('.login-modal-backdrop');
  
  // Close button
  closeLoginRequiredBtn.addEventListener('click', () => {
    loginRequiredModal.style.display = 'none';
    loginRequiredModal.classList.remove('active');
  });
  
  // Click backdrop to close
  loginRequiredBackdrop.addEventListener('click', () => {
    loginRequiredModal.style.display = 'none';
    loginRequiredModal.classList.remove('active');
  });
  
  // Login buttons in the required modal - delegate to auth.js buttons
  document.getElementById('login-required-google-btn').addEventListener('click', () => {
    loginRequiredModal.style.display = 'none';
    document.getElementById('google-login-btn').click();
  });
  
  document.getElementById('login-required-steam-btn').addEventListener('click', () => {
    loginRequiredModal.style.display = 'none';
    document.getElementById('steam-login-btn').click();
  });
  
  // Logo click - redirect to home
  document.getElementById('logo-btn').addEventListener('click', () => {
    window.location.href = window.location.pathname; // Reloads current page/goes to root path
  });
  
  
  // ===================================
  // CHECKOUT MODAL LOGIC
  // ===================================
  
  let selectedPaymentMethod = null;
  
  // Open checkout modal
  function openCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.classList.add('active');
    
    // Populate cart total
    updateCheckoutTotals();
    
    // Reset to payment selection step
    showPaymentSelection();
    
    // Re-initialize icons
    lucide.createIcons();

    // Initialize Stripe Elements (if not already)
    // We delay this until modal is likely visible or about to be
    setTimeout(() => {
        initStripeElements();
    }, 100);
  }
  
  // Close checkout modal
  function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    modal.classList.remove('active');
    selectedPaymentMethod = null;
  }
  
  // Update all total displays
  async function updateCheckoutTotals() {
    let total = getCartTotal();
    const itemCount = getCartItemCount();
    
    // Default values
    let discountPercent = 0;
    let discountAmount = 0;
    let finalTotal = total;
    let tierName = 'Member';
    
    // Check membership if logged in
    if (currentUserId && currentUserId !== 'guest' && window.firebaseCart && window.firebaseCart.getUserMembership) {
      try {
        const membership = await window.firebaseCart.getUserMembership(currentUserId);
        if (membership && membership.discount > 0) {
          discountPercent = membership.discount;
          tierName = membership.tier;
          discountAmount = total * discountPercent;
          finalTotal = total - discountAmount;
        }
      } catch (err) {
        console.warn('Failed to load membership for checkout:', err);
      }
    }
    
    // 1. Update Subtotal (Original Price)
    const subtotalRow = document.getElementById('checkout-subtotal-row');
    const subtotalEl = document.getElementById('checkout-subtotal');
    
    if (discountPercent > 0) {
      subtotalRow.style.display = 'flex';
      subtotalEl.textContent = formatCurrency(total);
    } else {
      subtotalRow.style.display = 'none';
      // If no discount, the main total serves as subtotal too, but we can just hide the subtotal row
    }
    
    // 2. Update Discount Row
    const discountRow = document.getElementById('checkout-discount-row');
    const discountLabel = document.getElementById('checkout-discount-label');
    const discountVal = document.getElementById('checkout-discount-amount');
    
    if (discountPercent > 0) {
      discountRow.style.display = 'flex';
      discountLabel.textContent = `${tierName} Discount (-${discountPercent * 100}%):`;
      discountVal.textContent = `-${formatCurrency(discountAmount)}`;
    } else {
      discountRow.style.display = 'none';
    }

    const formattedTotal = formatCurrency(finalTotal);
    
    // Update all total amounts
    document.getElementById('checkout-total-amount').textContent = formattedTotal;
    document.getElementById('card-total').textContent = formattedTotal;
    document.getElementById('vietqr-total').textContent = formattedTotal;
    document.getElementById('vietqr-amount').textContent = formattedTotal;
    document.getElementById('momo-total').textContent = formattedTotal;
    document.getElementById('momo-amount').textContent = formattedTotal;
    document.getElementById('zalopay-total').textContent = formattedTotal;
    document.getElementById('zalopay-amount').textContent = formattedTotal;
    
    // Update item counts
    document.getElementById('card-items-count').textContent = `${itemCount} items`;
    document.getElementById('momo-items-count').textContent = `${itemCount} items`;
    document.getElementById('zalopay-items-count').textContent = `${itemCount} items`;
    
    // Generate order ID for VietQR and e-wallets
    const orderId = 'NEONORDER' + Date.now().toString().slice(-6);
    document.getElementById('vietqr-content').textContent = orderId;
    document.getElementById('momo-transaction-id').textContent = 'TRANS_NX' + Date.now().toString().slice(-6);
    document.getElementById('zalopay-transaction-id').textContent = 'TRANS_ZP' + Date.now().toString().slice(-6);
  }
  
  // Show payment selection screen
  function showPaymentSelection() {
    // Hide all sections
    document.querySelectorAll('.checkout-section').forEach(section => {
      section.classList.remove('active');
    });
    
    // Show payment selection
    document.getElementById('payment-selection').classList.add('active');
    
    // Update button
    const continueBtn = document.getElementById('checkout-continue-btn');
    continueBtn.disabled = true;
    document.getElementById('continue-btn-text').textContent = 'SELECT METHOD';
    
    // Hide back button on first step
    document.getElementById('checkout-back-btn').style.display = 'none';
    
    lucide.createIcons();
  }
  
  // Show payment form for selected method
  function showPaymentForm(method) {
    // Hide all sections
    document.querySelectorAll('.checkout-section').forEach(section => {
      section.classList.remove('active');
    });
    
    // Show selected form
    document.getElementById(`${method}-form`).classList.add('active');
    
    // Update button
    const continueBtn = document.getElementById('checkout-continue-btn');
    continueBtn.disabled = false;
    
    // Update button text based on method
    if (method === 'card') {
      document.getElementById('continue-btn-text').textContent = 'PAY NOW';
    } else if (method === 'vietqr') {
      document.getElementById('continue-btn-text').textContent = 'PAY WITH QR';
    } else {
      document.getElementById('continue-btn-text').textContent = 'CONFIRM PAYMENT';
    }
    
    // Show back button
    document.getElementById('checkout-back-btn').style.display = 'flex';
    
    lucide.createIcons();
  }
  
  // Handle payment method selection
  document.querySelectorAll('.payment-method-card').forEach(card => {
    card.addEventListener('click', function() {
      const method = this.dataset.method;
      
      // Check if USD and non-card method
      if (currentCurrency === 'USD' && method !== 'card') {
        showNotification('This method only supports VND. Please switch to VND or use Bank Card.', 'warning');
        return; // Don't select
      }
      
      // Remove selected class from all cards
      document.querySelectorAll('.payment-method-card').forEach(c => {
        c.classList.remove('selected');
      });
      
      // Add selected class to clicked card
      this.classList.add('selected');
      
      // Store selected method
      selectedPaymentMethod = method;
      
      // Enable continue button
      document.getElementById('checkout-continue-btn').disabled = false;
      document.getElementById('continue-btn-text').textContent = 'CONTINUE';
    });
  });
  
  // Continue button handler
  document.getElementById('checkout-continue-btn').addEventListener('click', function() {
    if (this.disabled) return;
    
    const activeSection = document.querySelector('.checkout-section.active');
    
    if (activeSection.id === 'payment-selection') {
      // Moving from selection to form
      if (selectedPaymentMethod) {
        if (selectedPaymentMethod === 'momo' || selectedPaymentMethod === 'vietqr' || selectedPaymentMethod === 'zalopay') {
          processPayment();
        } else {
          showPaymentForm(selectedPaymentMethod);
        }
      }
    } else {
      // Processing payment
      processPayment();
    }
  });
  
  // Back button handler
  document.getElementById('checkout-back-btn').addEventListener('click', function() {
    showPaymentSelection();
  });
  
  // Close button handler
  document.getElementById('close-checkout-btn').addEventListener('click', closeCheckoutModal);
  
  // Click overlay to close
  document.querySelector('.checkout-modal-overlay').addEventListener('click', closeCheckoutModal);
  
  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('checkout-modal');
      if (modal.classList.contains('active')) {
        closeCheckoutModal();
      }
    }
  });
  
  // Helper to finish checkout (Success)
  function finishCheckout() {
      // Clear cart
      cart = [];
      saveCart();
      updateCartUI();
      
      // Close modals
      closeCheckoutModal();
      closeCart();
      
      // Redirect
      window.location.href = 'html/keygen.html';
  }

  // Actual Payment Processing
  async function processPayment() {
    const continueBtn = document.getElementById('checkout-continue-btn');
    const btnText = document.getElementById('continue-btn-text');
    const originalText = btnText.textContent;
    
    // Disable button and show loading
    continueBtn.disabled = true;
    
    // Save current cart as purchased items before clearing
    localStorage.setItem('purchasedItems', JSON.stringify(cart));
    
    try {
        let amount = getCartTotal();
        let discountApplied = false;

        // CHECK MEMBERSHIP DISCOUNT
        if (currentUserId && currentUserId !== 'guest' && window.firebaseCart && window.firebaseCart.getUserMembership) {
            try {
                const membership = await window.firebaseCart.getUserMembership(currentUserId);
                if (membership && membership.discount > 0) {
                    const discountAmount = amount * membership.discount;
                    console.log(`💎 Applying ${membership.tier} discount: ${membership.discount*100}% (-${discountAmount})`);
                    amount = amount - discountAmount;
                    discountApplied = true;
                }
            } catch (err) {
                console.warn('Checking discount failed, proceeding with full price:', err);
            }
        }
        
        // Ensure amount is in VND for payment gateways
        // If user is viewing in USD, recalculate total using native VND prices
        if (currentCurrency === 'USD') {
             // Cart items have salePriceVND stored - use those for payment
             let vndTotal = 0;
             for (const item of cart) {
                 if (item.salePriceVND) {
                     vndTotal += item.salePriceVND * item.quantity;
                 } else {
                     // Fallback: convert USD back to VND
                     vndTotal += Math.round(item.price * 26000) * item.quantity;
                 }
             }
             // Re-apply discount if needed
             if (discountApplied) {
                 const membership = await window.firebaseCart.getUserMembership(currentUserId);
                 if (membership && membership.discount > 0) {
                     vndTotal = vndTotal - (vndTotal * membership.discount);
                 }
             }
             amount = Math.round(vndTotal);
        } else {
             amount = Math.round(amount);
        }
        console.log(`💸 Final Payment Amount (VND): ${amount}`);

        // 1. STRIPE CARD PAYMENT
        if (selectedPaymentMethod === 'card-form' || selectedPaymentMethod === 'card') { // Adjust ID if needed
            btnText.textContent = 'PROCESSING...';
            
            // Create PaymentIntent
            const response = await fetch(`${API_BASE}/api/create-payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, currency: 'vnd' })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            // Confirm Card Payment
            const result = await stripe.confirmCardPayment(data.clientSecret, {
                payment_method: {
                    card: cardNumber,
                    billing_details: {
                        name: document.getElementById('card-holder').value || 'Guest User'
                    }
                }
            });

            if (result.error) {
                showNotification(result.error.message, 'error');
                continueBtn.disabled = false;
                btnText.textContent = originalText;
            } else {
                if (result.paymentIntent.status === 'succeeded') {
                    showNotification('Card payment successful!', 'success');
                    finishCheckout();
                }
            }
            return;
        }

        // 2. MOMO PAYMENT
        if (selectedPaymentMethod === 'momo-form' || selectedPaymentMethod === 'momo') {
            btnText.textContent = 'GENERATING QR CODE...';
            
            // Use window.location.origin + pathname logic to find keygen.html relative to index.html
            const pathParts = window.location.pathname.split('/');
            pathParts.pop(); 
            const basePath = pathParts.join('/');
            const redirectUrl = `${window.location.origin}${basePath}/html/keygen.html`;

            // Extract product names
            const products = cart.map(item => item.title).join(', ');
            const description = products.length > 50 ? products.substring(0, 47) + '...' : products;

            const response = await fetch(`${API_BASE}/api/create-momo-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, redirectUrl, description })
            });

            const data = await response.json();
            if (data.payUrl) {
                // For MoMo, we clear cart immediately assuming they will pay
                cart = [];
                saveCart();
                window.location.href = data.payUrl;
            } else {
                throw new Error('Could not receive MoMo payment link');
            }
            return;
        }

        // 3. ZALOPAY PAYMENT
        if (selectedPaymentMethod === 'zalopay-form' || selectedPaymentMethod === 'zalopay') {
            btnText.textContent = 'REDIRECTING TO ZALOPAY...';
            
            // Use window.location.origin + pathname logic to find keygen.html relative to index.html
            const pathParts = window.location.pathname.split('/');
            pathParts.pop(); 
            const basePath = pathParts.join('/');
            // Use the same return URL as Momo
            const redirectUrl = `${window.location.origin}${basePath}/html/keygen.html`;

            // Extract product names
            const products = cart.map(item => item.title).join(', ');
            const description = products.length > 50 ? products.substring(0, 47) + '...' : products;

            const response = await fetch(`${API_BASE}/api/create-zalopay-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, redirectUrl, products, description })
            });

            const data = await response.json();
            if (data.order_url) {
                // For ZaloPay, we clear cart immediately assuming they will pay
                cart = [];
                saveCart();
                window.location.href = data.order_url;
            } else {
                 console.error('ZaloPay Error Data:', data);
                if (data.return_message) {
                    throw new Error('ZaloPay Error: ' + data.return_message);
                } else {
                    throw new Error('Could not receive ZaloPay payment link');
                }
            }
            return;
        }

        // 4. PAYOS VIETQR PAYMENT
        if (selectedPaymentMethod === 'vietqr-form' || selectedPaymentMethod === 'vietqr') {
            btnText.textContent = 'GENERATING QR CODE...';

            // Use window.location.origin + pathname logic to find keygen.html relative to index.html
            const pathParts = window.location.pathname.split('/');
            pathParts.pop(); 
            const basePath = pathParts.join('/');
            const redirectUrl = `${window.location.origin}${basePath}/html/keygen.html`;
            const cancelUrl = `${window.location.origin}${basePath}/index.html`;

            const response = await fetch(`${API_BASE}/api/create-payos-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, returnUrl: redirectUrl, cancelUrl })
            });

            const data = await response.json();
            if (data.checkoutUrl) {
                // Clear cart immediately
                cart = [];
                saveCart();
                window.location.href = data.checkoutUrl;
            } else {
                throw new Error('Could not receive VietQR payment link');
            }
            return;
        }

        // 3. OTHERS (MOCK)
        btnText.textContent = 'PROCESSING...';
        setTimeout(() => {
            showNotification('Payment successful!', 'success');
            finishCheckout();
        }, 2000);

    } catch (error) {
        console.error('Payment Error:', error);
        showNotification(error.message || 'Server connection error', 'error');
        continueBtn.disabled = false;
        btnText.textContent = originalText;
    }
  }
  
  // Connect cart checkout button to open modal
  document.querySelector('.cart-checkout-btn').addEventListener('click', function() {
    if (cart.length === 0) {
      showNotification('Giỏ hàng trống!', 'warning');
      return;
    }
    
    openCheckoutModal();
  });
  
  // STRIPE VARS
  let stripe, elements, cardNumber, cardExpiry, cardCvc; 
  // Make these accessible to processPayment
  // Note: We'll attach them to window or rely on closure scope if processPayment is inside.
  // processPayment is inside DOMContentLoaded scope so it is fine.
  
  function initStripeElements() {
    if (cardNumber) return; // Already initialized
    
    // STRIPE INITIALIZATION
    stripe = Stripe('pk_test_51StocIEKdaFBWIdK6THVeZOr5mfk82tpfO2V0EB72SAnOU9JjGbrtDe82ddCnAvPl2gK6DRguSgQjp5QA2AabCYJ00oYSP1NRw');
    elements = stripe.elements();
    
    const elementStyle = {
      base: {
        color: '#fff',
        fontFamily: '"Roboto", sans-serif',
        fontSmoothing: 'antialiased',
        fontSize: '16px',
        iconColor: '#22d3ee', // Cyan icon
        '::placeholder': {
          color: '#94a3b8'
        }
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444'
      }
    };

    cardNumber = elements.create('cardNumber', { style: elementStyle });
    cardNumber.mount('#card-number');

    cardExpiry = elements.create('cardExpiry', { style: elementStyle });
    cardExpiry.mount('#card-expiry');

    cardCvc = elements.create('cardCvc', { style: elementStyle });
    cardCvc.mount('#card-cvv');
  }
  
  // Notification Helper
  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.custom-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    
    notification.innerHTML = `
      <i data-lucide="${iconName}" class="notification-icon"></i>
      <div class="notification-content">
        <div class="notification-title">${type === 'info' ? 'Information' : (type === 'error' ? 'Error' : (type === 'warning' ? 'Warning' : 'Success'))}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">
        <i data-lucide="x" style="width:16px;height:16px;"></i>
      </button>
    `;
    
    document.body.appendChild(notification);
    if (window.lucide) window.lucide.createIcons();
    
    requestAnimationFrame(() => notification.classList.add('active'));
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
  }

  // Phone number formatting for Momo/ZaloPay
  const phoneInputs = [
    document.getElementById('momo-phone'),
    document.getElementById('zalopay-phone')
  ];
  
  phoneInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 4 && value.length <= 7) {
          value = value.slice(0, 4) + ' ' + value.slice(4);
        } else if (value.length > 7) {
          value = value.slice(0, 4) + ' ' + value.slice(4, 7) + ' ' + value.slice(7, 10);
        }
        e.target.value = value;
      });
    }
  });
  
  // Load more button
  document.getElementById('load-more-btn').addEventListener('click', handleLoadMore);
});
