const functions = require('firebase-functions');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const axios = require('axios');
const openid = require('openid');
const CryptoJS = require('crypto-js');
const moment = require('moment');
const qs = require('qs');
const { PayOS } = require('@payos/node');

// ==========================================
// IMPORT CORS CONFIGURATION
// ==========================================
const { getCorsOptions, setCorsHeaders } = require('./cors-config');

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
 console.warn('WARNING: SESSION_SECRET is missing. Using temporary fallback secret.');
}

// ==========================================
// CONFIGURATION
// ==========================================
const { fetchGameNews } = require('./news');

// PayOS Config
let payOS = null;
if (process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY) {
  try {
    payOS = new PayOS({
      clientId: process.env.PAYOS_CLIENT_ID,
      apiKey: process.env.PAYOS_API_KEY,
      checksumKey: process.env.PAYOS_CHECKSUM_KEY
    });
  } catch (error) {
 console.warn('WARNING: Failed to initialize PayOS:', error.message);
  }
} else {
 console.warn('WARNING: PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY missing. PayOS features disabled.');
}

// ZaloPay Config
const zaloConfig = {
  app_id: process.env.ZALOPAY_APP_ID || '2553',
  key1: process.env.ZALOPAY_KEY1 || '',
  key2: process.env.ZALOPAY_KEY2 || '',
  endpoint: process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create',
  query_endpoint: process.env.ZALOPAY_QUERY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/query'
};
const isZaloConfigured = Boolean(zaloConfig.key1 && zaloConfig.key2);
if (!isZaloConfigured) {
 console.warn('WARNING: ZALOPAY_KEY1/ZALOPAY_KEY2 missing. ZaloPay features disabled.');
}

// Stripe Config
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
let stripe;
if (stripeKey && stripeKey.trim().length > 0 && !stripeKey.includes('copy your full key')) {
  stripe = require('stripe')(stripeKey.trim());
} else {
 console.warn(' STRIPE_SECRET_KEY missing or invalid. Stripe features disabled.');
}

// Steam Config
const STEAM_API_KEY = process.env.STEAM_API_KEY || '';
if (!STEAM_API_KEY) {
 console.warn('WARNING: STEAM_API_KEY missing. Steam profile enrichment disabled.');
}
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid';

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();

// Middleware
app.use(cors(getCorsOptions()));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET || `fallback_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    resave: true,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } // Set to true if relying on https (Firebase is https) but for simplicity false
}));

// ==========================================
// STEAM AUTHENTICATION
// ==========================================

// Helper to get Base URL dynamically
const getBaseUrl = (req) => {
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    return `${protocol}://${host}`;
};

// Route: Initiate Steam login (Manual OpenID 2.0 - no openid library needed)
app.get('/auth/steam', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const returnUrl = `${baseUrl}/auth/steam/return`;
  const realm = `${baseUrl}/`;

 console.log(`STEAM AUTH: Realm=${realm}, Return=${returnUrl}`);

  // Construct Steam OpenID URL manually
  // IMPORTANT: Do NOT use URLSearchParams - it encodes the spec URIs which Steam rejects
  const authUrl = 'https://steamcommunity.com/openid/login'
    + '?openid.ns=http://specs.openid.net/auth/2.0'
    + '&openid.mode=checkid_setup'
    + '&openid.return_to=' + encodeURIComponent(returnUrl)
    + '&openid.realm=' + encodeURIComponent(realm)
    + '&openid.identity=http://specs.openid.net/auth/2.0/identifier_select'
    + '&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select';

 console.log(' Redirecting to Steam:', authUrl);
  res.redirect(authUrl);
});

