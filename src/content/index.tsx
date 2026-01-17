import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { createRoot } from 'react-dom/client';

import FAB from './FAB';
import './style.css'; // We will create this

console.log("VibeCapsule content script loaded");

function init() {
    // Check if article is reader-able
    const documentClone = document.cloneNode(true) as Document;
    if (isProbablyReaderable(documentClone)) {
        console.log("VibeCapsule: Article detected!");
        injectFAB();
    }
}

function injectFAB() {
    const host = document.createElement('div');
    host.id = 'vibe-capsule-root';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // Inject styles into shadow DOM manually to ensure isolation
    // Note: Vite CRX might handle css injection, but shadow dom needs explicit style adoption or link
    // For simplicity, we use a style tag or emotion-like approach, or reuse the imported CSS text if configured
    // Here we will just let FAB handle its internal styles or assume basic button styles

    const root = createRoot(shadow);
    root.render(<FAB />);
}

// Listen for extraction requests
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'EXTRACT_CONTENT') {
        const documentClone = document.cloneNode(true) as Document;
        if (isProbablyReaderable(documentClone)) {
            const reader = new Readability(documentClone);
            const article = reader.parse();
            sendResponse({ content: article?.textContent, title: article?.title });
        } else {
            sendResponse({ error: 'Not reader-able' });
        }
    }
});

// Run init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
