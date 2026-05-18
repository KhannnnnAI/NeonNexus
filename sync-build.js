const fs = require('fs');
const path = require('path');

const SRC_DIR = __dirname;
const DEST_DIR = path.join(__dirname, 'firebase_build', 'public');

// List of directories and files to sync
const TO_SYNC = [
    'index.html',
    'API',
    'css',
    'dashboard',
    'html',
    'Image',
    'font',
    'img'
];

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        // Only copy if it's not a node_modules or firebase_build
        if (!src.includes('node_modules') && !src.includes('firebase_build')) {
            fs.copyFileSync(src, dest);
        }
    }
}

console.log('--- Starting Source Sync to Firebase Build ---');

TO_SYNC.forEach(item => {
    const srcPath = path.join(SRC_DIR, item);
    const destPath = path.join(DEST_DIR, item);
    
    if (fs.existsSync(srcPath)) {
        console.log(`Syncing: ${item}...`);
        copyRecursiveSync(srcPath, destPath);
    } else {
        console.warn(`Warning: ${item} not found in root!`);
    }
});

console.log('--- Sync Completed Successfully ---');