// Route: Steam callback
app.get('/auth/steam/return', async (req, res) => {
  try {
    // Verify the OpenID assertion with Steam directly
    const query = req.query;

    // Check that Steam returned a positive assertion
    if (query['openid.mode'] !== 'id_res') {
 console.error(' Steam did not return a positive assertion:', query['openid.mode']);
      return res.status(401).send('Steam login was cancelled or failed.');
    }

    // Build verification request to Steam
    const verifyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      verifyParams.append(key, value);
    }
    // Change mode to check_authentication for verification
    verifyParams.set('openid.mode', 'check_authentication');

    const verifyResponse = await axios.post(
      'https://steamcommunity.com/openid/login',
      verifyParams.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      }
    );

    const isValid = verifyResponse.data && verifyResponse.data.includes('is_valid:true');

    if (!isValid) {
 console.error(' Steam verification failed:', verifyResponse.data);
      return res.status(401).send('Steam verification failed.');
    }

    // Extract SteamID from claimed_id
    const claimedId = query['openid.claimed_id'];
    const match = claimedId && claimedId.match(/\/id\/(\d+)/);
    const steamId = match ? match[1] : null;

    if (!steamId) return res.status(400).send('No Steam ID found');

 console.log(' Steam login verified, SteamID:', steamId);

    // Fetch Profile
    let userData = {
      steamId: steamId,
      displayName: 'Steam User',
      photoURL: 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg'
    };

    if (STEAM_API_KEY) {
      try {
        const response = await axios.get(
          'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
          {
            params: { key: STEAM_API_KEY, steamids: steamId },
            timeout: 5000
          }
        );
        if (response.data?.response?.players?.length > 0) {
          const player = response.data.response.players[0];
          userData = {
            steamId: player.steamid,
            displayName: player.personaname,
            photoURL: player.avatarfull || player.avatarmedium
          };
        }
      } catch (apiError) {
 console.warn(' Steam API call failed:', apiError.message);
      }
    }

    // HTML Response (Popup Closer)
    const responseHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Steam Login Success</title>
        <style>
          body { background: #171a21; color: #66c0f4; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .box { text-align: center; background: #1b2838; padding: 2rem; border-radius: 8px; }
          img { border-radius: 50%; border: 2px solid #66c0f4; width: 80px; height: 80px; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <div class="box">
          <img src="${userData.photoURL}" />
          <h2>Welcome, ${userData.displayName}</h2>
          <p>You have successfully logged in.</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'STEAM_LOGIN_SUCCESS', user: ${JSON.stringify(userData)} }, '*');
            setTimeout(() => window.close(), 1000);
          } else {
             // Fallback if not a popup
             setTimeout(() => window.location.href = '/', 2000);
          }
        </script>
      </body>
      </html>
    `;
    res.send(responseHtml);
  } catch (err) {
 console.error(' Steam callback error:', err);
    res.status(500).send('Internal server error during Steam login.');
  }
});

// ==========================================
// STEAM STORE API PROXY
// ==========================================
app.get('/api/steam/details', async (req, res) => {
    const appid = req.query.appid;
    if (!appid) return res.status(400).json({ error: 'Missing appid' });

    try {
        const response = await axios.get(`https://store.steampowered.com/api/appdetails`, {
            params: { appids: appid, l: 'english', cc: 'US' },
            timeout: 8000,
            headers: {
                // Bypass Steam age-gate for mature games
                'Cookie': 'birthtime=0; wants_mature_content=1; lastagecheckage=1-January-1990'
            }
        });

        const data = response.data[appid];
        if (data && data.success) {
            // Extract only what we need: movies, screenshots, descriptions
            const details = data.data;
            res.json({
                success: true,
                data: {
                    name: details.name,
                    header_image: details.header_image,
                    short_description: details.short_description,
                    detailed_description: details.detailed_description,
                    about_the_game: details.about_the_game,
                    movies: (details.movies || []).map(m => ({
                        id: m.id,
                        name: m.name,
                        thumbnail: m.thumbnail,
                        webm: m.webm || {
                            '480': `https://video.akamai.steamstatic.com/store_trailers/${m.id}/movie480_vp9.webm`,
                            max: `https://video.akamai.steamstatic.com/store_trailers/${m.id}/movie_max_vp9.webm`
                        },
                        mp4: m.mp4 || {
                            '480': `https://video.akamai.steamstatic.com/store_trailers/${m.id}/movie480.mp4`,
                            max: `https://video.akamai.steamstatic.com/store_trailers/${m.id}/movie_max.mp4`
                        }
                    })),
                    screenshots: (details.screenshots || []).map(s => ({
                        id: s.id,
                        path_thumbnail: s.path_thumbnail,
                        path_full: s.path_full
                    })),
                    developers: details.developers,
                    publishers: details.publishers,
                    release_date: details.release_date,
                    metacritic: details.metacritic,
                    genres: details.genres,
                    pc_requirements: details.pc_requirements
                }
            });
        } else {
            res.json({ success: false, error: 'Game not found on Steam' });
        }
    } catch (error) {
 console.error(' Steam Store API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch Steam details' });
    }
});

