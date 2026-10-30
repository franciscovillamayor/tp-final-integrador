const fs = require('fs');
let c = fs.readFileSync('Pages/baneo.js', 'utf8');

// Replace ban emoji with SVG
const banSvg = '<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';
c = c.replace(/🚫/g, banSvg);

// Replace check mark in appeal confirmation
const checkSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
c = c.replace(/✓/g, checkSvg);

fs.writeFileSync('Pages/baneo.js', c, 'utf8');
console.log('Baneo emojis replaced successfully');
