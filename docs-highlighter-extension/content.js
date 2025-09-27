// content.js - Notion Highlighter Extension (FLOATING OVERLAY REVISION)
(function () {
    'use strict';

    // --- CONSTANTS ---
    const HIGHLIGHT_CLASS = 'notion-highlight-overlay';
    const SEARCH_HIGHLIGHT_CLASS = 'search-highlight-overlay';
    const HIGHLIGHT_ID_ATTR = 'data-highlight-id';
    const NOTION_CONTENT_SELECTOR = '.notion-page-content';
    const OVERLAY_CONTAINER_ID = 'notion-highlighter-overlays';
  
    // --- STATE ---
    let isProcessing = false;
    let isInitialized = false;
    let lastUrl = window.location.href;
    let persistentHighlights = new Map(); // Map of highlight ID to highlight data
    let searchHighlights = new Map(); // Map for search highlights
    let overlayContainer = null;
    let mutationObserver = null;
    let debounceTimer = null;
    let resizeObserver = null;
  
    // --- CORE INITIALIZATION ---
    function init() {
      if (isInitialized || !window.location.hostname.endsWith('notion.so')) {
        return;
      }
      isInitialized = true;
      console.log('🚀 Notion Highlighter Initialized');

      // Create overlay container
      createOverlayContainer();

      // Initial load of highlights
      setTimeout(loadHighlights, 500);

      // Add all event listeners
      addEventListeners();

      // Set up observers to handle dynamic content loading
      setupMutationObserver();
      setupResizeObserver();

      // Set up periodic highlight validation
      setupPeriodicValidation();
    }
  
    function addEventListeners() {
      chrome.runtime.onMessage.addListener(handleMessage);
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('dblclick', handleDoubleClick, true);
      // Use requestAnimationFrame for smooth scroll updates
      let isScrollUpdating = false;
      document.addEventListener('scroll', () => {
        if (isScrollUpdating) return;
        isScrollUpdating = true;
        requestAnimationFrame(() => {
          updateOverlayPositions();
          isScrollUpdating = false;
        });
      }, true);
    }

    // --- OVERLAY SYSTEM ---
    function createOverlayContainer() {
      // Check if container already exists
      if (overlayContainer) return;

      // Check if container exists in DOM but not in our variable
      const existing = document.getElementById(OVERLAY_CONTAINER_ID);
      if (existing) {
        overlayContainer = existing;
        return;
      }

      try {
        overlayContainer = document.createElement('div');
        overlayContainer.id = OVERLAY_CONTAINER_ID;
        overlayContainer.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          z-index: 10000;
          overflow: hidden;
        `;

        if (document.body) {
          document.body.appendChild(overlayContainer);
          console.log('Overlay container created successfully');

          // Add a class to prevent it from being removed by other scripts
          overlayContainer.setAttribute('data-extension', 'notion-highlighter');
          overlayContainer.setAttribute('data-protected', 'true');
        } else {
          console.error('Document body not available for overlay container');
          overlayContainer = null;
        }
      } catch (error) {
        console.error('Failed to create overlay container:', error);
        overlayContainer = null;
      }
    }

    function createHighlightOverlay(rect, highlightId, isSearch = false) {
      const overlay = document.createElement('div');
      overlay.className = isSearch ? SEARCH_HIGHLIGHT_CLASS : HIGHLIGHT_CLASS;
      overlay.setAttribute(HIGHLIGHT_ID_ATTR, highlightId);

      overlay.style.cssText = `
        position: absolute;
        left: ${rect.left + window.scrollX}px;
        top: ${rect.top + window.scrollY}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background-color: ${isSearch ? 'rgba(255, 240, 138, 0.6)' : 'rgba(255, 240, 138, 0.5)'};
        border-bottom: 2px solid ${isSearch ? 'rgba(255, 201, 25, 0.8)' : 'rgba(255, 201, 25, 0.6)'};
        border-radius: 3px;
        pointer-events: none;
        z-index: 1;
      `;

      return overlay;
    }

    function updateOverlayPositions() {
      if (!overlayContainer) {
        console.warn('Overlay container not found during position update, recreating...');
        createOverlayContainer();
        if (!overlayContainer) return;
      }

      // Check if overlay container is still in the DOM
      if (!document.body.contains(overlayContainer)) {
        console.warn('Overlay container was removed from DOM, recreating...');
        overlayContainer = null;
        createOverlayContainer();
        if (!overlayContainer) return;
      }

      // Update persistent highlights
      persistentHighlights.forEach((highlightData, highlightId) => {
        updateSingleHighlight(highlightId, highlightData, false);
      });

      // Update search highlights
      searchHighlights.forEach((highlightData, highlightId) => {
        updateSingleHighlight(highlightId, highlightData, true);
      });
    }

    function updateSingleHighlight(highlightId, highlightData, isSearch) {
      if (!overlayContainer) return;

      // Remove all existing overlays for this highlight
      const existingOverlays = overlayContainer.querySelectorAll(`[${HIGHLIGHT_ID_ATTR}^="${highlightId}"]`);
      existingOverlays.forEach(overlay => overlay.remove());

      // Find the text in the current DOM
      const textElement = findTextInDOM(highlightData.text, highlightData.blockId);
      if (!textElement) {
        return; // Text not found, just remove existing overlays
      }

      try {
        const rects = getTextBoundingRects(textElement, highlightData.text);
        if (rects.length === 0) return;

        // Create new overlays for each rect (in case text wraps)
        rects.forEach((rect, index) => {
          const overlay = createHighlightOverlay(rect, `${highlightId}-${index}`, isSearch);
          overlayContainer.appendChild(overlay);
        });
      } catch (error) {
        console.warn('Error updating highlight:', highlightId, error);
      }
    }

    function findTextInDOM(text, blockId) {
      const block = document.querySelector(`[data-block-id="${blockId}"]`);
      if (!block) return null;

      const walker = document.createTreeWalker(
        block,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue.includes(text)) {
          return node;
        }
      }
      return null;
    }

    function getTextBoundingRects(textNode, text) {
      const range = document.createRange();
      const nodeValue = textNode.nodeValue;
      const startIndex = nodeValue.indexOf(text);

      if (startIndex === -1) return [];

      range.setStart(textNode, startIndex);
      range.setEnd(textNode, startIndex + text.length);

      const rects = Array.from(range.getClientRects());
      return rects.filter(rect => rect.width > 0 && rect.height > 0);
    }

    function setupResizeObserver() {
      if (!window.ResizeObserver) return;

      let isResizeUpdating = false;
      resizeObserver = new ResizeObserver(() => {
        if (isResizeUpdating) return;
        isResizeUpdating = true;
        requestAnimationFrame(() => {
          updateOverlayPositions();
          isResizeUpdating = false;
        });
      });

      resizeObserver.observe(document.body);
    }

    function setupPeriodicValidation() {
      // Check highlights every 3 seconds to ensure they're still visible
      setInterval(() => {
        if (!overlayContainer || persistentHighlights.size === 0) return;

        const visibleOverlays = overlayContainer.querySelectorAll(`.${HIGHLIGHT_CLASS}`);

        // If we have highlights stored but no visible overlays, restore them
        if (persistentHighlights.size > 0 && visibleOverlays.length === 0) {
          console.log('Highlights lost, restoring...');
          updateOverlayPositions();
        }
      }, 3000);
    }

    // --- DOUBLE CLICK HANDLER ---
    function handleDoubleClick(event) {
      // Check if we're in a content editable area
      const target = event.target;
      const contentEditable = target.closest('[contenteditable="true"]');
      if (!contentEditable) return;

      // Small delay to let the selection settle
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim()) {
          highlightSelection();
        }
      }, 50);
    }
  
    // --- MUTATION OBSERVER (REVISED) ---
    function setupMutationObserver() {
      mutationObserver = new MutationObserver((mutations) => {
        // Ignore mutations that are from our own overlay container
        const isOurMutation = mutations.some(mutation => {
          return Array.from(mutation.addedNodes).some(node =>
            node.id === OVERLAY_CONTAINER_ID ||
            (node.parentElement && node.parentElement.id === OVERLAY_CONTAINER_ID) ||
            (node.className && typeof node.className === 'string' &&
             (node.className.includes('notion-highlight-overlay') || node.className.includes('search-highlight-overlay')))
          );
        });

        if (isOurMutation) {
          return; // Don't process mutations caused by our overlays
        }

        // Check if any significant content changes occurred
        const hasSignificantChanges = mutations.some(mutation => {
          return mutation.type === 'childList' &&
                 (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) &&
                 Array.from(mutation.addedNodes).some(node =>
                   node.nodeType === Node.ELEMENT_NODE &&
                   (node.classList?.contains('notion-page-content') ||
                    node.querySelector?.('[data-block-id]'))
                 );
        });

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            console.log('URL changed, reloading highlights.');
            loadHighlights();
          } else if (hasSignificantChanges) {
            // Only reapply highlights if there were significant content changes
            console.log('Significant content changes detected, updating highlights...');
            updateOverlayPositions();
          }
        }, 500); // Reduced debounce for better responsiveness
      });
  
      // Observe only the Notion content area, not the entire body
      const contentArea = document.querySelector('.notion-page-content') || document.body;
      mutationObserver.observe(contentArea, {
        childList: true,
        subtree: true,
        attributes: false, // Don't observe attribute changes
        characterData: false // Don't observe text changes
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
  
    // --- HIGHLIGHTING LOGIC (OVERLAY BASED) ---
    function highlightSelection() {
      if (isProcessing) return;
      if (!isInitialized) {
        showHUD('Extension still initializing...');
        return;
      }
      if (!overlayContainer) {
        showHUD('Overlay system not ready...');
        return;
      }
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

        const contentEditable = range.startContainer.parentElement?.closest('[contenteditable="true"]');
        if (!contentEditable) {
          showHUD('Cannot highlight here.');
          return;
        }

        const block = range.startContainer.parentElement?.closest('[data-block-id]');
        if (!block) {
          showHUD('Could not find Notion block.');
          return;
        }

        const blockId = block.getAttribute('data-block-id');
        const highlightId = `nh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Get the bounding rectangles for the selection
        const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);

        if (rects.length === 0) {
          showHUD('Could not determine text position.');
          return;
        }

        // Store highlight data
        const highlightData = {
          text: selectedText,
          blockId: blockId,
          highlightId: highlightId,
        };

        // Add to persistent highlights
        persistentHighlights.set(highlightId, highlightData);

        // Create overlay elements for each rect
        if (!overlayContainer) {
          console.error('Overlay container not initialized');
          createOverlayContainer();
        }

        rects.forEach((rect, index) => {
          const overlay = createHighlightOverlay(rect, `${highlightId}-${index}`, false);
          if (overlayContainer) {
            overlayContainer.appendChild(overlay);
          }
        });

        // Save to storage
        saveHighlight(highlightData);

        selection.removeAllRanges();
        showHUD('Highlight added!');
      } catch (e) {
        console.error('Error highlighting selection:', e);
        showHUD('Error: Could not highlight.');
      } finally {
        isProcessing = false;
      }
    }
    
    // --- SEARCH LOGIC (OVERLAY BASED) ---
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
          if (parent.closest('button, a, [role="button"]')) return;

          let currentIndex = 0;
          while ((currentIndex = textLower.indexOf(searchLower, currentIndex)) !== -1) {
            // Create a range for this match
            const range = document.createRange();
            range.setStart(node, currentIndex);
            range.setEnd(node, currentIndex + searchText.length);

            const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);

            if (rects.length > 0) {
              const highlightId = `search-${Date.now()}-${matchCount}`;
              const block = node.parentElement?.closest('[data-block-id]');
              const blockId = block?.getAttribute('data-block-id') || 'unknown';

              const highlightData = {
                text: node.nodeValue.substring(currentIndex, currentIndex + searchText.length),
                blockId: blockId,
                highlightId: highlightId,
              };

              // Add to search highlights
              searchHighlights.set(highlightId, highlightData);

              // Create overlay elements for each rect
              if (!overlayContainer) {
                console.error('Overlay container not initialized during search');
                createOverlayContainer();
              }

              rects.forEach((rect, index) => {
                const overlay = createHighlightOverlay(rect, `${highlightId}-${index}`, true);
                if (overlayContainer) {
                  overlayContainer.appendChild(overlay);
                }
              });

              matchCount++;
            }

            currentIndex += searchText.length;
          }
        }
      });

      if (matchCount > 0) {
        showHUD(`Found ${matchCount} matches.`);
        // Scroll to first match
        const firstOverlay = overlayContainer.querySelector(`.${SEARCH_HIGHLIGHT_CLASS}`);
        if (firstOverlay) {
          firstOverlay.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        showHUD('No matches found.');
      }
    }
    
    // --- CLEARING LOGIC ---
    function clearHighlights() {
      return new Promise((resolve) => {
        const highlightCount = persistentHighlights.size;
        if (highlightCount === 0) {
          showHUD('No highlights to clear.');
          resolve();
          return;
        }

        // Clear overlay elements
        if (overlayContainer) {
          const highlightOverlays = overlayContainer.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
          highlightOverlays.forEach(overlay => overlay.remove());
        }

        // Clear from memory
        persistentHighlights.clear();
        
        chrome.storage.local.get(['notionHighlights'], (result) => {
          const allHighlights = result.notionHighlights || {};
          if (allHighlights[window.location.href]) {
            delete allHighlights[window.location.href];
            chrome.storage.local.set({ notionHighlights: allHighlights }, () => {
              showHUD(`Cleared ${highlightCount} highlights.`);
              resolve();
            });
          } else {
            showHUD(`Cleared ${highlightCount} highlights.`);
            resolve();
          }
        });
      });
    }
  
    function clearSearchHighlights() {
      // Clear overlay elements
      if (overlayContainer) {
        const searchOverlays = overlayContainer.querySelectorAll(`.${SEARCH_HIGHLIGHT_CLASS}`);
        searchOverlays.forEach(overlay => overlay.remove());
      }

      // Clear from memory
      searchHighlights.clear();
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
    
    // This is the key persistence function, now uses overlay system
    let isReapplying = false;
    async function reapplyHighlights() {
      if (isReapplying) {
        console.warn('Reapply already in progress, skipping...');
        return;
      }
      isReapplying = true;

      try {
        const { notionHighlights = {} } = await chrome.storage.local.get('notionHighlights');
        const pageHighlights = notionHighlights[window.location.href] || [];

        if (pageHighlights.length === 0) return;

        // Ensure overlay container exists
        if (!overlayContainer) {
          console.warn('Overlay container not found during reapply, creating...');
          createOverlayContainer();
        }

        // Clear existing overlays for persistent highlights
        if (overlayContainer) {
          const existingOverlays = overlayContainer.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
          existingOverlays.forEach(overlay => overlay.remove());
        }
        persistentHighlights.clear();

        pageHighlights.forEach(h => {
          // Add to persistent highlights map
          persistentHighlights.set(h.highlightId, h);

          // Find the text and create overlays
          const textElement = findTextInDOM(h.text, h.blockId);
          if (textElement && overlayContainer) {
            try {
              const rects = getTextBoundingRects(textElement, h.text);
              rects.forEach((rect, index) => {
                const overlay = createHighlightOverlay(rect, `${h.highlightId}-${index}`, false);
                overlayContainer.appendChild(overlay);
              });
            } catch (error) {
              console.warn('Error applying highlight:', h.highlightId, error);
            }
          }
        });
      } catch (error) {
        console.error('Error in reapplyHighlights:', error);
      } finally {
        isReapplying = false;
      }
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