require('dotenv').config();
const express = require('express');
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.warn('⚠️ WARNING: STRIPE_SECRET_KEY is missing in .env file! Stripe payments will fail.');
}

let stripe;
if (stripeKey && stripeKey.trim().length > 0) {
  stripe = require('stripe')(stripeKey.trim());
} else {
  console.warn('⚠️ STRIPE_SECRET_KEY missing. Stripe features disabled.');
}
const session = require('express-session');
const cors = require('cors');
const axios = require('axios');
const openid = require('openid');
const CryptoJS = require('crypto-js');
const moment = require('moment');
const qs = require('qs');
const { fetchGameNews } = require('./news');

// ZaloPay Config
const zaloConfig = {
  app_id: '2553',
  key1: 'PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL',
  key2: 'kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz',
  endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
  query_endpoint: 'https://sb-openapi.zalopay.vn/v2/query'
};

// PayOS Config
const { PayOS } = require('@payos/node');
const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY
});



const app = express();
const PORT = process.env.PORT || 5000;

// Steam API Key
// Steam API Key
const STEAM_API_KEY = process.env.STEAM_API_KEY || 'F6F7130510E08D4107A50C499545F0F5';

// Steam OpenID configuration
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid';
const PRODUCTION_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://steam-auth-server-production.up.railway.app';

const relyingParty = new openid.RelyingParty(
  `${PRODUCTION_URL}/auth/steam/return`,
  PRODUCTION_URL,
  false,  // Stateful verification (fixes nonce replay issues)
  true,   // Use association (more secure, prevents nonce errors)
  []
);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'neon_nexus_secret_key',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Helper function to extract Steam ID from OpenID identifier
function extractSteamId(identifier) {
  const match = identifier.match(/\/id\/(\d+)/);
  return match ? match[1] : null;
}

