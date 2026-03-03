/**
 * NEWS API - Game News Aggregator
 * Fetches gaming news from multiple RSS sources
 */

const Parser = require('rss-parser');
const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent', {keepArray: true}],
            ['media:thumbnail', 'mediaThumbnail', {keepArray: true}],
            ['media:group', 'mediaGroup'],
            ['content:encoded', 'contentEncoded'],
            ['enclosure', 'enclosure']
        ]
    }
});

// Feed sources configuration
const FEED_SOURCES = [
    {
        name: 'GameK',
        url: 'https://gamek.vn/trang-chu.rss',
        lang: 'vi'
    },
    {
        name: 'Thanh Niên Game',
        url: 'https://thanhnien.vn/rss/game-316.rss',
        lang: 'vi'
    },
    {
        name: 'IGN',
        url: 'https://feeds.feedburner.com/ign/news',
        lang: 'en'
    },
    {
        name: 'GameSpot',
        url: 'https://www.gamespot.com/feeds/news/',
        lang: 'en'
    }
];

// Gaming-related keywords for filtering
const GAMING_KEYWORDS = [
    // English keywords
    'game', 'gaming', 'gamer', 'gameplay', 'playstation', 'xbox', 'nintendo', 
    'steam', 'epic games', 'pc gaming', 'console', 'esports', 'esport',
    'fps', 'rpg', 'mmorpg', 'moba', 'battle royale', 'fortnite', 'valorant',
    'league of legends', 'lol', 'dota', 'minecraft', 'call of duty', 'cod',
    'assassin', 'gta', 'grand theft', 'zelda', 'mario', 'pokemon', 'elden ring',
    'cyberpunk', 'witcher', 'final fantasy', 'resident evil', 'god of war',
    'horizon', 'spider-man', 'playstation', 'ps5', 'ps4', 'xbox series',
    'switch', 'dlc', 'update', 'patch', 'trailer', 'gameplay', 'review',
    'release', 'launch', 'beta', 'alpha', 'early access', 'steam deck',
    'nvidia', 'amd', 'gpu', 'rtx', 'geforce', 'radeon', 'graphics card',
    // Vietnamese keywords
    'trò chơi', 'game thủ', 'thủ game', 'esports', 'liên minh', 'liên quân',
    'pubg', 'free fire', 'lmht', 'tốc chiến', 'mobile legends', 'arena of valor',
    'garena', 'vng', 'fpt', 'nimo', 'streamer', 'youtuber', 'tựa game',
    'bản cập nhật', 'ra mắt', 'phát hành', 'thế giới mở', 'nhập vai',
    'hành động', 'chiến thuật', 'sinh tồn', 'đấu trường', 'giải đấu',
    'máy chơi game', 'console', 'tay cầm', 'bàn phím', 'chuột gaming',
    'màn hình gaming', 'laptop gaming', 'pc gaming', 'card đồ họa'
];

