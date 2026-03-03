// ===================================
// STEAM WALLET CODES MODULE
// ===================================

const GiftCodeAPI = (() => {
  const EXCHANGE_RATE = 26000; // 1 USD = 26,000 VND
  const EXCHANGE_RATE_JPY = 166; // 1 JPY = 166 VND
  const EXCHANGE_RATE_EUR = 27000; // 1 EUR = 27,000 VND
  const EXCHANGE_RATE_HKD = 3300; // 1 HKD = 3,300 VND


  // Gift code denominations
  const USD_DENOMINATIONS = [10, 20, 30, 50, 70, 100, 200, 500, 1000];
  const VND_DENOMINATIONS = [10000, 20000, 30000, 50000, 70000, 100000, 200000, 500000, 1000000];
  const JPY_DENOMINATIONS = [1000, 2000, 3000, 5000, 7000, 10000,];
  const EUR_DENOMINATIONS = [10, 20, 30, 50, 70, 100];
  const HKD_DENOMINATIONS = [10, 20, 30, 50, 70, 100];
  /**
   * Generate Steam Wallet gift codes
   * @returns {Array} Array of gift code products
   */
  function generateGiftCodes() {
    const giftCodes = [];

    // Use the Steam branding image for all gift cards
    const steamImage = 'Image/steam-gift-card.jpg';

    // Generate USD codes
    USD_DENOMINATIONS.forEach((amount, index) => {
      const vndPrice = amount * EXCHANGE_RATE;
      
      giftCodes.push({
        id: `gift_usd_${amount}`,
        dealID: `gift_usd_${amount}`, // Set dealID match id for hydration
        title: `Steam Wallet Code - $${amount} USD`,
        flagUrl: 'https://flagcdn.com/w40/us.png',
        price: vndPrice,
        originalPrice: vndPrice,
        savings: 0,
        category: 'WalletCode',
        rating: '5.0',
        image: steamImage,
        imageFallback: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+$${amount}+USD`,
        imageFallback2: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+$${amount}+USD`,
        needsRAWG: false,
        platform: 'WALLET CODE',
        specs: 'DIGITAL CODE',
        steamAppID: 'N/A',
        denomination: amount,
        currency: 'USD'
      });
    });

    // Generate VND codes
    VND_DENOMINATIONS.forEach((amount, index) => {
      
      giftCodes.push({
        id: `gift_vnd_${amount}`,
        dealID: `gift_vnd_${amount}`, // Set dealID match id
        title: `Steam Wallet Code - ${formatVNDShort(amount)} VND`,
        flagUrl: 'https://flagcdn.com/w40/vn.png',
        price: amount,
        originalPrice: amount,
        savings: 0,
        category: 'WalletCode',
        rating: '5.0',
        image: steamImage,
        imageFallback: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+${formatVNDShort(amount)}+VND`,
        imageFallback2: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+${formatVNDShort(amount)}+VND`,
        needsRAWG: false,
        platform: 'WALLET CODE',
        specs: 'DIGITAL CODE',
        steamAppID: 'N/A',
        denomination: amount,
        currency: 'VND'
      });
    });

    // Generate JPY codes
    JPY_DENOMINATIONS.forEach((amount, index) => {
      const vndPrice = amount * EXCHANGE_RATE_JPY;
      
      giftCodes.push({
        id: `gift_jpy_${amount}`,
        dealID: `gift_jpy_${amount}`, // Set dealID match id for hydration
        title: `Steam Wallet Code - ¥${amount} JPY`,
        flagUrl: 'https://flagcdn.com/w40/jp.png',
        price: vndPrice,
        originalPrice: vndPrice,
        savings: 0,
        category: 'WalletCode',
        rating: '5.0',
        image: steamImage,
        imageFallback: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+¥${amount}+JPY`,
        imageFallback2: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+¥${amount}+JPY`,
        needsRAWG: false,
        platform: 'WALLET CODE',
        specs: 'DIGITAL CODE',
        steamAppID: 'N/A',
        denomination: amount,
        currency: 'JPY'
      });
    });

    // Generate EUR codes
    EUR_DENOMINATIONS.forEach((amount, index) => {
      const vndPrice = amount * EXCHANGE_RATE_EUR;
      
      giftCodes.push({
        id: `gift_eur_${amount}`,
        dealID: `gift_eur_${amount}`, // Set dealID match id for hydration
        title: `Steam Wallet Code - €${amount} EUR`,
        flagUrl: 'https://flagcdn.com/w40/eu.png',
        price: vndPrice,
        originalPrice: vndPrice,
        savings: 0,
        category: 'WalletCode',
        rating: '5.0',
        image: steamImage,
        imageFallback: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+€${amount}+EUR`,
        imageFallback2: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+€${amount}+EUR`,
        needsRAWG: false,
        platform: 'WALLET CODE',
        specs: 'DIGITAL CODE',
        steamAppID: 'N/A',
        denomination: amount,
        currency: 'EUR'
      });
    });

    // Generate HKD codes
    HKD_DENOMINATIONS.forEach((amount, index) => {
      const vndPrice = amount * EXCHANGE_RATE_HKD;
      
      giftCodes.push({
        id: `gift_hkd_${amount}`,
        dealID: `gift_hkd_${amount}`, // Set dealID match id for hydration
        title: `Steam Wallet Code - HK$${amount} HKD`,
        flagUrl: 'https://flagcdn.com/w40/hk.png',
        price: vndPrice,
        originalPrice: vndPrice,
        savings: 0,
        category: 'WalletCode',
        rating: '5.0',
        image: steamImage,
        imageFallback: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+HK$${amount}+HKD`,
        imageFallback2: `https://placehold.co/616x353/171a21/ffffff?text=STEAM+HK$${amount}+HKD`,
        needsRAWG: false,
        platform: 'WALLET CODE',
        specs: 'DIGITAL CODE',
        steamAppID: 'N/A',
        denomination: amount,
        currency: 'HKD'
      });
    });

    return giftCodes;
  }

  /**
   * Format VND amount in short form (10k, 20k, 1 triệu)
   * @param {number} amount - Amount in VND
   * @returns {string} Formatted short string
   */
  function formatVNDShort(amount) {
    if (amount >= 1000000) {
      return `${amount / 1000000}M`;
    } else if (amount >= 1000) {
      return `${amount / 1000}k`;
    }
    return amount.toString();
  }

  /**
   * Get all gift codes
   * @returns {Array} Array of gift codes
   */
  function getGiftCodes() {
    return generateGiftCodes();
  }

  // Public API
  return {
    getGiftCodes,
    USD_DENOMINATIONS,
    VND_DENOMINATIONS
  };
})();
