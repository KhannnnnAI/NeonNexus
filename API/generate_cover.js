const fs = require('fs');
const path = require('path');
const TextToSVG = require('text-to-svg');

const fontPath = path.join(__dirname, 'font', 'ROGLyonsTypeRegular3.ttf');
const outputPath = path.join(__dirname, 'cover_custom.svg');

try {
    const textToSVG = TextToSVG.loadSync(fontPath);

    const attributes = { fill: '#ffffff', stroke: 'none' };
    const options = { x: 0, y: 0, fontSize: 130, anchor: 'left top', attributes: attributes };

    // Layout: Center alignment
    // Icon width ~260. Text height ~100.
    // NEON (Wide font) ~ 450px wide. NEXUS ~ 500px wide.
    // Total content width approx: 300 (Icon) + 40 (gap) + 450 + 40 + 500 = ~1330
    // Start X approx -665.
    
    // Mathematically perfect centering.
    // Total Width ~1280. Left: -640. Right: +640.
    // Icon: -640. NEON: -320. NEXUS: 160.
    // Gaps: Icon-NEON ~56px. NEON-NEXUS ~50px.
    
    const neonPath = textToSVG.getPath('NEON', { ...options, fontSize: 130, x: -320, y: -40, attributes: { fill: '#ffffff' } });
    const nexusPath = textToSVG.getPath('NEXUS', { ...options, fontSize: 130, x: 160, y: -40, attributes: { fill: 'url(#neonText)', filter: 'url(#glow)' } });
    
    // Slogan: Add spaces to simulate wide tracking
    const sloganText = 'I N F I N I T E   S T O R E   ::   S T E A M   D E A L S';
    // Center anchor for slogan. 
    // Reset to 0 since we want everything centered on 0.
    const sloganPath = textToSVG.getPath(sloganText, { 
        x: 0, y: 110, fontSize: 24, anchor: 'center top', attributes: { fill: '#94a3b8' } 
    });
    
    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1640 624" width="1640" height="624">
  <defs>
    <!-- Grid Pattern -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a1a" stroke-width="1"/>
    </pattern>
    
    <!-- Neon Gradient for Text/Icon -->
    <linearGradient id="neonText" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#22d3ee;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
    </linearGradient>
    
    <!-- Glow Filter -->
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="
        0 0 0 0 0
        0 0 0 0 0.8
        0 0 0 0 1
        0 0 0 0.5 0" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background: Dark Hex/Grid Pattern -->
  <rect width="100%" height="100%" fill="#0a0a0a" />
  <rect width="100%" height="100%" fill="url(#grid)" />

  <!-- Content Group (Centered) -->
  <g transform="translate(820, 312)">
    
    <!-- Icon (Left of text) -->
    <g transform="translate(-640, -120) scale(11)">
       <path fill="url(#neonText)" filter="url(#glow)" d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
    </g>

    <!-- Main Title: NEON NEXUS (Clean Paths) -->
    <!-- NEON -->
    ${neonPath}
    <!-- NEXUS -->
    ${nexusPath}

    <!-- Tagline (As Path) -->
    <g transform="translate(0, 40)">
       ${sloganPath}
    </g>

  </g>
</svg>`;

    fs.writeFileSync(outputPath, svgContent);
    console.log('✅ Generated cover_custom.svg with vectorized font paths.');

} catch (error) {
    console.error('❌ Error:', error.message);
}
