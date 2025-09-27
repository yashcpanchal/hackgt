// content.js - Notion Highlighter Extension (FINAL REVISION)
(function () {
    'use strict';
  
    // --- CONSTANTS ---
    const HIGHLIGHT_CLASS = 'notion-highlight';
    const SEARCH_HIGHLIGHT_CLASS = 'search-highlight';
    const HIGHLIGHT_ID_ATTR = 'data-highlight-id';
    const NOTION_CONTENT_SELECTOR = '.notion-page-content';
  
    // --- STATE ---
    let isProcessing = false;
    let isInitialized = false;
    let lastUrl = window.location.href;
    let searchHighlights = [];
    let mutationObserver = null;
    let debounceTimer = null;
  
    // --- CORE INITIALIZATION ---
    function init() {
      if (isInitialized || !window.location.hostname.endsWith('notion.so')) {
        return;
      }
      isInitialized = true;
      console.log('🚀 Notion Highlighter Initialized');
  
      // Initial load of highlights
      setTimeout(loadHighlights, 1500);
  
      // Add all event listeners
      addEventListeners();
      
      // Set up the observer to handle dynamic content loading
      setupMutationObserver();
    }
  
    function addEventListeners() {
      chrome.runtime.onMessage.addListener(handleMessage);
      document.addEventListener('keydown', handleKeyDown, true);
    }
  
    // --- MUTATION OBSERVER (REVISED) ---
    function setupMutationObserver() {
      mutationObserver = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            console.log('URL changed, reloading highlights.');
            loadHighlights();
          } else {
            // This call is now fixed and will correctly re-apply highlights
            reapplyHighlights();
          }
        }, 500);
      });
  
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
    
    // --- MESSAGE HANDLING ---
    function handleMessage(request, sender, sendResponse) {
      console.log('Message received:', request);
      switch (request.type) {
        case 'highlight-selection':
          highlightSelection();
          sendResponse({ status: 'highlighted' });
          break;
        case 'clear-highlights':
          clearHighlights();
          sendResponse({ status: 'cleared page' });
          break;
        case 'search-text':
          searchAndHighlightText(request.text);
          sendResponse({ status: 'search complete' });
          break;
        default:
          sendResponse({ status: 'unknown command' });
          break;
      }
      return true;
    }
    
    // --- KEYBOARD SHORTCUTS ---
    function handleKeyDown(e) {
      const activeElement = document.activeElement;
      if (!activeElement || !activeElement.closest('[contenteditable="true"]')) return;
  
      if (e.altKey && !e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        highlightSelection();
      } else if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        clearHighlights();
      }
    }
  
    // --- HIGHLIGHTING LOGIC ---
    function highlightSelection() {
      if (isProcessing) return;
      isProcessing = true;
    
      try {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
          showHUD('No text selected.');
          return;
        }
    
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();
        if (!selectedText) {
          showHUD('Please select some text.');
          return;
        }
        
        const contentEditable = range.startContainer.parentElement.closest('[contenteditable="true"]');
        if (!contentEditable) {
          showHUD('Cannot highlight here.');
          return;
        }
    
        const block = range.startContainer.parentElement.closest('[data-block-id]');
        if (!block) {
          showHUD('Could not find Notion block.');
          return;
        }
        const blockId = block.getAttribute('data-block-id');
        const highlightId = `nh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const span = document.createElement('span');
        span.className = HIGHLIGHT_CLASS;
        span.setAttribute(HIGHLIGHT_ID_ATTR, highlightId);
    
        try {
          range.surroundContents(span);
        } catch (e) {
          console.warn('surroundContents failed. Using fallback method.', e);
          const contents = range.extractContents();
          span.appendChild(contents);
          range.insertNode(span);
        }
    
        saveHighlight({
          text: selectedText,
          blockId: blockId,
          highlightId: highlightId,
        });
    
        selection.removeAllRanges();
        showHUD('Highlight added!');
      } catch (e) {
        console.error('Error highlighting selection:', e);
        showHUD('Error: Could not highlight.');
      } finally {
        isProcessing = false;
      }
    }
    
    // --- SEARCH LOGIC ---
    function searchAndHighlightText(searchText) {
      clearSearchHighlights();
      if (!searchText || searchText.trim().length === 0) return;
  
      const content = document.querySelector(NOTION_CONTENT_SELECTOR);
      if (!content) {
        showHUD('Could not find Notion content area.');
        return;
      }
  
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }
  
      let matchCount = 0;
      const searchLower = searchText.toLowerCase();
  
      textNodes.forEach(node => {
        const textLower = node.nodeValue.toLowerCase();
        if (textLower.includes(searchLower)) {
          let parent = node.parentNode;
          if (parent.closest(`.${HIGHLIGHT_CLASS}, .${SEARCH_HIGHLIGHT_CLASS}, button, a`)) return;
          
          let lastIndex = 0;
          const fragment = document.createDocumentFragment();
  
          while ((lastIndex = textLower.indexOf(searchLower, lastIndex)) !== -1) {
            fragment.appendChild(document.createTextNode(node.nodeValue.substring(lastIndex, lastIndex)));
            const span = document.createElement('span');
            span.className = SEARCH_HIGHLIGHT_CLASS;
            span.textContent = node.nodeValue.substring(lastIndex, lastIndex + searchText.length);
            fragment.appendChild(span);
            searchHighlights.push(span);
            matchCount++;
            lastIndex += searchText.length;
          }
          fragment.appendChild(document.createTextNode(node.nodeValue.substring(lastIndex)));
          parent.replaceChild(fragment, node);
        }
      });
  
      if (matchCount > 0) {
        showHUD(`Found ${matchCount} matches.`);
        searchHighlights[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        showHUD('No matches found.');
      }
    }
    
    // --- CLEARING LOGIC ---
    function clearHighlights() {
      return new Promise((resolve) => {
        const highlights = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        if (highlights.length === 0) {
          showHUD('No highlights to clear.');
          resolve();
          return;
        }
        
        highlights.forEach(span => {
          const parent = span.parentNode;
          if (parent) {
            const text = document.createTextNode(span.textContent);
            parent.replaceChild(text, span);
            parent.normalize();
          }
        });
        
        chrome.storage.local.get(['notionHighlights'], (result) => {
          const allHighlights = result.notionHighlights || {};
          if (allHighlights[window.location.href]) {
            delete allHighlights[window.location.href];
            chrome.storage.local.set({ notionHighlights: allHighlights }, () => {
              showHUD(`Cleared ${highlights.length} highlights.`);
              resolve();
            });
          }
        });
      });
    }
  
    function clearSearchHighlights() {
      searchHighlights.forEach(span => {
        if (span.parentNode) {
          const parent = span.parentNode;
          const text = document.createTextNode(span.textContent);
          parent.replaceChild(text, span);
          parent.normalize();
        }
      });
      searchHighlights = [];
    }
    
    // --- DATA PERSISTENCE (REVISED) ---
    async function saveHighlight(highlightData) {
      const { notionHighlights = {} } = await chrome.storage.local.get('notionHighlights');
      const pageUrl = window.location.href;
      const pageHighlights = notionHighlights[pageUrl] || [];
      pageHighlights.push(highlightData);
      notionHighlights[pageUrl] = pageHighlights;
      await chrome.storage.local.set({ notionHighlights });
    }
  
    // Simplified initial load function
    function loadHighlights() {
      reapplyHighlights();
    }
    
    // This is the key persistence function, now self-contained and fixed
    async function reapplyHighlights() {
      const { notionHighlights = {} } = await chrome.storage.local.get('notionHighlights');
      const pageHighlights = notionHighlights[window.location.href] || [];
      
      if (pageHighlights.length === 0) return;
  
      pageHighlights.forEach(h => {
        if (document.querySelector(`[${HIGHLIGHT_ID_ATTR}="${h.highlightId}"]`)) {
          return;
        }
  
        const block = document.querySelector(`[data-block-id="${h.blockId}"]`);
        if (block) {
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null, false);
          let node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue.includes(h.text) && !node.parentElement.closest(`.${HIGHLIGHT_CLASS}`)) {
              const range = document.createRange();
              const index = node.nodeValue.indexOf(h.text);
              range.setStart(node, index);
              range.setEnd(node, index + h.text.length);
              
              const span = document.createElement('span');
              span.className = HIGHLIGHT_CLASS;
              span.setAttribute(HIGHLIGHT_ID_ATTR, h.highlightId);
              try {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);
              } catch (e) {
                console.warn("Could not re-apply highlight:", h.text, e);
              }
              break; 
            }
          }
        }
      });
    }
  
    // --- UTILITY FUNCTIONS ---
    function showHUD(message, duration = 3000) {
      let hud = document.getElementById('notion-highlighter-hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'notion-highlighter-hud';
        document.body.appendChild(hud);
      }
      hud.textContent = message;
      hud.classList.add('visible');
      
      clearTimeout(hud.timeoutId);
      hud.timeoutId = setTimeout(() => {
        hud.classList.remove('visible');
      }, duration);
    }
    
    // --- START THE EXTENSION ---
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  
  })();