// ==========================================
// STEAM FEATURED CATEGORIES PROXY
// GET /api/steam/featured
// Proxies Steam's featuredcategories API server-side (no CORS issues)
// Used by final_local Flash Sale countdown to get real discount_expiration
// ==========================================
const steamFeaturedCache = { data: null, time: 0 };
const STEAM_FEATURED_TTL = 15 * 60 * 1000; // 15 minutes

app.get('/api/steam/featured', async (req, res) => {
    res.set('Cache-Control', 'public, max-age=900');

    if (steamFeaturedCache.data && (Date.now() - steamFeaturedCache.time < STEAM_FEATURED_TTL)) {
        res.set('X-Cache', 'HIT');
        return res.json(steamFeaturedCache.data);
    }

    try {
        const response = await axios.get('https://store.steampowered.com/api/featuredcategories/', {
            params: { cc: 'us', l: 'en' },
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://store.steampowered.com/'
            }
        });
        steamFeaturedCache.data = response.data;
        steamFeaturedCache.time = Date.now();
        console.log('[Steam Featured] Fetched fresh from Steam');
        res.set('X-Cache', 'MISS');
        return res.json(response.data);
    } catch (error) {
        console.error('[Steam Featured] Error:', error.message);
        if (steamFeaturedCache.data) {
            res.set('X-Cache', 'STALE');
            return res.json(steamFeaturedCache.data);
        }
        return res.status(500).json({ error: 'Failed to fetch Steam featured categories' });
    }
});

// ==========================================
// CHEAPSHARK API PROXY (bypass CORS + rate limit)
// ==========================================
const cheapsharkCache = new Map(); // In-memory cache
const cheapsharkRefreshInFlight = new Map();
const CS_MAX_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCheapSharkTtlMs(csPath, query = {}) {
    if (csPath === 'deals') {
        return 20 * 60 * 1000; // 20 minutes
    }
    if (csPath === 'games') {
        return query.title ? 6 * 60 * 60 * 1000 : 60 * 60 * 1000; // 6h search, 1h generic
    }
    return 30 * 60 * 1000; // default 30 minutes
}

