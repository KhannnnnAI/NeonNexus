
// Authentication Logic (LOCAL VERSION - Firebase Compat SDK)
// Uses firebase-app-compat, firebase-auth-compat, firebase-firestore-compat
// loaded via <script> tags in HTML (no ES modules needed)

// === FIREBASE COMPAT SHIM ===
// Maps modular Firebase API calls to Compat SDK globals so the rest of the code stays unchanged.
var initializeApp = function(config) { return firebase.initializeApp(config); };
var getApp = function() { return firebase.app(); };
var getApps = function() { return firebase.apps; };
var getAuth = function() { return firebase.auth(); };
var getFirestore = function() { return firebase.firestore(); };
var signInWithPopup = function(authInst, provider) { return authInst.signInWithPopup(provider); };
var signOut = function(authInst) { return authInst.signOut(); };
var onAuthStateChanged = function(authInst, cb) { return authInst.onAuthStateChanged(cb); };
var signInAnonymously = function(authInst) { return authInst.signInAnonymously(); };

// Firestore compat helpers - translate modular path segments to compat chained calls
var doc = function(dbRef) {
  var segments = Array.prototype.slice.call(arguments, 1);
  var ref = dbRef;
  for (var i = 0; i < segments.length; i++) {
    ref = (i % 2 === 0) ? ref.collection(segments[i]) : ref.doc(segments[i]);
  }
  return ref;
};
var setDoc = function(ref, data, options) { return ref.set(data, options || {}); };
var getDoc = async function(ref) {
  var snap = await ref.get();
  // Wrap compat snapshot to provide exists() as method (modular API uses method, compat uses property)
  return { exists: function() { return snap.exists; }, data: function() { return snap.data(); }, id: snap.id };
};
var collection = function(dbRef) {
  var segments = Array.prototype.slice.call(arguments, 1);
  var ref = dbRef;
  for (var i = 0; i < segments.length; i++) {
    ref = (i % 2 === 0) ? ref.collection(segments[i]) : ref.doc(segments[i]);
  }
  return ref;
};
var getDocs = function(ref) { return ref.get(); };
var onSnapshot = function(ref, cb, errCb) { return ref.onSnapshot(cb, errCb); };
var query = function(ref) { return ref; };
var orderBy = function() { return null; };

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
var auth = null;
var db = null;
var googleProvider = null;
const FIREBASE_DEBUG = false;
const MEMBERSHIP_CACHE_TTL_MS = 60 * 1000;
const CART_WRITE_DEDUPE_WINDOW_MS = 1500;
const membershipCache = new Map();
const cartWriteSignatures = new Map();
var authStateUnsubscribe = null;

var resolveAuthReady = () => {};
var authReadyResolved = false;
const authReadyPromise = new Promise((resolve) => {
  resolveAuthReady = resolve;
});

window.__firebaseAuthReady = authReadyPromise;
window.waitForFirebaseAuth = function waitForFirebaseAuth(timeoutMs = 8000) {
  return Promise.race([
    authReadyPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
};

function resolveAuthReadyOnce(user = null) {
  if (authReadyResolved) return;
  authReadyResolved = true;
  resolveAuthReady(user);
}

let fbInitAttempts = 0;
// Bắt đầu chạy vòng lặp khởi tạo an toàn
async function startFirebaseSafe() {
  // 1. Tự động kiểm tra và chèn thư viện Firebase nếu trang web bị thiếu thẻ script
  const loadScript = (url) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  try {
    if (typeof window.firebase === 'undefined') {
      console.log("Đang tự động tải Firebase Core...");
      await loadScript("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
    }
    if (typeof window.firebase.auth !== 'function') {
      console.log("Đang tự động tải Firebase Auth...");
      await loadScript("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js");
    }
    if (typeof window.firebase.firestore !== 'function') {
      console.log("Đang tự động tải Firebase Firestore...");
      await loadScript("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js");
    }
  } catch (e) {
    console.error("Lỗi mạng: Không thể tải Firebase từ máy chủ Google.", e);
    resolveAuthReadyOnce(null);
    return;
  }

  // 2. Khởi tạo Firebase (Lúc này ĐẢM BẢO 100% thư viện đã tải xong)
  try {
    console.log("Bắt đầu khởi tạo Firebase...");
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      throw new Error('Thiếu cấu hình firebaseConfig');
    }

    const app = window.firebase.apps.length > 0 ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig);
    auth = window.firebase.auth();
    googleProvider = new window.firebase.auth.GoogleAuthProvider();
    db = window.firebase.firestore();

    // Xuất ra toàn cục để file keygen.html có thể lưu key
    window.__firebaseAuth = auth;
    window.__firestoreDB = db;

    console.log("🔥 Firebase đã khởi tạo thành công 100%!");
    
    if (typeof checkAuthStatus === 'function') {
       checkAuthStatus({ ignoreSteamCache: (typeof isDashboardContext === 'function' && isDashboardContext()) });
    }
    
  } catch (error) {
    console.error("Lỗi trong quá trình khởi tạo Firebase:", error);
    resolveAuthReadyOnce(null);
  }
}

// Chạy hàm khởi tạo an toàn
startFirebaseSafe();

// --- DOM ELEMENTS ---
var loginBtn = document.getElementById("login-btn");
var userDropdown = document.getElementById("user-dropdown");
var logoutBtn = document.getElementById("logout-btn");
var loginModal = document.getElementById("login-modal");
var closeLoginBtn = document.getElementById("close-login-btn");
var googleLoginBtn = document.getElementById("google-login-btn");
var steamLoginBtn = document.getElementById("steam-login-btn");
var backdrop = document.querySelector(".login-modal-backdrop");
var guestLoginBtn = document.getElementById("guest-login-btn");

function refreshDOM() {
  loginBtn = document.getElementById("login-btn");
  userDropdown = document.getElementById("user-dropdown");
  logoutBtn = document.getElementById("logout-btn");
  loginModal = document.getElementById("login-modal");
  closeLoginBtn = document.getElementById("close-login-btn");
  googleLoginBtn = document.getElementById("google-login-btn");
  steamLoginBtn = document.getElementById("steam-login-btn");
  backdrop = document.querySelector(".login-modal-backdrop");
  guestLoginBtn = document.getElementById("guest-login-btn");
  
  // Debug if elements not found
  if (!loginBtn) console.warn("auth.js: login-btn not found in current DOM");
}

// --- STATE MANAGER ---
var currentUser = null;
window.__dashboardCurrentUser = null;
var DASHBOARD_SESSION_KEY = "dashboard_auth_session_v1";

function getProviderKey(source) {
  const providerId = String(
    source?.provider ||
      source?.providerId ||
      (Array.isArray(source?.providerData) && source.providerData[0]?.providerId) ||
      "",
  )
    .trim()
    .toLowerCase();

  if (providerId === "google.com") return "google";
  if (providerId === "password") return "email";
  if (providerId === "anonymous") return "anonymous";
  if (providerId === "guest") return "guest";
  return providerId;
}

function serializeDashboardUser(source) {
  if (!source || typeof source !== "object") return null;

  const email = String(source.email || "").trim();
  const displayName = String(source.displayName || "").trim();
  const photoURL = String(source.photoURL || "").trim();
  const rawUid = String(source.uid || "").trim();
  const profileUrl = String(source.profileUrl || "").trim();
  const steamIdMatch = email.match(/^(\d{17})@steam\.com$/i);
  const steamId = String(source.steamId || steamIdMatch?.[1] || "").trim();
  const provider = steamId ? "steam" : getProviderKey(source);
  const explicitAuthUid = String(
    source.authUid || source.firebaseUid || source.anonymousUid || "",
  ).trim();

  let uid = rawUid;
  let authUid = explicitAuthUid;

  if (provider === "steam") {
    uid = steamId || rawUid;
    if (!authUid && rawUid && rawUid !== steamId && !/^\d{17}$/.test(rawUid)) {
      authUid = rawUid;
    }
  }

  return {
    uid,
    email,
    displayName,
    photoURL,
    provider,
    steamId,
    authUid,
    profileUrl,
    isGuest: !!source.isGuest,
    cachedAt: Date.now(),
  };
}

function getSteamStorageIds(source) {
  if (!source || typeof source !== "object") {
    return { canonicalId: "", authUid: "" };
  }

  const steamId = String(source.steamId || "").trim();
  const uid = String(source.uid || "").trim();
  const authUid = String(source.authUid || "").trim();
  const currentAuthUid =
    auth && auth.currentUser && auth.currentUser.uid
      ? String(auth.currentUser.uid).trim()
      : "";

  const canonicalId = steamId || (/^\d{17}$/.test(uid) ? uid : "");
  const resolvedAuthUid =
    authUid ||
    (currentAuthUid && currentAuthUid !== canonicalId ? currentAuthUid : "") ||
    (!/^\d{17}$/.test(uid) ? uid : "");

  return {
    canonicalId,
    authUid: resolvedAuthUid,
  };
}

function getStoredDashboardSession() {
  try {
    const raw = localStorage.getItem(DASHBOARD_SESSION_KEY);
    if (!raw) return getStoredSteamDashboardUser();
    return JSON.parse(raw);
  } catch (error) {
 console.warn("Failed to parse stored dashboard session:", error);
    return getStoredSteamDashboardUser();
  }
}

function persistDashboardSession(user) {
  const sessionUser = serializeDashboardUser(user);
  if (!sessionUser) return;

  try {
    localStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(sessionUser));
  } catch (error) {
 console.warn("Failed to persist dashboard session:", error);
  }
}

