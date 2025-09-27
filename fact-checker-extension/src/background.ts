/**
 * Background script for Notion Highlighter Extension
 * Handles extension lifecycle and command shortcuts
 */

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command: string) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];

    if (!activeTab?.id || !activeTab.url?.includes('notion.so')) {
      console.log('Command ignored: not on a Notion page');
      return;
    }

    switch (command) {
      case 'highlight-selection':
        chrome.tabs.sendMessage(activeTab.id, { type: 'highlight-selection' })
          .catch(err => console.error('Error sending highlight command:', err));
        break;
      case 'clear-highlights':
        chrome.tabs.sendMessage(activeTab.id, { type: 'clear-highlights' })
          .catch(err => console.error('Error sending clear command:', err));
        break;
      default:
        console.log('Unknown command:', command);
    }
  });
});

// Handle extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Notion Highlighter Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // Open options page or show welcome message
    console.log('Welcome to Notion Highlighter Extension!');
  } else if (details.reason === 'update') {
    console.log('Notion Highlighter Extension updated to version:', chrome.runtime.getManifest().version);
  }
});

// Optional: Handle context menu (can be added if needed)
// chrome.contextMenus.onClicked.addListener((info, tab) => {
//   if (tab?.id && tab.url?.includes('notion.so')) {
//     chrome.tabs.sendMessage(tab.id, { type: 'highlight-selection' });
//   }
// });

export {}; // Make this a module