// Keywords to EXCLUDE (not gaming related)
const EXCLUDE_KEYWORDS = [
    // Sports
    'bóng đá', 'world cup', 'ngoại hạng', 'champions league', 'premier league',
    'la liga', 'serie a', 'bundesliga', 'messi', 'ronaldo', 'football',
    'soccer', 'basketball', 'tennis', 'golf', 'olympics', 'boxing',
    'thể thao', 'đội tuyển', 'huấn luyện viên', 'cầu thủ', 'sân cỏ',
    // Finance/Politics
    'chính trị', 'kinh tế', 'tài chính', 'chứng khoán', 'bitcoin', 'crypto',
    'bất động sản', 'nhà đất', 'đầu tư', 'ngân hàng',
    // Health/Fashion
    'thời trang', 'làm đẹp', 'sức khỏe', 'y tế', 'covid', 'vaccine',
    // Entertainment/Gossip - NOT gaming
    'hot girl', 'hotgirl', 'sexy', 'gợi cảm', 'khoe thân', 'khoe dáng',
    'diễn viên', 'ca sĩ', 'người mẫu', 'hoa hậu', 'showbiz', 'sao việt',
    'tình yêu', 'hẹn hò', 'chia tay', 'kết hôn', 'đám cưới', 'bạn trai', 'bạn gái',
    'scandal', 'drama', 'lộ ảnh', 'lộ clip', 'nóng bỏng', 'bikini',
    'cosplay', 'coser', 'cos',
    'mỹ nhân', 'visual', 'nhan sắc', 'xinh đẹp', 'quyến rũ', 'nữ thần',
    'idol', 'kpop', 'k-pop', 'blackpink', 'bts', 'twice',
    // Anime/Manga (not games)
    'one piece', 'naruto', 'dragon ball', 'attack on titan', 'demon slayer',
    'jujutsu kaisen', 'my hero academia', 'anime', 'manga', 'truyện tranh',
    'bleach', 'hunter x hunter', 'one punch man', 'spy x family',
    // Movies/TV
    'phim', 'movie', 'netflix', 'marvel', 'dc comics', 'avengers',
    'squid game', 'stranger things', 'hollywood', 'điện ảnh'
];

// Cache for news (refresh every 10 minutes)
let newsCache = [];
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Check if an article is gaming/PC related
 * STRICT MODE: Must contain gaming keywords, don't trust source
 */
function isGamingRelated(article) {
    const text = `${article.title} ${article.snippet}`.toLowerCase();
    
    // Check for excluded keywords first - immediate reject
    for (const keyword of EXCLUDE_KEYWORDS) {
        if (text.includes(keyword.toLowerCase())) {
            return false;
        }
    }
    
    // MUST contain at least one gaming/PC keyword - strict filter
    for (const keyword of GAMING_KEYWORDS) {
        if (text.includes(keyword.toLowerCase())) {
            return true;
        }
    }
    
    // No gaming keyword found = not gaming related
    return false;
}

/**
 * Fetch game news from all sources
 * @param {string} language - Filter by language ('vi', 'en', or 'all')
 * @param {number} limit - Maximum number of articles to return
 * @returns {Promise<Array>} - Array of news articles
 */
async function fetchGameNews(language = 'all', limit = 20) {
    const now = Date.now();
    
    // Return cached data if still fresh
    if (newsCache.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
        console.log('📰 Returning cached news');
        return filterNews(newsCache, language, limit);
    }

    try {
        console.log("⏳ Fetching news from RSS sources...");

        const feedPromises = FEED_SOURCES.map(async (source) => {
            try {
                const feed = await parser.parseURL(source.url);
                return feed.items.map(item => ({
                    title: item.title,
                    link: cleanLink(item.link, item.guid),
                    pubDate: new Date(item.pubDate).toISOString(),
                    snippet: cleanSnippet(item.contentSnippet || item.content || ''),
                    image: extractImage(item),
                    source: source.name,
                    language: source.lang
                }));
            } catch (err) {
                console.error(`❌ Error fetching from ${source.name}:`, err.message);
                return [];
            }
        });

        const results = await Promise.all(feedPromises);
        let allNews = results.flat();

        // Filter out non-gaming news
        const beforeFilter = allNews.length;
        allNews = allNews.filter(isGamingRelated);
        console.log(`🎮 Filtered: ${beforeFilter} -> ${allNews.length} gaming articles`);

        // Sort by date (newest first)
        allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        // Update cache
        newsCache = allNews;
        lastFetchTime = now;
        
        console.log(`✅ Fetched ${allNews.length} gaming articles`);

        return filterNews(allNews, language, limit, startDate, endDate);

    } catch (error) {
        console.error("❌ News fetch error:", error);
        return [];
    }
}

/**
 * Filter news by language, limit, and date range
 */