async function fetchCheapSharkData(csUrl, csPath) {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.get(csUrl, {
                timeout: 15000,
                headers: { 'User-Agent': 'NeonNexus-GameStore/1.0' }
            });
 console.log(`CheapShark proxy OK: ${csPath} (attempt ${attempt})`);
            return response.data;
        } catch (error) {
            if (error.response && error.response.status === 429) {
                if (attempt < MAX_RETRIES) {
                    const waitMs = attempt * 2000; // 2s, 4s backoff
 console.warn(`CheapShark 429 rate-limited, retrying in ${waitMs}ms (attempt ${attempt}/${MAX_RETRIES})...`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    continue;
                }

                if (csPath === 'deals') {
 console.warn('Returning fallback dummy deals due to 429 IP Block.');
                    return [{
                        internalName: "FALLBACK_GAME_1", title: "Cyberpunk 2077", dealID: "dummy_1", gameID: "123", salePrice: "29.99", normalPrice: "59.99", savings: "50", metacriticScore: "86", steamRatingPercent: "80", steamAppID: "1091500", releaseDate: 1607558400, lastChange: 1620000000, thumb: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/capsule_616x353.jpg"
                    }, {
                        internalName: "FALLBACK_GAME_2", title: "Elden Ring", dealID: "dummy_2", gameID: "456", salePrice: "39.99", normalPrice: "59.99", savings: "33", metacriticScore: "94", steamRatingPercent: "92", steamAppID: "1245620", releaseDate: 1645747200, lastChange: 1650000000, thumb: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/capsule_616x353.jpg"
                    }];
                }
                if (csPath === 'games') {
 console.warn('Returning fallback dummy games due to 429 IP Block.');
                    return [{
                        gameID: "789", steamAppID: "883710", cheapest: "9.99", cheapestDealID: "dummy_3", external: "Resident Evil 2", internalName: "RESIDENTEVIL2", thumb: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/883710/capsule_616x353.jpg"
                    }, {
                        gameID: "101", steamAppID: "1196590", cheapest: "19.99", cheapestDealID: "dummy_4", external: "Resident Evil Village", internalName: "RESIDENTEVILVILLAGE", thumb: "https://file.hstatic.net/1000231532/file/resident_evil_village_tung_demo_726a5bb3f08e466289ef5fc26864e161.jpg"
                    }];
                }
            }

            throw error;
        }
    }

    return [];
}

function refreshCheapSharkCache(cacheKey, csUrl, csPath, ttlMs) {
    if (cheapsharkRefreshInFlight.has(cacheKey)) return;

    const job = fetchCheapSharkData(csUrl, csPath)
        .then((data) => {
            cheapsharkCache.set(cacheKey, {
                data,
                time: Date.now(),
                ttlMs
            });
        })
        .catch((err) => {
 console.warn(`Background CheapShark refresh failed: ${err.message}`);
        })
        .finally(() => {
            cheapsharkRefreshInFlight.delete(cacheKey);
        });

    cheapsharkRefreshInFlight.set(cacheKey, job);
}

app.get('/api/cheapshark/:endpoint', async (req, res) => {
    const csPath = req.params.endpoint;
    const queryString = new URLSearchParams(req.query).toString();
    const csUrl = `https://www.cheapshark.com/api/1.0/${csPath}${queryString ? '?' + queryString : ''}`;
    const cacheKey = csUrl;
    const ttlMs = getCheapSharkTtlMs(csPath, req.query);
    const now = Date.now();

    res.set('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=86400');

    const cached = cheapsharkCache.get(cacheKey);
    if (cached) {
        const ageMs = now - cached.time;
        const cachedTtlMs = cached.ttlMs || ttlMs;

        if (ageMs < cachedTtlMs) {
            res.set('X-Cache', 'HIT');
            return res.json(cached.data);
        }

        if (ageMs < CS_MAX_STALE_MS) {
            res.set('X-Cache', 'STALE');
            refreshCheapSharkCache(cacheKey, csUrl, csPath, ttlMs);
            return res.json(cached.data);
        }
    }

    try {
        const data = await fetchCheapSharkData(csUrl, csPath);
        cheapsharkCache.set(cacheKey, {
            data,
            time: now,
            ttlMs
        });
        res.set('X-Cache', 'MISS');
        return res.json(data);
    } catch (error) {
 console.error('CheapShark proxy error:', error.message);

        if (cached && cached.data) {
            res.set('X-Cache', 'STALE_ERROR');
            return res.json(cached.data);
        }

        if (error.response) {
            return res.status(error.response.status).json({ error: `CheapShark API error: ${error.response.status}` });
        }
        return res.status(500).json({ error: 'Failed to fetch from CheapShark' });
    }
});
// ==========================================
// STEAM PRICE PROXY (Dual VND + USD)
// ==========================================
const steamPriceCache = new Map(); // appid -> { data, time }
const STEAM_PRICE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

