// ===================================
// NEONNEXUS - CUSTOM AAA GAMES
// ===================================


function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function loadCustomGames() {
    console.log('[Custom Games] Loading custom AAA games...');
    const newGrid = document.getElementById('new-trending-grid');
    const classicGrid = document.getElementById('classic-trending-grid');

    // Custom AAA games data
    const customAAAGames = [
            {
                dealID: 'custom1',
                title: 'DEAD OR ALIVE 6 Last Round',
                normalPrice: '867000',
                savings: '25',
                steamRatingPercent: '85',
                steamRatingCount: '15420',
                releaseDate: new Date('2026-03-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4144680/e94fe79e24de4c1488f1967f13144c6df66b5b51/header.jpg?t=1776377936',
                steamAppID: '4144680',
                class: 'coming-soon'
            },
            {
                dealID: 'custom2',
                title: 'MARVEL Tōkon: Fighting Souls™',
                normalPrice: '1600000',
                savings: '22',
                steamRatingPercent: '90',
                steamRatingCount: '23150',
                releaseDate: new Date('2026-08-6').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3787240/7c31b39ea7425766f289fc5c81ecbecd8604d912/header.jpg?t=1775555637',
                steamAppID: '3787240',
                class: 'coming-soon'
            },
            {
                dealID: 'custom3',
                title: 'SILENT HIL: Townfall',
                normalPrice: '1320000',
                savings: '29',
                steamRatingPercent: '92',
                steamRatingCount: '31200',
                releaseDate: new Date('2026-02-10').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1636440/6ccd36f8da1eb7fd0e04e6f04675b9f9d56728b4/header.jpg?t=1772169094',
                steamAppID: '1636440',
                class: 'coming-soon'
            },
            {
                dealID: 'custom4',
                title: 'Forza Horizon 6',
                normalPrice: '1500000',
                savings: '27',
                steamRatingPercent: '90',
                steamRatingCount: '28900',
                releaseDate: new Date('2026-04-08').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2483190/27abb1584a118d50d0e3950fd48d557c51981db7/header.jpg?t=1777567585',
                steamAppID: '2483190',
                class: 'coming-soon'

            },
            {
                dealID: 'custom5',
                title: 'Phantom Blade Zero',
                normalPrice: '1600000',
                savings: '31',
                steamRatingPercent: '90',
                steamRatingCount: '19800',
                releaseDate: new Date('2026-06-12').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4115450/5930310dc5f043a1df400d9dc70ddb43843480fc/header.jpg?t=1766676850',
                steamAppID: '4115450',
                class: 'coming-soon'
            },
            {
                dealID: 'custom6',
                title: '007 First Light',
                normalPrice: '1050000',
                savings: '33',
                steamRatingPercent: '83',
                steamRatingCount: '16500',
                releaseDate: new Date('2026-07-25').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3768760/86d898447e0e475e3f8a9cc1ef660a80032472d7/header_alt_assets_1.jpg?t=1777552006',
                steamAppID: '3768760',
                class: 'coming-soon'
            },
            {
                dealID: 'custom7',
                title: 'Dune: Awakening',
                normalPrice: '790000',
                savings: '20',
                steamRatingPercent: '89',
                steamRatingCount: '22100',
                releaseDate: new Date('2026-08-30').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1172710/da994ea756677c3d1d9a77accb8596a8661f4cad/header.jpg?t=1777565238',
                steamAppID: '1172710',
                class: 'coming-soon'
            },
            {
                dealID: 'custom8',
                title: 'STAR WARS: Galactic Racer™',
                normalPrice: '780900',
                savings: '27',
                steamRatingPercent: '91',
                steamRatingCount: '27300',
                releaseDate: new Date('2026-09-18').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/4078430/97215eb609882139ce6a28419116be23fcf5ac86/header.jpg?t=1777558462',
                steamAppID: '4078430',
                class: 'coming-soon'
            },
            {
                dealID: 'custom9',
                title: 'Resident Evil Requiem',
                normalPrice: '1450000',
                savings: '30',
                steamRatingPercent: '100',
                steamRatingCount: '18700',
                releaseDate: new Date('2026-10-22').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3764200/ce5437442768e38eb575f205ab9397d0264017b0/header.jpg?t=1772587704',
                steamAppID: '3764200'
            },
            {
                dealID: 'custom10',
                title: 'Pragmata',
                normalPrice: '1250000',
                savings: '25',
                steamRatingPercent: '95',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3357650/e32e168b25ed68a0cf6264c220c07e96c2abfb56/header.jpg?t=1777351016',
                steamAppID: '3357650'
            },
            {
                dealID: 'custom11',
                title: 'Screamer',
                normalPrice: '999000',
                savings: '25',
                steamRatingPercent: '95',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2814990/f4fba3a1edca44fbb2bd86c80340eb3de854102b/header.jpg?t=1776873990',
                steamAppID: '2814990'
            },
            {
                dealID: 'custom12',
                title: "Nioh 3",
                normalPrice: '1450000',
                savings: '25',
                steamRatingPercent: '98',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3681010/a21264e9fd476dcb2901c2432b598107d024c5a8/header.jpg?t=1772090941',
                steamAppID: '3681010'
            },
            {
                dealID: 'custom13',
                title: "Code Vein 2",
                normalPrice: '1190000',
                savings: '25',
                steamRatingPercent: '98',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2362060/955e8f3fce6d832c286ac8013657ed6fc51f1f85/header.jpg?t=1770242240',
                steamAppID: '2362060'
            },
            {
                dealID: 'custom14',
                title: "FATAL FRAME II: Crimson Butterfly REMAKE",
                normalPrice: '1042000',
                savings: '25',
                steamRatingPercent: '90',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3920610/f0ca97688410ecb4effbde0b77431443a5172cf8/header.jpg?t=1774575080',
                steamAppID: '3920610'
            },
            {
                dealID: 'custom15',
                title: "Yakuza Kiwami 3 & Dark Ties",
                normalPrice: '909000',
                savings: '25',
                steamRatingPercent: '92',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3937550/a90df0d7be6d8f1dd5d8eceb796840ff522d002a/header.jpg?t=1777587435',
                steamAppID: '3937550'
            },
            {
                dealID: 'custom16',
                title: "Monster Hunter Stories 3: Twisted Reflection",
                normalPrice: '1450000',
                savings: '25',
                steamRatingPercent: '93',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2852190/de3717096a093d7bf9ab504563621bc17e37ccf4/header.jpg?t=1776820472',
                steamAppID: '2852190'
            },
            {
                dealID: 'custom17',
                title: "DEATH STRANDING 2: ON THE BEACH",
                normalPrice: '1850000',
                savings: '25',
                steamRatingPercent: '92',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3280350/6270c77b0729e2df0a17d660286eeddfd9169386/header.jpg?t=1774022345',
                steamAppID: '3280350'
            },
            {
                dealID: 'custom18',
                title: "Marathon",
                normalPrice: '739000',
                savings: '25',
                steamRatingPercent: '87',
                steamRatingCount: '24500',
                releaseDate: new Date('2026-11-15').getTime() / 1000,
                thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3065800/64362abbb8904abd51d9d17e54e0154be16916fc/header.jpg?t=1776191386',
                steamAppID: '3065800'
            }
        ];

    // Popular AAA games data
    const popularAAAGames = [
        {
            dealID: 'popular1',
            title: 'Black Myth: Wukong',
            normalPrice: '1299000',
            savings: '0',
            steamRatingPercent: '95',
            steamRatingCount: '45000',
            releaseDate: new Date('2024-08-20').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/header.jpg?t=1760601605',
            steamAppID: '2358720'
        },
        {
            dealID: 'popular2',
            title: 'Helldivers 2',
            normalPrice: '1060000',
            savings: '0',
            steamRatingPercent: '92',
            steamRatingCount: '68000',
            releaseDate: new Date('2024-02-08').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/f11c258b04a5e3e7771c1bab60f324ebf6c6c6fb/header.jpg?t=1770747641',
            steamAppID: '553850'
        },
        {
            dealID: 'popular3',
            title: 'Warhammer 40,000: Space Marine 2',
            normalPrice: '830000',
            savings: '0',
            steamRatingPercent: '90',
            steamRatingCount: '32000',
            releaseDate: new Date('2024-09-09').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2183900/header.jpg?t=1774004924',
            steamAppID: '2183900'
        },
        {
            dealID: 'popular4',
            title: "Dragon's Dogma 2",
            normalPrice: '1450000',
            savings: '0',
            steamRatingPercent: '88',
            steamRatingCount: '51000',
            releaseDate: new Date('2024-03-22').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2054970/header.jpg?t=1768870094',
            steamAppID: '2054970'
        },
        {
            dealID: 'popular5',
            title: 'Resident Evil 4 Remake',
            normalPrice: '850000',
            savings: '0',
            steamRatingPercent: '100',
            steamRatingCount: '42000',
            releaseDate: new Date('2024-01-26').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2050650/header.jpg?t=1772502922',
            steamAppID: '2050650'
        },
        {
            dealID: 'popular6',
            title: 'Monster Hunter Wilds',
            normalPrice: '1390000',
            savings: '0',
            steamRatingPercent: '95',
            steamRatingCount: '28000',
            releaseDate: new Date('2025-02-28').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2246340/header.jpg?t=1771382452',
            steamAppID: '2246340'
        },
        {
            dealID: 'popular7',
            title: "Assassin's Creed Shadows",
            normalPrice: '1190000',
            savings: '0',
            steamRatingPercent: '87',
            steamRatingCount: '35000',
            releaseDate: new Date('2025-11-14').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3159330/header.jpg?t=1775589420',
            steamAppID: '3159330'
        },
        {
            dealID: 'popular8',
            title: "Kingdom Come: Deliverance II",
            normalPrice: '999000',
            savings: '0',
            steamRatingPercent: '91',
            steamRatingCount: '29000',
            releaseDate: new Date('2025-02-04').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1771300/header.jpg?t=1774370931',
            steamAppID: '1771300'
        },
        {
            dealID: 'popular9',
            title: 'DOOM: The Dark Ages',
            normalPrice: '1630000',
            savings: '0',
            steamRatingPercent: '94',
            steamRatingCount: '38000',
            releaseDate: new Date('2025-05-20').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3017860/header.jpg?t=1768344167',
            steamAppID: '3017860'
        },
        {
            dealID: 'popular10',
            title: "Sid Meier's Civilization® VII",
            normalPrice: '2328000',
            savings: '0',
            steamRatingPercent: '89',
            steamRatingCount: '41000',
            releaseDate: new Date('2025-02-11').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1295660/header.jpg?t=1777064528',
            steamAppID: '1295660'
        },
        {
            dealID: 'popular11',
            title: 'Like a Dragon: Infinite Wealth',
            normalPrice: '1230000',
            savings: '0',
            steamRatingPercent: '92',
            steamRatingCount: '33000',
            releaseDate: new Date('2024-01-26').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2072450/header.jpg?t=1763646953',
            steamAppID: '2072450'
        },
        {
            dealID: 'popular12',
            title: "S.T.A.L.K.E.R. 2: Heart of Chornobyl",
            normalPrice: '990000',
            savings: '0',
            steamRatingPercent: '86',
            steamRatingCount: '46000',
            releaseDate: new Date('2024-09-05').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1643320/3e525c6969728ec1641c5834e660472357fcd4cf/header.jpg?t=1776173087',
            steamAppID: '1643320'
        },
        {
            dealID: 'popular13',
            title: 'Metaphor: ReFantazio',
            normalPrice: '1264000',
            savings: '0',
            steamRatingPercent: '93',
            steamRatingCount: '31000',
            releaseDate: new Date('2024-10-11').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2679460/header.jpg?t=1764776325',
            steamAppID: '2679460'
        },
        {
            dealID: 'popular14',
            title: 'Silent Hill 2 (Remake)',
            normalPrice: '870000',
            savings: '0',
            steamRatingPercent: '91',
            steamRatingCount: '52000',
            releaseDate: new Date('2024-10-08').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2124490/header.jpg?t=1744248682',
            steamAppID: '2124490'
        },
        {
            dealID: 'popular15',
            title: 'Persona 3 Reload',
            normalPrice: '909000',
            savings: '0',
            steamRatingPercent: '94',
            steamRatingCount: '44000',
            releaseDate: new Date('2024-02-02').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2161700/header.jpg?t=1764776430',
            steamAppID: '2161700'
        },
        {
            dealID: 'popular16',
            title: 'Horizon Forbidden West™ Complete Edition',
            normalPrice: '1600000',
            savings: '0',
            steamRatingPercent: '90',
            steamRatingCount: '37000',
            releaseDate: new Date('2024-03-21').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2420110/header.jpg?t=1776465869',
            steamAppID: '2420110'
        },
        {
            dealID: 'popular17',
            title: "Ghost of Tsushima DIRECTOR'S CUT",
            normalPrice: '1600000',
            savings: '0',
            steamRatingPercent: '95',
            steamRatingCount: '48000',
            releaseDate: new Date('2024-05-16').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2215430/header.jpg?t=1763409398',
            steamAppID: '2215430'
        },
        {
            dealID: 'popular18',
            title: "Senua's Saga: Hellblade II",
            normalPrice: '1163000',
            savings: '0',
            steamRatingPercent: '89',
            steamRatingCount: '29000',
            releaseDate: new Date('2024-05-21').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2461850/eeba63cff53a732f380249a09b0be2bbf49f2635/header.jpg?t=1767701468',
            steamAppID: '2461850'
        },
        {
            dealID: 'popular19',
            title: 'Banishers: Ghosts of New Eden',
            normalPrice: '700000',
            savings: '0',
            steamRatingPercent: '88',
            steamRatingCount: '26000',
            releaseDate: new Date('2024-02-13').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1493640/header.jpg?t=1763044792',
            steamAppID: '1493640'
        },
        {
            dealID: 'popular20',
            title: 'Frostpunk 2',
            normalPrice: '5250000',
            savings: '0',
            steamRatingPercent: '92',
            steamRatingCount: '34000',
            releaseDate: new Date('2024-09-20').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1601580/header.jpg?t=1776700013',
            steamAppID: '1601580'
        },
        {
            dealID: 'popular21',
            title: 'Metal Gear Solid Delta: Snake Eater (Remake)',
            normalPrice: '870000',
            savings: '0',
            steamRatingPercent: '96',
            steamRatingCount: '51000',
            releaseDate: new Date('2025-08-28').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2417610/05c97cbcd0cfc27c8ed6c7fc6d81e0995aa2a7d4/header.jpg?t=1762249119',
            steamAppID: '2417610'
        },
        {
            dealID: 'popular22',
            title: "Clair Obscur: Expedition 33",
            normalPrice: '770000',
            savings: '0',
            steamRatingPercent: '98',
            steamRatingCount: '35000',
            releaseDate: new Date('2025-11-14').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1903340/be3305b02d4db0dffa3458537118423bf2792d7e/header.jpg?t=1773676780',
            steamAppID: '1903340'
        },
        {
            dealID: 'popular23',
            title: 'Tekken 8',
            normalPrice: '790000',
            savings: '0',
            steamRatingPercent: '93',
            steamRatingCount: '42000',
            releaseDate: new Date('2024-01-26').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1778820/f69b0f7c35aa8c966d9ff74c2bae548dbea072e4/header.jpg?t=1770678135',
            steamAppID: '1778820'
        },
        {
            dealID: 'popular24',
            title: 'FINAL FANTASY XVI',
            normalPrice: '1249000',
            savings: '0',
            steamRatingPercent: '93',
            steamRatingCount: '42000',
            releaseDate: new Date('2024-01-26').getTime() / 1000,
            thumb: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2515020/header.jpg?t=1773294537',
            steamAppID: '2515020'
        },
    ];

    // Use only custom games data
    const newHits = customAAAGames;
    const classicMasterpieces = popularAAAGames;

    
    renderGrid(newGrid, newHits, 'cyan');
    renderGrid(classicGrid, classicMasterpieces, 'purple');

    console.log(`[Custom Games] Loaded ${newHits.length} custom games`);
    
    // Populate DISCOUNTS section with flash sale deals
    if (typeof loadTrendingDiscounts === 'function') {
        loadTrendingDiscounts();
    }

    // Add delegated click listener for product cards (Production Parity)
    [newGrid, classicGrid].forEach(grid => {
        if (!grid) return;
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            if (!card) return;
            
            const dealID = card.getAttribute('data-id');
            const game = [...newHits, ...classicMasterpieces].find(g => g.dealID === dealID);
            
            if (game && game.steamAppID) {
                window.open(`https://store.steampowered.com/app/${game.steamAppID}`, '_blank');
            }
        });
    });
}