function clearDashboardSession() {
  try {
    localStorage.removeItem(DASHBOARD_SESSION_KEY);
  } catch (error) {
 console.warn("Failed to clear dashboard session:", error);
  }
}

function getStoredSteamDashboardUser() {
  try {
    const raw = localStorage.getItem("steam_user");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
 console.warn("Failed to parse stored Steam session:", error);
    return null;
  }
}

function normalizeDashboardSessionAccount(source) {
  if (!source || typeof source !== "object") return "";

  const provider = String(source.provider || "").trim().toLowerCase();
  const email = String(source.email || "").trim();
  const displayName = String(source.displayName || "").trim();
  const uid = String(source.uid || "").trim();
  const steamIdMatch = email.match(/^(\d{17})@steam\.com$/i);
  const steamId = String(source.steamId || steamIdMatch?.[1] || "").trim();

  if (provider === "steam" || steamId) {
    return steamId || displayName || email;
  }

  if (email) return email;
  if (displayName) return displayName;
  if (provider && uid) return uid;

  return "";
}

function resolveDashboardSessionAccount(preferredUser = null) {
  const firebaseUser = auth && auth.currentUser
    ? {
        uid: auth.currentUser.uid || "",
        email: auth.currentUser.email || "",
        displayName: auth.currentUser.displayName || "",
        provider:
          auth.currentUser.providerData && auth.currentUser.providerData[0]
            ? auth.currentUser.providerData[0].providerId || ""
            : "",
      }
    : null;

  const candidates = [
    preferredUser,
    currentUser,
    window.__dashboardCurrentUser,
    getStoredSteamDashboardUser(),
    firebaseUser,
  ];

  for (const candidate of candidates) {
    const account = normalizeDashboardSessionAccount(candidate);
    if (account) return account;
  }

  return "";
}

window.__dashboardResolveSessionAccount = resolveDashboardSessionAccount;

function getDashboardI18nText(path, fallback, params = {}) {
  const api = window.dashboardI18n;
  if (api && typeof api.t === "function") {
    return api.t(path, params, fallback);
  }
  return fallback;
}

function renderLoggedOutButton() {
  if (!loginBtn) return;

  loginBtn.innerHTML = `
      <i data-lucide="user" class="login-icon"></i>
      <span class="login-text">LOGIN</span>
    `;
  loginBtn.classList.remove("logged-in");
  closeUserDropdown();

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    lucide.createIcons();
  }
}

async function hydrateDashboardSessionFromCache() {
  const cachedUser = getStoredDashboardSession();
  if (!cachedUser) return;

 console.log("Hydrating dashboard session from local cache");
  await updateUI(cachedUser, {
    hydrateOnly: true,
    persist: false,
    dispatch: true,
    syncLegacySteamStorage: false,
    saveSteamProfile: false,
  });
}

