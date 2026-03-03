// Account Page Logic - Manage Purchased Keys
// Uses Firebase real-time listener to display keys

console.log('📦 Account.js loaded');

// Wait for auth.js to load and Firebase to initialize
let currentUserId = null;
let unsubscribeListener = null;

/**
 * Update user UI in header (avatar + name)
 */
function updateUserUI() {
  const userInfoDisplay = document.getElementById('user-info-display');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const loginBtn = document.getElementById('login-btn');
  
  if (!userInfoDisplay || !userAvatar || !userName || !loginBtn) {
    console.warn('⚠️ User UI elements not found');
    return;
  }
  
  const auth = window.__firebaseAuth;
  let userData = null;
  
  // Priority 1: Check Steam user from localStorage FIRST
  const savedSteamUser = localStorage.getItem('steam_user');
  if (savedSteamUser) {
    try {
      userData = JSON.parse(savedSteamUser);
      console.log('✅ Updating UI for Steam user:', userData.displayName);
    } catch (error) {
      console.error('Failed to parse Steam user data');
    }
  }
  
  // Priority 2: Check Firebase Auth (Google ONLY - not anonymous)
  if (!userData && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
    userData = {
      photoURL: auth.currentUser.photoURL,
      displayName: auth.currentUser.displayName || auth.currentUser.email,
    };
    console.log('✅ Updating UI for Google user:', userData.displayName);
  }
  
  if (userData) {
    // Show user info
    loginBtn.style.display = 'none';
    userInfoDisplay.style.display = 'flex';
    userAvatar.src = userData.photoURL || 'https://placehold.co/40';
    
    // Debug: Check displayName value
    console.log('🔍 DEBUG userData:', JSON.stringify(userData));
    console.log('🔍 DEBUG displayName:', userData.displayName);
    console.log('🔍 DEBUG userName element:', userName);
    
    userName.textContent = userData.displayName || 'User';
    console.log('✅ User UI updated:', userName.textContent);
  } else {
    // Show login button
    loginBtn.style.display = 'flex';
    userInfoDisplay.style.display = 'none';
  }
}

// Initialize account page (called after user is detected)
async function initAccountPage() {
  console.log('🔄 Loading keys for user:', currentUserId);
  
  if (!currentUserId) {
    console.error('❌ No user ID available');
    showLoginRequired();
    return;
  }
  
  // Load membership details
  if (window.firebaseCart && window.firebaseCart.getUserMembership) {
    try {
      const membership = await window.firebaseCart.getUserMembership(currentUserId);
      renderMembership(membership);
    } catch (err) {
      console.error('Failed to load membership:', err);
    }
  }
  
  // Load purchased keys
  loadUserKeys(currentUserId);
}

