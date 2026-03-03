// Authentication Logic
// Note: You must replace the configuration below with your own Firebase project keys.

// Import Firebase SDKs (using CDN for simplicity in this project structure)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  getDocs,
  onSnapshot,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBUR5_v33e6ciQrN2YVSRXugHHOO5mnZqw",
  authDomain: "nenonexus-digital-game-store.firebaseapp.com",
  projectId: "nenonexus-digital-game-store",
  storageBucket: "nenonexus-digital-game-store.firebasestorage.app",
  messagingSenderId: "171441174876",
  appId: "1:171441174876:web:463dae218cc3b845c1e999",
  measurementId: "G-VM6GX6WZ69",
};

// --- FIREBASE INITIALIZATION ---
let auth = null;
let db = null;
let googleProvider = null;

try {
  console.log('🔥 Initializing Firebase...');
  
  // Check if Firebase config exists
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    throw new Error('Firebase config is missing');
  }

  // Initialize Firebase app
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  db = getFirestore(app);

  // ✅ Export Firebase Auth to window for global access
  window.__firebaseAuth = auth;
  console.log("🔧 DEBUG: auth exposed to window.__firebaseAuth");

  // Export Firestore instance
  window.__firestoreDB = db;
  console.log("🔧 DEBUG: db exposed to window.__firestoreDB");

  console.log("✅ Firebase initialized successfully");
  console.log("✅ Auth instance:", !!auth);
  console.log("✅ Firestore instance:", !!db);
} catch (error) {
  console.error("❌ Firebase initialization error:", error);
  console.error("❌ Error details:", error.message, error.code);
  console.warn(
    "Firebase config is missing or invalid. Google Login will run in mock mode.",
    error,
  );
}

// --- DOM ELEMENTS ---
const loginBtn = document.getElementById("login-btn");
const userDropdown = document.getElementById("user-dropdown");
const logoutBtn = document.getElementById("logout-btn");
const loginModal = document.getElementById("login-modal");
const closeLoginBtn = document.getElementById("close-login-btn");
const googleLoginBtn = document.getElementById("google-login-btn");
const steamLoginBtn = document.getElementById("steam-login-btn");
const backdrop = document.querySelector(".login-modal-backdrop");

// --- STATE MANAGER ---
let currentUser = null;

// --- EVENT LISTENERS ---
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  
  // Wait a bit for Firebase to initialize
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Check for saved Steam session in localStorage
  const savedSteamUser = localStorage.getItem('steam_user');
  console.log('🔍 Checking for saved Steam session...', !!savedSteamUser);
  
  if (savedSteamUser) {
    try {
      const userData = JSON.parse(savedSteamUser);
      console.log('🔄 Restoring Steam session:', userData.displayName);
      
      // 🔐 CRITICAL: Create Firebase Anonymous Auth session for Steam users
      // This is REQUIRED for Firestore Security Rules to allow read/write
      if (auth && !auth.currentUser) {
        try {
          console.log('🔐 Creating anonymous Firebase session for restored Steam user...');
          const { signInAnonymously } = await import(
            "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
          );
          await signInAnonymously(auth);
          console.log('✅ Anonymous auth session created for Steam user');
          
          // Wait for auth to propagate
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (authError) {
          console.error('❌ Failed to create anonymous session:', authError);
        }
      }
      
      // Try to load fresh data from Firebase
      if (userData.uid && window.firebaseCart && window.firebaseCart.isAvailable()) {
        console.log('📡 Attempting to load from Firebase...');
        const firebaseProfile = await window.firebaseCart.loadUserProfile(userData.uid);
        if (firebaseProfile) {
          // Update with fresh data from Firebase
          const refreshedUser = {
            uid: firebaseProfile.steamId,
            steamId: firebaseProfile.steamId,
            displayName: firebaseProfile.displayName,
            photoURL: firebaseProfile.photoURL,
            email: firebaseProfile.email,
            provider: firebaseProfile.provider,
            profileUrl: firebaseProfile.profileUrl
          };
          console.log('✅ Calling updateUI with Firebase data:', refreshedUser);
          await updateUI(refreshedUser);
          console.log('✅ Steam session restored from Firebase');
        } else {
          // Use cached data if Firebase fails
          console.log('⚠️ Firebase load failed, using cache');
          await updateUI(userData);
          console.log('✅ Steam session restored from cache');
        }
      } else {
        // No Firebase, use cached data
        console.log('📦 Using cached data (Firebase not available)');
        await updateUI(userData);
        console.log('✅ Steam session restored from cache');
      }
    } catch (error) {
      console.error('❌ Failed to restore Steam session:', error);
      localStorage.removeItem('steam_user');
    }
  } else {
    console.log('ℹ️ No saved Steam session found');
  }
  
  // Check Firebase auth status (for Google login)
  checkAuthStatus();
});

