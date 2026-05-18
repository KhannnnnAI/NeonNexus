// ===================================
// DLC LIST MODULE
// ===================================

var DLCAPI = (() => {
  const DLC_DATA = [
    // === RESIDENT EVIL SERIES ===
    { name: "Resident Evil 4 - Separate Ways",                                 id: "2109300", price: 235000, franchise: "Resident Evil Series", tag: "Action, Horror, Story Expansion" },
    { name: "Resident Evil 4 - Leon/Ashley Costumes: 'Casual'",                id: "2109303", price:  70000, franchise: "Resident Evil Series", tag: "Cosmetic, Outfit" },
    { name: "Resident Evil 4 - Leon/Ashley Costumes: 'Romantic'",              id: "2109304", price:  70000, franchise: "Resident Evil Series", tag: "Cosmetic, Outfit" },
    { name: "Resident Evil 4 - Leon Costume & Filter: 'Hero'",                 id: "2109305", price:  47000, franchise: "Resident Evil Series", tag: "Cosmetic, Filter" },
    { name: "Resident Evil 4 - Leon Costume & Filter: 'Villain'",              id: "2109306", price:  47000, franchise: "Resident Evil Series", tag: "Cosmetic, Filter" },
    { name: "Resident Evil 4 - Deluxe Weapon: 'Sentinel Nine'",                id: "2109308", price:  47000, franchise: "Resident Evil Series", tag: "Weapon, Item" },
    { name: "Resident Evil 4 - Deluxe Weapon: 'Skull Shaker'",                 id: "2109309", price:  47000, franchise: "Resident Evil Series", tag: "Weapon, Item" },
    { name: "Resident Evil Village - Winters' Expansion",                      id: "1731080", price: 470000, franchise: "Resident Evil Series", tag: "Horror, Third Person, Story" },
    { name: "Resident Evil Village - Trauma Pack",                             id: "1456360", price: 350000, franchise: "Resident Evil Series", tag: "Cosmetic, Safe Room Music, Weapon" },
    { name: "Resident Evil Village - Street Wolf Outfit",                      id: "1731081", price: 115000, franchise: "Resident Evil Series", tag: "Cosmetic, Outfit" },
    { name: "Resident Evil 7 - Banned Footage Vol.1",                         id: "529930",  price: 235000, franchise: "Resident Evil Series", tag: "Horror, Survival, Puzzle" },
    { name: "Resident Evil 7 - Banned Footage Vol.2",                         id: "530610",  price: 350000, franchise: "Resident Evil Series", tag: "Horror, Survival, Minigames" },
    { name: "Resident Evil 7 - End of Zoe",                                   id: "530611",  price: 350000, franchise: "Resident Evil Series", tag: "Action, Horror, Story Expansion" },
    { name: "Resident Evil 7 - Season Pass",                                  id: "540340",  price: 700000, franchise: "Resident Evil Series", tag: "Bundle, DLC Pass" },
    { name: "Resident Evil 2 - All In-game Rewards Unlock",                   id: "920571",  price: 115000, franchise: "Resident Evil Series", tag: "Unlockable, Cheat" },
    { name: "Resident Evil 2 - Leon Costume: 'Noir'",                         id: "920561",  price:  70000, franchise: "Resident Evil Series", tag: "Cosmetic, Outfit" },
    { name: "Resident Evil 2 - Claire Costume: 'Noir'",                       id: "920563",  price:  70000, franchise: "Resident Evil Series", tag: "Cosmetic, Outfit" },
    { name: "Resident Evil 2 - Deluxe Weapon: 'Samurai Edge - Albert Model'", id: "920568",  price:  47000, franchise: "Resident Evil Series", tag: "Weapon, Item" },
    { name: "Resident Evil 2 - Original Ver. Soundtrack Swap",                id: "920567",  price:  70000, franchise: "Resident Evil Series", tag: "Audio, Retro" },
    { name: "Resident Evil 3 - Classic Costume Pack",                         id: "1158730", price:  70000, franchise: "Resident Evil Series", tag: "Cosmetic, Retro Outfit" },
    { name: "Resident Evil 3 - All In-game Rewards Unlock",                   id: "1348140", price: 115000, franchise: "Resident Evil Series", tag: "Unlockable, Cheat" },
    { name: "RE Revelations - Rachel Ooze Costume",                           id: "229627",  price:  70000, franchise: "Resident Evil Series", tag: "Raid Mode, Cosmetic" },
    { name: "RER2 Episode Two: Contemplation",                                 id: "319810",  price: 470000, franchise: "Resident Evil Series", tag: "Bundle, Story Episodes" },
    { name: "RER2 Episode Three: Judgment",                                    id: "320350",  price: 470000, franchise: "Resident Evil Series", tag: "Bundle, Story Episodes" },
    // === OTHER FRANCHISES ===
    { name: "Cyberpunk 2077: Phantom Liberty",                                 id: "2138330", price: 709000,  franchise: "Cyberpunk 2077",                tag: "RPG, Sci-fi, Story Expansion" },
    { name: "Elden Ring Shadow of the Erdtree",                                id: "2778580", price: 850000,  franchise: "Elden Ring",                     tag: "Souls-like, Dark Fantasy, RPG" },
    { name: "The Witcher 3: Wild Hunt - Blood and Wine",                       id: "378648",  price: 450000,  franchise: "The Witcher 3: Wild Hunt",        tag: "RPG, Open World, Story Expansion" },
    { name: "The Witcher 3: Wild Hunt - Hearts of Stone",                      id: "378649",  price: 220000,  franchise: "The Witcher 3: Wild Hunt",        tag: "RPG, Story Expansion" },
    { name: "Monster Hunter World: Iceborne",                                  id: "1118010", price: 800000,  franchise: "Monster Hunter: World",           tag: "Action, Hunting, Massive Expansion" },
    { name: "Monster Hunter Rise: Sunbreak",                                   id: "1880360", price: 880000,  franchise: "Monster Hunter: Rise",            tag: "Action, Hunting, Expansion" },
    { name: "Fallout 4 - Far Harbor",                                          id: "435881",  price: 360000,  franchise: "Fallout 4",                       tag: "Open World, Post-apocalyptic, RPG" },
    { name: "Fallout 4 - Nuka-World",                                          id: "490650",  price: 240000,  franchise: "Fallout 4",                       tag: "Open World, RPG" },
    { name: "Skyrim Anniversary Upgrade",                                      id: "1746860", price: 470000,  franchise: "The Elder Scrolls V: Skyrim",     tag: "RPG, Fantasy, Upgrade Pack" },
    { name: "Assassin's Creed Valhalla - Dawn of Ragnarök",                   id: "2210140", price: 820000,  franchise: "Assassin's Creed Valhalla",       tag: "Action, Viking, Mythology" },
    { name: "Assassin's Creed Valhalla - Wrath of the Druids",                id: "2210142", price: 500000,  franchise: "Assassin's Creed Valhalla",       tag: "Action, Story DLC" },
    { name: "Dark Souls III - The Ringed City",                                id: "506971",  price: 340000,  franchise: "Dark Souls III",                  tag: "Souls-like, Action RPG" },
    { name: "Dark Souls III - Ashes of Ariandel",                             id: "506970",  price: 340000,  franchise: "Dark Souls III",                  tag: "Souls-like, Action RPG" },
    { name: "Dying Light: The Following",                                      id: "325724",  price: 470000,  franchise: "Dying Light",                     tag: "Zombies, Parkour, Story Expansion" },
    { name: "Destiny 2: The Final Shape",                                      id: "2336880", price: 1180000, franchise: "Destiny 2",                       tag: "FPS, Looter Shooter, Expansion" },
    { name: "Destiny 2: Lightfall",                                            id: "1945340", price: 940000,  franchise: "Destiny 2",                       tag: "FPS, Sci-fi" },
    { name: "Borderlands 3: Season Pass",                                      id: "1233060", price: 1150000, franchise: "Borderlands 3",                   tag: "Looter Shooter, FPS" },
    { name: "Civilization VI: Gathering Storm",                                id: "947510",  price: 930000,  franchise: "Sid Meier's Civilization VI",     tag: "Strategy, Turn-based" },
    { name: "Civilization VI: Rise and Fall",                                  id: "645402",  price: 700000,  franchise: "Sid Meier's Civilization VI",     tag: "Strategy, Turn-based" },
    { name: "Total War: WARHAMMER III - Shadows of Change",                   id: "2325830", price: 570000,  franchise: "Total War: WARHAMMER III",        tag: "Strategy, RTS" },
    { name: "Forza Horizon 5 Rally Adventure",                                 id: "1613281", price: 470000,  franchise: "Forza Horizon 5",                 tag: "Racing, Open World" },
    { name: "Forza Horizon 5 Hot Wheels",                                      id: "1551360", price: 470000,  franchise: "Forza Horizon 5",                 tag: "Racing, Arcade" },
    { name: "Dead by Daylight - Resident Evil Chapter",                        id: "1634040", price: 142000,  franchise: "Dead by Daylight",                tag: "Horror, Multiplayer" },
    { name: "Dead by Daylight - Silent Hill Chapter",                          id: "1324970", price: 100000,  franchise: "Dead by Daylight",                tag: "Horror, Multiplayer" },
    { name: "DOOM Eternal: The Ancient Gods - Part One",                       id: "1098292", price: 470000,  franchise: "DOOM Eternal",                    tag: "FPS, Action, Gore" },
    { name: "Remnant II - DLC Bundle",                                         id: "2384071", price: 580000,  franchise: "Remnant II",                      tag: "Souls-like, Action, Co-op" },
    { name: "Hogwarts Legacy: Dark Arts Pack",                                 id: "1880832", price: 470000,  franchise: "Hogwarts Legacy",                 tag: "RPG, Magic, Cosmetic" },
  ];

  // Manual image overrides for IDs whose header.jpg differs from the CDN default
  const manualImages = {
    "2109300": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2109300/header.jpg?t=1772502990",
    "2109303": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2109303/ea37a0d893dbe6ab23a1daa0c4f568a9328904a9/header.jpg?t=1744269543",
    "2109304": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2109304/2f4e70910aa662d20741884eb3c61bddac4f1cb8/header.jpg?t=1773461522",
    "2109305": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2109305/header.jpg?t=1660143428",
    "2109306": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2109306/header.jpg?t=1693417145",
    "2109308": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2109308/header.jpg?t=1728353422",
    "2109309": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2109309/header.jpg?t=1778505901",
    "1731080": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1731080/header.jpg?t=1776927212",
    "1456360": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1456360/header.jpg?t=1776927216",
    "1731081": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1731081/header.jpg?t=1776927212",
    "530610":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/530610/header.jpg?t=1683527559",
    "530611":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/530611/header.jpg?t=1683527618",
    "540340":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/540340/header.jpg?t=1728451911",
    "920563":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/920563/header.jpg?t=1728438746",
    "920568":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/920568/header.jpg?t=1728438769",
    "287290":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/287290/header.jpg?t=1769125412",
    "2138330": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2435150/header.jpg?t=1684266618",
    "2778580": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2778580/header.jpg?t=1763403045",
    "378648":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/378648/88bcde3e71414240678d5591088a7ebfb5e0aaf2/header.jpg?t=1768304054",
    "378649":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/378649/48e242724931e89a71474b9f5ca080243e3ac772/header.jpg?t=1768304100",
    "1118010": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1118010/header.jpg?t=1727684185",
    "1880360": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1880360/header.jpg?t=1771259412",
    "435881":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/435881/header.jpg?t=1533677062",
    "490650":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/490650/header.jpg?t=1478693964",
    "1746860": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1746860/header.jpg?t=1726757961",
    "506971":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/506971/header.jpg?t=1580310936",
    "506970":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/506970/header.jpg?t=1580310767",
    "325724":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/325724/header.jpg?t=1738251150",
    "1945340": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1945340/header.jpg?t=1765904449",
    "1233060": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1233060/header.jpg?t=1692309310",
    "947510":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/947510/header.jpg?t=1734134756",
    "645402":  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/645402/header.jpg?t=1734133062",
    "2325830": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2325830/header.jpg?t=1742922069",
    "1551360": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/header.jpg?t=1746471508",
  };

  function generateDLCCards() {
    return DLC_DATA.map(item => {
      const steamID = item.id;
      const defaultImage = `https://cdn.akamai.steamstatic.com/steam/apps/${steamID}/header.jpg`;

      return {
        id: `dlc_${steamID}`,
        dealID: `dlc_${steamID}`,
        title: item.name,
        price: item.price,
        originalPrice: item.price,
        savings: 0,
        category: 'DLC',
        tag: item.tag,
        franchise: item.franchise,
        rating: '4.7',
        image: manualImages[steamID] || defaultImage,
        imageFallback: `https://cdn.akamai.steamstatic.com/steam/apps/${steamID}/header.jpg`,
        imageFallback2: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamID}/capsule_616x353.jpg`,
        imageFallback3: `https://placehold.co/616x353/171a21/ffffff?text=${encodeURIComponent(item.name)}`,
        platform: 'STEAM',
        steamAppID: steamID,
      };
    });
  }

  function getDLCList() {
    return generateDLCCards();
  }

  return {
    getDLCList
  };
})();
