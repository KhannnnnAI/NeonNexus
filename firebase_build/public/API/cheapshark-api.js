// ===================================
// CHEAPSHARK API MODULE
// ===================================

var CheapSharkAPI = (() => {
  // ---- Smart URL Routing ----
  var CHEAPSHARK_DIRECT_URL = 'https://www.cheapshark.com/api/1.0';
  
  // Detect server URL based on current location
  function getServerURL() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // Firebase production/preview
    if (hostname.includes('web.app') || hostname.includes('firebaseapp.com')) {
      return 'https://nenonexus-digital-game-store.web.app';
    }
    
    // Localhost development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:5000`;
    }
    
    // Fallback
    return 'https://nenonexus-digital-game-store.web.app';
  }
  
  var SERVER_URL = getServerURL();
  var PROXY_URL = `${SERVER_URL}/api/cheapshark`;

  var BASE_URL = PROXY_URL;
  var useProxy = true;
  var serverChecked = false;

  async function checkServerAvailability() {
    if (serverChecked) return useProxy;

    try {
      var controller = new AbortController();
      var timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout
      var response = await fetch(`${SERVER_URL}/api/cheapshark/deals?storeID=1&pageSize=1`, {
        signal: controller.signal,
        method: 'GET',
        credentials: 'include'
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        useProxy = true;
        BASE_URL = PROXY_URL;
        console.log('[CheapShark] Proxy server is available - using proxy mode');
      } else {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (err) {
      console.warn('[CheapShark] Proxy server unavailable:', err.message);
      console.log('[CheapShark] Switching to DIRECT CheapShark API mode');
      useProxy = false;
      BASE_URL = CHEAPSHARK_DIRECT_URL;
    }
    serverChecked = true;
    return useProxy;
  }

  var EXCHANGE_RATE = 26000; // 1 USD = 26,000 VND
  var PAGE_SIZE = 60;
  
  var CATEGORIES = ["All", "Action", "RPG", "Strategy", "Indie", "Shooter", "Adventure", "Simulation", "Racing", "Horror"];

  // BUMP VERSION LÊN v14 ĐỂ XÓA SẠCH CACHE CŨ BỊ THIẾU THUMB
  const GAMES_CACHE_KEY_PREFIX = 'cheapshark_games_page_v14_';
  const RE_GAMES_CACHE_KEY = 'cheapshark_resident_evil_v14';
  var STEAM_PRICE_CACHE_KEY = 'cheapshark_steam_price_v4';
  
  var GAMES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
  var RE_GAMES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  var STEAM_PRICE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  var memorySteamPriceCache = new Map();

  function readLocalCache(key, ttlMs) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.time) return null;
      if (Date.now() - parsed.time > ttlMs) return null;
      return parsed.data;
    } catch (_) {
      return null;
    }
  }

  function writeLocalCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
    } catch (_) {
    }
  }

  function loadStoredSteamPriceCache() {
    try {
      var raw = localStorage.getItem(STEAM_PRICE_CACHE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.time || !parsed.data) return {};
      if (Date.now() - parsed.time > STEAM_PRICE_CACHE_TTL_MS) return {};
      return parsed.data;
    } catch (_) {
      return {};
    }
  }

  function saveStoredSteamPriceCache(data) {
    try {
      localStorage.setItem(STEAM_PRICE_CACHE_KEY, JSON.stringify({
        time: Date.now(),
        data
      }));
    } catch (_) {
    }
  }

  function getCachedSteamPrice(id, persistedCache) {
    var memoryEntry = memorySteamPriceCache.get(id);
    if (memoryEntry && (Date.now() - memoryEntry.time <= STEAM_PRICE_CACHE_TTL_MS)) {
      return memoryEntry.data;
    }

    var persisted = persistedCache[id];
    if (persisted) {
      memorySteamPriceCache.set(id, { data: persisted, time: Date.now() });
      return persisted;
    }

    return null;
  }

  var MAX_CONCURRENT_REQUESTS = 5;
  var activeRequests = 0;
  var requestQueue = [];

  async function processQueue() {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) return;
    
    activeRequests++;
    var { url, options, resolve, reject, retries } = requestQueue.shift();
    
    try {
      var response = await fetch(url, options);
      if (response.status === 429) {
        throw new Error('429 Too Many Requests');
      }
      resolve(response);
    } catch (error) {
      if (url.includes(PROXY_URL) && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.name === 'TypeError')) {
        console.warn(' Proxy connection failed, retrying with direct CheapShark URL...');
        useProxy = false;
        BASE_URL = CHEAPSHARK_DIRECT_URL;
        var directUrl = url.replace(PROXY_URL, CHEAPSHARK_DIRECT_URL);
        try {
          const directResponse = await fetch(directUrl, options);
          if (directResponse.status === 429) {
            throw new Error('429 Too Many Requests');
          }
          resolve(directResponse);
          return;
        } catch (directError) {
          reject(directError);
          return;
        }
      }

      if (error.message.includes('429') && retries > 0) {
        console.warn(` Rate limited on ${url}, retrying in 2s...`);
        setTimeout(() => {
          requestQueue.push({ url, options, resolve, reject, retries: retries - 1 });
          processQueue();
        }, 2000 + Math.random() * 1000);
      } else {
        reject(error);
      }
    } finally {
      activeRequests--;
      processQueue();
    }
  }

  function fetchWithQueue(url, options = {}, retries = 3) {
    return new Promise((resolve, reject) => {
      requestQueue.push({ url, options, resolve, reject, retries });
      processQueue();
    });
  }

  async function fetchSteamPrices(steamIds) {
    if (!serverChecked) {
      await checkServerAvailability();
    }
    if (!useProxy) {
      return {};
    }
    if (!steamIds || steamIds.length === 0) return {};
    var validIds = steamIds.filter(id => id && id !== 'Unknown' && id !== 'N/A');
    if (validIds.length === 0) return {};

    var persistedCache = loadStoredSteamPriceCache();
    var result = {};
    var missingIds = [];

    for (const id of validIds) {
      var cached = getCachedSteamPrice(id, persistedCache);
      if (cached) {
        result[id] = cached;
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) {
      return result;
    }

    try {
      var url = `${SERVER_URL}/api/steam/price?appids=${missingIds.join(',')}`;
      var controller = new AbortController();
      var timeout = setTimeout(() => controller.abort(), 7000);
      var response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Steam price API error: ${response.status}`);
      var data = await response.json();

      var mergedPersisted = { ...persistedCache };
      for (const [id, value] of Object.entries(data)) {
        result[id] = value;
        memorySteamPriceCache.set(id, { data: value, time: Date.now() });
        mergedPersisted[id] = value;
      }
      saveStoredSteamPriceCache(mergedPersisted);
      return result;
    } catch (error) {
      console.warn(`[Steam API] Error fetching prices:`, error);
      return result;
    }
  }

  function applySteamPrice(game, steamPrices) {
    var steamInfo = steamPrices[game.steamAppID];
    
    if (!steamInfo) {
      if (game.steamAppID === '3764200') {
        game.price = 1450000;
        game.originalPrice = 1450000;
        game.savings = 0;
      }
      return;
    }

    game.salePriceVND = steamInfo.vnd.sale;
    game.normalPriceVND = steamInfo.vnd.normal;
    game.salePriceUSD = steamInfo.usd.sale;
    game.normalPriceUSD = steamInfo.usd.normal;

    game.price = steamInfo.vnd.sale;
    game.originalPrice = steamInfo.vnd.normal;
    game.savings = steamInfo.savings;
    game.steamPriceLoaded = true;
  }

  function setExchangeRate(rate) {
    EXCHANGE_RATE = rate;
  }

  function getExchangeRate() {
    return EXCHANGE_RATE;
  }

  async function fetchDeals(pageNumber = 0) {
    try {
      var sortOption = pageNumber % 2 === 0 ? 'Metacritic' : 'B12d'; 
      var url = `${BASE_URL}/deals?storeID=1&pageSize=${PAGE_SIZE}&pageNumber=${pageNumber}&onSale=1&sortBy=${sortOption}&lowerPrice=5&AAA=1`;
      
      console.log(` Fetching recommended games (page ${pageNumber}, sort: ${sortOption}) from CheapShark API...`);
      var response = await fetchWithQueue(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      var data = await response.json();
      console.log(` Loaded ${data.length} recommended deals from page ${pageNumber}`);
      
      return data;
    } catch (error) {
      console.error(' Error fetching from CheapShark API:', error);
      throw error;
    }
  }

  function getBestImageUrl(deal, baseTitle = null) {
    var title = baseTitle || deal.title || deal.external || '';
    
    const RE_ID_MAP = {
      '4249100': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249100/370da9c8c5e4573ea3c9d6ff22c88e89728fa0ed/header.jpg?t=1775088621',
      '4249110': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249110/db95a4fbb11b56b6dc065dc0d6c662dab47498e5/header.jpg?t=1775090214',
      '4249120': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249120/a882eb9852c45108a0e4d725cd15132387ab038e/header.jpg?t=1775090236',
      '304240':  'https://www.residentevil.com/1/_asset/images/bio1-share-global.png',
      '3764200': 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3764200/ce5437442768e38eb575f205ab9397d0264017b0/header.jpg'
    };

    const reAppID = deal.steamAppID && deal.steamAppID !== 'Unknown' ? deal.steamAppID : null;
    const reImageOverride = RE_ID_MAP[reAppID];
    
    if (reImageOverride) {
      return {
        primary: reImageOverride,
        fallback: reImageOverride,
        fallback2: reImageOverride,
        title: title
      };
    }

    if (title && title.toLowerCase().includes('resident evil') && !title.match(/\d/) && !title.toLowerCase().includes('village')) {
      const bio1Image = "https://www.residentevil.com/1/_asset/images/bio1-share-global.png";
      return {
        primary: bio1Image,
        fallback: bio1Image,
        fallback2: bio1Image,
        title: title
      };
    }

    if ((deal.steamAppID && deal.steamAppID == '2947440') || (title && title.toLowerCase().includes('silent hill f'))) {
       var silentHillArt = "https://kamikey.com/wp-content/uploads/2025/08/SILENT-HILL-f.jpg";
       return {
         primary: silentHillArt,
         fallback: silentHillArt,
         fallback2: silentHillArt,
         title: title
       };
    }

    if (deal.steamAppID && deal.steamAppID !== 'Unknown' && deal.steamAppID !== 'N/A') {
      let primaryImage = deal.thumb;
      let steamHeader = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${deal.steamAppID}/header.jpg`;

      if (!deal.thumb || deal.thumb.includes('no_image_available') || deal.thumb.includes('steamstatic.com')) {
        primaryImage = steamHeader; 
      }

      const result = {
        primary: primaryImage,
        fallback: steamHeader, 
        fallback2: deal.thumb,  
        title: title || deal.title || deal.external
      };
      return result;
    }

    var primary = deal.thumb;
    var fallback = deal.thumb;
    var fallback2 = `https://placehold.co/616x353/1a1a1a/22d3ee?text=${encodeURIComponent(title || 'No+Image')}`;

    return {
      primary: primary,
      fallback: fallback,
      fallback2: fallback2,
      title: title || deal.title || deal.external
    };
  }

  function transformDeal(deal) {
    var imageUrls = getBestImageUrl(deal, deal.title);
    var randomCat = CATEGORIES[Math.floor(Math.random() * (CATEGORIES.length - 1)) + 1];

    let finalPrice = parseFloat(deal.salePrice) * EXCHANGE_RATE;
    let finalOriginal = parseFloat(deal.normalPrice) * EXCHANGE_RATE;
    let finalSavings = Math.round(parseFloat(deal.savings));

    var result = {
      id: deal.gameID,
      dealID: deal.dealID, 
      title: deal.title,
      price: finalPrice,
      originalPrice: finalOriginal,
      savings: finalSavings,
      category: randomCat,
      rating: deal.steamRatingPercent > 0 ? (deal.steamRatingPercent / 20).toFixed(1) : ((Math.random() * 1.5) + 3.5).toFixed(1),
      image: imageUrls.primary,
      imageFallback: imageUrls.fallback,
      imageFallback2: imageUrls.fallback2,
      thumb: deal.thumb, // <---- ĐÃ FIX: TRẢ THUỘC TÍNH THUMB RA NGOÀI ĐỂ INDEX.JS DÙNG
      rawgTitle: imageUrls.title,
      platform: "STEAM",
      specs: parseFloat(deal.normalPrice) >= 30 ? "AAA GAME" : "INDIE",
      dealRating: deal.dealRating,
      steamAppID: deal.steamAppID
    };

    const RE_ID_TO_TITLE = {
      '883710': 'Resident Evil 2 Remake',
      '952060': 'Resident Evil 3 Remake',
      '2050650': 'Resident Evil 4 Remake',
      '254700': 'Resident Evil 4 Classic',
      '4249100': 'Resident Evil Classic',
      '4249110': 'Resident Evil 2 Classic',
      '4249120': 'Resident Evil 3: Nemesis',
      '1196590': 'Resident Evil Village',
      '418370':  'Resident Evil 7 Biohazard',
      '221040':  'Resident Evil 6',
      '21690':   'Resident Evil 5',
      '304240':  'Resident Evil HD Remaster',
      '339340':  'Resident Evil 0',
      '222480':  'Resident Evil Revelations',
      '287290':  'Resident Evil Revelations 2',
      '3764200': 'Resident Evil: Requiem',
    };

    const RE_TITLE_TO_ID = {
      'resident evil 4 remake': '2050650',
      'resident evil 3 remake': '952060',
      'resident evil 2 remake': '883710',
      'resident evil village': '1196590',
      'resident evil 7 biohazard': '418370',
      'resident evil 6': '221040',
      'resident evil 5': '21690',
      'resident evil 4 classic': '254700',
      'resident evil hd remaster': '304240',
      'resident evil 0': '339340',
      'resident evil revelations': '222480',
      'resident evil revelations 2': '287290',
      'resident evil requiem': '3764200',
      'nemesis': '4249120',
      'classic 2': '4249110',
      'classic 1': '4249100'
    };

    if (!result.steamAppID || result.steamAppID === 'Unknown' || result.steamAppID === '0') {
      const t = result.title.toLowerCase();
      for (const [titlePattern, id] of Object.entries(RE_TITLE_TO_ID)) {
        if (t.includes(titlePattern)) {
          result.steamAppID = id;
          break;
        }
      }
    }

    if (result.steamAppID && RE_ID_TO_TITLE[result.steamAppID]) {
      result.title = RE_ID_TO_TITLE[result.steamAppID];
      const updatedImages = getBestImageUrl(result, result.title);
      result.image = updatedImages.primary;
      result.imageFallback = updatedImages.fallback;
      result.imageFallback2 = updatedImages.fallback2;
    }

    if (result.steamAppID === '3764200') {
      result.price = 1450000;
      result.originalPrice = 1450000;
      result.savings = 0;
    }

    return result;
  }

  async function fetchResidentEvilGames() {
    try {
      var cachedReGames = readLocalCache(RE_GAMES_CACHE_KEY, RE_GAMES_CACHE_TTL_MS);
      if (cachedReGames && Array.isArray(cachedReGames)) {
        return cachedReGames;
      }

      var [mainRes, revRes] = await Promise.all([
          fetchWithQueue(`${BASE_URL}/games?title=resident%20evil&limit=60`),
          fetchWithQueue(`${BASE_URL}/games?title=resident%20evil%20revelations&limit=10`)
      ]);
      
      var mainData = await mainRes.json();
      var revData = await revRes.json();
      
      var allData = [...mainData, ...revData];
      var uniqueData = Array.from(new Map(allData.map(item => [item.gameID, item])).values());
      
      var mappedGames = uniqueData
        .filter(game => {
            const t = game.external.toLowerCase();
            return !t.includes('resident evil hd remaster') && 
                   !t.includes('trilogy') && 
                   !t.includes('bundle') &&
                   !t.includes('pack') &&
                   !t.includes('episode') && 
                   !t.includes('season pass') &&
                   !t.includes('dlc') &&
                   !t.includes('gold'); 
        })
        .map(game => {
          const randomCat = CATEGORIES[Math.floor(Math.random() * (CATEGORIES.length - 1)) + 1];
          const cheapest = game.cheapest ? parseFloat(game.cheapest) : 29.99;
          const imageUrls = getBestImageUrl(game, game.external);
          let displayImage = imageUrls.primary;
          
          if (game.external.includes(' / ')) {
              game.external = game.external.split(' / ')[0].trim();
          } else if (game.external.includes('/')) {
              game.external = game.external.split('/')[0].trim();
          }

          game.external = game.external
            .replace(/\(Deluxe.*?\)/gi, '')
            .replace(/\s*Complete.* Edition/gi, '')
            .replace(/\s*Complete/gi, '')
            .replace(/\(Complete.*?\)/gi, '')
            .replace(/\s+/g, ' ') 
            .trim();
          
          const RE_TITLE_TO_ID = {
            'resident evil 4 remake': '2050650',
            'resident evil 3 remake': '952060',
            'resident evil 2 remake': '883710',
            'resident evil village': '1196590',
            'resident evil 7 biohazard': '418370',
            'resident evil 6': '221040',
            'resident evil 5': '21690',
            'resident evil 4 classic': '254700',
            'resident evil hd remaster': '304240',
            'resident evil 0': '339340',
            'resident evil revelations': '222480',
            'resident evil revelations 2': '287290',
            'resident evil requiem': '3764200',
          };

          const cleanTitle = game.external.toLowerCase();
          if ((!game.steamAppID || game.steamAppID === 'Unknown' || game.steamAppID === '0')) {
             for (const [title, id] of Object.entries(RE_TITLE_TO_ID)) {
               if (cleanTitle.includes(title)) {
                 game.steamAppID = id;
                 break;
               }
             }
          }

          const RE_ID_MAP = {
            '4249100': { title: 'Resident Evil Classic', image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249100/370da9c8c5e4573ea3c9d6ff22c88e89728fa0ed/header.jpg?t=1775088621' },
            '4249110': { title: 'Resident Evil 2 Classic', image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249110/db95a4fbb11b56b6dc065dc0d6c662dab47498e5/header.jpg?t=1775090214' },
            '4249120': { title: 'Resident Evil 3: Nemesis', image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249120/a882eb9852c45108a0e4d725cd15132387ab038e/header.jpg?t=1775090236' },
            '2050650': { title: 'Resident Evil 4 Remake', image: 'https://image.api.playstation.com/vulcan/ap/rnd/202210/0712/BiS5QP6h4506JHyJlZlVzK9D.jpg' },
            '254700':  { title: 'Resident Evil 4 Classic', image: 'https://gaming-cdn.com/images/products/7818/orig/resident-evil-4-2005-pc-game-steam-europe-cover.jpg?v=1747906511' },
            '883710':  { title: 'Resident Evil 2 Remake', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/883710/header.jpg?t=1728438541' },
            '952060':  { title: 'Resident Evil 3 Remake', image: 'https://i.ytimg.com/vi/UxfvgMp9xdU/maxresdefault.jpg' },
            '1196590': { title: 'Resident Evil Village', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1196590/header.jpg?t=1770093483' },
            '21690':   { title: 'Resident Evil 5', image: 'https://www.residentevil.com/5/_asset/images/bio5-share-global.png' },
            '339340':  { title: 'Resident Evil 0', image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/339340/header.jpg?t=1742177237' },
            '304240':  { title: 'Resident Evil HD Remaster', image: 'https://www.residentevil.com/1/_asset/images/bio1-share-global.png' },
            '3764200': { title: 'Resident Evil: Requiem', image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3764200/ce5437442768e38eb575f205ab9397d0264017b0/header.jpg' },
            '221040':  { title: 'Resident Evil 6', image: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/221040/header.jpg' },
            '418370':  { title: 'Resident Evil 7 Biohazard', image: 'https://image.api.playstation.com/vulcan/ap/rnd/202206/0311/cp7G7TILGKzAzLGb1MMn9hyt.jpg' },
          };

          const reIdOverride = game.steamAppID && RE_ID_MAP[game.steamAppID];
          if (reIdOverride) {
            game.external = reIdOverride.title;
            displayImage = reIdOverride.image;
          } else {
            if (game.external === 'Resident Evil Revelations 2') {
              displayImage = "https://www.nintendo.com/eu/media/images/10_share_images/games_15/nintendo_switch_download_software_1/H2x1_NSwitchDS_ResidentEvilRevelations2_image1600w.jpg";
            } else if (game.external === 'Resident Evil: Revelations' || game.external === 'Resident Evil Revelations') {
              displayImage = "https://www.nintendo.com/eu/media/images/10_share_images/games_15/nintendo_switch_download_software_1/H2x1_NSwitchDS_ResidentEvilRevelations_image1600w.jpg";
            } else if (game.external.includes('Resident Evil 7')) {
              displayImage = "https://image.api.playstation.com/vulcan/ap/rnd/202206/0311/cp7G7TILGKzAzLGb1MMn9hyt.jpg";
              game.external = "Resident Evil 7 Biohazard";
            } else if (game.external.includes('Resident Evil 6')) {
              displayImage = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/221040/header.jpg";
            } else if (game.external === 'Resident Evil (GOG)') {
              displayImage = "https://gpstatic.com/acache/79/00/1/us/packshot-295a3a91a3ce2c8fe8b1324421c12ce5.jpg";
              game.steamAppID = "Unknown";
            } else if (game.external.includes('Resident Evil') && !game.external.match(/\d/) && !game.external.includes('Village') && !game.external.includes('Revelations') && !game.external.includes('Resistance') && !game.external.includes('Requiem') && !game.external.includes('Bundle') && !game.external.includes('Classic') && !game.external.includes('Nemesis') && !game.external.includes('GOG')) {
              displayImage = "https://www.residentevil.com/1/_asset/images/bio1-share-global.png";
            }
          }

          if (!game.steamAppID || game.steamAppID === 'Unknown') {
              const t = game.external.toLowerCase();
              if (t.includes('resident evil 3') && (t.includes('nemesis') || t.includes('classic'))) {
                  game.steamAppID = '4249120';
                  game.external = 'Resident Evil 3: Nemesis';
                  displayImage = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249120/a882eb9852c45108a0e4d725cd15132387ab038e/header.jpg?t=1775090236';
              } else if (t.includes('resident evil 2') && t.includes('classic')) {
                  game.steamAppID = '4249110';
                  game.external = 'Resident Evil 2 Classic';
                  displayImage = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249110/db95a4fbb11b56b6dc065dc0d6c662dab47498e5/header.jpg?t=1775090214';
              } else if (t.includes('resident evil') && t.includes('classic') && !t.match(/\d/)) {
                  game.steamAppID = '4249100';
                  game.external = 'Resident Evil Classic';
                  displayImage = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4249100/370da9c8c5e4573ea3c9d6ff22c88e89728fa0ed/header.jpg?t=1775088621';
              }
          }

          let finalPrice = cheapest * EXCHANGE_RATE;
          let finalOrig = cheapest * EXCHANGE_RATE * 1.5;
          let finalSav = Math.round(33);

          if (game.steamAppID === '3764200') {
             finalPrice = 1450000;
             finalOrig = 1450000;
             finalSav = 0;
          }

          return {
            id: game.gameID,
            dealID: game.cheapestDealID,
            title: game.external,
            price: finalPrice,
            originalPrice: finalOrig,
            savings: finalSav,
            category: randomCat,
            rating: ((Math.random() * 0.5) + 4.5).toFixed(1),
            image: displayImage,
            imageFallback: imageUrls.fallback,   // <---- ĐÃ FIX: TRẢ ĐÚNG LINK FALLBACK 
            imageFallback2: imageUrls.fallback2, // <---- ĐÃ FIX: TRẢ ĐÚNG LINK FALLBACK 2 
            thumb: game.thumb, // <---- ĐÃ FIX: CHÈN THUỘC TÍNH THUMB 
            rawgTitle: imageUrls.title,
            platform: "STEAM",
            specs: "AAA GAME",
            steamAppID: game.steamAppID
          };
        });

      var uniqueTitles = new Map();
      mappedGames.forEach(game => {
          const key = game.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (uniqueTitles.has(key)) {
              const existing = uniqueTitles.get(key);
              const existingHasID = existing.steamAppID && existing.steamAppID !== 'Unknown';
              const newHasID = game.steamAppID && game.steamAppID !== 'Unknown';
              
              if (!existingHasID && newHasID) {
                  uniqueTitles.set(key, game);
              }
          } else {
              uniqueTitles.set(key, game);
          }
      });

      var dedupedGames = Array.from(uniqueTitles.values()).filter(game => {
          if (!game.steamAppID || game.steamAppID === 'Unknown' || game.steamAppID === '0' || game.steamAppID === 'N/A') return false;
          return true;
      });

      dedupedGames.sort((a, b) => {
          const getRank = (title) => {
              const t = title.toLowerCase();
              if (t.includes('requiem')) return 1;
              if (t.includes('resident evil 4') && t.includes('remake')) return 2;
              if (t.includes('village')) return 3;
              if (t.includes('resident evil 3') && t.includes('remake')) return 4; 
              if (t.includes('resident evil 2') && t.includes('remake')) return 5; 
              if (t.includes('resident evil 7')) return 6;
              if (t.includes('resident evil 0')) return 7;
              if (t.includes('revelations 2')) return 8;
              if (t === 'resident evil' || t === 'resident evil hd remaster' || (t.includes('resident evil') && !t.includes('gog') && !t.match(/\d/) && !t.includes('revelations') && !t.includes('operation') && !t.includes('village') && !t.includes('classic') && !t.includes('nemesis'))) return 9;
              if (t.includes('revelations') && !t.includes('2')) return 10;
              if (t.includes('resident evil 6')) return 11;
              if (t.includes('resident evil 5')) return 12;
              if (t.includes('resident evil 4 classic') || (t.includes('resident evil 4') && !t.includes('remake'))) return 13;
              if (t.includes('resident evil 3') && (t.includes('nemesis') || t.includes('classic') || !t.includes('remake'))) return 14; 
              if (t.includes('resident evil 2') && (t.includes('classic') || !t.includes('remake'))) return 15; 
              if (t.includes('resident evil classic') && !t.match(/\d/)) return 16; 
              if ((t === 'resident evil (gog)') || (t.includes('resident evil') && t.includes('gog') && !t.match(/\d/))) return 17;
              
              return 100; 
          };
          
          return getRank(a.title) - getRank(b.title);
      });
      writeLocalCache(RE_GAMES_CACHE_KEY, dedupedGames);
      return dedupedGames;
    } catch (error) {
      console.warn('Error fetching RE games:', error);
      return [];
    }
  }

  async function buildGamesPage(pageNumber = 0) {
    var deals = await fetchDeals(pageNumber);

    if (deals.length === 0) {
      return [];
    }

    var allGames = deals.map(deal => transformDeal(deal));

    var reGames = [];
    if (pageNumber === 0) {
      reGames = await fetchResidentEvilGames();
    }

    var mergedGames = [...reGames, ...allGames];
    var uniqueGames = deduplicateGames(mergedGames);

    var steamIds = uniqueGames
      .map(g => g.steamAppID)
      .filter(id => id && id !== 'Unknown' && id !== 'N/A');
    var steamPrices = await fetchSteamPrices(steamIds);
    for (const game of uniqueGames) {
      applySteamPrice(game, steamPrices);
    }

    uniqueGames.sort((a, b) => {
      var priceA = a.originalPrice / EXCHANGE_RATE;
      var priceB = b.originalPrice / EXCHANGE_RATE;
      var isREa = a.title.toLowerCase().includes('resident evil');
      var isREb = b.title.toLowerCase().includes('resident evil');

      if (isREa && !isREb) return -1;
      if (!isREa && isREb) return 1;

      var isAAAa = a.specs === "AAA GAME";
      var isAAAb = b.specs === "AAA GAME";

      if (isAAAa && !isAAAb) return -1;
      if (!isAAAa && isAAAb) return 1;

      return priceB - priceA;
    });

    var reCount = uniqueGames.filter(g => g.title.toLowerCase().includes('resident evil')).length;
    console.log(`Loaded ${uniqueGames.length} games (${reCount} Resident Evil games at top)`);

    return uniqueGames.filter(g => {
      if (!g.steamAppID || g.steamAppID === 'Unknown' || g.steamAppID === '0' || g.steamAppID === 'N/A') return false;
      return true;
    });
  }

  async function getGames(pageNumber = 0) {
    var cacheKey = `${GAMES_CACHE_KEY_PREFIX}${pageNumber}`;
    var cachedGames = readLocalCache(cacheKey, GAMES_CACHE_TTL_MS);
    if (cachedGames && Array.isArray(cachedGames) && cachedGames.length > 0) {
      return cachedGames;
    }

    try {
      var freshGames = await buildGamesPage(pageNumber);
      if (freshGames.length > 0) {
        writeLocalCache(cacheKey, freshGames);
      }
      return freshGames;
    } catch (error) {
      throw new Error('Failed to load games from CheapShark API');
    }
  }

  function deduplicateGames(games) {
    var gameMap = new Map();
    
    games.forEach(game => {
      var { baseTitle, edition } = extractTitleAndEdition(game.title);
      
      if (gameMap.has(baseTitle)) {
        var existing = gameMap.get(baseTitle);
        var existingHasID = existing.steamAppID && existing.steamAppID !== 'Unknown';
        var newHasID = game.steamAppID && game.steamAppID !== 'Unknown';

        if (!existingHasID && newHasID) {
             gameMap.set(baseTitle, {
                ...game,
                baseTitle: baseTitle,
                editions: edition ? [edition] : []
             });
             return; 
        }

        if (existingHasID && !newHasID) {
            if (edition && !existing.editions.includes(edition)) {
                existing.editions.push(edition);
            }
            return; 
        }

        if (edition && !existing.editions.includes(edition)) {
          existing.editions.push(edition);
        }
        
        if (game.price < existing.price) {
          existing.price = game.price;
          existing.originalPrice = game.originalPrice;
          existing.savings = game.savings;
          existing.dealID = game.dealID;
          
          if (newHasID) {
              existing.steamAppID = game.steamAppID;
              existing.image = game.image; 
          }
        }
      } else {
        gameMap.set(baseTitle, {
          ...game,
          baseTitle: baseTitle,
          editions: edition ? [edition] : []
        });
      }
    });
    
    return Array.from(gameMap.values()).map(game => {
      if (game.editions.length > 0) {
        if (game.baseTitle === "Resident Evil 4" && 
           (game.editions.includes("2023") || game.editions.includes("Remake"))) {
             game.title = "Resident Evil 4 (Remake)";
        } else {
             game.title = `${game.baseTitle} (${game.editions.join(', ')})`;
        }
      } else {
        game.title = game.baseTitle;
      }
      delete game.baseTitle;
      delete game.editions;
      return game;
    });
  }

  function extractTitleAndEdition(title) {
    var editionPatterns = [
      /\s*\((\d{4})\)$/i,
      /\s*\((Deluxe|Gold|Premium|Ultimate|Complete|GOTY|Game of the Year|Definitive|Enhanced|Digital Deluxe|Collector's|Special|Standard|Anniversary|Director's Cut)\s*(Edition|Pack|Cut|Content)?\)$/i,
      /\s*-\s*(Deluxe|Gold|Premium|Ultimate|Complete|GOTY|Game of the Year|Definitive|Enhanced|Digital Deluxe|Collector's|Special|Standard|Anniversary)\s*(Edition|Pack)?/i,
      /\s+(Deluxe|Gold|Premium|Ultimate|Complete|GOTY|Game of the Year|Definitive|Enhanced|Digital Deluxe|Collector's|Special|Standard|Anniversary)\s*(Edition|Pack)?$/i,
      /\s+v?\d+\.\d+$/i
    ];
    
    var baseTitle = title;
    var edition = null;
    
    for (const pattern of editionPatterns) {
      var match = title.match(pattern);
      if (match) {
        edition = match[1]; 
        baseTitle = title.replace(pattern, '').trim();
        break;
      }
    }
    
    baseTitle = baseTitle.replace(/\s*:\s*$/, '').trim();
    return { baseTitle, edition };
  }

  async function searchGames(query) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      var url = `${BASE_URL}/games?title=${encodeURIComponent(query)}&limit=30`; 
      
      console.log(` Searching for: "${query}"`);
      var response = await fetchWithQueue(url);
      
      if (!response.ok) {
        throw new Error(`Search API returned status: ${response.status}`);
      }
      
      var data = await response.json();
      console.log(` Found ${data.length} games matching "${query}"`);
      
      var games = data.map(game => {
        var randomCat = CATEGORIES[Math.floor(Math.random() * (CATEGORIES.length - 1)) + 1];
        var cheapest = game.cheapest ? parseFloat(game.cheapest) : 9.99;
        var imageUrls = getBestImageUrl(game);
        
        let finalPrice = cheapest * EXCHANGE_RATE;
        let finalOrig = cheapest * EXCHANGE_RATE * 1.5;
        let finalSav = Math.round(33);
        
        if (game.steamAppID === '3764200') {
             finalPrice = 1450000;
             finalOrig = 1450000;
             finalSav = 0;
        }

        return {
          id: game.gameID,
          dealID: game.cheapestDealID, 
          title: game.external,
          price: finalPrice,
          originalPrice: finalOrig,
          savings: finalSav,
          category: randomCat,
          rating: ((Math.random() * 1.5) + 3.5).toFixed(1),
          image: imageUrls.primary,
          imageFallback: imageUrls.fallback,
          imageFallback2: imageUrls.fallback2,
          thumb: game.thumb, // <---- ĐÃ FIX: CHÈN THUỘC TÍNH THUMB VÀO ĐÂY
          platform: "STEAM",
          specs: cheapest > 30 ? "AAA GAME" : "INDIE",
          steamAppID: game.steamAppID
        };
      });
      
      var uniqueGames = deduplicateGames(games);
      
      return uniqueGames.filter(g => {
        if (!g.steamAppID || g.steamAppID === 'Unknown' || g.steamAppID === '0' || g.steamAppID === 'N/A') return false;
        return true;
      });
    } catch (error) {
      console.error(' Error searching games:', error);
      return [];
    }
  }

  function formatCurrency(amount) {
    var rounded = Math.ceil(amount / 1000) * 1000;
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(rounded);
  }

  async function getDealDetails(dealID) {
    if (dealID && typeof dealID === 'string' && dealID.startsWith('gift_')) {
      var parts = dealID.split('_'); 
      if (parts.length === 3) {
         const currency = parts[1].toUpperCase();
         const amount = parseInt(parts[2]);
         const steamImage = 'Image/steam-gift-card.jpg';
         
         const formatVNDShort = (amt) => {
             if (amt >= 1000000) return `${amt/1000000} triệu`;
             if (amt >= 1000) return `${amt/1000}k`;
             return amt.toString();
         };

         let title = '';
         let price = 0;
         
         if (currency === 'USD') {
             title = `Steam Wallet Gift Card - $${amount} USD`;
             price = amount * EXCHANGE_RATE;
         } else {
             title = `Steam Wallet Gift Card - ${formatVNDShort(amount)} VND`;
             price = amount;
         }

         return {
            id: dealID,
            dealID: dealID,
            title: title,
            price: price,
            originalPrice: price,
            savings: 0,
            category: 'GiftCard',
            rating: '5.0',
            image: steamImage,
            imageFallback: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+GIFT`,
            imageFallback2: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+GIFT`,
            thumb: steamImage, // <---- ĐÃ FIX: CHÈN THUMB CHO GIFTCARD
            platform: 'GIFT CARD',
            specs: 'DIGITAL CODE',
            steamAppID: 'N/A',
            denomination: amount,
            currency: currency
         };
      }
    }

    try {
      var cleanID = dealID;
      if (typeof dealID === 'string' && dealID.includes('%')) {
        try { cleanID = decodeURIComponent(dealID); } catch(e) {}
      }

      var url = `${BASE_URL}/deals?id=${encodeURIComponent(cleanID)}`;
      var response = await fetchWithQueue(url);
      
      if (!response.ok) {
        var error = new Error(`API request failed: ${response.status}`);
        error.status = response.status;
        throw error;
      }
      
      var data = await response.json();
      
      var transformedDeal = {
        dealID: dealID,
        gameID: data.gameInfo?.gameID || dealID,
        title: data.gameInfo?.name || 'Unknown Game',
        salePrice: data.gameInfo?.salePrice || '0',
        normalPrice: data.gameInfo?.retailPrice || '0',
        savings: data.gameInfo?.savings || '0',
        thumb: data.gameInfo?.thumb || '',
        steamAppID: data.gameInfo?.steamAppID || null,
        steamRatingPercent: data.gameInfo?.steamRatingPercent || 0
      };
      
      var result = transformDeal(transformedDeal);
      
      if (result.steamAppID && result.steamAppID !== 'Unknown') {
        var steamPrices = await fetchSteamPrices([result.steamAppID]);
        applySteamPrice(result, steamPrices);
      }
      
      return result;
      
    } catch (error) {
      if (error.status === 404 || error.message.includes('404')) {
        console.warn(` Deal details not found (likely expired): ${dealID}. Using fallback.`);
      } else {
        console.error(' Error fetching deal details:', dealID, error);
      }
      
      return {
        id: dealID,
        dealID: dealID,
        title: 'Game Unavailable',
        price: 0,
        originalPrice: 0,
        savings: 0,
        category: 'Unknown',
        platform: 'PC',
        rating: 0,
        image: 'https://placehold.co/616x353/1a1a1a/22d3ee?text=Unavailable',
        imageFallback: '',
        imageFallback2: '',
        rawgTitle: ''
      };
    }
  }

  async function fetchGamesByGenre(category, pageNumber = 0) {
    var categoryKeywords = {
      "Action": "action",
      "RPG": "rpg",
      "Strategy": "strategy",
      "Indie": "indie",
      "Shooter": "shooter",
      "Adventure": "adventure",
      "Simulation": "simulation",
      "Racing": "racing",
      "Horror": "horror"
    };

    var query = categoryKeywords[category] || "";
    
    if (!query || category === "All") {
      return getGames(pageNumber);
    }
    
    try {
      console.log(` Fetching ${category} games from CheapShark via Search...`);
      var results = await searchGames(query);
      
      return results.map(game => ({
          ...game,
          category: category
      }));
    } catch (error) {
      console.error(` Error fetching ${category} games:`, error);
      return [];
    }
  }

  function getGameUrl(steamID, params = null) {
    // Ưu tiên sử dụng PathResolver nếu có
    if (typeof window.url === 'function') {
        const baseUrl = window.url('/game');
        const query = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params || {}).toString();
        const sep = query ? (baseUrl.includes('?') ? '&' : '?') : '';
        const finalUrl = `${baseUrl}${sep}${query}`;
        // Nếu có appid trong params thì dùng, nếu không thì thêm vào
        return finalUrl.includes('appid=') ? finalUrl : `${finalUrl}${query ? '&' : ''}appid=${steamID}`;
    }

    const isHosted = window.location.hostname.includes('web.app') || window.location.hostname.includes('firebaseapp.com');
    let baseUrl = '';
    
    if (isHosted) {
        baseUrl = '/game';
    } else {
        const inHtml = window.location.pathname.includes('/html/') || window.location.pathname.includes('game.html');
        const prefix = inHtml ? '' : 'html/';
        baseUrl = `${prefix}game.html`;
    }
    
    if (!params) params = {};
    if (params instanceof URLSearchParams) {
        params.set('appid', steamID);
    } else {
        params = { ...params, appid: steamID };
    }

    const query = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
    return `${baseUrl}?${query}`;
  }

  return {
    getGameUrl,
    getGames,
    searchGames,
    getDealDetails,
    fetchGamesByGenre,
    formatCurrency,
    setExchangeRate,
    getExchangeRate,
    CATEGORIES,
    checkServerAvailability,
    getBestImageUrl,
    SERVER_URL: SERVER_URL,
    PROXY_URL: PROXY_URL,
    get useProxy() { return useProxy; }
  };
})();