// Render membership section
function renderMembership(data) {
  const section = document.getElementById('membership-section');
  if (!section || !data) return;
  
  const { tier, discount, totalSpent } = data;
  
  // Determine next tier info (approximate logic matching auth.js)
  // Re-calculating here for progress bar display
  let nextTier = 'Silver';
  let nextGoal = 2000000;
  let progress = 0;
  
  if (totalSpent >= 10000000) {
    nextTier = 'MAX LEVEL';
    nextGoal = totalSpent;
    progress = 100;
  } else if (totalSpent >= 7000000) {
    nextTier = 'Diamond';
    nextGoal = 10000000;
    progress = ((totalSpent - 7000000) / 3000000) * 100;
  } else if (totalSpent >= 5000000) {
    nextTier = 'Platinum';
    nextGoal = 7000000;
    progress = ((totalSpent - 5000000) / 2000000) * 100;
  } else if (totalSpent >= 2000000) {
    nextTier = 'Gold';
    nextGoal = 5000000;
    progress = ((totalSpent - 2000000) / 3000000) * 100;
  } else {
    nextTier = 'Silver';
    nextGoal = 2000000;
    progress = (totalSpent / 2000000) * 100;
  }
  
  // Update UI
  section.style.display = 'block';
  
  // Set data-tier attribute on section for tier-based styling
  section.setAttribute('data-tier', tier.toLowerCase());
  
  const tierElement = document.getElementById('member-tier');
  tierElement.textContent = tier.toUpperCase();
  tierElement.setAttribute('data-tier', tier.toLowerCase());
  
  // Update Icon Color using data-tier (CSS handles the color)
  const iconEl = document.getElementById('member-icon');
  if (iconEl) {
      iconEl.style.color = getTierColor(tier);
      // If Lucide has already replaced <i> with <svg>, it should preserve the ID.
      // If not, we might need to re-run createIcons or target differently, 
      // but standard Lucide behavior preserves attributes.
  }
  
  document.getElementById('member-discount').textContent = `${discount * 100}%`;
  
  document.getElementById('total-spent-display').textContent = new Intl.NumberFormat('vi-VN', { 
    style: 'currency', currency: 'VND' 
  }).format(totalSpent);
  
  // Let CSS handle the progress bar color based on data-tier
  document.getElementById('member-progress-bar').style.width = `${Math.min(100, Math.max(0, progress))}%`;
  // Don't override background - let CSS handle it based on data-tier
  
  const remaining = Math.max(0, nextGoal - totalSpent);
  const remainingStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(remaining);
  
  if (totalSpent >= 10000000) {
    document.getElementById('member-next-tier-msg').textContent = 'You have reached the highest rank!';
  } else {
    document.getElementById('member-next-tier-msg').textContent = `Next Tier: ${nextTier.toUpperCase()} (${remainingStr} more)`;
  }
}

function getTierColor(tier) {
  switch (tier?.toLowerCase()) {
    case 'diamond': return '#b9f2ff'; // Light Cyan
    case 'platinum': return '#e5e7eb'; // Gray/White
    case 'gold': return '#fbbf24'; // Gold
    case 'silver': return '#94a3b8'; // Silver/Gray
    default: return '#22d3ee'; // Default Cyan
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔧 Account page initialized');
  
  // Show loading state while waiting for auth
  showLoading();
  
  // Wait for Firebase to initialize
  let retries = 0;
  const maxRetries = 10;
  
  while (retries < maxRetries) {
    const auth = window.__firebaseAuth;
    const firestoreDB = window.__firestoreDB;
    
    if (auth && firestoreDB) {
      console.log('✅ Firebase ready');
      break;
    }
    
    console.log(`⏳ Waiting for Firebase... (${retries + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, 300));
    retries++;
  }
  
  const auth = window.__firebaseAuth;
  
  if (!auth) {
    console.error('❌ Firebase Auth not available');
    showLoginRequired();
    return;
  }
  
  // Use onAuthStateChanged to wait for auth state restoration
  auth.onAuthStateChanged(async (firebaseUser) => {
    console.log('🔐 Auth state changed:', !!firebaseUser);
    
    if (firebaseUser) {
      // ✅ CRITICAL: Check if anonymous (Steam) vs Google
      if (firebaseUser.isAnonymous) {
        // Steam user - wait for localStorage (auth.js needs time to save it)
        let steamUserData = null;
        let retries = 0;
        const maxRetries = 5;
        
        while (retries < maxRetries && !steamUserData) {
          const savedData = localStorage.getItem('steam_user');
          if (savedData) {
            try {
              steamUserData = JSON.parse(savedData);
              break;
            } catch (e) {
              console.error('Failed to parse Steam user');
            }
          }
          console.log(`⏳ Waiting for Steam data (${retries + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 200));
          retries++;
        }
        
        if (steamUserData) {
          currentUserId = steamUserData.uid || steamUserData.steamId;
          console.log('✅ Steam user detected (anonymous), steamId:', currentUserId);
          updateUserUI();
          await initAccountPage();
          return;
        }
        
        console.log('⚠️ No Steam data after retries');
        showLoginRequired();
        return;
      }
      
      // Real Firebase Auth user (Google)
      currentUserId = firebaseUser.uid;
      console.log('✅ Google user detected via onAuthStateChanged:', currentUserId);
      
      // Update UI with user info
      updateUserUI();
      
      await initAccountPage();
    } else {
      // Check Steam user from localStorage
      const steamUserData = localStorage.getItem('steam_user');
      if (steamUserData) {
        try {
          const steamUser = JSON.parse(steamUserData);
          if (steamUser && steamUser.uid) {
            currentUserId = steamUser.uid;
            console.log('✅ Steam user detected:', currentUserId);
            
            // Update UI with user info
            updateUserUI();
            
            await initAccountPage();
            return;
          }
        } catch (e) {
          console.error('Failed to parse Steam user data');
        }
      }
      
      // No user logged in
      console.log('⚠️ No user logged in');
      showLoginRequired();
    }
  });
  
  // Listen for user login event
  window.addEventListener('user-login', (event) => {
    const { userId } = event.detail;
    console.log('👤 User logged in:', userId);
    currentUserId = userId;
    
    // ✅ Update UI header
    updateUserUI();
    
    loadUserKeys(userId);
  });

  // Listen for user logout event
  window.addEventListener('user-logout', () => {
    console.log('👋 User logged out');
    currentUserId = null;
    if (unsubscribeListener) {
      unsubscribeListener();
      unsubscribeListener = null;
    }
    showLoginRequired();
  });
});