// Route: Initiate Steam login
app.get('/auth/steam', (req, res) => {
  relyingParty.authenticate(STEAM_OPENID_URL, false, (error, authUrl) => {
    if (error) {
      console.error('❌ Authentication error:', error);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Login Error</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: linear-gradient(135deg, #171a21 0%, #1b2838 100%);
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            .error {
              background: #1b2838;
              padding: 2rem;
              border-radius: 8px;
              max-width: 500px;
            }
            h2 { color: #ff4444; }
            .btn {
              margin-top: 1rem;
              padding: 0.75rem 1.5rem;
              background: #66c0f4;
              border: none;
              border-radius: 4px;
              color: #000;
              cursor: pointer;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>⚠️ Steam Login Error</h2>
            <p>${error.message || 'Failed to connect to Steam'}</p>
            <button class="btn" onclick="window.close()">Close</button>
          </div>
        </body>
        </html>
      `);
    }
    
    if (!authUrl) {
      return res.send('Authentication failed');
    }
    
    // Redirect to Steam login
    res.redirect(authUrl);
  });
});

// Route: Steam callback
app.get('/auth/steam/return', async (req, res) => {
  relyingParty.verifyAssertion(req.url, async (error, result) => {
    if (error) {
      console.error('❌ Verification error:', error);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Verification Failed</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: linear-gradient(135deg, #171a21 0%, #1b2838 100%);
              color: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            .error {
              background: #1b2838;
              padding: 2rem;
              border-radius: 8px;
            }
            h2 { color: #ff4444; }
          </style>
        </head>
        <body>
          <div class="error">
            <h2>Verification Failed</h2>
            <p>${error.message}</p>
            <button onclick="window.close()">Close</button>
          </div>
        </body>
        </html>
      `);
    }

    if (!result || !result.authenticated) {
      return res.send('Authentication failed');
    }

    // Extract Steam ID from claimed identifier
    const steamId = extractSteamId(result.claimedIdentifier);
    
    if (!steamId) {
      return res.send('Failed to extract Steam ID');
    }

    console.log('✅ Steam ID authenticated:', steamId);

    // Fetch user profile from Steam API
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
            params: {
              key: STEAM_API_KEY,
              steamids: steamId
            },
            timeout: 5000
          }
        );

        if (response.data?.response?.players?.length > 0) {
          const player = response.data.response.players[0];
          userData = {
            steamId: player.steamid,
            displayName: player.personaname,
            photoURL: player.avatarfull || player.avatarmedium || player.avatar,
            profileUrl: player.profileurl
          };
          console.log('✅ Fetched Steam profile:', userData.displayName);
        }
      } catch (apiError) {
        console.warn('⚠️ Steam API call failed:', apiError.message);
      }
    }

    // Send success page
    const responseHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Steam Login Success</title>
        <style>
          body {
            background: linear-gradient(135deg, #171a21 0%, #1b2838 100%);
            color: #66c0f4;
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .success {
            text-align: center;
            animation: fadeIn 0.5s;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .checkmark {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin: 1rem auto;
            border: 3px solid #66c0f4;
          }
        </style>
      </head>
      <body>
        <div class="success">
          <div class="checkmark">✓</div>
          <img src="${userData.photoURL}" class="avatar" alt="Avatar">
          <h2>Welcome, ${userData.displayName}!</h2>
          <p>Login successful. Redirecting...</p>
        </div>
        <script>
          const user = ${JSON.stringify(userData)};
          
          if (window.opener) {
            // Send data to parent window
            window.opener.postMessage({ 
              type: 'STEAM_LOGIN_SUCCESS', 
              user: user 
            }, '*');
            
            // Close after delay
            setTimeout(() => window.close(), 1500);
          } else {
            document.body.innerHTML += '<p style="margin-top: 1rem;">Please close this window.</p>';
          }
        </script>
      </body>
      </html>
    `;

    res.send(responseHtml);
  });
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Steam Auth Server - Official OpenID',
    mode: 'production',
    endpoints: {
      login: '/auth/steam',
      callback: '/auth/steam/return'
    }
  });
});

// Health check (moved before server start)
// Server will be started at the end of the file

// ==========================================
// STEAM STORE API PROXY
// ==========================================
app.get('/api/steam/details', async (req, res) => {
    const appid = req.query.appid;
    if (!appid) return res.status(400).json({ error: 'Missing appid' });

    try {
        const response = await axios.get(`https://store.steampowered.com/api/appdetails`, {
            params: { appids: appid, l: 'english' },
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
        console.error('❌ Steam Store API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch Steam details' });
    }
});

// ==========================================
// CHEAPSHARK API PROXY (bypass CORS + rate limit)
// ==========================================
const cheapsharkCache = new Map(); // In-memory cache
const CS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

app.get('/api/cheapshark/:endpoint', async (req, res) => {
    const csPath = req.params.endpoint;
    const queryString = new URLSearchParams(req.query).toString();
    const csUrl = `https://www.cheapshark.com/api/1.0/${csPath}${queryString ? '?' + queryString : ''}`;
    const cacheKey = csUrl;

    // Check cache first
    const cached = cheapsharkCache.get(cacheKey);
    if (cached && (Date.now() - cached.time < CS_CACHE_TTL)) {
        console.log(`📦 CheapShark cache hit: ${csPath}`);
        return res.json(cached.data);
    }

    // Retry logic with exponential backoff for 429 errors
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.get(csUrl, {
                timeout: 15000,
                headers: { 'User-Agent': 'NeonNexus-GameStore/1.0' }
            });

            // Cache successful response
            cheapsharkCache.set(cacheKey, { data: response.data, time: Date.now() });
            console.log(`✅ CheapShark proxy OK: ${csPath} (attempt ${attempt})`);
            return res.json(response.data);
        } catch (error) {
            if (error.response && error.response.status === 429) {
                if (attempt < MAX_RETRIES) {
                    const waitMs = attempt * 2000; // 2s, 4s backoff
                    console.warn(`⏳ CheapShark 429 rate-limited, retrying in ${waitMs}ms (attempt ${attempt}/${MAX_RETRIES})...`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    continue;
                } else {
                    // --- Fallback Mechanism for 429 IP Bans ---
                    // If we are completely rate limited after all retries, return some dummy data so the site doesn't break
                    if (csPath === 'deals') {
                         console.warn('⚠️ Returning fallback dummy deals due to 429 IP Block.');
                         return res.json([{
                             internalName: "FALLBACK_GAME_1", title: "Cyberpunk 2077", dealID: "dummy_1", gameID: "123", salePrice: "29.99", normalPrice: "59.99", savings: "50", metacriticScore: "86", steamRatingPercent: "80", steamAppID: "1091500", releaseDate: 1607558400, lastChange: 1620000000, thumb: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/capsule_616x353.jpg"
                         }, {
                             internalName: "FALLBACK_GAME_2", title: "Elden Ring", dealID: "dummy_2", gameID: "456", salePrice: "39.99", normalPrice: "59.99", savings: "33", metacriticScore: "94", steamRatingPercent: "92", steamAppID: "1245620", releaseDate: 1645747200, lastChange: 1650000000, thumb: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/capsule_616x353.jpg"
                         }]);
                    }
                    if (csPath === 'games') {
                         console.warn('⚠️ Returning fallback dummy games due to 429 IP Block.');
                         // Basic structure expected by frontend
                         return res.json([{
                             gameID: "789", steamAppID: "883710", cheapest: "9.99", cheapestDealID: "dummy_3", external: "Resident Evil 2", internalName: "RESIDENTEVIL2", thumb: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/883710/capsule_616x353.jpg"
                         }, {
                             gameID: "101", steamAppID: "1196590", cheapest: "19.99", cheapestDealID: "dummy_4", external: "Resident Evil Village", internalName: "RESIDENTEVILVILLAGE", thumb: "https://file.hstatic.net/1000231532/file/resident_evil_village_tung_demo_726a5bb3f08e466289ef5fc26864e161.jpg"
                         }]);
                    }
                }
            }
            
            console.error('❌ CheapShark proxy error:', error.message);
            if (error.response) {
                return res.status(error.response.status).json({ error: `CheapShark API error: ${error.response.status}` });
            }
            return res.status(500).json({ error: 'Failed to fetch from CheapShark' });
        }
    }
});

