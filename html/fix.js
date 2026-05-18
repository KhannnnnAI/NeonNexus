const fs = require('fs');

function fixKeygen(file) {
  if (!fs.existsSync(file)) {
    console.log("File not found:", file);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');

  const regex = /\/\/\s*Save to Firebase if user is logged in[\s\S]*?console\.log\(" Saving keys to Firebase..."\);/;

  const replacementStr = `        // Check if user is Guest
        const isGuestUser = !currentUserId || currentUserId === 'guest' || String(currentUserId).startsWith('guest_');

        if (isGuestUser) {
          console.log(" Guest user - Saving keys to LocalStorage...");
          totalAmount = Math.round(Number(totalAmount)) || 0;
          
          const orderData = {
            orderId: "ORDER_" + Date.now(),
            keys: allKeys,
            games: allGames,
            amount: totalAmount,
            paymentMethod: paymentMethod,
            purchaseDate: new Date().toISOString(),
            status: "completed",
          };

          try {
            const existingKeys = JSON.parse(localStorage.getItem('guest_purchased_keys') || '[]');
            existingKeys.push(orderData);
            localStorage.setItem('guest_purchased_keys', JSON.stringify(existingKeys));
            console.log("Keys saved to LocalStorage successfully");
          } catch(e) {
            console.warn('Failed to save guest keys to localStorage:', e);
          }
        } else if (
          currentUserId &&
          window.firebaseCart &&
          window.firebaseCart.isAvailable()
        ) {
          console.log(" Saving keys to Firebase...");`;

  if (regex.test(content)) {
    content = content.replace(regex, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Successfully replaced in", file);
  } else {
    console.log("Target string not found in", file);
  }
}

fixKeygen('g:/TK Web/final/html/keygen.html');
fixKeygen('g:/TK Web/final/firebase_build/public/html/keygen.html');
