// content.js - Injected into web pages
// Listens for extraction requests and returns cleaned page text

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    const result = extractPageContent();
    sendResponse(result);
  }
  return true;
});

function extractPageContent() {
  // Priority: semantic elements first
  const semanticEl = document.querySelector('article, [role="main"], main');
  const sourceEl = semanticEl || document.body;

  // Clone to avoid mutating the live DOM
  const clone = sourceEl.cloneNode(true);

  // Remove noise elements
  const noiseSelectors = [
    'script', 'style', 'noscript', 'nav', 'header', 'footer',
    'aside', 'iframe', 'svg', 'canvas', 'video', 'audio',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
    '[role="search"]', '[aria-hidden="true"]',
    '.advertisement', '.ads', '.ad', '#cookie-banner', '.cookie',
    '.sidebar', '.modal', '.overlay', '.popup'
  ];

  noiseSelectors.forEach(sel => {
    try {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    } catch {}
  });

  // Extract text and normalize whitespace
  const rawText = clone.innerText || clone.textContent || '';
  const cleaned = rawText
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Truncate to ~12000 chars (~3000 tokens) to fit most context windows
  const truncated = cleaned.length > 12000
    ? cleaned.slice(0, 12000) + '\n\n[Content truncated...]'
    : cleaned;

  return {
    content: truncated,
    title: document.title,
    url: window.location.href
  };
}
