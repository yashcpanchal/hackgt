// background.js - Notion Highlighter Extension (REVISED)

// --- INSTALLATION ---
chrome.runtime.onInstalled.addListener(() => {
  // Use a promise-based approach for cleaner setup
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({
      id: 'highlight-selection',
      title: 'Highlight Selection',
      contexts: ['selection'],
      documentUrlPatterns: ['*://*.notion.so/*']
    });

    chrome.contextMenus.create({
      id: 'clear-highlights-page',
      title: 'Clear Page Highlights',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.notion.so/*']
    });
  });

  // Initialize storage if it doesn't exist
  chrome.storage.local.get('notionHighlights', (result) => {
    if (!result.notionHighlights) {
      chrome.storage.local.set({ notionHighlights: {} });
    }
  });
});

// --- CONTEXT MENU CLICKS ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  
  let messageType = '';
  if (info.menuItemId === 'highlight-selection') {
    messageType = 'highlight-selection';
  } else if (info.menuItemId === 'clear-highlights-page') {
    messageType = 'clear-highlights';
  }
  
  if (messageType) {
    chrome.tabs.sendMessage(tab.id, { type: messageType })
      .catch(err => console.log(`Error sending message for ${messageType}:`, err));
  }
});

// --- KEYBOARD SHORTCUTS ---
chrome.commands.onCommand.addListener((command, tab) => {
  // The manifest maps commands to `highlight-selection` and `clear-highlights`
  // We can pass the command directly as the message type
  if (tab && tab.id && tab.url && tab.url.includes('notion.so')) {
    chrome.tabs.sendMessage(tab.id, { type: command })
      .catch(err => console.log('Error sending command:', command, err));
  }
});

// --- POPUP MESSAGES ---
// Note: Most logic is now in content.js. The background script's role is minimal.
// The popup.js will send messages directly to the content script.