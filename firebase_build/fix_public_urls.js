const fs = require('fs');
const path = require('path');
const baseURL = '/API/';

// Fix index.html in public
let idxPath = path.join(__dirname, 'public', 'index.html');
if (fs.existsSync(idxPath)) {
    let idx = fs.readFileSync(idxPath, 'utf8');
    // Match both src="./API/" and src="/API/" and src="API/"
    idx = idx.replace(/src=["'](\.?\/)?API\//g, 'src="' + baseURL);
    fs.writeFileSync(idxPath, idx);
}

// Fix all htmls in public/html dynamically
const htmlDir = path.join(__dirname, 'public', 'html');
if (fs.existsSync(htmlDir)) {
    fs.readdirSync(htmlDir).forEach(f => {
        if (f.endsWith('.html')) {
            const p = path.join(htmlDir, f);
            let content = fs.readFileSync(p, 'utf8');
            content = content.replace(/src=\"\.\.\/API\//g, 'src=\"' + baseURL);
            content = content.replace(/import \"\.\.\/API\//g, 'import \"' + baseURL);
            fs.writeFileSync(p, content);
        }
    });
}
console.log('Firebase public HTML replacements done!');
