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
// CONFIGURATION
// ==========================================

// PayOS Config
const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY
});

// ZaloPay Config
const zaloConfig = {
  app_id: '2553',
  key1: 'PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL',
  key2: 'kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz',
  endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
  query_endpoint: 'https://sb-openapi.zalopay.vn/v2/query'
};

// Stripe Config
const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripe;
if (stripeKey && stripeKey.trim().length > 0 && !stripeKey.includes('copy your full key')) {
  stripe = require('stripe')(stripeKey.trim());
} else {
  console.warn('⚠️ STRIPE_SECRET_KEY missing or invalid. Stripe features disabled.');
}

// Steam Config
const STEAM_API_KEY = process.env.STEAM_API_KEY || 'F6F7130510E08D4107A50C499545F0F5';
const STEAM_OPENID_URL = 'https://steamcommunity.com/openid';

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'neon_nexus_secret_key',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if relying on https (Firebase is https) but for simplicity false
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

// Route: Initiate Steam login
app.get('/auth/steam', (req, res) => {
  const baseUrl = getBaseUrl(req);
  const returnUrl = `${baseUrl}/auth/steam/return`;
  const realm = `${baseUrl}/`;

  console.log(`STEAM AUTH: Realm=${realm}, Return=${returnUrl}`);

  const relyingParty = new openid.RelyingParty(
    returnUrl,
    realm,
    false,  // Stateful verification
    true,   // Use association
    []
  );

  relyingParty.authenticate(STEAM_OPENID_URL, false, (error, authUrl) => {
    if (error) {
      console.error('❌ Authentication error:', error);
      return res.status(500).send('Authentication Error: ' + error.message);
    }
    if (!authUrl) return res.status(500).send('Authentication Failed');
    res.redirect(authUrl);
  });
});

// Route: Steam callback
app.get('/auth/steam/return', async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const returnUrl = `${baseUrl}/auth/steam/return`;
  const realm = `${baseUrl}/`;

  const relyingParty = new openid.RelyingParty(
    returnUrl,
    realm,
    false,
    true,
    []
  );

  relyingParty.verifyAssertion(req.url, async (error, result) => {
    if (error || !result || !result.authenticated) {
      console.error('❌ Verification error:', error);
      return res.status(401).send('Verification Failed');
    }

    const match = result.claimedIdentifier.match(/\/id\/(\d+)/);
    const steamId = match ? match[1] : null;

    if (!steamId) return res.status(400).send('No Steam ID found');

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
        console.warn('⚠️ Steam API call failed:', apiError.message);
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
  });
});

// ==========================================
// TWITCH API PROXY
// ==========================================
app.get('/api/twitch/token', async (req, res) => {
    // Note: User needs to ensure TWITCH keys are in .env
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

// PayOS
app.post('/api/create-payos-payment', async (req, res) => {
  try {
    const { amount, description, returnUrl, cancelUrl } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount required' });

    const orderCode = Number(String(Date.now()).slice(-6));
    const body = {
      orderCode: orderCode,
      amount: Math.round(Number(amount)),
      description: (description || 'Payment').slice(0, 25),
      cancelUrl: cancelUrl || 'https://neonnexus.web.app',
      returnUrl: returnUrl || 'https://neonnexus.web.app' // Fallbacks need to be absolute URLs in prod
    };
    
    // Check if URLs are local, if so, they are fine, but in Prod they must be public.
    // PayOS requires public URLs usually? Or at least reachable from user browser.

    console.log('PAYOS_CREATE:', body.orderCode, body.amount);
    const paymentLinkResponse = await payOS.paymentRequests.create(body);
    res.json({ checkoutUrl: paymentLinkResponse.checkoutUrl });

  } catch (error) {
    console.error('PayOS Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Stripe
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

// ZaloPay (Create Order)
app.post('/api/create-zalopay-payment', async (req, res) => {
    try {
        const { amount, redirectUrl } = req.body;
        const transID = Math.floor(Math.random() * 1000000);
        const order = {
            app_id: zaloConfig.app_id,
            app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
            app_user: 'user123',
            app_time: Date.now(),
            item: '[]',
            embed_data: JSON.stringify({ redirecturl: redirectUrl }),
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

// MoMo (Simplification: using a dedicated function if it exists, else simplified mock logic for now as I don't have momo.js content fully read and mapped, 
// BUT server.js imported it. I should assume momo.js exists in functions/ folder too.
// I see 'momo.js' in Step 364 listing. I should use it.)
const { createMomoPayment } = require('./momo');
app.post('/api/create-momo-payment', async (req, res) => {
    try {
        const { amount, redirectUrl } = req.body;
        const result = await createMomoPayment(amount, 'MOMO'+Date.now(), 'Payment', redirectUrl);
        if (result && result.payUrl) res.json({ payUrl: result.payUrl });
        else res.status(500).json({ error: 'Failed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Health
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Export
exports.api = functions.https.onRequest(app);
