// popup.js - Handles the extension popup UI (REVISED)

document.addEventListener('DOMContentLoaded', () => {
  const clearPageBtn = document.getElementById('clearPage');
  const clearAllBtn = document.getElementById('clearAll');
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchText');

  // Send a message to the active tab's content script
  async function sendMessageToActiveTab(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url.includes('notion.so')) {
      // Add a small delay to give the content script time to initialize
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, message);
          window.close();
        } catch (error) {
          console.error(`Error sending message: ${message.type}`, error);
          alert('Could not connect to the Notion page. Please refresh the page and try again.');
        }
      }, 100);
    } else {
      alert('This extension only works on notion.so pages.');
    }
  }

  // Handle Clear Page button click
  clearPageBtn.addEventListener('click', () => {
    sendMessageToActiveTab({ type: 'clear-highlights' });
  });

  // Handle Clear All button click (this affects storage directly)
  clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear ALL highlights across ALL pages? This cannot be undone.')) {
      // Clear all highlights from storage
      chrome.storage.local.set({ notionHighlights: {} }, () => {
        // Notify all open Notion tabs to clear their highlights from the view
        chrome.tabs.query({ url: '*://*.notion.so/*' }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: 'clear-highlights' })
              .catch(err => console.log('Could not message tab, it might be inactive:', tab.url, err));
          });
        });
        window.close();
      });
    }
  });

  // Handle search logic
  function handleSearch() {
    const searchText = searchInput.value.trim();
    if (searchText) {
      sendMessageToActiveTab({ type: 'search-text', text: searchText });
    }
  }

  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });
});