async function restoreStoredSteamSession() {
  const cachedSteamUser = getStoredSteamDashboardUser();
 console.log("Checking for saved Steam session...", !!cachedSteamUser);

  if (!cachedSteamUser) {
 console.log("No saved Steam session found");
    return;
  }

  try {
    const userData = serializeDashboardUser(cachedSteamUser) || cachedSteamUser;
 console.log("Restoring Steam session:", userData.displayName || userData.steamId || "Steam");

    if (auth && !auth.currentUser) {
      try {
 console.log("Creating anonymous Firebase session for restored Steam user...");
        const credential = await signInAnonymously(auth);
        if (credential?.user?.uid) {
          userData.authUid = credential.user.uid;
        }
 console.log("Anonymous auth session created for Steam user");
      } catch (authError) {
 console.error("Failed to create anonymous session:", authError);
      }
    } else if (auth?.currentUser?.uid) {
      userData.authUid = auth.currentUser.uid;
    }

    if (userData.steamId) {
      userData.uid = userData.steamId;
    }

    // Show cached account immediately, then try to refresh from Firestore.
    await updateUI(userData, {
      hydrateOnly: true,
      persist: true,
      dispatch: true,
      syncLegacySteamStorage: true,
      saveSteamProfile: true,
    });

    const { canonicalId, authUid } = getSteamStorageIds(userData);
    if (canonicalId && window.firebaseCart && window.firebaseCart.isAvailable()) {
      const applyFirebaseProfile = async (firebaseProfile) => {
        const refreshedUser = serializeDashboardUser({
          uid: firebaseProfile.steamId || canonicalId,
          authUid:
            firebaseProfile.authUid ||
            authUid ||
            auth?.currentUser?.uid ||
            "",
          steamId: firebaseProfile.steamId || canonicalId || userData.steamId || "",
          displayName: firebaseProfile.displayName || userData.displayName || "",
          photoURL: firebaseProfile.photoURL || userData.photoURL || "",
          email: firebaseProfile.email || userData.email || "",
          provider: firebaseProfile.provider || "steam",
          profileUrl: firebaseProfile.profileUrl || userData.profileUrl || "",
        });
 console.log("Steam session refreshed from Firebase");
        await updateUI(refreshedUser, {
          persist: true,
          // Same Steam account is already active; avoid duplicate login event/cart reload.
          dispatch: false,
          syncLegacySteamStorage: true,
          saveSteamProfile: true,
        });
      };

 console.log("Attempting to load fresh Steam profile from Firebase...");
      const firebaseProfile = await window.firebaseCart.loadUserProfile(canonicalId, {
        fallbackAuthUid: authUid,
      });
      if (firebaseProfile) {
        await applyFirebaseProfile(firebaseProfile);
        return;
      }

 console.warn("No Steam profile found on first read, syncing cached profile and retrying...");
      try {
        await window.firebaseCart.saveUserProfile(canonicalId, userData);
        const retriedProfile = await window.firebaseCart.loadUserProfile(canonicalId, {
          fallbackAuthUid: authUid,
        });
        if (retriedProfile) {
          await applyFirebaseProfile(retriedProfile);
          return;
        }
      } catch (retryError) {
 console.warn("Steam profile retry sync failed:", retryError);
      }
    }

 console.log("Steam session restored from local cache");
  } catch (error) {
 console.error("Failed to restore Steam session:", error);
    localStorage.removeItem("steam_user");
    clearDashboardSession();
  }
}

function isDashboardContext() {
  const pathname = String(window.location.pathname || "").toLowerCase();
  return pathname.includes("dashboard");
}

// --- EVENT LISTENERS ---
async function initAuth() {
  refreshDOM();
  const dashboardContext = isDashboardContext();

  setupEventListeners();
  if (!dashboardContext) {
    await hydrateDashboardSessionFromCache();
    void restoreStoredSteamSession();
  } else {
    // Dashboard requires explicit support account login.
    localStorage.removeItem("steam_user");
  }

  // Check Firebase auth status (for Google login)
  checkAuthStatus({ ignoreSteamCache: dashboardContext });
  window.addEventListener("storage", async (event) => {
    if (event.key !== DASHBOARD_SESSION_KEY && event.key !== "steam_user") return;

    const nextSession = getStoredDashboardSession();
    if (nextSession) {
      await updateUI(nextSession, {
        hydrateOnly: true,
        persist: false,
        dispatch: true,
        syncLegacySteamStorage: false,
        saveSteamProfile: false,
      });
      return;
    }

    await updateUI(null, {
      persist: false,
      dispatch: true,
      syncLegacySteamStorage: false,
      saveSteamProfile: false,
    });
  });

  window.addEventListener("dashboard-language-change", () => {
    if (!currentUser) {
      renderLoggedOutButton();
      return;
    }

    const dropdownAvatar = document.getElementById("user-dropdown-avatar");
    if (dropdownAvatar) {
      dropdownAvatar.alt = getDashboardI18nText("common.auth.userAlt", "Avatar");
    }
});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuth);
} else {
  initAuth();
}



function setupEventListeners() {
  // Login button - opens modal OR toggles dropdown
  if (loginBtn) {
    loginBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentUser) {
        if (userDropdown) {
          toggleUserDropdown();
        } else {
          openModal();
        }
        return;
      } else {
        openModal();
      }
    });
  }

  // Logout button in dropdown
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleLogout();
    });
  }

  // Close dropdown when clicking outside
  if (!window.__authDocumentClickBound) {
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".user-section")) {
        closeUserDropdown();
      }
    });
    window.__authDocumentClickBound = true;
  }

  // Modal Toggles
  if (closeLoginBtn) {
    closeLoginBtn.addEventListener("click", closeModal);
  }
  if (backdrop) {
    backdrop.addEventListener("click", closeModal);
  }

  // Login Actions
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", handleGoogleLogin);
  }
  if (steamLoginBtn) {
    steamLoginBtn.addEventListener("click", handleSteamLogin);
  }
  
  // Guest Login Action
  if (guestLoginBtn) {
    guestLoginBtn.addEventListener("click", handleGuestLogin);
  }
  
  // Specific check for login-required guest buttons (if any)
  const requiredGuestBtn = document.getElementById("login-required-guest-btn");
  if (requiredGuestBtn) {
    requiredGuestBtn.addEventListener("click", handleGuestLogin);
  }
}