function setupEventListeners() {
  // Login button - opens modal OR toggles dropdown
  loginBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentUser) {
      toggleUserDropdown();
    } else {
      openModal();
    }
  });

  // Logout button in dropdown
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleLogout();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".user-section")) {
      closeUserDropdown();
    }
  });

  // Modal Toggles
  closeLoginBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  // Login Actions
  googleLoginBtn.addEventListener("click", handleGoogleLogin);
  steamLoginBtn.addEventListener("click", handleSteamLogin);
}

// --- UI FUNCTIONS ---
function toggleUserDropdown() {
  const isVisible = userDropdown.style.display === "block";
  userDropdown.style.display = isVisible ? "none" : "block";
}

function closeUserDropdown() {
  if (userDropdown) {
    userDropdown.style.display = "none";
  }
}

function openModal() {
  loginModal.style.display = "flex";
  // Animation/Transition
  setTimeout(() => {
    loginModal.classList.add("active");
  }, 10);
}

function closeModal() {
  loginModal.classList.remove("active");
  setTimeout(() => {
    loginModal.style.display = "none";
  }, 300);
}

async function updateUI(user) {
  if (user) {
    currentUser = user;

    // Update Login Button to User Profile
    loginBtn.innerHTML = `
      <img src="${user.photoURL || "https://ui-avatars.com/api/?name=User"}" class="user-avatar-display" alt="Avatar">
      <span class="user-name-display">${user.displayName || "Gamer"}</span>
    `;
    loginBtn.classList.add("logged-in");

    // Update dropdown info
    const dropdownAvatar = document.getElementById("user-dropdown-avatar");
    const dropdownName = document.getElementById("user-dropdown-name");
    if (dropdownAvatar)
      dropdownAvatar.src =
        user.photoURL || "https://ui-avatars.com/api/?name=User";
    if (dropdownName) dropdownName.textContent = user.displayName || "Gamer";

    // Dispatch custom event for cart system
    // IMPORTANT: Use user.uid (Firebase UID) for Firestore, not email!
    const userId =
      user.uid || user.email || user.displayName || "user_" + Date.now();
    window.dispatchEvent(
      new CustomEvent("user-login", {
        detail: { user, userId },
      }),
    );

    // Save Steam user profile to Firebase (if Steam login and Firestore available)
    if (user.provider === 'steam' && window.firebaseCart && window.firebaseCart.isAvailable()) {
      // Create Firebase Anonymous Auth session for Steam users
      // This is REQUIRED for Firestore Security Rules to allow writes
      if (auth && !auth.currentUser) {
        try {
          console.log('🔐 Creating anonymous Firebase session for Steam user...');
          await signInAnonymously(auth);
          console.log('✅ Anonymous auth session created');
        } catch (authError) {
          console.warn('⚠️ Failed to create anonymous session:', authError);
        }
      }
      
      // Wait for anonymous auth to complete before saving
      // Give it a moment to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now save profile with auth session
      try {
        await window.firebaseCart.saveUserProfile(userId, user);
      } catch (err) {
        console.warn('⚠️ Failed to save Steam profile to Firebase:', err);
      }
      
      // Save to localStorage for session persistence
      localStorage.setItem('steam_user', JSON.stringify(user));
      console.log('💾 Steam session saved to localStorage');
    }
  } else {
    currentUser = null;

    // Clear Steam session from localStorage
    localStorage.removeItem('steam_user');

    // Reset to Login Button
    loginBtn.innerHTML = `
      <i data-lucide="user" class="login-icon"></i>
      <span class="login-text">LOGIN</span>
    `;
    loginBtn.classList.remove("logged-in");
    closeUserDropdown();

    // Re-init icon
    lucide.createIcons();

    // Dispatch logout event for cart system
    window.dispatchEvent(new CustomEvent("user-logout"));
  }
}

