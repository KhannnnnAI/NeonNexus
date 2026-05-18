const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = 'g:\\TK Web\\final';
const DEST_DIR = 'g:\\TK Web\\final-local';

console.log('--- Syncing Files ---');
try {
    // We use robocopy via shell
    execSync(`robocopy "${SOURCE_DIR}" "${DEST_DIR}" /E /XF *.git* *.vscode* node_modules* firebase_build* /XD .git .vscode node_modules firebase_build /NP /R:1 /W:1`, { stdio: 'inherit' });
} catch (e) {
    // Robocopy returns non-zero even on success (1 = files copied)
    if (e.status > 8) {
        console.error('Robocopy failed:', e.message);
    }
}

console.log('--- Localizing Paths in ' + DEST_DIR + ' ---');

const mappings = [
    { from: 'href="/"', to: 'href="index.html"' },
    { from: 'href="/trending"', to: 'href="html/trending.html"' },
    { from: 'href="/event"', to: 'href="html/event.html"' },
    { from: 'href="/community"', to: 'href="html/community.html"' },
    { from: 'href="/support"', to: 'href="html/support.html"' },
    { from: 'href="/privacy-policy"', to: 'href="html/privacy_policy.html"' },
    { from: 'href="/terms-of-service"', to: 'href="html/terms_of_service.html"' },
    { from: 'href="/account"', to: 'href="html/account.html"' },
    { from: 'href="/game"', to: 'href="html/game.html"' },
    { from: 'href="/keygen"', to: 'href="html/keygen.html"' },
    { from: 'window.location.href = \'/\'', to: 'window.location.href = \'index.html\'' },
    { from: 'window.location.href = "/account"', to: 'window.location.href = "html/account.html"' },
    { from: 'window.location.href = "/keygen"', to: 'window.location.href = "html/keygen.html"' },
    { from: 'window.location.href = \'/keygen\'', to: 'window.location.href = \'html/keygen.html\'' }
];

const subDirMappings = [
    { from: 'href="/"', to: 'href="../index.html"' },
    { from: 'href="/trending"', to: 'href="trending.html"' },
    { from: 'href="/event"', to: 'href="event.html"' },
    { from: 'href="/community"', to: 'href="community.html"' },
    { from: 'href="/support"', to: 'href="support.html"' },
    { from: 'href="/privacy-policy"', to: 'href="privacy_policy.html"' },
    { from: 'href="/terms-of-service"', to: 'href="terms_of_service.html"' },
    { from: 'href="/account"', to: 'href="account.html"' },
    { from: 'href="/game"', to: 'href="game.html"' },
    { from: 'href="/keygen"', to: 'href="keygen.html"' },
    { from: 'window.location.href = \'/\'', to: 'window.location.href = \'../index.html\'' },
    { from: 'window.location.href = "/account"', to: 'window.location.href = "account.html"' },
    { from: 'window.location.href = "/keygen"', to: 'window.location.href = "keygen.html"' }
];

function processFile(filePath, maps) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // 1. Inject Path Resolver Script if not present
    if (!content.includes('path-resolver.js')) {
        const isRoot = !filePath.includes(path.sep + 'html' + path.sep) && !filePath.includes(path.sep + 'dashboard' + path.sep);
        const prefix = isRoot ? '' : '../';
        const scriptTag = `\n  <!-- Path Resolver for Local/Server switching -->\n  <script src="${prefix}API/path-resolver.js"></script>`;
        
        // Insert after first <script> or before </head>
        if (content.includes('</head>')) {
            content = content.replace('</head>', `${scriptTag}\n</head>`);
        }
    }

    // 2. Run existing mappings
    maps.forEach(m => {
        const regex = new RegExp(m.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        content = content.replace(regex, m.to);
    });
    
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated: ${path.relative(DEST_DIR, filePath)}`);
    }
}

// Process index.html in DEST_DIR
processFile(path.join(DEST_DIR, 'index.html'), mappings);

// Process files in html/
const htmlDir = path.join(DEST_DIR, 'html');
if (fs.existsSync(htmlDir)) {
    fs.readdirSync(htmlDir).forEach(file => {
        if (file.endsWith('.html')) {
            processFile(path.join(htmlDir, file), subDirMappings);
        }
    });
}

// Process files in dashboard/
const dashboardDir = path.join(DEST_DIR, 'dashboard');
if (fs.existsSync(dashboardDir)) {
    fs.readdirSync(dashboardDir).forEach(file => {
        if (file.endsWith('.html')) {
            processFile(path.join(dashboardDir, file), subDirMappings);
        }
    });
}

console.log('--- Sync and Localization Complete ---');
