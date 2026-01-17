/// <reference types="chrome" />

console.log("VibeCapsule background script loaded");

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'OPEN_SIDEPANEL') {
        // This requires the sender to be a tab
        if (sender.tab?.id) {
            chrome.sidePanel.open({ tabId: sender.tab.id, windowId: sender.tab.windowId });
        }
    }
});

// Optional: Enable sidepanel on icon click too
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