// --- AUTH HANDLERS ---

async function handleGoogleLogin() {
  // Check if running on file:// protocol
  if (window.location.protocol === "file:") {
    alert(
      "Google Login via Firebase requires a web server (http:// or https://) and will NOT work when opening the HTML file directly.\n\nPlease use a local server (e.g., Live Server in VS Code) and ensure 'localhost' is added to your Firebase Authorized Domains.",
    );
    return;
  }

  if (!auth) {
    alert("Firebase config missing! Check console for details.");
    // Mock login for demonstration
    mockLogin({
      displayName: "Demo User",
      photoURL: "https://ui-avatars.com/api/?name=Demo+User&background=random",
    });
    closeModal();
    return;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log("Google Login Success:", user);
    closeModal();
    // UI update handled by onAuthStateChanged
  } catch (error) {
    console.error("Google Login Error:", error);

    if (error.code === "auth/popup-closed-by-user") {
        showNotification("Bạn đã hủy thao tác đăng nhập", "warning");
    } else if (error.code === "auth/cancelled-popup-request") {
        showNotification("Đã hủy thao tác: Một cửa sổ đăng nhập khác đang mở.", "warning");
    } else if (error.code === "auth/unauthorized-domain") {
      showNotification("Lỗi tên miền không được phép (Unauthorized Domain)", "error");
    } else if (
      error.code === "auth/operation-not-supported-in-this-environment"
    ) {
      showNotification("Tính năng này không hỗ trợ chạy trực tiếp từ file (file://)", "error");
    } else {
      showNotification(`Lỗi đăng nhập: ${error.message}`, "error");
    }
  }
}

function handleSteamLogin() {
  // Steam Login Implementation using local server
  const width = 800;
  const height = 600;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;

  const popWin = window.open(
    "https://steam-auth-server-production.up.railway.app/auth/steam",
    "SteamLogin",
    `width=${width},height=${height},left=${left},top=${top}`,
  );
  
  // Safety check if popup was blocked
  if (!popWin || popWin.closed || typeof popWin.closed == 'undefined') { 
      showNotification("Cửa sổ đăng nhập đã bị chặn. Vui lòng cho phép popup.", "error");
      return;
  }

  // Status check loop to see if popup is closed manually without login
  const timer = setInterval(() => {
    if (popWin.closed) {
      clearInterval(timer);
      console.log('Steam popup closed by user');
      // showNotification("Bạn đã hủy đăng nhập Steam", "info"); // Optional
    }
  }, 500);

  // Listen for message from popup
  window.addEventListener("message", function onMessage(event) {
    // Security check: Only accept messages from trusted origins (or loose for local dev)
    if (event.origin !== "https://steam-auth-server-production.up.railway.app") return;

    if (event.data && event.data.type === "STEAM_LOGIN_SUCCESS") {
      const steamUser = event.data.user;

      // Adapt Steam user object to our app's user structure
      const user = {
        displayName: steamUser.displayName,
        photoURL: steamUser.photoURL,
        uid: steamUser.steamId, // Use SteamID as unique ID
        email: `${steamUser.steamId}@steam.com`, // Fake email for consistency
        provider: "steam",
      };

      console.log("Steam Login Success:", user);

      // Update UI and clean up
      updateUI(user);
      closeModal();
      showNotification(`Chào mừng, ${user.displayName}!`, "success");

      // Remove listener to avoid duplicates
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
    }
  });
}

