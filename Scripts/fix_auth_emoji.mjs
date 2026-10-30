import { readFileSync, writeFileSync } from 'fs';

// Fix Pages/auth.js - globe emoji
let auth = readFileSync('Pages/auth.js', 'utf8');
const globe = String.fromCodePoint(0x1F310); // 🌐
const globeSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
auth = auth.replaceAll(globe, globeSvg);
writeFileSync('Pages/auth.js', auth, 'utf8');
console.log('Pages/auth.js emojis fixed');

// Fix Scripts/auth.js - globe emoji
let sauth = readFileSync('Scripts/auth.js', 'utf8');
sauth = sauth.replaceAll(globe, globeSvg);
writeFileSync('Scripts/auth.js', sauth, 'utf8');
console.log('Scripts/auth.js emojis fixed');

console.log('All auth emojis fixed!');