// --- UI FUNCTIONS ---
function toggleUserDropdown() {
  if (!userDropdown) return;
  const isVisible = userDropdown.style.display === "block";
  userDropdown.style.display = isVisible ? "none" : "block";
}

function closeUserDropdown() {
  if (userDropdown) {
    userDropdown.style.display = "none";
  }
}

function openModal() {
  if (!loginModal) return;
  loginModal.style.display = "flex";
  // Animation/Transition
  setTimeout(() => {
    loginModal.classList.add("active");
  }, 10);
}

function closeModal() {
  if (!loginModal) return;
  loginModal.classList.remove("active");
  setTimeout(() => {
    loginModal.style.display = "none";
  }, 300);
}

async function updateUI(user, options = {}) {
  const settings = {
    hydrateOnly: false,
    persist: true,
    dispatch: true,
    syncLegacySteamStorage: true,
    saveSteamProfile: true,
    ...options,
  };

  const nextUser = user ? serializeDashboardUser(user) || user : null;

  if (nextUser) {
    if (nextUser.provider === "steam") {
      const uidAsText = String(nextUser.uid || "");
      if (!nextUser.steamId && /^\d{17}$/.test(uidAsText)) {
        nextUser.steamId = uidAsText;
      }

      if (!settings.hydrateOnly) {
        if (auth && !auth.currentUser) {
          try {
            const credential = await signInAnonymously(auth);
            if (credential?.user?.uid) {
              nextUser.authUid = credential.user.uid;
            }
          } catch (authError) {
 console.warn("Steam anonymous auth failed:", authError);
          }
        } else if (auth?.currentUser?.uid) {
          nextUser.authUid = auth.currentUser.uid;
        }
      } else if (!nextUser.authUid && auth?.currentUser?.uid) {
        nextUser.authUid = auth.currentUser.uid;
      }

      if (nextUser.steamId) {
        nextUser.uid = nextUser.steamId;
      }
    }

    currentUser = nextUser;
    window.__dashboardCurrentUser = nextUser;

    if (!loginBtn) loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
      let avatarUrl = nextUser.photoURL || "https://ui-avatars.com/api/?name=User";
      if (nextUser.isGuest) {
        if (typeof window.url === 'function') {
           avatarUrl = window.url('Image/profile.png');
        } else {
           avatarUrl = (window.location.pathname.includes('/html/') || window.location.pathname.includes('/dashboard/')) 
             ? "../Image/profile.png" 
             : "Image/profile.png";
        }
      }
      loginBtn.innerHTML = `
        <span class="login-profile-info">
          <img src="${avatarUrl}" class="user-avatar-display" ${nextUser.isGuest ? 'style="background-color: white;"' : ''} alt="${getDashboardI18nText("common.auth.userAlt", "Avatar")}">
          <span class="user-name-display">${nextUser.displayName || getDashboardI18nText("common.auth.defaultUserName", "Gamer")}</span>
        </span>
      `;
      loginBtn.classList.add("logged-in");
    }

    const dropdownAvatar = document.getElementById("user-dropdown-avatar");
    const dropdownName = document.getElementById("user-dropdown-name");
    if (dropdownAvatar) {
      let avatarUrl = nextUser.photoURL || "https://ui-avatars.com/api/?name=User";
      if (nextUser.isGuest) {
        if (typeof window.url === 'function') {
           avatarUrl = window.url('Image/profile.png');
        } else {
           avatarUrl = (window.location.pathname.includes('/html/') || window.location.pathname.includes('/dashboard/')) 
             ? "../Image/profile.png" 
             : "Image/profile.png";
        }
        dropdownAvatar.style.backgroundColor = "white";
        dropdownAvatar.style.objectFit = "contain";
        dropdownAvatar.style.padding = "4px";
      } else {
        dropdownAvatar.style.backgroundColor = "transparent";
        dropdownAvatar.style.objectFit = "cover";
        dropdownAvatar.style.padding = "0";
      }
      dropdownAvatar.src = avatarUrl;
      dropdownAvatar.alt = getDashboardI18nText("common.auth.userAlt", "Avatar");
    }
    if (dropdownName) {
      dropdownName.textContent =
        nextUser.displayName || getDashboardI18nText("common.auth.defaultUserName", "Gamer");
    }

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      lucide.createIcons();
    }

    const userId =
      nextUser.provider === "steam"
        ? nextUser.steamId || nextUser.uid || "guest"
        : nextUser.uid || "guest";

    if (settings.persist) {
      persistDashboardSession(nextUser);
    }

    if (nextUser.provider === "steam" && settings.syncLegacySteamStorage) {
      localStorage.setItem("steam_user", JSON.stringify(nextUser));
 console.log("Steam session saved to localStorage");
    }

    if (
      nextUser.provider === "steam" &&
      settings.saveSteamProfile &&
      window.firebaseCart &&
      window.firebaseCart.isAvailable()
    ) {
      try {
        await window.firebaseCart.saveUserProfile(
          nextUser.steamId || userId,
          nextUser,
        );
      } catch (err) {
 console.warn("Failed to save Steam profile to Firebase:", err);
      }
    }

    if (settings.dispatch) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("user-login", {
            detail: {
              user: nextUser,
              userId,
              sessionAccount: resolveDashboardSessionAccount(nextUser),
            },
          }),
        );
      }, 0);
    }
  } else {
    currentUser = null;
    window.__dashboardCurrentUser = null;

    if (settings.syncLegacySteamStorage) {
      localStorage.removeItem("steam_user");
    }
    if (settings.persist) {
      clearDashboardSession();
    }

    renderLoggedOutButton();

    if (settings.dispatch) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("user-logout"));
      }, 0);
    }
  }
}


// --- AUTH HANDLERS ---

async function handleGoogleLogin() {
  if (!auth || !googleProvider) {
    alert("Firebase is not ready yet. Please wait and try again.");
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
        showNotification("You cancelled the login", "warning");
    } else if (error.code === "auth/cancelled-popup-request") {
        showNotification("Cancelled: Another login window is already open.", "warning");
    } else if (error.code === "auth/unauthorized-domain") {
      showNotification("This domain is not authorized for Google login. Add localhost to Firebase Console > Authentication > Settings > Authorized domains.", "error");
    } else if (
      error.code === "auth/operation-not-supported-in-this-environment"
    ) {
      showNotification("Google login requires http/https. Please open via http://localhost:5000", "error");
    } else {
      showNotification(`Login error: ${error.message}`, "error");
    }
  }
}