function mockLogin(mockUser) {
  // Add email/uid for cart persistence
  mockUser.email =
    mockUser.email ||
    `${mockUser.displayName.replace(/\s/g, "_").toLowerCase()}@demo.com`;
  mockUser.uid = mockUser.uid || "mock_" + Date.now();

  updateUI(mockUser);
  closeModal();

  // Show welcome notification
  showNotification(`Welcome back, ${mockUser.displayName}!`, "success");
}

function handleLogout() {
  closeUserDropdown();
  
  if (auth && currentUser && currentUser.provider !== 'steam') {
    // Firebase logout (for Google login)
    signOut(auth)
      .then(() => {
        console.log("Signed out from Firebase");
        updateUI(null); // Ensure UI updates
        showNotification("Đã đăng xuất thành công", "success");
      })
      .catch((error) => {
        console.error("Sign out error", error);
        // Force logout anyway
        updateUI(null);
        showNotification("Đã đăng xuất", "info");
      });
  } else {
    // Steam or mock logout
    console.log("Logging out (Steam/Mock)");
    updateUI(null);
    showNotification("Đã đăng xuất thành công", "success");
  }
}

// Notification helper (Updated to use index.css styles)
function showNotification(message, type = "info") {
    // Remove existing notification if any
    const existing = document.querySelector('.custom-notification');
    if (existing) existing.remove();
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    
    // Determine icon
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    
    // Check if lucide is available (should be from index.html)
    const hasLucide = window.lucide && window.lucide.createIcons;
    
    // Fallback info if lucide not ready? usually is.
    
    notification.innerHTML = `
      <i data-lucide="${iconName}" class="notification-icon"></i>
      <div class="notification-content">
        <div class="notification-title">${type === 'info' ? 'Thông báo' : (type === 'error' ? 'Lỗi' : (type === 'warning' ? 'Chú ý' : 'Thành công'))}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;
    
    document.body.appendChild(notification);
    
    if (hasLucide) {
        window.lucide.createIcons();
    }
    
    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('active');
    });
    
    // Auto remove
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
}

function checkAuthStatus() {
  if (auth) {
    onAuthStateChanged(auth, (user) => {
      // Check if user is already logged in via Steam
      const savedSteamUser = localStorage.getItem('steam_user');
      
      if (savedSteamUser) {
        // Don't override Steam user with Firebase auth
        console.log('ℹ️ Steam session detected, skipping Firebase auth update');
        return;
      }
      
      // Only update UI for Google login (non-anonymous) or logout
      if (user && user.providerData && user.providerData.length > 0) {
        // Real Google user (has provider data)
        updateUI(user);
      } else if (!user) {
        // User logged out
        updateUI(null);
      } else {
        // Anonymous user - ignore (used for Steam)
        console.log('ℹ️ Anonymous auth detected, not updating UI');
      }
    });
  }
}

// === FIREBASE CART FUNCTIONS ===
// Export cart functions for use in index.js
window.firebaseCart = {
  /**
   * Save cart to Firestore (minimal data: dealID + quantity only)
   * @param {string} userId - User ID
   * @param {Array} items - Cart items with full details
   * @returns {Promise<boolean>} Success status
   */
  async saveCart(userId, items) {
    console.log("🔍 === saveCart CALLED ===");
    console.log("🔍 userId:", userId);
    console.log("🔍 items:", items);
    console.log("🔍 window.__firestoreDB:", !!window.__firestoreDB);
    console.log("🔍 db:", typeof db, !!db);

    const firestoreDB = window.__firestoreDB || db;
    console.log("🔍 firestoreDB (after assignment):", !!firestoreDB);

    console.log("🔍 Check results:");
    console.log("  - !firestoreDB:", !firestoreDB);
    console.log("  - !userId:", !userId);
    console.log("  - userId === guest:", userId === "guest");

    if (!firestoreDB || !userId || userId === "guest") {
      console.log(
        "⚠️ Firestore not available or guest user, skipping Firebase save",
      );
      console.log("🔧 DEBUG: firestoreDB =", !!firestoreDB, "userId =", userId);
      return false;
    }

    try {
      console.log("🔍 STEP 1: Starting try block...");

      // Convert to minimal format (dealID + quantity only)
      console.log("🔍 STEP 2: Converting to minimal format...");
      const minimalItems = items.map((item) => ({
        dealID: item.dealID || item.id,
        quantity: item.quantity || 1,
      }));
      console.log("🔍 STEP 3: Minimal items created:", minimalItems);

      // Save to Firestore: users/{userId}/cart/data
      console.log("🔍 STEP 4: Creating document reference...");
      console.log("  Path: users/" + userId + "/cart/data");
      const cartRef = doc(firestoreDB, "users", userId, "cart", "data");
      console.log("🔍 STEP 5: Doc ref created:", !!cartRef);

      console.log("🔍 STEP 6: Calling setDoc...");
      const docData = {
        items: minimalItems,
        updatedAt: new Date(),
        totalItems: items.reduce((sum, item) => sum + (item.quantity || 1), 0),
      };
      console.log("🔍 STEP 7: Document data:", docData);

      // Wrap setDoc with timeout to catch hanging requests
      const setDocPromise = setDoc(cartRef, docData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("setDoc timeout after 10s")), 10000),
      );

      console.log("🔍 STEP 7.5: Awaiting setDoc with 10s timeout...");
      await Promise.race([setDocPromise, timeoutPromise]);
      console.log("🔍 STEP 8: setDoc completed!");

      console.log("✅ Cart saved to Firebase:", minimalItems.length, "items");
      return true;
    } catch (error) {
      console.error("❌ Firebase save error:", error);
      console.error("❌ Error type:", error.constructor.name);
      console.error("❌ Error message:", error.message);
      console.error("❌ Error code:", error.code);
      console.error("❌ Full error:", error);
      return false;
    }
  },

  /**
   * Load cart from Firestore (returns minimal data: dealID + quantity)
   * @param {string} userId - User ID
   * @returns {Promise<Array|null>} Cart items or null
   */
  async loadCart(userId) {
    const firestoreDB = window.__firestoreDB || db;

    if (!firestoreDB || !userId || userId === "guest") {
      console.log("⚠️ Firestore not available or guest user");
      return null;
    }

    try {
      const cartRef = doc(firestoreDB, "users", userId, "cart", "data");
      const docSnap = await getDoc(cartRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log(
          "✅ Cart loaded from Firebase:",
          data.items.length,
          "items",
        );
        return data.items; // [{dealID, quantity}, ...]
      } else {
        console.log("📭 No cart found in Firebase");
        return null;
      }
    } catch (error) {
      console.error("❌ Firebase load error:", error);
      return null;
    }
  },

  /**
   * Check if Firestore is available
   */
  isAvailable() {
    const firestoreDB = window.__firestoreDB || db;
    return !!firestoreDB;
  },

  /**
   * Save Steam user profile to Firestore
   * @param {string} userId - User ID (Steam ID)
   * @param {Object} userProfile - User profile data
   * @returns {Promise<boolean>} Success status
   */
  async saveUserProfile(userId, userProfile) {
    const firestoreDB = window.__firestoreDB || db;
    
    if (!firestoreDB || !userId || userId === 'guest') {
      console.log('⚠️ Firestore not available or guest user, skipping profile save');
      return false;
    }

    try {
      // Save to Firestore: users/{userId}/profile/data
      const profileRef = doc(firestoreDB, 'users', userId, 'profile', 'data');
      
      // ✅ Build profile data and remove undefined fields
      const profileData = {
        steamId: userProfile.uid || userProfile.steamId,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL,
        email: userProfile.email,
        provider: userProfile.provider || 'steam',
        lastLogin: new Date(),
        updatedAt: new Date()
      };
      
      // Add profileUrl only if it exists
      if (userProfile.profileUrl) {
        profileData.profileUrl = userProfile.profileUrl;
      }

      await setDoc(profileRef, profileData);
      console.log('✅ Steam user profile saved to Firebase:', userProfile.displayName);
      return true;
    } catch (error) {
      console.error('❌ Profile save error:', error);
      return false;
    }
  },

  /**
   * Load Steam user profile from Firestore
   * @param {string} userId - User ID (Steam ID)
   * @returns {Promise<Object|null>} User profile or null
   */
  async loadUserProfile(userId) {
    const firestoreDB = window.__firestoreDB || db;
    
    if (!firestoreDB || !userId || userId === 'guest') {
      console.log('⚠️ Firestore not available or guest user');
      return null;
    }

    try {
      const profileRef = doc(firestoreDB, 'users', userId, 'profile', 'data');
      const docSnap = await getDoc(profileRef);
      
      if (docSnap.exists()) {
        const profile = docSnap.data();
        console.log('✅ User profile loaded from Firebase:', profile.displayName);
        return profile;
      } else {
        console.log('📭 No user profile found in Firebase');
        return null;
      }
    } catch (error) {
      console.error('❌ Profile load error:', error);
      return null;
    }
  },

  /**
   * Save purchased keys to Firestore after successful payment
   * @param {string} userId - User ID
   * @param {Object} orderData - Order data with keys, games, amount, etc.
   * @returns {Promise<boolean>} Success status
   */
  async savePurchasedKeys(userId, orderData) {
    const firestoreDB = window.__firestoreDB || db;
    
    if (!firestoreDB || !userId || userId === 'guest') {
      console.log('⚠️ Firestore not available or guest user, skipping keys save');
      return false;
    }

    try {
      // Generate order ID if not provided
      const orderId = orderData.orderId || 'ORDER_' + Date.now();
      
      // Save to Firestore: users/{userId}/keys/{orderId}
      const keysRef = doc(firestoreDB, 'users', userId, 'keys', orderId);
      
      // ✅ Build keys data with only defined values
      const keysData = {
        orderId: orderId,
        keys: orderData.keys || [],
        games: orderData.games || [],
        amount: orderData.amount || 0,
        paymentMethod: orderData.paymentMethod || 'unknown',
        purchaseDate: orderData.purchaseDate || new Date(),
        status: orderData.status || 'completed',
        updatedAt: new Date()
      };

      await setDoc(keysRef, keysData);
      console.log('✅ Purchased keys saved to Firebase:', orderId);
      return true;
    } catch (error) {
      console.error('❌ Keys save error:', error);
      return false;
    }
  },

  /**
   * Load all purchased keys for user with real-time listener
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function to receive updates
   * @returns {Function} Unsubscribe function
   */
  async loadPurchasedKeys(userId, callback) {
    const firestoreDB = window.__firestoreDB || db;
    
    if (!firestoreDB || !userId || userId === 'guest') {
      console.log('⚠️ Firestore not available or guest user');
      callback([]);
      return () => {}; // Return empty unsubscribe function
    }

    try {
      // Reference to user's keys collection
      const keysCollectionRef = collection(firestoreDB, 'users', userId, 'keys');
      
      // Create query to get all keys ordered by purchase date
      const keysQuery = query(keysCollectionRef, orderBy('purchaseDate', 'desc'));
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(keysQuery, (snapshot) => {
        const orders = [];
        
        snapshot.forEach((doc) => {
          orders.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        console.log('✅ Keys loaded from Firebase (real-time):', orders.length, 'orders');
        callback(orders);
      }, (error) => {
        console.error('❌ Keys listener error:', error);
        callback([]);
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('❌ Failed to setup keys listener:', error);
      callback([]);
      return () => {};
    }
  },

  /**
   * Calculate membership tier based on total spent
   * @param {number} totalSpent - Total amount spent in VND
   * @returns {Object} Membership tier and discount
   */
  calculateMembership(totalSpent) {
    // Membership Tiers
    // Silver: 2M VND 
    // Gold: 5M VND
    // Platinum: 7M VND
    // Diamond: 10M VND
    
    // Default
    let tier = 'Member';
    let discount = 0;
    
    if (totalSpent >= 10000000) {
      tier = 'Diamond';
      discount = 0.10; // 10%
    } else if (totalSpent >= 7000000) {
      tier = 'Platinum';
      discount = 0.07; // 7%
    } else if (totalSpent >= 5000000) {
      tier = 'Gold';
      discount = 0.05; // 5%
    } else if (totalSpent >= 2000000) {
      tier = 'Silver';
      discount = 0.03; // 3%
    }
    
    return { tier, discount };
  },

  /**
   * Get current user's membership details
   * @param {string} userId
   * @returns {Promise<Object>} Membership details
   */
  async getUserMembership(userId) {
    // Strategy: Calculate total spent from actual order history to be 100% accurate
    // This fixes issues where the totalSpent field might not have been updated correctly
    const firestoreDB = window.__firestoreDB || db;
    let totalSpent = 0;
    
    if (firestoreDB && userId && userId !== 'guest') {
      try {
        const keysRef = collection(firestoreDB, 'users', userId, 'keys');
        const snapshot = await getDocs(keysRef);
        
        snapshot.forEach(doc => {
          const data = doc.data();
          // Sum up amount (handle string/number cases)
          const amount = Number(data.amount) || 0;
          totalSpent += amount;
        });
        
        console.log(`✅ Calculated total spent from ${snapshot.size} orders: ${totalSpent}`);
        
        // Optional: Self-heal the profile data (only update totalSpent field)
        if (totalSpent > 0) {
          try {
            const profileRef = doc(firestoreDB, 'users', userId, 'profile', 'data');
            await setDoc(profileRef, { 
              totalSpent: totalSpent,
              updatedAt: new Date()
            }, { merge: true });
            console.log('✅ Self-healed totalSpent in profile');
          } catch (e) {
            console.warn('Self-heal failed:', e.message);
          }
        }
        
      } catch (err) {
        console.error('Failed to calculate details from history:', err);
        // Fallback to profile data if history fetch fails
        const profile = await this.loadUserProfile(userId);
        totalSpent = Number(profile?.totalSpent) || 0;
      }
    }

    return {
       totalSpent,
       ...this.calculateMembership(totalSpent)
    };
  }
};

// Monkey-patch savePurchasedKeys to update totalSpent
// We do this to ensure we track spending without modifying the original function too much
// or we can just add a new method "updateUserSpending" and call it from keygen.html
// But modifying savePurchasedKeys is safer as it guarantees update on save.
const originalSaveKeys = window.firebaseCart.savePurchasedKeys;
window.firebaseCart.savePurchasedKeys = async function(userId, orderData) {
  // 1. Call original save
  const success = await originalSaveKeys.call(this, userId, orderData);
  
  if (success) {
    try {
      // 2. Load current profile
      const profile = await this.loadUserProfile(userId);
      // Ensure currentTotal is a number
      const currentTotal = Number(profile?.totalSpent) || 0;
      // Ensure orderAmount is a number
      const orderAmount = Number(orderData.amount) || 0;
      
      // 3. Calculate new total
      const newTotal = currentTotal + orderAmount;
      
      console.log(`🧮 Calculating New Total: ${currentTotal} + ${orderAmount} = ${newTotal}`);

      // 4. Update profile with new total
      // Use module-scope db variable directly
      const firestoreDB = window.__firestoreDB || db;
      
      if (firestoreDB) {
        // Use module-scope imports (doc, setDoc) directly
        try {
            const profileRef = doc(firestoreDB, 'users', userId, 'profile', 'data');
            
            await setDoc(profileRef, { 
              totalSpent: newTotal,
              updatedAt: new Date()
            }, { merge: true });
            
            console.log(`💰 Updated total spent in Firebase for ${userId}: ${currentTotal} -> ${newTotal}`);
        } catch (innerErr) {
             console.error("❌ Firestore update failed:", innerErr);
        }
      } else {
          console.error("❌ Firestore DB instance not found during profile update");
      }
    } catch (err) {
      console.error('Failed to update user spending stats:', err);
    }
  }
  
  return success;
};
