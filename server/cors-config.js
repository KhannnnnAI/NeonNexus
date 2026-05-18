/**
 * CORS Configuration - Centralized for all endpoints
 * Fixes CORS issues comprehensively across the application
 */

// Allowed origins - add your frontend URL here
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'https://nenonexus-digital-game-store.web.app',
  'https://www.nenonexus.com',
  'https://nenonexus.com',
  'file://', // For electron/local testing
];

// Allowed HTTP methods
const ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
];

// Allowed headers
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-CSRF-Token',
  'X-API-Key',
  'Accept',
  'Accept-Language',
  'Content-Language',
  'Last-Event-ID',
  'Cache-Control',
];

// Exposed headers (client can read these)
const EXPOSED_HEADERS = [
  'Content-Length',
  'Content-Type',
  'X-Cache',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
];

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin) {
  // Always allow no origin (same-origin requests)
  if (!origin) return true;
  
  // Check exact match
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // Check wildcard patterns
  if (ALLOWED_ORIGINS.includes('*')) return true;
  
  // Allow localhost variations
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  
  // Allow Firebase domains
  if (origin && origin.includes('firebaseapp.com')) return true;
  if (origin && origin.includes('web.app')) return true;
  
  return false;
}

/**
 * Main CORS middleware for Express
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  // Set CORS headers
  if (isOriginAllowed(origin)) {
    res.set('Access-Control-Allow-Origin', origin || '*');
  } else if (!origin) {
    // Same-origin request
    res.set('Access-Control-Allow-Origin', '*');
  }
  
  // Always set these headers
  res.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  res.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  res.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '3600'); // Cache preflight for 1 hour
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Additional security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('X-XSS-Protection', '1; mode=block');
  
  next();
}

/**
 * Wrapper for cors() package with proper configuration
 * Use this if you're using the 'cors' npm package
 */
function getCorsOptions() {
  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else if (!origin) {
        // Same-origin or no origin header
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: 3600,
    optionsSuccessStatus: 200, // For legacy browsers
  };
}

/**
 * Manual CORS headers for specific endpoints
 * Use this when you need fine-grained control
 */
function setCorsHeaders(res, origin = null) {
  if (isOriginAllowed(origin)) {
    res.set('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  
  res.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
  res.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  res.set('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '3600');
}

/**
 * Error handler for CORS errors
 */
function corsErrorHandler(err, req, res, next) {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS policy violation',
      message: 'The origin is not allowed',
      origin: req.headers.origin,
    });
  }
  next(err);
}

module.exports = {
  corsMiddleware,
  getCorsOptions,
  setCorsHeaders,
  corsErrorHandler,
  isOriginAllowed,
  ALLOWED_ORIGINS,
  ALLOWED_METHODS,
  ALLOWED_HEADERS,
  EXPOSED_HEADERS,
};