function handleSteamLogin() {
  // Steam always authenticates via Firebase production server 
  // (Steam OpenID callback is registered there)
  const steamAuthUrl = "https://nenonexus-digital-game-store.web.app/auth/steam";

  const width = 800;
  const height = 600;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;

  const popWin = window.open(
    steamAuthUrl,
    "SteamLogin",
    `width=${width},height=${height},left=${left},top=${top}`,
  );
  
  // Safety check if popup was blocked
  if (!popWin || popWin.closed || typeof popWin.closed == 'undefined') { 
      showNotification("Login popup was blocked. Please allow popups.", "error");
      return;
  }

  let finished = false;
  let timer = null;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    window.removeEventListener("message", onMessage);
  };

  const onMessage = (event) => {
    // Only accept messages from the Firebase production server
    if (event.origin !== "https://nenonexus-digital-game-store.web.app") return;

    if (!event.data || event.data.type !== "STEAM_LOGIN_SUCCESS") return;
    const steamUser = event.data.user;

    const user = {
      displayName: steamUser.displayName,
      photoURL: steamUser.photoURL,
      steamId: steamUser.steamId,
      uid: steamUser.steamId,
      authUid: "",
      email: `${steamUser.steamId}@steam.com`,
      provider: "steam",
    };

    console.log("Steam Login Success:", user);
    cleanup();
    updateUI(user);
    closeModal();
    showNotification(`Welcome, ${user.displayName}!`, "success");
  };

  timer = setInterval(() => {
    if (!popWin.closed) return;
    console.log("Steam popup closed by user");
    cleanup();
  }, 500);

  setTimeout(cleanup, 2 * 60 * 1000);
  window.addEventListener("message", onMessage);
}