function renderGrid(container, items, themeColor) {
    if (!container) return;
    
    if (items.length === 0) {
        container.innerHTML = '<p class="empty-notice">No titles found in this category.</p>';
        return;
    }

    container.innerHTML = items.map(game => {
        const priceVND = game.normalPrice;
        
        const ratingColor = getRatingColor(game.steamRatingPercent);
        const releaseYear = game.releaseDate ? new Date(game.releaseDate * 1000).getFullYear() : 'N/A';

        // Use game.thumb directly
        let imageSrc = game.thumb || 'https://placehold.co/616x353/1a1a1a/22d3ee?text=No+Image';

        return `
            <div class="product-card ${game.class || ''}" data-id="${game.dealID}">
                <div class="product-card-inner">
                    <div class="product-image-wrapper img">
                        <img 
                            src="${imageSrc}" 
                            alt="${game.title}" 
                            class="product-image" 
                            loading="lazy"
                            onerror="this.onerror=null; this.src='https://placehold.co/616x353/1a1a1a/22d3ee?text=${encodeURIComponent(game.title || 'No+Image')}';"
                        >
                        ${game.class === 'coming-soon' ? '<div class="coming-soon-badge">Coming Soon</div>' : ''}
                        <div class="game-rating-float" style="background: ${ratingColor}">
                            <i data-lucide="star" class="rating-icon"></i>
                            <span>${game.steamRatingPercent}%</span>
                        </div>
                    </div>
                    <div class="product-content">
                        <div class="product-header">
                            <h3 class="product-title">${game.title}</h3>
                            <div class="game-meta">
                                <span class="meta-tag tag-${themeColor}">${releaseYear}</span>
                            </div>
                        </div>
                        <div class="product-footer">
                            <div class="product-price-wrapper">
                                <span class="product-price">${formatCurrency(priceVND)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

function getRatingColor(percent) {
    const p = parseInt(percent);
    if (p >= 95) return '#00f2ff'; // Cyan
    if (p >= 85) return '#10b981'; // Green
    if (p >= 75) return '#fbbf24'; // Yellow
    return '#ef4444'; // Red
}

// Simple add to cart handler for custom games
window.handleAddToCart = (dealID) => {
    console.log(`[Custom Games] Add to cart clicked for: ${dealID}`);
    // You can add custom cart logic here
    alert(`Game ${dealID} added to cart!`);
};