app.get('/api/steam/price', async (req, res) => {
    const appidsParam = req.query.appids;
    if (!appidsParam) return res.status(400).json({ error: 'Missing appids parameter' });

    const appids = Array.from(new Set(
        appidsParam
            .split(',')
            .map(id => id.trim())
            .filter(id => id && id !== 'Unknown' && id !== 'N/A')
    ));
    if (appids.length === 0) return res.json({});

    const now = Date.now();
    const result = {};
    const missingIds = [];

    for (const id of appids) {
        const cached = steamPriceCache.get(id);
        if (cached && (now - cached.time < STEAM_PRICE_CACHE_TTL_MS)) {
            result[id] = cached.data;
        } else {
            missingIds.push(id);
        }
    }

    if (missingIds.length === 0) {
        res.set('X-Price-Cache', 'HIT');
        return res.json(result);
    }

 console.log(`Fetching Steam prices for ${missingIds.length} uncached games (VN + US)...`);

    const BATCH_SIZE = 40;

    try {
        for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
            const batch = missingIds.slice(i, i + BATCH_SIZE);
            const idsStr = batch.join(',');

            const [vnResponse, usResponse] = await Promise.all([
                axios.get('https://store.steampowered.com/api/appdetails', {
                    params: { appids: idsStr, filters: 'price_overview', cc: 'VN' },
                    timeout: 10000,
                    headers: {
                        'Cookie': 'birthtime=0; wants_mature_content=1; lastagecheckage=1-January-1990'
                    }
                }),
                axios.get('https://store.steampowered.com/api/appdetails', {
                    params: { appids: idsStr, filters: 'price_overview', cc: 'US' },
                    timeout: 10000,
                    headers: {
                        'Cookie': 'birthtime=0; wants_mature_content=1; lastagecheckage=1-January-1990'
                    }
                })
            ]);

            const vnData = vnResponse.data;
            const usData = usResponse.data;

            for (const id of batch) {
                const vnInfo = vnData[id];
                const usInfo = usData[id];

                if (vnInfo && vnInfo.success && vnInfo.data && vnInfo.data.price_overview) {
                    const vnPrice = vnInfo.data.price_overview;
                    const usPrice = (usInfo && usInfo.success && usInfo.data && usInfo.data.price_overview)
                        ? usInfo.data.price_overview
                        : null;

                    const priceData = {
                        vnd: {
                            sale: Math.round(vnPrice.final / 100),
                            normal: Math.round(vnPrice.initial / 100)
                        },
                        usd: usPrice ? {
                            sale: usPrice.final / 100,
                            normal: usPrice.initial / 100
                        } : {
                            sale: Math.round((vnPrice.final / 100) / 26000 * 100) / 100,
                            normal: Math.round((vnPrice.initial / 100) / 26000 * 100) / 100
                        },
                        savings: vnPrice.discount_percent || 0
                    };

                    result[id] = priceData;
                    steamPriceCache.set(id, {
                        data: priceData,
                        time: now
                    });
                }
            }
        }

        res.set('X-Price-Cache', Object.keys(result).length === appids.length ? 'MISS' : 'PARTIAL_MISS');
 console.log(`Steam prices fetched: ${Object.keys(result).length}/${appids.length} games`);
        return res.json(result);
    } catch (error) {
 console.error('Steam Price API Error:', error.message);

        if (Object.keys(result).length > 0) {
            res.set('X-Price-Cache', 'STALE_PARTIAL');
            return res.json(result);
        }

        return res.status(500).json({ error: 'Failed to fetch Steam prices' });
    }
});
// ==========================================
// STEAM IMAGE PROXY
// ==========================================
app.get('/api/steam/image', async (req, res) => {
    const { url, appid } = req.query;
    let imageUrl = url || null;

    if (!imageUrl && appid) {
        imageUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
    }
    if (!imageUrl) {
        return res.status(400).json({ error: 'url or appid is required' });
    }
    if (!imageUrl.includes('steamstatic.com') && !imageUrl.includes('steampowered.com')) {
        return res.status(403).json({ error: 'Only Steam URLs allowed' });
    }

    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://store.steampowered.com/',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });
        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(Buffer.from(response.data));
    } catch (error) {
        res.status(404).send('Image not found');
    }
});

