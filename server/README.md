# Steam Login Server - Setup Instructions

## Prerequisites

You need to have **Node.js** installed to run the authentication server.

### Check if Node.js is installed:

```bash
node --version
npm --version
```

### If not installed, download Node.js from:

**https://nodejs.org/** (Download the LTS version)

---

## Installation Steps

### 1. Install Dependencies

Open a terminal in the `server` folder and run:

```bash
cd "g:\TK Web\final\server"
npm install
```

This will install:

- `express` - Web server framework
- `passport` - Authentication middleware
- `passport-steam` - Steam OpenID strategy
- `express-session` - Session management
- `cors` - Cross-origin resource sharing

### 2. (Optional) Get a Steam Web API Key

For full profile data (avatar, username), get a free API key:

1. Visit: **https://steamcommunity.com/dev/apikey**
2. Sign in with your Steam account
3. Create an API key for domain: `localhost`
4. Open `server/server.js` and replace `YOUR_STEAM_API_KEY_HERE` with your key

**Note:** The login will work without a valid key, but profile data may be limited.

---

## Running the Server

### Start the server:

```bash
cd "g:\TK Web\final\server"
npm start
```

You should see:

```
==================================================
🚀 Steam Auth Server running at http://localhost:5000
👉 Auth Endpoint: http://localhost:5000/auth/steam
==================================================
```

**Keep this terminal window open!**

---

## Testing the Login

1. **Start your frontend** (using Live Server or similar)
2. Click **"Login"** → **"Sign in with Steam"**
3. A popup will open redirecting to Steam
4. Sign in with your Steam account
5. The popup will close automatically and you'll be logged in

---

## Troubleshooting

### Error: "npm is not recognized"

- Install Node.js from https://nodejs.org/
- Restart your terminal after installation

### Port 5000 already in use:

- Change `PORT = 5000` to another port (e.g., 3000) in `server.js`
- Also update the URL in `auth.js` line 223

### Popup blocked:

- Allow popups for localhost in your browser settings