function filterNews(news, language, limit, startDate, endDate) {
    let filtered = news;
    
    // Filter by language
    if (language !== 'all') {
        filtered = news.filter(n => n.language === language);
    }

    // Filter by date range
    if (startDate) {
        const start = new Date(startDate).setHours(0,0,0,0);
        filtered = filtered.filter(n => new Date(n.pubDate).getTime() >= start);
    }
    
    if (endDate) {
        const end = new Date(endDate).setHours(23,59,59,999);
        filtered = filtered.filter(n => new Date(n.pubDate).getTime() <= end);
    }

    // Default: Filter out very old news only if no specific date range is requested
    // If user explicitly asks for older news (startDate provided), we don't apply the 7-day filter
    if (!startDate) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = filtered.filter(article => new Date(article.pubDate) >= sevenDaysAgo);
    }
    
    return filtered.slice(0, limit);
}

/**
 * Clean tracking URLs and return original article URL
 * GameK uses cl44.cnnd.vn, d44.cnnd.vn as tracking redirects
 */
function cleanLink(link, guid) {
    if (!link) return guid || '#';
    
    // GameK uses cnnd.vn tracking domains (cl44.cnnd.vn, d44.cnnd.vn, etc.)
    // Example: https://cl44.cnnd.vn/netflix-goi-goku...17826020.chn -> https://gamek.vn/netflix-goi-goku...17826020.chn
    if (link.includes('cnnd.vn') || link.includes('ctvrd.vn')) {
        try {
            const url = new URL(link);
            // Get the pathname which contains the article slug
            const pathname = url.pathname;
            if (pathname && pathname.length > 1) {
                // Reconstruct GameK URL from pathname
                return `https://gamek.vn${pathname}`;
            }
        } catch (e) {
            // If URL parsing fails, try regex extraction
            const pathMatch = link.match(/cnnd\.vn(\/[^\s?]+)/);
            if (pathMatch && pathMatch[1]) {
                return `https://gamek.vn${pathMatch[1]}`;
            }
        }
        
        // Fallback to GUID if available
        if (guid && (guid.startsWith('http://') || guid.startsWith('https://'))) {
            return guid;
        }
    }
    
    return link;
}

/**
 * Clean HTML from snippet
 */
function cleanSnippet(text) {
    if (!text) return '';
    // Remove HTML tags
    let clean = text.replace(/<[^>]*>/g, '');
    // Truncate to 200 chars
    if (clean.length > 200) {
        clean = clean.substring(0, 200) + '...';
    }
    return clean.trim();
}

/**
 * Try to extract image from RSS item
 */
function extractImage(item) {
    // Check enclosure (common in many feeds)
    if (item.enclosure && item.enclosure.url) {
        return item.enclosure.url;
    }
    
    // Check mediaContent (parsed from media:content - IGN, GameSpot)
    if (item.mediaContent && Array.isArray(item.mediaContent)) {
        for (const media of item.mediaContent) {
            if (media.$ && media.$.url) {
                return media.$.url;
            }
        }
    }
    
    // Check mediaThumbnail (parsed from media:thumbnail)
    if (item.mediaThumbnail && Array.isArray(item.mediaThumbnail)) {
        for (const thumb of item.mediaThumbnail) {
            if (thumb.$ && thumb.$.url) {
                return thumb.$.url;
            }
        }
    }
    
    // Check mediaGroup
    if (item.mediaGroup && item.mediaGroup['media:thumbnail']) {
        const thumb = item.mediaGroup['media:thumbnail'];
        if (Array.isArray(thumb) && thumb[0] && thumb[0]['$']) {
            return thumb[0]['$'].url;
        }
    }
    
    // Check contentEncoded for embedded images
    if (item.contentEncoded) {
        const imgMatch = item.contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/);
        if (imgMatch) return imgMatch[1];
    }
    
    // Check regular content
    if (item.content) {
        const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/);
        if (imgMatch) return imgMatch[1];
    }
    
    // Check description
    if (item.description) {
        const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/);
        if (imgMatch) return imgMatch[1];
    }
    
    // Default placeholder with gaming theme
    return 'https://placehold.co/400x200/0f172a/22d3ee?text=GAMING+NEWS';
}

module.exports = { fetchGameNews, FEED_SOURCES };