// ==========================================
// STEAM PRICE PROXY (Dual VND + USD)
// ==========================================
app.get('/api/steam/price', async (req, res) => {
    const appidsParam = req.query.appids;
    if (!appidsParam) return res.status(400).json({ error: 'Missing appids parameter' });

    const appids = appidsParam.split(',').filter(id => id && id.trim() !== '' && id !== 'Unknown' && id !== 'N/A');
    if (appids.length === 0) return res.json({});

    console.log(`💰 Fetching Steam prices for ${appids.length} games (VN + US)...`);

    // Steam API chỉ chấp nhận tối đa ~50 IDs mỗi lần gọi,
    // nên ta chia nhỏ thành các batch 40 IDs
    const BATCH_SIZE = 40;
    const result = {};

    try {
        for (let i = 0; i < appids.length; i += BATCH_SIZE) {
            const batch = appids.slice(i, i + BATCH_SIZE);
            const idsStr = batch.join(',');

            // Gọi song song 2 khu vực: VN (VND) và US (USD)
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

                    result[id] = {
                        vnd: {
                            sale: Math.round(vnPrice.final / 100),
                            normal: Math.round(vnPrice.initial / 100)
                        },
                        usd: usPrice ? {
                            sale: usPrice.final / 100,
                            normal: usPrice.initial / 100
                        } : {
                            // Fallback nếu không có giá US: chia VND cho tỷ giá ước tính
                            sale: Math.round((vnPrice.final / 100) / 26000 * 100) / 100,
                            normal: Math.round((vnPrice.initial / 100) / 26000 * 100) / 100
                        },
                        savings: vnPrice.discount_percent || 0
                    };
                }
                // Nếu game miễn phí hoặc không có giá -> bỏ qua (giữ giá CheapShark gốc)
            }
        }

        console.log(`✅ Steam prices fetched: ${Object.keys(result).length}/${appids.length} games`);
        res.json(result);
    } catch (error) {
        console.error('❌ Steam Price API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch Steam prices' });
    }
});

// ==========================================
// STEAM IMAGE PROXY (bypass Akamai 403)
// ==========================================
app.get('/api/steam/image', async (req, res) => {
    const { url, appid } = req.query;

    // Accept full URL or construct from appid
    let imageUrl = url || null;
    if (!imageUrl && appid) {
        imageUrl = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
    }
    if (!imageUrl) {
        return res.status(400).json({ error: 'url or appid is required' });
    }

    // Security: only proxy Steam image URLs
    if (!imageUrl.includes('steamstatic.com') && !imageUrl.includes('steampowered.com')) {
        return res.status(403).json({ error: 'Only Steam URLs allowed' });
    }

    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
// TWITCH API PROXY (Auth & Search)
// ==========================================
app.get('/api/twitch/token', async (req, res) => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_SECRET;

    if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Twitch keys not configured in server' });
    }

    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials'
            }
        });
        
        // Return the token to the client
        res.json({ 
            access_token: response.data.access_token, 
            client_id: clientId // Client needs this too for headers
        });
    } catch (error) {
        console.error('❌ Twitch Auth Failed:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to authenticate with Twitch' });
    }
});



/**
 * PROXY: Search IGDB for Game Trailer (User Requested Logic)
 * Usage: GET /api/games/trailer?name=Resident%20Evil%205
 */