/**
 * Load user's purchased keys from Firebase
 */
async function loadUserKeys(userId) {
  if (!userId || userId === 'guest') {
    showLoginRequired();
    return;
  }

  // Show loading state
  showLoading();

  // Check if Firebase is available
  if (!window.firebaseCart || !window.firebaseCart.isAvailable()) {
    console.warn('⚠️ Firebase not available, using mock data');
    setTimeout(() => showEmptyState(), 1000);
    return;
  }

  try {
    // Load keys with real-time listener
   await window.firebaseCart.loadPurchasedKeys(userId, renderKeys);
  } catch (error) {
    console.error('❌ Error loading keys:', error);
    showEmptyState();
  }
}

/**
 * Render keys on the page
 */
function renderKeys(orders) {
  console.log('🎨 Rendering keys:', orders);

  const keysContainer = document.getElementById('keys-container');
  const keysList = document.getElementById('keys-list');
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const loginRequired = document.getElementById('login-required-msg');

  // Hide all states
  loadingState.style.display = 'none';
  emptyState.style.display = 'none';
  loginRequired.style.display = 'none';

  if (!orders || orders.length === 0) {
    showEmptyState();
    return;
  }

  // Show keys container
  keysContainer.style.display = 'block';
  keysList.innerHTML = '';

  // Sort orders by date (newest first)
  orders.sort((a, b) => {
    const dateA = a.purchaseDate?.toDate ? a.purchaseDate.toDate() : new Date(a.purchaseDate);
    const dateB = b.purchaseDate?.toDate ? b.purchaseDate.toDate() : new Date(b.purchaseDate);
    return dateB - dateA;
  });

  // Render each order
  orders.forEach((order, index) => {
    const orderCard = createOrderCard(order, index);
    keysList.appendChild(orderCard);
  });

  // Reinitialize icons
  lucide.createIcons();
}

/**
 * Create order card element
 */
