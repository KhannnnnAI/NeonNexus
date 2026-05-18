/**
 * steam-proxy.js
 * Local CORS proxy — fetches Steam Featured Categories and serves it with CORS headers.
 * Run once: node steam-proxy.js
 * Then the browser calls http://localhost:3001/steam-featured (no CORS issues)
 */

const http  = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const STEAM_API = 'https://store.steampowered.com/api/featuredcategories/?cc=us&l=en';

const server = http.createServer((req, res) => {
  // Allow all origins (browser calling from any protocol)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  
  // Handle static files from Image directory
  if (req.url.startsWith('/Image/')) {
    const filePath = path.join(__dirname, req.url);
    const ext = path.extname(filePath);
    
    // Set content type based on file extension
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.gif': 'image/gif'
    };
    
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Image not found');
        return;
      }
      res.writeHead(200);
      res.end(data);
    });
    return;
  }
  
  if (req.url !== '/steam-featured') { res.writeHead(404); res.end('Not found'); return; }

  // Set content type for API endpoint
  res.setHeader('Content-Type', 'application/json');

  // Fetch from Steam and forward
  https.get(STEAM_API, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  }, (steamRes) => {
    let body = '';
    steamRes.on('data', chunk => body += chunk);
    steamRes.on('end', () => {
      res.writeHead(200);
      res.end(body);
      console.log('[Steam Proxy] Served Steam data:', new Date().toLocaleTimeString());
    });
  }).on('error', (err) => {
    console.error('[Steam Proxy] Error:', err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Steam Local Proxy — đang chạy             ║');
  console.log('║   http://localhost:' + PORT + '/steam-featured        ║');
  console.log('║   Giữ cửa sổ này mở khi dùng trang web     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('[Steam Proxy] Port 3001 đã được dùng — proxy có thể đang chạy rồi');
  } else {
    console.error('[Steam Proxy] Lỗi server:', err);
  }
});
