// ===================================
// SOFTWARE LIST MODULE
// ===================================

var SoftwareAPI = (() => {
  const SOFTWARE_DATA = [
    { name: "Lossless Scaling", id: "993090", price: 102000, tag: "Performance" },
    { name: "3DMark", id: "223850", price: 580000, tag: "benchmark" },
    { name: "FPS Monitor", id: "966610", price: 142000, tag: "Performance" },
    { name: "PCMark 10", id: "524390", price: 580000, tag: "benchmark" },
    { name: "VRMark", id: "464170", price: 280000, tag: "benchmark" },
    { name: "Wallpaper Engine", id: "431960", price: 70000, tag: "Customization" },
    { name: "DisplayFusion", id: "227260", price: 400000, tag: "Customization" },
    { name: "Start11 v2", id: "1694750", price: 185000, tag: "Customization" },
    { name: "WindowBlinds 11", id: "2294630", price: 260000, tag: "Customization" },
    { name: "Soundpad", id: "629520", price: 82000, tag: "Audio" },
    { name: "Controller Companion", id: "367670", price: 45000, tag: "Gaming & Streaming" },
    { name: "Crosshair X", id: "1366800", price: 142000, tag: "Gaming & Streaming" },
    { name: "Borderless Gaming", id: "388080", price: 70000, tag: "Gaming & Streaming" },
    { name: "Virtual Desktop", id: "382110", price: 215000, tag: "VR" },
    { name: "Aseprite", id: "431730", price: 260000, tag: "Design & Illustration" },
    { name: "Substance 3D Painter 2026", id: "4329260", price: 3950000, tag: "Design & Illustration" },
    { name: "RPG Maker MZ", id: "1096900", price: 1100000, tag: "Design & Illustration" },
    { name: "DSX", id: "1812620", price: 121000, tag: "Utility" }
  ];

  function generateSoftwareCards() {
    return SOFTWARE_DATA.map(item => {
      const steamID = item.id;
      const headerImage = `https://cdn.akamai.steamstatic.com/steam/apps/${steamID}/header.jpg`;
      const manualImages = {
        "4329260": "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4329260/29f4eefacd48ae8a827a82a8c868f60b085dbafb/header.jpg?t=1773787641",
        // Add more manual IDs and URLs here if needed
      };

      return {
        id: `soft_${steamID}`,
        dealID: `soft_${steamID}`,
        title: item.name,
        price: item.price,
        originalPrice: item.price,
        savings: 0,
        category: (item.tag === "") ? "Software" : item.tag,
        rating: '4.8',
        image: manualImages[steamID] || headerImage,
        imageFallback: `https://placehold.co/616x353/171a21/ffffff?text=${encodeURIComponent(item.name)}`,
        imageFallback2: `https://placehold.co/616x353/171a21/ffffff?text=Software`,
        platform: 'WINDOWS',
        steamAppID: steamID,
      };
    });
  }

  const manualImages = {
    "4329260": "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4329260/29f4eefacd48ae8a827a82a8c868f60b085dbafb/header.jpg?t=1773787641",
  }

  function getSoftwareList() {
    return generateSoftwareCards();
  }

  return {
    getSoftwareList
  };
})();
