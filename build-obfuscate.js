const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const PUBLIC_DIR = path.join(__dirname, 'firebase_build', 'public');

// Obfuscator Options - SAFE MODE
const jsOptions = {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: false,
    stringArray: true,
    stringArrayCallsTransform: false,
    stringArrayEncoding: [],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'variable',
    stringArrayThreshold: 0.75,
    transformObjectKeys: false,
    unicodeEscapeSequence: false
};

const htmlOptions = {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: false, // Disable inline JS minification to prevent breakage
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true
};

const cssCleaner = new CleanCSS({
    level: 1 // Safe mode (prevents stripping needed rules like @font-face)
});

async function processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
        if (ext === '.js') {
            const code = fs.readFileSync(filePath, 'utf8');
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, jsOptions);
            const obfuscatedCode = obfuscationResult.getObfuscatedCode();
            fs.writeFileSync(filePath, obfuscatedCode);
            console.log(`🔒 Obfuscated JS: ${path.relative(PUBLIC_DIR, filePath)}`);
        } else if (ext === '.html') {
            const html = fs.readFileSync(filePath, 'utf8');
            const minifiedHtml = await minify(html, htmlOptions);
            fs.writeFileSync(filePath, minifiedHtml);
            console.log(`📄 Minified HTML: ${path.relative(PUBLIC_DIR, filePath)}`);
        } else if (ext === '.css') {
            const css = fs.readFileSync(filePath, 'utf8');
            // SKIP Minification to prevent removing @font-face rules
            fs.writeFileSync(filePath, css);
            console.log(`🎨 CSS Copied (No Minify): ${path.relative(PUBLIC_DIR, filePath)}`);
        }
    } catch (err) {
        console.error(`❌ Error processing ${filePath}:`, err.message);
    }
}

async function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            await scanDirectory(fullPath); // Recursive
        } else {
            const lowerPath = fullPath.toLowerCase();
            if (lowerPath.endsWith('.js') || lowerPath.endsWith('.html') || lowerPath.endsWith('.css')) {
                await processFile(fullPath);
            }
        }
    }
}

(async () => {
    console.log('🛡️ Starting Full Site Obfuscation & Minification...');
    if (fs.existsSync(PUBLIC_DIR)) {
        await scanDirectory(PUBLIC_DIR);
        console.log('✅ All files protected!');
    } else {
        console.error('❌ Public directory not found:', PUBLIC_DIR);
    }
})();