// ==========================================
// TWITCH API PROXY
// ==========================================
app.get('/api/twitch/token', async (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Twitch keys not configured' });
    }

    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials'
            }
        });
        res.json({ access_token: response.data.access_token, client_id: clientId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to authenticate with Twitch' });
    }
});

app.get('/api/games/trailer', async (req, res) => {
    const gameName = req.query.name;
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_SECRET;

    if (!gameName) return res.status(400).json({ error: 'Missing game name' });
    if (!clientId || !clientSecret) {
         return res.json({ title: 'Stardew Valley (Demo)', video_id: 'ot7uXAWTq94' });
    }

    try {
        const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: { client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }
        });
        const accessToken = tokenRes.data.access_token;

        const igdbRes = await axios({
            url: 'https://api.igdb.com/v4/games',
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'text/plain'
            },
            data: `fields name, videos.video_id, videos.name; search "${gameName}"; limit 1;`
        });

        const games = igdbRes.data;
        if (games && games.length > 0 && games[0].videos) {
            const video = games[0].videos[0];
            return res.json({ title: games[0].name, video_id: video.video_id });
        }
        res.status(404).json({ error: 'No trailer found' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch from IGDB' });
    }
});

// ==========================================
// PAYMENT ENDPOINTS
// ==========================================
app.post('/api/create-payos-payment', async (req, res) => {
  try {
    if (!payOS) {
      return res.status(500).json({ error: 'PayOS is not configured on this server.' });
    }

    const { amount, description, returnUrl, cancelUrl } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount required' });

    const orderCode = Number(String(Date.now()).slice(-6));
    const body = {
      orderCode: orderCode,
      amount: Math.round(Number(amount)),
      description: (description || 'Payment').slice(0, 25),
      cancelUrl: cancelUrl || 'https://nenonexus-digital-game-store.web.app',
      returnUrl: returnUrl || 'https://nenonexus-digital-game-store.web.app/keygen'
    };

    const paymentLinkResponse = await payOS.paymentRequests.create(body);
    res.json({ checkoutUrl: paymentLinkResponse.checkoutUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public-config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    stripePublishableKey
  });
});

app.post('/api/create-payment-intent', async (req, res) => {
  try {
      if (!stripe) throw new Error('Stripe not configured');
      const { amount, currency = 'vnd' } = req.body;
      const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount),
          currency: currency,
          payment_method_types: ['card'],
      });
      res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-zalopay-payment', async (req, res) => {
    try {
        const { amount, redirectUrl } = req.body;
        if (!isZaloConfigured) {
            return res.status(500).json({ error: 'ZaloPay is not configured on this server.' });
        }
        if (!amount) {
            return res.status(400).json({ error: 'Amount required' });
        }

        const transID = Math.floor(Math.random() * 1000000);
        const order = {
            app_id: zaloConfig.app_id,
            app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
            app_user: 'user123',
            app_time: Date.now(),
            item: '[]',
            embed_data: JSON.stringify({ redirecturl: redirectUrl || process.env.DEFAULT_RETURN_URL || 'https://nenonexus-digital-game-store.web.app/keygen' }),
            amount: amount,
            description: `Payment #${transID}`,
            bank_code: ''
        };

        const data = zaloConfig.app_id + '|' + order.app_trans_id + '|' + order.app_user + '|' + order.amount + '|' + order.app_time + '|' + order.embed_data + '|' + order.item;
        order.mac = CryptoJS.HmacSHA256(data, zaloConfig.key1).toString();

        const result = await axios.post(zaloConfig.endpoint, null, { params: order });
        return res.status(200).json(result.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/check-zalopay-status', async (req, res) => {
  if (!isZaloConfigured) {
    return res.status(500).json({ error: 'ZaloPay is not configured on this server.' });
  }
  const { app_trans_id } = req.body;
  const postData = {
    app_id: zaloConfig.app_id,
    app_trans_id,
  };
  const data = postData.app_id + '|' + postData.app_trans_id + '|' + zaloConfig.key1;
  postData.mac = CryptoJS.HmacSHA256(data, zaloConfig.key1).toString();

  try {
    const result = await axios({
      method: 'post',
      url: zaloConfig.query_endpoint,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: qs.stringify(postData),
    });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

const { createMomoPayment } = require('./momo');
app.post('/api/create-momo-payment', async (req, res) => {
    try {
        const { amount, redirectUrl } = req.body;
        if (!amount) {
          return res.status(400).json({ error: 'Amount required' });
        }
        const result = await createMomoPayment(amount, 'MOMO' + Date.now(), 'Payment', redirectUrl);
        if (result && result.payUrl) res.json({ payUrl: result.payUrl });
        else res.status(500).json({ error: 'Failed to create payment URL' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/news', async (req, res) => {
  try {
    const { lang = 'all', limit = 20, startDate, endDate } = req.query;
    const parsedLimit = Number.parseInt(limit, 10);
    const news = await fetchGameNews(lang, Number.isFinite(parsedLimit) ? parsedLimit : 20, startDate, endDate);
    res.json({
      success: true,
      count: news.length,
      data: news
    });
  } catch (error) {
 console.error('News API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news'
    });
  }
});

// ==========================================
// ADMIN: Backfill user profiles from Firebase Auth
// ==========================================
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}
const adminDb = admin.firestore();

app.post('/api/admin/backfill-users', async (req, res) => {
  try {
    // List all Firebase Auth users
    const listResult = await admin.auth().listUsers(1000);
    const users = listResult.users;
    let updated = 0;
    let skipped = 0;

    for (const userRecord of users) {
      const uid = userRecord.uid;
      if (!uid) continue;

      // Skip anonymous users (no email, no displayName, no provider)
      const providerData = userRecord.providerData || [];
      if (providerData.length === 0 && !userRecord.email) {
        skipped++;
        continue;
      }

      const providerId = providerData[0]?.providerId || 'unknown';
      const displayName = userRecord.displayName || '';
      const email = userRecord.email || '';
      const photoURL = userRecord.photoURL || '';

      // Write to top-level users/{uid}
      await adminDb.doc(`users/${uid}`).set({
        displayName,
        email,
        provider: providerId,
        photoURL,
        lastLogin: userRecord.metadata.lastSignInTime
          ? new Date(userRecord.metadata.lastSignInTime)
          : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: userRecord.metadata.creationTime
          ? new Date(userRecord.metadata.creationTime)
          : admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Write to users/{uid}/profile/data
      await adminDb.doc(`users/${uid}/profile/data`).set({
        authUid: uid,
        userId: uid,
        displayName,
        email,
        provider: providerId,
        photoURL,
        lastLogin: userRecord.metadata.lastSignInTime
          ? new Date(userRecord.metadata.lastSignInTime)
          : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: userRecord.metadata.creationTime
          ? new Date(userRecord.metadata.creationTime)
          : admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      updated++;
    }

    res.json({
      success: true,
      message: `Backfilled ${updated} users, skipped ${skipped} anonymous accounts`,
      total: users.length,
      updated,
      skipped,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/clean-phantoms', async (req, res) => {
  try {
    const snap = await adminDb.collection('users').get();
    let deleted = 0;
    const phantoms = [];
    
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (!data.email || data.email === '') {
        phantoms.push({ id: docSnap.id, data: data });
      }
    }
    
    res.json({ success: true, count: phantoms.length, phantoms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export
// Using v2 syntax for region if the module is from v2, but since `const functions = require('firebase-functions')` is v1 syntax:
// We need to use `functions.region('asia-southeast1').https.onRequest(app)` if it was v1, but it threw an error.
// Let's use the v2 syntax explicitly:
const { onRequest } = require("firebase-functions/v2/https");
exports.api = onRequest({ region: "asia-southeast1" }, app);

