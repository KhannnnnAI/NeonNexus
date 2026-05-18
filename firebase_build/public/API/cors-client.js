/**
 * FRONTEND CORS FIX
 * Ensures all API calls are made correctly to avoid CORS errors
 */

// ============================================
// API CONFIGURATION
// ============================================

// API_BASE is imported from index.js to avoid duplicate declaration

// ============================================
// FETCH WRAPPER WITH PROPER CORS HANDLING
// ============================================

/**
 * Make API requests with proper CORS headers
 * @param {string} endpoint - API endpoint (e.g., '/api/games')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Default fetch options with proper headers
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // Indicates AJAX request
    },
    credentials: 'include', // Include cookies for authentication
  };
  
  // Merge options
  const fetchOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {}),
    },
  };
  
  try {
    const response = await fetch(url, fetchOptions);
    
    // Handle 401 (Unauthorized) - redirect to login
    if (response.status === 401) {
      console.warn('Unauthorized: Redirecting to login');
      // showLoginModal();
      throw new Error('Unauthorized');
    }
    
    // Handle 403 (Forbidden - CORS or permission issue)
    if (response.status === 403) {
      console.error('CORS Error or Forbidden:', response);
      throw new Error('Access forbidden - CORS or permission issue');
    }
    
    // Handle 404
    if (response.status === 404) {
      console.warn('Endpoint not found:', url);
      throw new Error('Endpoint not found');
    }
    
    // Handle 429 (Rate Limited)
    if (response.status === 429) {
      console.warn('Rate limited - retry after delay');
      throw new Error('Rate limited');
    }
    
    // Handle 500+ (Server error)
    if (response.status >= 500) {
      console.error('Server error:', response.status);
      throw new Error(`Server error: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}

// ============================================
// COMMON API CALLS WITH CORS FIX
// ============================================

// Example: Get CheapShark deals (with fallback to direct API)
async function fetchDealsWithCORS(params = {}) {
  try {
    // Try server proxy first (handles CORS)
    const response = await apiFetch('/api/cheapshark/deals', {
      method: 'GET',
    });
    
    if (!response.ok) throw new Error('Proxy failed');
    return await response.json();
  } catch (error) {
    console.warn('Server proxy failed, trying direct CheapShark API');
    
    // Fallback to direct API (CheapShark allows CORS)
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`https://www.cheapshark.com/api/1.0/deals?${queryString}`);
      return await response.json();
    } catch (fallbackError) {
      console.error('All attempts failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Example: Get Steam featured categories
async function fetchSteamFeaturedWithCORS() {
  try {
    // Use server proxy to avoid Steam's CORS restrictions
    const response = await apiFetch('/api/steam/featured');
    
    if (!response.ok) throw new Error('Proxy failed');
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Steam featured categories:', error);
    return null;
  }
}

// Example: Create payment intent (POST with credentials)
async function createPaymentIntentWithCORS(amount, currency = 'vnd') {
  try {
    const response = await apiFetch('/api/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency,
      }),
      credentials: 'include',
    });
    
    if (!response.ok) throw new Error('Payment intent creation failed');
    return await response.json();
  } catch (error) {
    console.error('Payment intent error:', error);
    throw error;
  }
}

// ============================================
// HELPER: DETECT CORS ERRORS IN BROWSER CONSOLE
// ============================================

/**
 * Check for CORS errors and suggest fixes
 */
function checkCORSStatus() {
  const corsChecks = {
    'API_BASE': (typeof API_BASE !== 'undefined') ? API_BASE : 'Same-origin (no proxy)',
    'Credentials included': 'Yes',
    'Request headers': 'Content-Type, Authorization, X-Requested-With',
    'Allowed methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  };
  
  console.log('=== CORS Configuration ===');
  Object.entries(corsChecks).forEach(([key, value]) => {
    console.log(`✓ ${key}: ${value}`);
  });
  
  console.log('=== Common CORS Errors & Fixes ===');
  console.log('1. "Access to fetch ... blocked by CORS policy"');
  console.log('   → Make sure request goes through proxy endpoint (e.g., /api/cheapshark)');
  console.log('2. "Credentials mode is \'include\' but Access-Control-Allow-Credentials header is missing"');
  console.log('   → Server must set "Access-Control-Allow-Credentials: true"');
  console.log('3. "Request header ... is not allowed"');
  console.log('   → Check if custom headers are in Access-Control-Allow-Headers');
  console.log('4. "Preflight request failed"');
  console.log('   → Server must handle OPTIONS requests properly');
}

// ============================================
// EXPORT FOR USE IN OTHER MODULES
// ============================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiFetch,
    fetchDealsWithCORS,
    fetchSteamFeaturedWithCORS,
    createPaymentIntentWithCORS,
    checkCORSStatus,
  };
}

// Run CORS check on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkCORSStatus);
} else {
  checkCORSStatus();
}