app.get('/api/games/trailer', async (req, res) => {
    const gameName = req.query.name;
    if (!gameName) return res.status(400).json({ error: 'Missing game name' });

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_SECRET;

    if (!clientId || !clientSecret) { // Mock response if no keys
         console.warn('⚠️ No Twitch Keys. Returning Mock Trailer.');
         console.warn('⚠️ No Twitch Keys. Returning Mock Trailer.');
         // Return a safe mock for demo (Stardew Valley - very safe/embeddable)
         return res.json({ 
             title: 'Stardew Valley (Demo Fallback)', 
             video_id: 'ot7uXAWTq94' 
         });
    }

    try {
        // 1. Get Token (Client Credentials)
        // Note: In production, you should cache this token globally
        const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'client_credentials'
            }
        });
        const accessToken = tokenRes.data.access_token;

        // 2. Query IGDB for Trailer
        // Fetch up to 5 videos to choose the best one
        const igdbQuery = `fields name, videos.video_id, videos.name; search "${gameName}"; limit 1;`;
        
        const igdbRes = await axios({
            url: 'https://api.igdb.com/v4/games',
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'text/plain'
            },
            data: igdbQuery
        });

        const games = igdbRes.data;
        if (games && games.length > 0 && games[0].videos && games[0].videos.length > 0) {
            const videos = games[0].videos;
            let chosenVideo = videos[0]; // Default to first

            // Try to find a "Gameplay" or "Launch" trailer as they are often less restricted
            const saferVideo = videos.find(v => 
                v.name.toLowerCase().includes('gameplay') || 
                v.name.toLowerCase().includes('launch')
            );
            
            if (saferVideo) {
                chosenVideo = saferVideo;
            }

            console.log(`✅ IGDB Found Trailer for ${gameName}: ${chosenVideo.name} (${chosenVideo.video_id})`);
            return res.json({ 
                title: games[0].name,
                video_id: chosenVideo.video_id 
            });
        }
        
        console.log(`⚠️ IGDB: No trailer found for ${gameName}`);
        return res.status(404).json({ error: 'No trailer found' });

    } catch (error) {
        console.error('❌ IGDB Proxy Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch from IGDB' });
    }
});