async function handleGuestLogin() {
  console.log("Processing Guest Login...");
  
  // Check if we already have a guest ID in local storage
  let guestId = localStorage.getItem("guest_id");
  if (!guestId) {
    guestId = "guest_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("guest_id", guestId);
  }

  const guestUser = {
    uid: guestId,
    displayName: "Guest Gamer",
    photoURL: "Image/profile.png",
    email: `${guestId}@guest.local`,
    provider: "guest",
    authUid: "",
    isGuest: true
  };

  console.log("Guest User Created:", guestUser);
  
  // Update UI and persist
  await updateUI(guestUser, {
    persist: true,
    dispatch: true,
    syncLegacySteamStorage: false
  });
  
  closeModal();
  showNotification("Logged in as Guest", "success");
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
        showNotification("Logged out successfully", "success");
      })
      .catch((error) => {
 console.error("Sign out error", error);
        // Force logout anyway
        updateUI(null);
        showNotification("Logged out", "info");
      });
  } else {
    // Steam or mock logout
 console.log("Logging out (Steam/Mock)");
    updateUI(null);
    showNotification("Logged out successfully", "success");
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
        <div class="notification-title">${type === 'info' ? 'Information' : (type === 'error' ? 'Error' : (type === 'warning' ? 'Warning' : 'Success'))}</div>
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

window.showNotification = showNotification;

function checkAuthStatus(options = {}) {
  const settings = {
    ignoreSteamCache: false,
    ...options,
  };

  if (!auth) {
    resolveAuthReadyOnce(null);
    return;
  }

  if (typeof authStateUnsubscribe === "function") {
    authStateUnsubscribe();
    authStateUnsubscribe = null;
  }

  authStateUnsubscribe = onAuthStateChanged(auth, (user) => {
    resolveAuthReadyOnce(user || null);

    // Check if user is already logged in via Steam or Dashboard (Guest/Mock)
    const savedSteamUser = localStorage.getItem('steam_user');
    const savedDashboardSession = localStorage.getItem(DASHBOARD_SESSION_KEY);

    if ((savedSteamUser || savedDashboardSession) && !settings.ignoreSteamCache) {
      // Steam user detected - allow Firebase auth update for proper authentication
      console.log('Steam session detected, allowing Firebase auth update');
      // Don't skip - let Steam user get proper Firebase session
    }

    // On dashboard pages, anonymous Steam session should not block support login.
    if (settings.ignoreSteamCache && user && user.isAnonymous) {
      signOut(auth)
        .catch((error) => {
 console.warn('Failed to clear anonymous dashboard session:', error);
        })
        .finally(() => {
          updateUI(null, {
            syncLegacySteamStorage: false,
          });
        });
      return;
    }

    // Only update UI for authenticated users (Google, Steam, or logged out)
    if (user) {
      // Real authenticated user (Google or Steam)
      
      // CRITICAL: If we are currently a Guest, don't let an anonymous or background Firebase session 
      // overwrite our local Guest session unless it's a real non-anonymous user (Google).
      const savedDash = localStorage.getItem(DASHBOARD_SESSION_KEY);
      let isGuest = false;
      if (savedDash) {
        try {
          const parsed = JSON.parse(savedDash);
          if (parsed && parsed.provider === 'guest') {
            isGuest = true;
          }
        } catch(e) {}
      }

      if (isGuest && user.isAnonymous) {
        console.log('Preserving Guest session over anonymous Firebase session');
        return;
      }

      updateUI(user);
    } else if (!user) {
      // User logged out
      const savedDash = localStorage.getItem(DASHBOARD_SESSION_KEY);
      let isGuest = false;
      if (savedDash) {
        try {
          const parsed = JSON.parse(savedDash);
          if (parsed && parsed.provider === 'guest') {
            isGuest = true;
          }
        } catch(e) {}
      }
      
      const savedSteamUser = localStorage.getItem('steam_user');
      
      // CRITICAL: Robust Guest session preservation
      // We ONLY wipe the UI if there is NO guest session AND no steam user AND no firebase user.
      if (!isGuest && !savedSteamUser) {
        console.log('auth.js: No user session found, rendering logged out state');
        updateUI(null);
      } else if (isGuest) {
        console.log('auth.js: Maintaining existing Guest session despite Firebase user=null');
        // Re-sync guest UI just in case it was missed
        hydrateDashboardSessionFromCache();
      }
    } else if (FIREBASE_DEBUG) {
      // Debug mode - show all users including anonymous
      console.log('User detected:', user);
      updateUI(user);
    }
  });
}

// === FIREBASE CART FUNCTIONS ===
// Helper: check if userId belongs to a Guest user
function _isGuestId(userId) {
  return !userId || userId === 'guest' || String(userId).startsWith('guest_');
}

// Helper: get correct Firestore document ID based on user provider
function _getFirestoreUserId(userId, currentUser = null) {
  // Guest users - not applicable for Firestore
  if (_isGuestId(userId)) {
    return null;
  }

  // If no current user, fallback to userId
  if (!currentUser) {
    return userId;
  }

  // Check if this is a Steam user
  const isSteamUser = currentUser.provider === 'steam' || 
    (currentUser.steamId && currentUser.steamId !== '') ||
    (currentUser.email && currentUser.email.match(/^\d{17}@steam\.com$/i));
  
  if (isSteamUser) {
    // For Steam users, use steamId as the document ID
    return currentUser.steamId || userId;
  }
  
  // For Google users, use Firebase auth UID
  return currentUser.uid || userId;
}

// Export cart functions for use in index.js
window.firebaseCart = {
  /**
   * Save cart to Firestore (minimal data: dealID + quantity only)
   * @param {string} userId - User ID
   * @param {Array} items - Cart items with full details
   * @returns {Promise<boolean>} Success status
   */
  async saveCart(userId, items) {
    const firestoreDB = window.__firestoreDB || db;

    // Guest users: save to localStorage only
    if (_isGuestId(userId)) {
      console.log("Guest user - saving cart to localStorage");
      try {
        const cartData = {
          items: items.map(item => ({
            dealID: item.dealID,
            quantity: item.quantity || 1,
            price: item.price,
            title: item.title
          })),
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('guest_cart', JSON.stringify(cartData));
        return true;
      } catch(e) {
        console.warn('Failed to save guest cart to localStorage:', e);
        return false;
      }
    }

    if (!firestoreDB) {
      console.log("Firestore not available");
      return false;
    }

    // Get correct Firestore document ID based on provider
    const firestoreUserId = _getFirestoreUserId(userId, currentUser);
    
    if (!firestoreUserId) {
      console.warn("No valid Firestore user ID found, cannot save cart to Firestore");
      return false;
    }

    try {
      // Use the correct document ID for the user
      const cartRef = doc(firestoreDB, "users", firestoreUserId, "cart", "data");
      
      // TẠO PAYLOAD ĐÚNG CHUẨN CHO FIRESTORE RULES
      const cartData = {
        items: items.map(item => ({
          dealID: item.dealID,
          quantity: item.quantity || 1,
          price: item.price,
          title: item.title
        })),
        originalUserId: userId, // Keep original userId for reference
        steamId: firestoreUserId, // <--- ĐIỂM CHỐT LÀ ĐÂY: Gửi kèm steamId để Rule nhận diện đúng chủ!
        updatedAt: new Date()
      };
      
      await setDoc(cartRef, cartData, { merge: true });
      console.log(`Cart saved to Firestore for ${currentUser?.provider || 'unknown'} user:`, firestoreUserId);
      return true;
    } catch (error) {
      console.error("Failed to save cart to Firestore:", error);
      return false;
    }
  },

  /**
   * Load purchased keys for a user
   * @param {string} userId - User ID
   * @param {Function} callback - Callback function with (keys) parameter
   * @returns {Function} Unsubscribe function
   */
  loadPurchasedKeys(userId, callback) {
    const firestoreDB = window.__firestoreDB || db;

    // Guest users: load from localStorage
    if (_isGuestId(userId)) {
      console.log("Guest user - loading keys from localStorage");
      try {
        const guestKeys = JSON.parse(localStorage.getItem('guest_purchased_keys') || '[]');
        callback(guestKeys);
      } catch(e) {
        console.warn('Failed to load guest keys from localStorage:', e);
        callback([]);
      }
      return () => {}; // Dummy unsubscribe function
    }

    if (!firestoreDB) {
      console.log("Firestore not available");
      callback([]);
      return () => {};
    }

    try {
      const candidateIds = [String(userId).trim()];
      const authUid =
        auth && auth.currentUser && auth.currentUser.uid
          ? String(auth.currentUser.uid).trim()
          : "";
      if (authUid && !candidateIds.includes(authUid)) {
        candidateIds.push(authUid);
      }

      const sourceOrders = new Map();
      const unsubscribers = [];
      const normalizeOrderDoc = (docSnap) => {
        const data = docSnap.data() || {};
        const normalized = {
          id: docSnap.id,
          ...data,
        };

        if (!normalized.orderId) {
          normalized.orderId = docSnap.id;
        }

        if (!normalized.purchaseDate) {
          normalized.purchaseDate = normalized.createdAt || normalized.updatedAt || null;
        }

        if (!Array.isArray(normalized.keys)) {
          if (Array.isArray(normalized.keyCodes)) {
            normalized.keys = normalized.keyCodes;
          } else if (Array.isArray(normalized.codes)) {
            normalized.keys = normalized.codes;
          } else {
            normalized.keys = [];
          }
        }

        if (!Array.isArray(normalized.games)) {
          if (Array.isArray(normalized.items)) {
            normalized.games = normalized.items.map((item) => {
              if (!item) return "Unknown Game";
              if (typeof item === "string") return item;
              return (
                item.title ||
                item.name ||
                item.gameName ||
                item.id ||
                "Unknown Game"
              );
            });
          } else if (Array.isArray(normalized.titles)) {
            normalized.games = normalized.titles;
          } else {
            normalized.games = [];
          }
        }

        return normalized;
      };

      const emitMergedOrders = () => {
        const merged = new Map();

        // Prioritize the first candidate (canonical userId, usually SteamID)
        for (const candidateId of candidateIds) {
          const orders = sourceOrders.get(candidateId) || [];
          for (const order of orders) {
            if (!merged.has(order.id)) {
              merged.set(order.id, order);
            }
          }
        }

        const mergedOrders = Array.from(merged.values()).sort((a, b) => {
          const dateA = a.purchaseDate?.toDate ? a.purchaseDate.toDate().getTime() : new Date(a.purchaseDate || 0).getTime();
          const dateB = b.purchaseDate?.toDate ? b.purchaseDate.toDate().getTime() : new Date(b.purchaseDate || 0).getTime();
          return dateB - dateA;
        });

        callback(mergedOrders);
      };

      for (const candidateId of candidateIds) {
        const keysCollectionRef = collection(firestoreDB, "users", candidateId, "keys");

        const unsubscribe = onSnapshot(
          keysCollectionRef,
          (snapshot) => {
            const orders = [];
            snapshot.forEach((docSnap) => {
              orders.push(normalizeOrderDoc(docSnap));
            });
            sourceOrders.set(candidateId, orders);
            emitMergedOrders();
          },
          (error) => {
console.error("Keys listener error:", error);
            sourceOrders.set(candidateId, []);
            emitMergedOrders();
          },
        );

        unsubscribers.push(unsubscribe);
      }

      return () => {
        unsubscribers.forEach((unsubscribe) => {
          if (typeof unsubscribe === "function") unsubscribe();
        });
      };
    } catch (error) {
console.error("Failed to setup keys listener:", error);
      callback([]);
      return () => {};
    }
  },

  /**
   * Save user profile to Firestore
   * @param {string} userId - User ID
   * @param {Object} profileData - Profile data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveUserProfile(userId, profileData) {
    const firestoreDB = window.__firestoreDB || db;

    if (_isGuestId(userId)) {
      console.log("Guest user - saving profile to localStorage");
      try {
        const existingProfile = JSON.parse(localStorage.getItem('guest_profile') || '{}');
        const updatedProfile = { ...existingProfile, ...profileData, updatedAt: new Date().toISOString() };
        localStorage.setItem('guest_profile', JSON.stringify(updatedProfile));
        return true;
      } catch(e) {
        console.warn('Failed to save guest profile to localStorage:', e);
        return false;
      }
    }

    if (!firestoreDB) {
      console.log("Firestore not available");
      return false;
    }

    // Get correct Firestore document ID based on provider
    const firestoreUserId = _getFirestoreUserId(userId, currentUser);
    
    if (!firestoreUserId) {
      console.warn("No valid Firestore user ID found, cannot save profile to Firestore");
      return false;
    }

    try {
      // Use the correct document ID for the user
      const profileRef = doc(firestoreDB, "users", firestoreUserId, "profile", "data");
      await setDoc(profileRef, {
        ...profileData,
        originalUserId: userId, // Keep original userId for reference
        updatedAt: new Date()
      }, { merge: true });
      console.log(`Profile saved to Firestore for ${currentUser?.provider || 'unknown'} user:`, firestoreUserId);
      return true;
    } catch (error) {
      console.error("Failed to save profile to Firestore:", error);
      return false;
    }
  },

  /**
   * Load user profile from Firestore
   * @param {string} userId - User ID
   * @param {Object} options - Options object
   * @returns {Promise<Object>} Profile data
   */
  async loadUserProfile(userId, options = {}) {
    const firestoreDB = window.__firestoreDB || db;

    if (_isGuestId(userId)) {
      console.log("Guest user - loading profile from localStorage");
      try {
        const profile = JSON.parse(localStorage.getItem('guest_profile') || '{}');
        return profile;
      } catch(e) {
        console.warn('Failed to load guest profile from localStorage:', e);
        return {};
      }
    }

    if (!firestoreDB) {
      console.log("Firestore not available");
      return {};
    }

    try {
      const candidateIds = [String(userId).trim()];
      const authUid =
        auth && auth.currentUser && auth.currentUser.uid
          ? String(auth.currentUser.uid).trim()
          : "";
      if (authUid && !candidateIds.includes(authUid)) {
        candidateIds.push(authUid);
      }

      // Try to load from each candidate ID
      for (const candidateId of candidateIds) {
        try {
          const profileRef = doc(firestoreDB, "users", candidateId, "profile", "data");
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            console.log(`Profile loaded from Firestore for ${candidateId}`);
            return profileData;
          }
        } catch (candidateError) {
          if (candidateError && candidateError.code === "permission-denied") {
            continue;
          }
          throw candidateError;
        }
      }

      // No profile found, return empty object
      console.log("No profile found in Firestore");
      return {};
    } catch (error) {
      console.error("Failed to load profile from Firestore:", error);
      return {};
    }
  },

  /**
   * Check if Firebase is available
   * @returns {boolean} Availability status
   */
  isAvailable() {
    const firestoreDB = window.__firestoreDB || db;
    return !!firestoreDB;
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
  async getUserMembership(userId, options = {}) {
    const settings = {
      forceRefresh: false,
      ...options,
    };

    if (_isGuestId(userId)) {
      return {
        totalSpent: 0,
        ...this.calculateMembership(0),
      };
    }

    const cached = membershipCache.get(userId);
    if (
      !settings.forceRefresh &&
      cached &&
      Date.now() - cached.cachedAt < MEMBERSHIP_CACHE_TTL_MS
    ) {
      return cached.value;
    }

    const firestoreDB = window.__firestoreDB || db;
    let totalSpent = 0;

    if (firestoreDB) {
      try {
        const profile = await this.loadUserProfile(userId);
        totalSpent = Number(profile?.totalSpent) || 0;

        // If profile totalSpent is missing, recalculate once from order history.
        if (settings.forceRefresh || totalSpent <= 0) {
          const candidateIds = [String(userId).trim()];
          const authUid =
            auth && auth.currentUser && auth.currentUser.uid
              ? String(auth.currentUser.uid).trim()
              : "";
          if (authUid && !candidateIds.includes(authUid)) {
            candidateIds.push(authUid);
          }

          const orderAmountById = new Map();
          for (const candidateId of candidateIds) {
            try {
              const keysRef = collection(firestoreDB, "users", candidateId, "keys");
              const snapshot = await getDocs(keysRef);

              snapshot.forEach((docSnap) => {
                const data = docSnap.data() || {};
                const amount = Number(data.amount) || 0;
                const existing = Number(orderAmountById.get(docSnap.id) || 0);
                if (amount > existing) {
                  orderAmountById.set(docSnap.id, amount);
                }
              });
            } catch (candidateError) {
              if (candidateError && candidateError.code === "permission-denied") {
                continue;
              }
              throw candidateError;
            }
          }

          totalSpent = 0;
          orderAmountById.forEach((amount) => {
            totalSpent += Number(amount) || 0;
          });

          if (totalSpent > 0 && totalSpent !== Number(profile?.totalSpent || 0)) {
            const profileRef = doc(firestoreDB, "users", userId, "profile", "data");
            await setDoc(
              profileRef,
              {
                totalSpent,
                updatedAt: new Date(),
              },
              { merge: true },
            );
          }
        }
      } catch (err) {
 console.error("Failed to load membership details:", err);
      }
    }

    const value = {
      totalSpent,
      ...this.calculateMembership(totalSpent),
    };

    membershipCache.set(userId, {
      cachedAt: Date.now(),
      value,
    });

    return value;
  },

  /**
   * Save purchased keys to Firestore
   * @param {string} userId - User ID
   * @param {Object} orderData - Order data containing keys, games, amount, etc.
   * @returns {Promise<boolean>} Success status
   */
  async savePurchasedKeys(userId, orderData) {
    const firestoreDB = window.__firestoreDB || db;

    // Guest users: save to localStorage only
    if (_isGuestId(userId)) {
      console.log('Guest user - saving keys to localStorage only');
      try {
        const existingKeys = JSON.parse(localStorage.getItem('guest_purchased_keys') || '[]');
        existingKeys.push({
          orderId: orderData.orderId || 'ORDER_' + Date.now(),
          keys: orderData.keys || [],
          games: orderData.games || [],
          amount: orderData.amount || 0,
          paymentMethod: orderData.paymentMethod || 'unknown',
          purchaseDate: new Date().toISOString(),
          status: 'completed'
        });
        localStorage.setItem('guest_purchased_keys', JSON.stringify(existingKeys));
        return true;
      } catch(e) {
        console.warn('Failed to save guest keys to localStorage:', e);
        return false;
      }
    }

    if (!firestoreDB) {
      console.log("Firestore not available");
      return false;
    }

    // Get correct Firestore document ID based on provider
    const firestoreUserId = _getFirestoreUserId(userId, currentUser);
    
    if (!firestoreUserId) {
      console.warn("No valid Firestore user ID found, cannot save keys to Firestore");
      return false;
    }

    try {
      // Use the correct document ID for the user
      const keysRef = doc(firestoreDB, "users", firestoreUserId, "keys", orderData.orderId || 'ORDER_' + Date.now());
      
      await setDoc(keysRef, {
        orderId: orderData.orderId || 'ORDER_' + Date.now(),
        keys: orderData.keys || [],
        games: orderData.games || [],
        amount: orderData.amount || 0,
        paymentMethod: orderData.paymentMethod || 'unknown',
        purchaseDate: orderData.purchaseDate || new Date(),
        status: orderData.status || 'completed',
        originalUserId: userId, // Keep original userId for reference
        createdAt: new Date()
      }, { merge: true });
      
      console.log(`Keys saved to Firestore for ${currentUser?.provider || 'unknown'} user:`, firestoreUserId);
      return true;
    } catch (error) {
      console.error("Failed to save keys to Firestore:", error);
      return false;
    }
  }
};

// Monkey-patch savePurchasedKeys to update totalSpent
// We do this to ensure we track spending without modifying the original function too much
// or we can just add a new method "updateUserSpending" and call it from keygen.html
// But modifying savePurchasedKeys is safer as it guarantees update on save.
const originalSaveKeys = window.firebaseCart.savePurchasedKeys;
window.firebaseCart.savePurchasedKeys = async function(userId, orderData) {
  // Guest users: chỉ dùng localStorage, skip Firebase hoàn toàn
  if (_isGuestId(userId)) {
    console.log('Guest user - saving keys to localStorage only');
    try {
      const existingKeys = JSON.parse(localStorage.getItem('guest_purchased_keys') || '[]');
      existingKeys.push({
        orderId: orderData.orderId || 'ORDER_' + Date.now(),
        keys: orderData.keys || [],
        games: orderData.games || [],
        amount: orderData.amount || 0,
        paymentMethod: orderData.paymentMethod || 'unknown',
        purchaseDate: new Date().toISOString(),
        status: 'completed'
      });
      localStorage.setItem('guest_purchased_keys', JSON.stringify(existingKeys));
    } catch(e) { console.warn('Failed to save guest keys to localStorage:', e); }
    return true;
  }

  // Non-guest: use original Firebase save
  const success = await originalSaveKeys.call(this, userId, orderData);

  if (success) {
    try {
      const cachedMembership = membershipCache.get(userId);
      const profile = await this.loadUserProfile(userId);
      // Ensure currentTotal is a number
      const currentTotal = Number(
        cachedMembership?.value?.totalSpent ?? profile?.totalSpent,
      ) || 0;
      // Ensure orderAmount is a number
      const orderAmount = Number(orderData.amount) || 0;

      // 3. Calculate new total
      const newTotal = currentTotal + orderAmount;

      if (FIREBASE_DEBUG) {
 console.log(`Calculating New Total: ${currentTotal} + ${orderAmount} = ${newTotal}`);
      }

      // 4. Update profile with new total
      // Use module-scope db variable directly
      const firestoreDB = window.__firestoreDB || db;

      if (firestoreDB) {
        // Use module-scope imports (doc, setDoc) directly
        try {
          const profileRef = doc(firestoreDB, "users", userId, "profile", "data");

          await setDoc(
            profileRef,
            {
              totalSpent: newTotal,
              updatedAt: new Date(),
            },
            { merge: true },
          );

          membershipCache.set(userId, {
            cachedAt: Date.now(),
            value: {
              totalSpent: newTotal,
              ...window.firebaseCart.calculateMembership(newTotal),
            },
          });

          if (FIREBASE_DEBUG) {
 console.log(`Updated total spent in Firebase for ${userId}: ${currentTotal} -> ${newTotal}`);
          }
        } catch (innerErr) {
 console.error("Firestore update failed:", innerErr);
        }
      } else {
 console.error("Firestore DB instance not found during profile update");
      }
    } catch (err) {
 console.error("Failed to update user spending stats:", err);
    }
  }

  return success;
};