function createOrderCard(order, index) {
  const card = document.createElement('div');
  card.className = 'key-card';
  card.style.animationDelay = `${index * 0.1}s`;

  // Format date
  const purchaseDate = order.purchaseDate?.toDate ? order.purchaseDate.toDate() : new Date(order.purchaseDate);
  const dateStr = purchaseDate.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Create header
  const header = `
    <div class="key-card-header">
      <div>
        <div class="order-id">ORDER #${order.orderId || 'N/A'}</div>
        <div class="order-date">${dateStr}</div>
      </div>
      <div style="text-align: right;">
        <div style="color: #22d3ee; font-weight: bold; font-size: 1.1rem;">
          ${formatPrice(order.amount)}
        </div>
        <div style="color: #9ca3af; font-size: 0.85rem; text-transform: uppercase;">
          ${order.paymentMethod || 'N/A'}
        </div>
      </div>
    </div>
  `;

  // Create keys list
  let keysHtml = '';
  const games = order.games || [];
  const keys = order.keys || [];

  // Logic to track duplicate games for numbering
  const gameCounts = {};
  const gameTracker = {};
  
  // First pass: count total occurrences of each game
  games.forEach(game => {
    gameCounts[game] = (gameCounts[game] || 0) + 1;
  });

  // Generate HTML
  games.forEach((gameName, idx) => {
    const key = keys[idx] || 'KEY-NOT-FOUND';
    
    // Determine display name (add #number if multiple exist)
    let displayName = gameName;
    if (gameCounts[gameName] > 1) {
      gameTracker[gameName] = (gameTracker[gameName] || 0) + 1;
      displayName = `${gameName} #${gameTracker[gameName]}`;
    }

    keysHtml += `
      <div class="key-item">
        <div class="game-name">
          <i data-lucide="gamepad-2" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;"></i>
          ${displayName}
        </div>
        <div class="key-box">
          <span id="key-${order.orderId}-${idx}">${key}</span>
          <button class="copy-btn" onclick="copyKey('key-${order.orderId}-${idx}')" title="Copy key">
            <i data-lucide="copy" style="width: 16px; height: 16px;"></i>
          </button>
        </div>
      </div>
    `;
  });

  // Check if we need a scrollable container
  let contentHtml = keysHtml;
  if (games.length > 5) {
    contentHtml = `<div class="keys-scroll-container">${keysHtml}</div>`;
  }

  card.innerHTML = header + contentHtml;
  return card;
}

/**
 * Format price display
 */
function formatPrice(amount) {
  if (!amount) return '0₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

/**
 * Copy key to clipboard
 */
window.copyKey = function(elementId) {
  const keyElement = document.getElementById(elementId);
  if (!keyElement) return;

  const keyText = keyElement.textContent;
  
  navigator.clipboard.writeText(keyText).then(() => {
    // Show success notification
    showNotification('Key copied to clipboard!', 'success');
  }).catch(err => {
    console.error('Failed to copy:', err);
    // Fallback method
    const textArea = document.createElement('textarea');
    textArea.value = keyText;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showNotification('Key copied to clipboard!', 'success');
    } catch (e) {
      showNotification('Failed to copy key', 'error');
    }
    document.body.removeChild(textArea);
  });
};

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  // Remove existing notification
  const existing = document.querySelector('.custom-notification');
  if (existing) existing.remove();

  // Create notification
  const notification = document.createElement('div');
  notification.className = `custom-notification ${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-circle';

  notification.innerHTML = `
    <i data-lucide="${iconName}" class="notification-icon"></i>
    <div class="notification-content">
      <div class="notification-title">${type === 'success' ? 'Success' : 'Notification'}</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  document.body.appendChild(notification);
  lucide.createIcons();

  requestAnimationFrame(() => {
    notification.classList.add('active');
  });

  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.remove('active');
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

/**
 * Show UI states
 */
function showLoading() {
  document.getElementById('loading-state').style.display = 'block';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('login-required-msg').style.display = 'none';
  document.getElementById('keys-container').style.display = 'none';
}

function showEmptyState() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('login-required-msg').style.display = 'none';
  document.getElementById('keys-container').style.display = 'none';
  lucide.createIcons();
}

function showLoginRequired() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('login-required-msg').style.display = 'block';
  document.getElementById('keys-container').style.display = 'none';
  lucide.createIcons();
}
