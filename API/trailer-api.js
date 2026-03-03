// ===================================
// TRAILER API MODULE (IGDB / TWITCH)
// ===================================

const TrailerAPI = (() => {

    /**
     * Search for a valid YouTube Trailer via our Server's IGDB Proxy
     * 
     * @param {string} gameName - Name of the game
     * @returns {Promise<Object|null>} Trailer data
     */
    async function getTrailer(gameName) {
      if (!gameName) return null;
      
      // Clean up game name for better search results
      // Remove years, text in parentheses, etc. e.g. "Resident Evil 4 (2023)" -> "Resident Evil 4"
      const cleanName = gameName.replace(/\s*\(.*?\)\s*/g, '').trim();

      // Manual overrides for specific games
      const OVERRIDES = {
          "Resident Evil 4 Classic": "FBZqcVXeTFc",
          "Resident Evil 4 (Remake)": "Id2EaldBaWw",
          "Resident Evil 5": "EUI48f4iWPc",
          "Resident Evil 5 Gold": "EUI48f4iWPc",
          "Resident Evil 6 (Complete)": "sS_bGpe9qE8",
          "Resident Evil 7 Biohazard": "RgYqQsbKn6w", 
          "Resident Evil 7 Biohazard Gold": "RgYqQsbKn6w",
          "Resident Evil Village": "btFclZUXpzA",
          "Resident Evil: Requiem": "T54OWinnymM",
          "Resident Evil Revelations 2": "3IMxhH0o-LY",
          "Resident Evil":"xcL-BMyFiA8",
          "Resident Evil 3":"xNjGFUaorYc",
          "Resident Evil 2":"u3wS-Q2KBpk",
          "Resident Evil 0":"tffrh6JMptM",
          "Resident Evil: Revelations": "pgSF2aY9MtM",
          
          
      };
    
      if (OVERRIDES[gameName] || OVERRIDES[cleanName]) {
          const videoId = OVERRIDES[gameName] || OVERRIDES[cleanName];
          console.log(`🎬 Using Manual Override for: ${gameName}`);
          return {
                id: videoId,
                title: `${gameName} - Official Trailer`,
                source: 'YouTube (Manual)',
                embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0`
          };
      }
      
      console.log(`🎬 Requesting trailer via IGDB Proxy for: ${cleanName} (Original: ${gameName})`);

      try {
        // Call our own server endpoint which handles the IGDB query logic
        const response = await fetch(`http://localhost:5000/api/games/trailer?name=${encodeURIComponent(cleanName)}`);
        
        if (!response.ok) {
            console.warn('IGDB Proxy returned error or 404');
            return null;
        }

        const data = await response.json();
        
        if (data && data.video_id) {
            return {
                id: data.video_id,
                title: `${data.title || gameName} - Official Trailer`,
                source: 'YouTube (IGDB)',
                // IGDB returns YouTube Video IDs, so we simply embed them
                embedUrl: `https://www.youtube.com/embed/${data.video_id}?autoplay=1&mute=0`
            };
        }
        
        return null; // Return null if no trailer found (Server returned 200 but no ID, or we handled it)

      } catch (error) {
        console.warn('Trailer API Warning: Could not fetch trailer.', error.message);
        return null; // Return null on error to trigger "No Trailer" UI
      }
    }

    // Removed getFallbackTrailer to prevent showing wrong videos
  
    return {
      getTrailer
    };
  })();
  
  window.TrailerAPI = TrailerAPI;
