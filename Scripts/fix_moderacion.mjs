import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('Pages/moderacion.js', 'utf8');

// Replace mod tab emojis
const flagEmoji = String.fromCodePoint(0x1F6A9);   // 🚩
const banEmoji = String.fromCodePoint(0x1F6AB);    // 🚫
const scalesEmoji = String.fromCodePoint(0x2696, 0xFE0F); // ⚖️
const clapEmoji = String.fromCodePoint(0x1F3AC);   // 🎬
const groupEmoji = String.fromCodePoint(0x1F465);  // 👥
const lockEmoji = String.fromCodePoint(0x1F512);   // 🔒

// Flag icon SVG
const flagSvg = '<svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>';

// Ban icon SVG
const banSvg = '<svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>';

// Scales icon SVG
const scalesSvg = '<svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"></line><path d="M5 21h14"></path><path d="m3 7 4-4 4 4"></path><path d="m17 7 4-4-4-4"></path><path d="M3 7c0 2.2 1.8 4 4 4s4-1.8 4-4"></path><path d="M17 7c0 2.2-1.8 4-4 4s-4-1.8-4-4"></path></svg>';

// Film icon SVG
const filmSvg = '<svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line><line x1="17" y1="17" x2="22" y2="17"></line></svg>';

// Users icon SVG
const usersSvg = '<svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';

// Lock icon SVG (for empty state)
const lockSvg = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

c = c.replaceAll(flagEmoji + ' Reportes', flagSvg + ' Reportes');
c = c.replaceAll(flagEmoji, flagSvg);
c = c.replaceAll(banEmoji + ' Baneos', banSvg + ' Baneos');
c = c.replaceAll(banEmoji, banSvg);
c = c.replaceAll(scalesEmoji + ' Apelaciones', scalesSvg + ' Apelaciones');
c = c.replaceAll(scalesEmoji, scalesSvg);
c = c.replaceAll(clapEmoji + ' Gestión Catálogo', filmSvg + ' Gestión Catálogo');
c = c.replaceAll(clapEmoji, filmSvg);
c = c.replaceAll(groupEmoji + ' Gestión Usuarios', usersSvg + ' Gestión Usuarios');
c = c.replaceAll(groupEmoji, usersSvg);
c = c.replaceAll('<div class="empty-icon">' + lockEmoji + '</div>', '<div class="empty-icon">' + lockSvg + '</div>');

writeFileSync('Pages/moderacion.js', c, 'utf8');
console.log('Moderacion emojis fixed');