// ==========================================
// PAYOS PAYMENT ENDPOINT
// ==========================================
app.post('/api/create-payos-payment', async (req, res) => {
  try {
    const { amount, description, returnUrl, cancelUrl } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const orderCode = Number(String(Date.now()).slice(-6));
    const body = {
      orderCode: orderCode,
      amount: Math.round(Number(amount)), // Ensure integer
      description: (description || 'Thanh toan don hang').slice(0, 25), // PayOS might limit chars
      cancelUrl: cancelUrl || 'http://localhost:5500/final/index.html',
      returnUrl: returnUrl || 'http://localhost:5500/final/html/keygen.html'
    };

    console.log('📦 PayOS Payload:', JSON.stringify(body, null, 2));
    console.log('🔑 Client ID:', payOS.clientId); // Check if keys are loaded (don't log sensitive keys fully)

    const paymentLinkResponse = await payOS.paymentRequests.create(body);
    
    console.log('✅ PayOS Payment Link created:', paymentLinkResponse.checkoutUrl);
    res.json({ checkoutUrl: paymentLinkResponse.checkoutUrl });

  } catch (error) {
    console.error('❌ PayOS Error:', error.message);
    if (error.code) console.error('   Code:', error.code);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// MOMO PAYMENT ENDPOINT
// ==========================================
// Import momo helper
const { createMomoPayment } = require('../API/momo');

app.post('/api/create-momo-payment', async (req, res) => {
    try {
        const { amount, redirectUrl } = req.body;
        
        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const orderId = 'MOMO' + new Date().getTime();
        const orderInfo = 'Pay with MoMo at NeonNexus';
        
        console.log(`💸 Creating MoMo payment for order ${orderId}, amount: ${amount}`);

        // Pass redirectUrl if provided
        const result = await createMomoPayment(amount, orderId, orderInfo, redirectUrl);
        
        if (result && result.payUrl) {
            console.log('✅ MoMo Payment URL created:', result.payUrl);
            res.json({ payUrl: result.payUrl });
        } else {
            console.error('❌ Failed to create MoMo payment:', result);
            res.status(500).json({ error: 'Failed to create payment URL', details: result });
        }

    } catch (error) {
        console.error('❌ Server Error creating MoMo payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// STRIPE PAYMENT ENDPOINT
// ==========================================
app.post('/api/create-payment-intent', async (req, res) => {
    try {
        const { amount, currency = 'vnd' } = req.body;
        
        console.log(`💳 Creating Stripe Intent: ${amount} ${currency.toUpperCase()}`);
        console.log(`   (Key length: ${stripeKey ? stripeKey.trim().length : 0})`);

        if (!stripe) {
            throw new Error('Stripe is not configured on this server.');
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount),
            currency: currency,
            payment_method_types: ['card'],
        });

        console.log('✅ Intent created:', paymentIntent.id);
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('❌ Stripe Error (Catch):', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ZALOPAY PAYMENT ENDPOINTS
// ==========================================

// Create ZaloPay Order
app.post('/api/create-zalopay-payment', async (req, res) => {
    try {
        const { amount, redirectUrl } = req.body;
        
        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const embed_data = {
            // After payment, redirect here
            redirecturl: redirectUrl || 'http://localhost:5500/final/html/keygen.html'
        };

        const items = []; // Can be populated with cart items if needed
        const transID = Math.floor(Math.random() * 1000000); // Random trans ID
        
        const order = {
            app_id: zaloConfig.app_id,
            app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
            app_user: 'user123',
            app_time: Date.now(), // milliseconds
            item: JSON.stringify(items),
            embed_data: JSON.stringify(embed_data),
            amount: amount,
            description: `NeonNexus - Payment for order #${transID}`,
            bank_code: '',
            // callback_url: 'https://your-domain.com/api/zalopay-callback' 
            // Note: callback_url must be public. For local dev, we rely on client-side check or ngrok.
        };

        // Mac Generation: appid|app_trans_id|appuser|amount|apptime|embeddata|item
        const data = zaloConfig.app_id + '|' + order.app_trans_id + '|' + order.app_user + '|' + order.amount + '|' + order.app_time + '|' + order.embed_data + '|' + order.item;
        order.mac = CryptoJS.HmacSHA256(data, zaloConfig.key1).toString();

        console.log(`🔷 Creating ZaloPay Order: ${order.app_trans_id}, Amount: ${amount}`);

        const result = await axios.post(zaloConfig.endpoint, null, { params: order });
        
        console.log('✅ ZaloPay Response:', result.data);
        
        // return_code = 1 means success
        return res.status(200).json(result.data);

    } catch (error) {
        console.error('❌ ZaloPay Error:', error.message);
        res.status(500).json({ error: 'Failed to create ZaloPay order' });
    }
});

// Sync Check Status (Optional, often used by frontend to verify status)
app.post('/api/check-zalopay-status', async (req, res) => {
  const { app_trans_id } = req.body;

  let postData = {
    app_id: zaloConfig.app_id,
    app_trans_id, 
  };

  let data = postData.app_id + '|' + postData.app_trans_id + '|' + zaloConfig.key1; // appid|app_trans_id|key1
  postData.mac = CryptoJS.HmacSHA256(data, zaloConfig.key1).toString();

  let postConfig = {
    method: 'post',
    url: zaloConfig.query_endpoint,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: qs.stringify(postData),
  };

  try {
    const result = await axios(postConfig);
    console.log(`🔎 ZaloPay Status Check (${app_trans_id}):`, result.data);
    return res.status(200).json(result.data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// NEWS API - Game News Aggregator
// =============================================
app.get('/api/news', async (req, res) => {
  try {
    const { lang = 'all', limit = 20 } = req.query;
    const news = await fetchGameNews(lang, parseInt(limit));
    res.json({
      success: true,
      count: news.length,
      data: news
    });
  } catch (error) {
    console.error('❌ News API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news'
    });
  }
});

// Global Error Handlers
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION! Server shutting down...');
  console.error(err);
  // process.exit(1); // Keep running if possible or exit
});

process.on('unhandledRejection', (err) => {
  console.error('🔥 UNHANDLED REJECTION! Server shutting down...');
  console.error(err);
});

const server = app.listen(PORT, () => {
  console.log('============================================================');
  console.log('🚀 Steam Auth Server - OFFICIAL OpenID');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🔐 Login: http://localhost:${PORT}/auth/steam`);
  console.log('============================================================');
  console.log('');
  console.log('✅ Using Steam Community OpenID');
  console.log(`   Endpoint: ${STEAM_OPENID_URL}`);
  console.log(`   API Key: ${STEAM_API_KEY ? '✓ Configured' : '❌ MISSING'}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use! Please close other processes on this port.`);
    // Optionally retry?
  } else {
    console.error('❌ Server Error:', e);
  }
});
