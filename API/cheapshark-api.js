// ===================================
// CHEAPSHARK API MODULE
// ===================================

const CheapSharkAPI = (() => {
  // ---- Smart URL Routing ----
  // Try proxy server first (for CORS bypass + Steam prices),
  // but automatically fall back to direct CheapShark if server is down.
  const CHEAPSHARK_DIRECT_URL = 'https://www.cheapshark.com/api/1.0';
  const SERVER_URL = (window.location.port === '5500' || window.location.protocol === 'file:')
    ? 'http://localhost:5000'
    : '';
  const PROXY_URL = `${SERVER_URL}/api/cheapshark`;

  // Dynamic base URL — starts with proxy, switches to direct if server is down
  let BASE_URL = PROXY_URL;
  let useProxy = true;
  let serverChecked = false;

  // Check if proxy server is available (runs once on startup)
  async function checkServerAvailability() {
    if (serverChecked) return useProxy;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout
      await fetch(`${SERVER_URL}/api/cheapshark/deals?storeID=1&pageSize=1`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      useProxy = true;
      BASE_URL = PROXY_URL;
      console.log('✅ Proxy server is available — using proxy mode');
    } catch (err) {
      useProxy = false;
      BASE_URL = CHEAPSHARK_DIRECT_URL;
      console.warn('⚠️ Proxy server unavailable — switching to DIRECT CheapShark API mode');
    }
    serverChecked = true;
    return useProxy;
  }

  // Run check immediately
  checkServerAvailability();

  let EXCHANGE_RATE = 26000; // 1 USD = 26,000 VND
  const PAGE_SIZE = 60;
  
  const CATEGORIES = ["All", "Action", "RPG", "Strategy", "Indie", "Shooter", "Adventure", "Simulation", "Racing", "Horror"];
  
  // RAWG API configuration removed

  // --- Request Queue System for Rate Limiting ---
  const MAX_CONCURRENT_REQUESTS = 5;
  let activeRequests = 0;
  const requestQueue = [];

  async function processQueue() {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) return;
    
    activeRequests++;
    const { url, options, resolve, reject, retries } = requestQueue.shift();
    
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        throw new Error('429 Too Many Requests');
      }
      resolve(response);
    } catch (error) {
      // If proxy fails with connection error, try direct CheapShark URL
      if (url.includes(PROXY_URL) && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.name === 'TypeError')) {
        console.warn('🔄 Proxy connection failed, retrying with direct CheapShark URL...');
        useProxy = false;
        BASE_URL = CHEAPSHARK_DIRECT_URL;
        // Convert proxy URL to direct URL and retry
        const directUrl = url.replace(PROXY_URL, CHEAPSHARK_DIRECT_URL);
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
        console.warn(`⏳ Rate limited on ${url}, retrying in 2s...`);
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

  /**
   * Fetch real Steam prices (VND + USD) for a batch of Steam App IDs
   * @param {Array<string>} steamIds - Array of Steam App IDs
   * @returns {Promise<Object>} Map of appId -> {vnd: {sale, normal}, usd: {sale, normal}, savings}
   */
  async function fetchSteamPrices(steamIds) {
    // Steam prices require the proxy server — skip if it's down
    if (!useProxy) {
      console.log('ℹ️ Proxy unavailable — skipping Steam price fetch, using CheapShark prices');
      return {};
    }
    if (!steamIds || steamIds.length === 0) return {};
    const validIds = steamIds.filter(id => id && id !== 'Unknown' && id !== 'N/A');
    if (validIds.length === 0) return {};

    try {
      const url = `${SERVER_URL}/api/steam/price?appids=${validIds.join(',')}`;
      console.log(`💰 Fetching Steam prices for ${validIds.length} games...`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Steam price API error: ${response.status}`);
      const data = await response.json();
      console.log(`✅ Steam prices received: ${Object.keys(data).length} games`);
      return data;
    } catch (error) {
      console.warn('⚠️ Steam price fetch failed, using CheapShark prices:', error.message);
      return {};
    }
  }

  /**
   * Apply Steam prices to a game object
   * @param {Object} game - Game object with steamAppID
   * @param {Object} steamPrices - Map from fetchSteamPrices()
   */
  function applySteamPrice(game, steamPrices) {
    const steamInfo = steamPrices[game.steamAppID];
    if (!steamInfo) return;

    // Store both VND and USD prices natively from Steam
    game.salePriceVND = steamInfo.vnd.sale;
    game.normalPriceVND = steamInfo.vnd.normal;
    game.salePriceUSD = steamInfo.usd.sale;
    game.normalPriceUSD = steamInfo.usd.normal;

    // Override the main price fields (default = VND)
    game.price = steamInfo.vnd.sale;
    game.originalPrice = steamInfo.vnd.normal;
    game.savings = steamInfo.savings;
    game.steamPriceLoaded = true;
  }

  /**
   * Set exchange rate
   * @param {number} rate - New exchange rate
   */
  function setExchangeRate(rate) {
    EXCHANGE_RATE = rate;
  }

  /**
   * Get current exchange rate
   * @returns {number} Current exchange rate
   */
  function getExchangeRate() {
    return EXCHANGE_RATE;
  }

  /**
   * Fetch deals from CheapShark API
   * @param {number} pageNumber - Page number (0-indexed)
   * @returns {Promise<Array>} Array of deals
   */
  async function fetchDeals(pageNumber = 0) {
    try {
      // Improved logic: Fetch Popular / AAA games
      // sortBy=Metacritic to get good games
      // lowerPrice=10 to avoid very cheap shovelware
      // AAA title usually > $29.99 normal price (handled in UI, but we can't filter server-side easily without excluding deals)
      // let's try sorting by 'Reviews' or 'Metacritic' for better quality recommendation
      
      const sortOption = pageNumber % 2 === 0 ? 'Metacritic' : 'B12d'; // Alternate between Metacritic and "Beast" (Deal Rating)
      
      const url = `${BASE_URL}/deals?storeID=1&pageSize=${PAGE_SIZE}&pageNumber=${pageNumber}&onSale=1&sortBy=${sortOption}&lowerPrice=5&AAA=1`;
      
      console.log(`🎮 Fetching recommended games (page ${pageNumber}, sort: ${sortOption}) from CheapShark API...`);
      const response = await fetchWithQueue(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Loaded ${data.length} recommended deals from page ${pageNumber}`);
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching from CheapShark API:', error);
      throw error;
    }
  }

  // getRAWGImage function removed

  /**
   * Get the best possible image URL for a game
   * Prioritize Steam Capsule -> CheapShark thumb -> Placeholder
   */
  function getBestImageUrl(deal, baseTitle = null) {
    const title = baseTitle || deal.title || deal.external || '';
    
    // Custom logic for Resident Evil (older games without proper Steam IDs in some API returns)
    if ((deal.steamAppID && deal.steamAppID == '304240') || (title && title.toLowerCase().includes('resident evil') && !title.match(/\d/))) {
      const bio1Image = "https://www.residentevil.com/1/_asset/images/bio1-share-global.png";
      return {
        primary: bio1Image,
        fallback: bio1Image,
        fallback2: bio1Image,
        title: title
      };
    }

    // Override for Silent Hill F (Global override)
    if ((deal.steamAppID && deal.steamAppID == '2947440') || (title && title.toLowerCase().includes('silent hill f'))) {
       const silentHillArt = "https://kamikey.com/wp-content/uploads/2025/08/SILENT-HILL-f.jpg";
       return {
         primary: silentHillArt,
         fallback: silentHillArt,
         fallback2: silentHillArt,
         title: title
       };
    }

    if (deal.steamAppID && deal.steamAppID !== 'Unknown' && deal.steamAppID !== 'N/A') {
      // Direct Steam CDN high-resolution capsule image instead of relying on RAWG
      return {
        primary: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${deal.steamAppID}/capsule_616x353.jpg`,
        fallback: `https://steamcdn-a.akamaihd.net/steam/apps/${deal.steamAppID}/header.jpg`,
        fallback2: deal.thumb,
        title: title || deal.title || deal.external
      };
    }
    
    // If no Steam ID, prioritize thumb
    let primary = deal.thumb;
    let fallback = deal.thumb;
    let fallback2 = 'https://placehold.co/616x353/1a1a1a/22d3ee?text=No+Image';

    return {
      primary: primary,
      fallback: fallback,
      fallback2: fallback2,
      title: title || deal.title || deal.external
    };
  }

  /**
   * Transform deal to game format
   * @param {Object} deal - CheapShark deal object
   * @returns {Object} Transformed game object
   */
  function transformDeal(deal) {
    // Get best image URLs
    const imageUrls = getBestImageUrl(deal, deal.title);

    // Random category for variety
    const randomCat = CATEGORIES[Math.floor(Math.random() * (CATEGORIES.length - 1)) + 1];

    return {
      id: deal.gameID,
      dealID: deal.dealID, // Ensure dealID is passed through
      title: deal.title,
      price: parseFloat(deal.salePrice) * EXCHANGE_RATE,
      originalPrice: parseFloat(deal.normalPrice) * EXCHANGE_RATE,
      savings: Math.round(parseFloat(deal.savings)),
      category: randomCat,
      rating: deal.steamRatingPercent > 
        0 ? (deal.steamRatingPercent / 20).toFixed(1) 
        : ((Math.random() * 1.5) + 3.5).toFixed(1),
      image: imageUrls.primary,
      imageFallback: imageUrls.fallback,
      imageFallback2: imageUrls.fallback2,
      rawgTitle: imageUrls.title,
      platform: "STEAM",
      specs: parseFloat(deal.normalPrice) >= 30 ? "AAA GAME" : "INDIE",
      dealRating: deal.dealRating,
      steamAppID: deal.steamAppID
    };
  }

  /**
   * Fetch Resident Evil games specifically
   * @returns {Promise<Array>} Array of Resident Evil games
   */
  async function fetchResidentEvilGames() {
    try {

      const [mainRes, revRes] = await Promise.all([
          fetchWithQueue(`${BASE_URL}/games?title=resident%20evil&limit=30`), // Increased limit
          fetchWithQueue(`${BASE_URL}/games?title=resident%20evil%20revelations&limit=10`) // Ensure Revelations works
      ]);
      
      const mainData = await mainRes.json();
      const revData = await revRes.json();
      
      // Merge and Deduplicate by gameID
      const allData = [...mainData, ...revData];
      const uniqueData = Array.from(new Map(allData.map(item => [item.gameID, item])).values());

      console.log(`🧟‍♂️ Found ${uniqueData.length} Resident Evil games (Merged)`);
      
      // Transform to game format and FILTER OUT "Requiem" duplicates and exact "Resident Evil 7" (keep Biohazard version)
      // Also filter out "Episode" (Revelations 2 parts), DLCs, etc.
      const mappedGames = uniqueData
        .filter(game => {
            const t = game.external.toLowerCase();
            return !t.includes('requiem') && 
                   !t.includes('resident evil hd remaster') && 
                   !t.includes('trilogy') && 
                   !t.includes('bundle') &&
                   !t.includes('pack') &&
                   !t.includes('episode') && // Filter out episodic parts
                   !t.includes('season pass') &&
                   !t.includes('dlc');
        })
        .map(game => {
          const randomCat = CATEGORIES[Math.floor(Math.random() * (CATEGORIES.length - 1)) + 1];
          const cheapest = game.cheapest ? parseFloat(game.cheapest) : 29.99;
          
          const imageUrls = getBestImageUrl(game, game.external);
          
          let displayImage = imageUrls.primary;
          
          // Clean up titles (Remove Biohazard / Japanese names / Deluxe / Complete)
          // 1. Remove everything after " / " (Biohazard names)
          if (game.external.includes(' / ')) {
              game.external = game.external.split(' / ')[0].trim();
          } else if (game.external.includes('/')) {
              game.external = game.external.split('/')[0].trim();
          }

          // 2. Remove specific text in parentheses
          game.external = game.external
            .replace(/\(Deluxe.*?\)/gi, '')
            .replace(/\(Complete.*?\)/gi, '')
            .replace(/\(Gold.*?\)/gi, '') // If user wants gold removed too? Maybe not, keep Gold usually. But user highlighted Deluxe.
            .replace(/\s+/g, ' ') // Collapse double spaces
            .trim();
          
          // Override for Resident Evil 4 Remake (2023)
          if (game.steamAppID == '2050650' || (game.external.includes('Resident Evil 4') && (game.external.includes('Remake') || game.external.includes('2023')))) {
            displayImage = "https://image.api.playstation.com/vulcan/ap/rnd/202210/0712/BiS5QP6h4506JHyJlZlVzK9D.jpg";
          }
          
          // Override for Resident Evil 4 Classic (Check ID, '2005', or 'Classic' in title)
          // Also explicitly renaming it to "Resident Evil 4 Classic" if it's the 2005 version for clarity
          if (game.steamAppID == '254700' || game.external.includes('2005') || (game.external.includes('Resident Evil 4') && !game.external.includes('2023') && !game.external.includes('Remake') && parseFloat(game.cheapest) < 10)) {
            displayImage = "https://gaming-cdn.com/images/products/7818/orig/resident-evil-4-2005-pc-game-steam-europe-cover.jpg?v=1747906511";
            game.external = "Resident Evil 4 Classic"; // Force title to be consistent
          }

          // Override for Resident Evil 2 Remake
          if (game.steamAppID == '883710' || (game.external.includes('Resident Evil 2') && (game.external.includes('Remake') || game.external.includes('2019')))) {
            displayImage = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/883710/capsule_616x353.jpg?t=1728438541";
          }

          // Override for Resident Evil 3 Remake
          if (game.steamAppID == '952060' || (game.external.includes('Resident Evil 3') && (game.external.includes('Remake') || game.external.includes('2020')))) {
            displayImage = "https://i.ytimg.com/vi/UxfvgMp9xdU/maxresdefault.jpg";
            // Normalizing ALL CAPS title if present
            if (game.external === 'RESIDENT EVIL 3') {
                game.external = 'Resident Evil 3';
            }
          }

          // Override for Resident Evil Village
          if (game.steamAppID == '1196590' || game.external.includes('Resident Evil Village')) {
            displayImage = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1196590/header.jpg?t=1770093483";
          }

          // Override for Resident Evil 5
          if (game.steamAppID == '21690' || game.external.includes('Resident Evil 5')) {
            displayImage = "https://www.residentevil.com/5/_asset/images/bio5-share-global.png";
          }

          // Override for Resident Evil 0
          if (game.steamAppID == '339340' || game.external.includes('Resident Evil 0')) {
            displayImage = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/339340/header.jpg?t=1742177237";
          }

          // Override for original Resident Evil (1996/Origins Collection)
          if (game.steamAppID == '304240' || (game.external.includes('Resident Evil') && !game.external.includes('0') && !game.external.includes('2') && !game.external.includes('3') && !game.external.includes('4') && !game.external.includes('5') && !game.external.includes('6') && !game.external.includes('7') && !game.external.includes('Village') && !game.external.includes('Revelations') && !game.external.includes('Resistance') && !game.external.includes('Requiem') && !game.external.includes('Bundle'))) {
            displayImage = "https://www.residentevil.com/1/_asset/images/bio1-share-global.png";
          }

          // Override for Resident Evil (GOG)
          if (game.external === 'Resident Evil (GOG)') {
             displayImage = "https://gpstatic.com/acache/79/00/1/us/packshot-295a3a91a3ce2c8fe8b1324421c12ce5.jpg";
             game.steamAppID = "Unknown"; // User requested ID to be Unknown
          }
          if (game.external === 'Resident Evil Revelations 2') {
             displayImage = "https://www.nintendo.com/eu/media/images/10_share_images/games_15/nintendo_switch_download_software_1/H2x1_NSwitchDS_ResidentEvilRevelations2_image1600w.jpg";
             
          }
          if (game.external === 'Resident Evil: Revelations') {
             displayImage = "https://www.nintendo.com/eu/media/images/10_share_images/games_15/nintendo_switch_download_software_1/H2x1_NSwitchDS_ResidentEvilRevelations_image1600w.jpg";
             
          }
          if (game.external === 'Resident Evil 7 Biohazard') {
             displayImage = "https://image.api.playstation.com/vulcan/ap/rnd/202206/0311/cp7G7TILGKzAzLGb1MMn9hyt.jpg";
             
          }
          if (game.external === 'Resident Evil 6') {
             displayImage = "https://www.nintendo.com/eu/media/images/10_share_images/games_15/nintendo_switch_download_software_1/H2x1_NSwitchDS_ResidentEvil6.jpg";
             
          }



          return {
            id: game.gameID,
            dealID: game.cheapestDealID, // Use cheapest deal ID for games endpoint
            title: game.external,
            price: cheapest * EXCHANGE_RATE,
            originalPrice: cheapest * EXCHANGE_RATE * 1.5,
            savings: Math.round(33),
            category: randomCat,
            rating: ((Math.random() * 0.5) + 4.5).toFixed(1), // RE games rated highly
            image: displayImage,
            imageFallback: displayImage,
            imageFallback2: displayImage,
            rawgTitle: imageUrls.title,
            platform: "STEAM",
            specs: "AAA GAME",
            steamAppID: game.steamAppID
          };
        });

      // Deduplicate by Cleaned Title
      // We use a strict alphanumeric key to match "Resident Evil: Revelations" with "Resident Evil Revelations"
      const uniqueTitles = new Map();
      
      mappedGames.forEach(game => {
          // Create strict key: lowercase, remove all non-alphanumeric chars
          const key = game.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          if (uniqueTitles.has(key)) {
              const existing = uniqueTitles.get(key);
              
              const existingHasID = existing.steamAppID && existing.steamAppID !== 'Unknown';
              const newHasID = game.steamAppID && game.steamAppID !== 'Unknown';
              
              // If new one has ID and existing doesn't, replace it (Get rid of Unknowns)
              if (!existingHasID && newHasID) {
                  uniqueTitles.set(key, game);
              }
              // If both have IDs (or both don't), prefer Steam platform (usually cheaper/better data?) 
              // or just keep existing (first found usually better from main search)
          } else {
              uniqueTitles.set(key, game);
          }
      });
      // Convert map back to array AND Filter out "Unknown" IDs
      // User explicitly asked to remove duplicates and ones without IDs
      const dedupedGames = Array.from(uniqueTitles.values()).filter(game => {
          // Keep custom games like Requeim (id: custom_re9)
          if (game.id && game.id.startsWith('custom_')) return true;
          
          // Remove if ID is Unknown or missing
          if (!game.steamAppID || game.steamAppID === 'Unknown') return false;
          
          return true;
      });

      // Sort games by specific custom order asked by user
      dedupedGames.sort((a, b) => {
          const getRank = (title) => {
              const t = title.toLowerCase();
              if (t.includes('requiem')) return 1;
              if (t.includes('resident evil 4') && (t.includes('remake') || t.includes('2023'))) return 2;
              if (t.includes('village')) return 3;
              if (t.includes('resident evil 3') && !t.includes('gog')) return 4; // Remake
              if (t.includes('resident evil 2') && !t.includes('gog')) return 5; // Remake
              if (t.includes('resident evil 7')) return 6;
              if (t.includes('resident evil 0')) return 7;
              if (t.includes('revelations 2')) return 8;
              // Official RE1 / HD Remaster (Not GOG)
              if (t === 'resident evil' || (t.includes('resident evil') && !t.includes('gog') && !t.match(/\d/) && !t.includes('revelations') && !t.includes('operation') && !t.includes('village'))) return 9;
              if (t.includes('revelations') && !t.includes('2')) return 10;
              if (t.includes('resident evil 6')) return 11;
              if (t.includes('resident evil 5')) return 12;
              if (t.includes('resident evil 4 classic') || (t.includes('resident evil 4') && !t.includes('2023') && !t.includes('remake'))) return 13;
              if (t.includes('resident evil 3') && t.includes('gog')) return 14;
              if (t.includes('resident evil 2') && t.includes('gog')) return 15;
              if ((t === 'resident evil (gog)') || (t.includes('resident evil') && t.includes('gog') && !t.match(/\d/))) return 16;
              
              return 100; // Others at the bottom
          };
          
          return getRank(a.title) - getRank(b.title);
      });

      // Inject Custom High-Quality RE9: Requiem
      const customRE9 = {
        id: "custom_re9",
        dealID: null, // Custom game has no deal ID
        title: "Resident Evil: Requiem",
        price: 59.99 * EXCHANGE_RATE,
        originalPrice: 89.99 * EXCHANGE_RATE,
        savings: 33,
        category: "Horror",
        rating: "5.0",
        image: "https://paradoxetemporel.fr/wp-content/uploads/2025/12/resident-evil-requiem-3eme-trail.jpg", // New High quality wallpaper
        imageFallback: "https://paradoxetemporel.fr/wp-content/uploads/2025/12/resident-evil-requiem-3eme-trail.jpg",
        imageFallback2: "https://paradoxetemporel.fr/wp-content/uploads/2025/12/resident-evil-requiem-3eme-trail.jpg",
        platform: "STEAM",
        specs: "AAA GAME",
        steamAppID: "3764200"
      };

      // Return custom game + API games
      return [customRE9, ...mappedGames];
    } catch (error) {
      console.warn('Error fetching RE games:', error);
      return [];
    }
  }

  /**
   * Get games for a specific page
   * @param {number} pageNumber - Page number
   * @returns {Promise<Array>} Array of transformed games
   */
  async function getGames(pageNumber = 0) {
    try {
      // Fetch regular deals
      const deals = await fetchDeals(pageNumber);
      
      if (deals.length === 0) {
        return [];
      }

      // Transform all deals
      const allGames = deals.map(deal => transformDeal(deal));
      
      // Fetch Resident Evil games separately (only for first page)
      let reGames = [];
      if (pageNumber === 0) {
        reGames = await fetchResidentEvilGames();
      }
      
      // Merge: RE games first, then regular games
      const mergedGames = [...reGames, ...allGames];
      
      // Deduplicate (removes duplicates if RE games also in regular deals)
      const uniqueGames = deduplicateGames(mergedGames);

      // === STEAM PRICE INJECTION ===
      // Fetch real Steam prices (VND + USD) and override CheapShark prices
      const steamIds = uniqueGames
        .map(g => g.steamAppID)
        .filter(id => id && id !== 'Unknown' && id !== 'N/A');
      const steamPrices = await fetchSteamPrices(steamIds);
      for (const game of uniqueGames) {
        applySteamPrice(game, steamPrices);
      }
      
      // Sort with priority: 1) Resident Evil, 2) AAA games, 3) Others
      uniqueGames.sort((a, b) => {
        const priceA = a.originalPrice / EXCHANGE_RATE;
        const priceB = b.originalPrice / EXCHANGE_RATE;
        
        // Check if game is Resident Evil
        const isREa = a.title.toLowerCase().includes('resident evil');
        const isREb = b.title.toLowerCase().includes('resident evil');
        
        // Resident Evil games FIRST
        if (isREa && !isREb) return -1;
        if (!isREa && isREb) return 1;
        
        // Then AAA games
        const isAAAa = a.specs === "AAA GAME";
        const isAAAb = b.specs === "AAA GAME";
        
        if (isAAAa && !isAAAb) return -1;
        if (!isAAAa && isAAAb) return 1;
        
        // Within same tier, sort by price (high to low)
        return priceB - priceA;
      });
      
      const reCount = uniqueGames.filter(g => g.title.toLowerCase().includes('resident evil')).length;
      console.log(`🎮 Loaded ${uniqueGames.length} games (${reCount} Resident Evil games at top)`);
      
      // Final Global Filter: Remove anything with "Unknown" ID (unless custom)
      // This catches any stragglers from the general deals feed
      const validGames = uniqueGames.filter(g => {
          if (g.id && g.id.startsWith('custom_')) return true; // Keep custom overrides
          if (!g.steamAppID || g.steamAppID === 'Unknown') return false;
          return true;
      });
      
      return validGames;
    } catch (error) {
      throw new Error('Failed to load games from CheapShark API');
    }
  }

  /**
   * Deduplicate games and group editions
   * @param {Array} games - Array of games
   * @returns {Array} Deduplicated games with grouped editions
   */
  function deduplicateGames(games) {
    const gameMap = new Map();
    
    games.forEach(game => {
      // Extract base title and edition
      const { baseTitle, edition } = extractTitleAndEdition(game.title);
      
      if (gameMap.has(baseTitle)) {
        // Game already exists
        const existing = gameMap.get(baseTitle);

        // ID Priority Logic: Always prefer valid Steam ID over Unknown
        const existingHasID = existing.steamAppID && existing.steamAppID !== 'Unknown';
        const newHasID = game.steamAppID && game.steamAppID !== 'Unknown';

        // 1. If existing is Unknown and New has ID -> Replace immediately
        if (!existingHasID && newHasID) {
             gameMap.set(baseTitle, {
                ...game,
                baseTitle: baseTitle,
                editions: edition ? [edition] : []
             });
             return; // Done
        }

        // 2. If existing has ID and New is Unknown -> Ignore New (don't overwrite)
        if (existingHasID && !newHasID) {
            // Just maybe add edition if needed? 
            if (edition && !existing.editions.includes(edition)) {
                existing.editions.push(edition);
            }
            return; // keep existing
        }

        // 3. If both have IDs (or both don't), use Price/Data logic
        if (edition && !existing.editions.includes(edition)) {
          existing.editions.push(edition);
        }
        
        // Keep the cheapest price
        if (game.price < existing.price) {
          existing.price = game.price;
          existing.originalPrice = game.originalPrice;
          existing.savings = game.savings;
          // Also update dealID closely associated with the price
          existing.dealID = game.dealID;
          
          // If we are updating the deal, should we update the ID?
          // Only if the new ID is valid (which we established above they are 'equal' in validity status)
          if (newHasID) {
              existing.steamAppID = game.steamAppID;
              existing.image = game.image; // Maybe better image?
          }
        }
      } else {
        // New game
        gameMap.set(baseTitle, {
          ...game,
          baseTitle: baseTitle,
          editions: edition ? [edition] : []
        });
      }
    });
    
    // Convert map to array and format titles with editions
    return Array.from(gameMap.values()).map(game => {
      if (game.editions.length > 0) {
        // Special rename for RE4 Remake
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

  /**
   * Extract base title and edition from game title
   * @param {string} title - Full game title
   * @returns {Object} {baseTitle, edition}
   */
  function extractTitleAndEdition(title) {
    const editionPatterns = [
      // Year in parentheses (2023) (2022)
      /\s*\((\d{4})\)$/i,
      // Remake, Remaster
      /\s+(Remake|Remastered|Remaster)$/i,
      // Parentheses Editions: (Gold), (Deluxe Edition), (Complete), etc.
      /\s*\((Deluxe|Gold|Premium|Ultimate|Complete|GOTY|Game of the Year|Definitive|Enhanced|Digital Deluxe|Collector's|Special|Standard|Anniversary|Director's Cut)\s*(Edition|Pack|Cut|Content)?\)$/i,
      // Edition patterns with dash or space
      /\s*-\s*(Deluxe|Gold|Premium|Ultimate|Complete|GOTY|Game of the Year|Definitive|Enhanced|Digital Deluxe|Collector's|Special|Standard|Anniversary)\s*(Edition|Pack)?/i,
      /\s+(Deluxe|Gold|Premium|Ultimate|Complete|GOTY|Game of the Year|Definitive|Enhanced|Digital Deluxe|Collector's|Special|Standard|Anniversary)\s*(Edition|Pack)?$/i,
      // Version numbers
      /\s+v?\d+\.\d+$/i
    ];
    
    let baseTitle = title;
    let edition = null;
    
    for (const pattern of editionPatterns) {
      const match = title.match(pattern);
      if (match) {
        edition = match[1]; // Extract edition name or year
        baseTitle = title.replace(pattern, '').trim();
        break;
      }
    }
    
    // Clean up common suffixes that aren't editions
    baseTitle = baseTitle.replace(/\s*:\s*$/, '').trim();
    
    return { baseTitle, edition };
  }

  /**
   * Search games by title from CheapShark API
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of transformed games
   */
  async function searchGames(query) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const url = `${BASE_URL}/games?title=${encodeURIComponent(query)}&limit=30`; // Increased limit
      
      console.log(`🔍 Searching for: "${query}"`);
      const response = await fetchWithQueue(url);
      
      if (!response.ok) {
        throw new Error(`Search API returned status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Found ${data.length} games matching "${query}"`);
      
      // Transform search results
      const games = data.map(game => {
        const randomCat = CATEGORIES[Math.floor(Math.random() * (CATEGORIES.length - 1)) + 1];
        
        // Use cheaper price if available
        const cheapest = game.cheapest ? parseFloat(game.cheapest) : 9.99;
        
        // Get image with fallbacks
        const imageUrls = getBestImageUrl(game);
        
        return {
          id: game.gameID,
          dealID: game.cheapestDealID, // Use cheapest deal ID
          title: game.external,
          price: cheapest * EXCHANGE_RATE,
          originalPrice: cheapest * EXCHANGE_RATE * 1.5,
          savings: Math.round(33),
          category: randomCat,
          rating: ((Math.random() * 1.5) + 3.5).toFixed(1),
          image: imageUrls.primary,
          imageFallback: imageUrls.fallback,
          imageFallback2: imageUrls.fallback2,
          platform: "STEAM",
          specs: cheapest > 30 ? "AAA GAME" : "INDIE",
          steamAppID: game.steamAppID
        };
      });
      
      // Deduplicate search results
      const uniqueGames = deduplicateGames(games);
      
      return uniqueGames;
    } catch (error) {
      console.error('❌ Error searching games:', error);
      return [];
    }
  }

  /**
   * Format currency to VND
   * @param {number} amount - Amount in VND
   * @returns {string} Formatted currency string
   */
  function formatCurrency(amount) {
    const rounded = Math.ceil(amount / 1000) * 1000;
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(rounded);
  }

  /**
   * Get deal details by dealID
   * @param {string} dealID - CheapShark deal ID
   * @returns {Promise<Object>} Game details
   */
  /**
   * Get deal details by dealID
   * @param {string} dealID - CheapShark deal ID
   * @returns {Promise<Object>} Game details
   */
  async function getDealDetails(dealID) {
    // 1. Handle Custom Games (Resident Evil 9)
    if (dealID === 'custom_re9') {
      return {
        id: "custom_re9",
        dealID: "custom_re9",
        title: "Resident Evil: Requiem",
        price: 59.99 * EXCHANGE_RATE,
        originalPrice: 89.99 * EXCHANGE_RATE,
        savings: 33,
        category: "Horror",
        rating: "5.0",
        image: "https://paradoxetemporel.fr/wp-content/uploads/2025/12/resident-evil-requiem-3eme-trail.jpg",
        imageFallback: "https://paradoxetemporel.fr/wp-content/uploads/2025/12/resident-evil-requiem-3eme-trail.jpg",
        imageFallback2: "https://paradoxetemporel.fr/wp-content/uploads/2025/12/resident-evil-requiem-3eme-trail.jpg",
        platform: "STEAM",
        specs: "AAA GAME",
        steamAppID: "3764200"
      };
    }

    // 2.5 Handle Gift Cards (Hydration)
    if (dealID && typeof dealID === 'string' && dealID.startsWith('gift_')) {
      const parts = dealID.split('_'); // gift, currency, amount
      if (parts.length === 3) {
         const currency = parts[1].toUpperCase();
         const amount = parseInt(parts[2]);
         const steamImage = 'Image/steam-gift-card.jpg';
         
         // Helper for VND format
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
            platform: 'GIFT CARD',
            specs: 'DIGITAL CODE',
            steamAppID: 'N/A',
            denomination: amount,
            currency: currency
         };
      }
    }

    try {
      // 3. Handle Standard CheapShark Deals
      // Attempt to fix double-encoded IDs if any
      let cleanID = dealID;
      if (typeof dealID === 'string' && dealID.includes('%')) {
        try { cleanID = decodeURIComponent(dealID); } catch(e) {}
      }

      const url = `${BASE_URL}/deals?id=${encodeURIComponent(cleanID)}`;
      const response = await fetchWithQueue(url);
      
      if (!response.ok) {
        const error = new Error(`API request failed: ${response.status}`);
        error.status = response.status;
        throw error;
      }
      
      const data = await response.json();
      
      const transformedDeal = {
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
      
      const result = transformDeal(transformedDeal);
      
      // === STEAM PRICE INJECTION (Single Game) ===
      if (result.steamAppID && result.steamAppID !== 'Unknown') {
        const steamPrices = await fetchSteamPrices([result.steamAppID]);
        applySteamPrice(result, steamPrices);
      }
      
      return result;
      
    } catch (error) {
      if (error.status === 404 || error.message.includes('404')) {
         console.warn(`⚠️ Deal details not found (likely expired): ${dealID}. Using fallback.`);
      } else {
         console.error('❌ Error fetching deal details:', dealID, error);
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

  /**
   * Fetch games by genre using Keyword Search on CheapShark
   * @param {string} category - The UI Category (e.g. Action, RPG)
   * @returns {Promise<Array>} Array of games
   */
  async function fetchGamesByGenre(category, pageNumber = 0) {
    // Map category to a relevant keyword query
    const categoryKeywords = {
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

    const query = categoryKeywords[category] || "";
    
    // If "All" or unknown category, just fetch popular deals
    if (!query || category === "All") {
      return getGames(pageNumber);
    }
    
    try {
      console.log(`🎮 Fetching ${category} games from CheapShark via Search...`);
      // Re-use searchGames with the keyword
      const results = await searchGames(query);
      
      // Override the dynamically assigned category with the requested one to keep UI clean
      return results.map(game => ({
          ...game,
          category: category
      }));
    } catch (error) {
      console.error(`❌ Error fetching ${category} games:`, error);
      return [];
    }
  }

  // Public API
  return {
    getGames,
    searchGames,
    getDealDetails,
    fetchGamesByGenre,
    formatCurrency,
    setExchangeRate,
    getExchangeRate,
    CATEGORIES,
    checkServerAvailability
  };
})();
