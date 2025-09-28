// content.js - Notion Highlighter Extension (REVISED & FIXED)

(function () {
  'use strict';

  // --- CONSTANTS ---
  const HIGHLIGHT_CLASS = 'notion-fact-check-highlight';
  const HIGHLIGHT_ID_ATTR = 'data-highlight-id';
  const HIGHLIGHT_TEXT_ATTR = 'data-highlight-text';
  const OVERLAY_CONTAINER_ID = 'notion-highlighter-overlays';
  const RADIAL_MENU_ID = 'cedar-radial-menu-container';

  // --- STATE ---
  let isInitialized = false;
  let overlayContainer = null;
  let radialMenu = null;
  let hideMenuTimer = null;
  let scrollDebounceTimer = null;

  // --- CORE INITIALIZATION ---
  function init() {
      if (isInitialized) return;
      isInitialized = true;
      console.log('🚀 Notion Fact-Checker Initialized (v2)');

      createOverlayContainer();
      addEventListeners();

      // Initial load needs a slight delay for Notion's UI to settle.
      setTimeout(reapplyHighlights, 500);
  }

  // --- EVENT LISTENERS ---
  function addEventListeners() {
      // Listens for messages from background script/popup
      chrome.runtime.onMessage.addListener(handleMessage);
      
      // Handles keyboard/mouse shortcuts
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('dblclick', handleDoubleClick, true);

      // Use event delegation on the overlay container for better performance
      if (overlayContainer) {
          overlayContainer.addEventListener('mouseover', handleHighlightHover);
          overlayContainer.addEventListener('mouseleave', handleHighlightLeave, true);
      }

      // Add debounced listeners for scroll and resize to reposition highlights
      window.addEventListener('scroll', () => {
          clearTimeout(scrollDebounceTimer);
          scrollDebounceTimer = setTimeout(reapplyHighlights, 150);
      });
      window.addEventListener('resize', () => {
          clearTimeout(scrollDebounceTimer);
          scrollDebounceTimer = setTimeout(reapplyHighlights, 150);
      });
  }

  // --- HIGHLIGHT & OVERLAY LOGIC (FIXED) ---

  function createOverlayContainer() {
      if (document.getElementById(OVERLAY_CONTAINER_ID)) return;
      
      overlayContainer = document.createElement('div');
      overlayContainer.id = OVERLAY_CONTAINER_ID;
      // CRITICAL FIX: Use position: absolute to scroll with the document.
      // It acts as a transparent layer over the entire page content.
      overlayContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${document.body.scrollWidth}px; /* Cover entire scrollable width */
        height: ${document.body.scrollHeight}px; /* Cover entire scrollable height */
        pointer-events: none; /* Ignore clicks on the container itself */
        z-index: 999;
      `;
      document.body.appendChild(overlayContainer);
  }

  function createHighlightOverlay(rect, highlightId, text) {
      const overlay = document.createElement('div');
      overlay.className = HIGHLIGHT_CLASS;
      overlay.setAttribute(HIGHLIGHT_ID_ATTR, highlightId);
      overlay.setAttribute(HIGHLIGHT_TEXT_ATTR, text);

      // CRITICAL FIX: Calculate 'top' and 'left' including scroll offset.
      // This ensures highlights are placed correctly relative to the document, not the window.
      overlay.style.cssText = `
          position: absolute;
          left: ${rect.left + window.scrollX}px;
          top: ${rect.top + window.scrollY}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          pointer-events: auto; /* Allow this element to be hovered */
      `;
      return overlay;
  }

  // This is the master function to draw/redraw all saved highlights
  async function reapplyHighlights() {
      if (!overlayContainer) createOverlayContainer();
      
      // Adjust overlay container size to match any changes in document size
      overlayContainer.style.width = `${document.body.scrollWidth}px`;
      overlayContainer.style.height = `${document.body.scrollHeight}px`;
      
      const { notionHighlights = {} } = await chrome.storage.local.get('notionHighlights');
      const pageUrl = window.location.href.split('#')[0]; // Ignore hash for URL matching
      const pageHighlights = notionHighlights[pageUrl] || [];
      
      // Clear existing highlights before redrawing
      overlayContainer.innerHTML = '';

      // Find each piece of text and draw a new highlight overlay for it
      pageHighlights.forEach(h => {
          const textElement = findTextInDOM(h.text, h.blockId);
          if (textElement) {
              const rects = getTextBoundingRects(textElement, h.text);
              rects.forEach((rect, index) => {
                  const overlay = createHighlightOverlay(rect, `${h.highlightId}-${index}`, h.text);
                  overlayContainer.appendChild(overlay);
              });
          }
      });
  }
  
  // --- RADIAL MENU LOGIC (FIXED) ---

  function showRadialMenu(event) {
      // Remove any existing menu first
      hideRadialMenu();
      clearTimeout(hideMenuTimer); // Cancel any pending hide actions

      const highlightText = event.target.getAttribute(HIGHLIGHT_TEXT_ATTR);
      if (!highlightText) return;

      // Create the menu container
      radialMenu = document.createElement('div');
      radialMenu.id = RADIAL_MENU_ID;
      radialMenu.style.left = `${event.clientX}px`;
      radialMenu.style.top = `${event.clientY}px`;
      
      // Define menu items
      const items = [
          { label: 'Fact Check (Wikipedia)', action: () => console.log(`WIKIPEDIA CHECK on: "${highlightText}"`) },
          { label: 'Fact Check (Textbook)', action: () => console.log(`TEXTBOOK CHECK on: "${highlightText}"`) },
      ];
      
      // Create and append button for each item
      items.forEach(item => {
          const button = document.createElement('div');
          button.className = 'radial-menu-item';
          button.textContent = item.label;
          button.onclick = (e) => {
              e.stopPropagation(); // Prevent click from bubbling up
              item.action();
              hideRadialMenu();
          };
          radialMenu.appendChild(button);
      });

      document.body.appendChild(radialMenu);
      
      // Add a listener to hide the menu if user clicks away
      setTimeout(() => document.addEventListener('click', hideRadialMenu, { once: true }), 100);
  }

  function hideRadialMenu() {
      const existingMenu = document.getElementById(RADIAL_MENU_ID);
      if (existingMenu) {
          existingMenu.remove();
      }
      radialMenu = null;
  }
  
  function handleHighlightHover(event) {
      if (event.target.classList.contains(HIGHLIGHT_CLASS)) {
          showRadialMenu(event);
      }
  }

  function handleHighlightLeave() {
      // Hide the menu with a delay to allow moving mouse onto the menu itself
      hideMenuTimer = setTimeout(hideRadialMenu, 300);
  }
  
  // --- USER ACTIONS & DATA ---
  // (These functions are largely unchanged but adapted for the new structure)

  function highlightSelection() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      
      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      if (!selectedText) return;

      const block = range.startContainer.parentElement?.closest('[data-block-id]');
      if (!block) {
          showHUD('Highlight must be within a Notion block.');
          return;
      }
      
      const highlightData = {
          text: selectedText,
          blockId: block.getAttribute('data-block-id'),
          highlightId: `nh-${Date.now()}`,
          url: window.location.href.split('#')[0] // Store URL without hash
      };

      saveHighlight(highlightData).then(() => {
          reapplyHighlights(); // Redraw all highlights including the new one
          selection.removeAllRanges();
          showHUD('Highlight added!');
      });
  }

  async function saveHighlight(highlightData) {
      const { notionHighlights = {} } = await chrome.storage.local.get('notionHighlights');
      const pageUrl = highlightData.url;
      const pageHighlights = notionHighlights[pageUrl] || [];
      pageHighlights.push(highlightData);
      notionHighlights[pageUrl] = pageHighlights;
      await chrome.storage.local.set({ notionHighlights });
  }

  function clearHighlights() {
      chrome.storage.local.get(['notionHighlights'], (result) => {
          const allHighlights = result.notionHighlights || {};
          const pageUrl = window.location.href.split('#')[0];
          if (allHighlights[pageUrl]) {
              delete allHighlights[pageUrl];
              chrome.storage.local.set({ notionHighlights: allHighlights }, () => {
                  reapplyHighlights(); // Redraw, which will now show nothing
                  showHUD('Cleared highlights for this page.');
              });
          }
      });
  }

  function handleMessage(request) {
      if (request.type === 'highlight-selection') {
          highlightSelection();
      } else if (request.type === 'clear-highlights') {
          clearHighlights();
      }
  }

  // --- HELPER FUNCTIONS ---
  // (Unchanged from your original logic)
  
  function findTextInDOM(text, blockId) {
      const block = document.querySelector(`[data-block-id="${blockId}"]`);
      if (!block) return null;
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
          if (node.nodeValue.includes(text)) return node;
      }
      return null;
  }

  function getTextBoundingRects(textNode, text) {
      const range = document.createRange();
      const startIndex = textNode.nodeValue.indexOf(text);
      if (startIndex === -1) return [];
      range.setStart(textNode, startIndex);
      range.setEnd(textNode, startIndex + text.length);
      return Array.from(range.getClientRects());
  }
  
  function handleKeyDown(e) {
      if (e.altKey && !e.shiftKey && e.key.toLowerCase() === 'h') {
          e.preventDefault();
          highlightSelection();
      } else if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          clearHighlights();
      }
  }
  
  function handleDoubleClick() {
      // Small delay to allow browser to complete the double-click selection
      setTimeout(highlightSelection, 50);
  }
  
  function showHUD(message, duration = 2000) {
      let hud = document.getElementById('notion-highlighter-hud');
      if (!hud) {
          hud = document.createElement('div');
          hud.id = 'notion-highlighter-hud';
          document.body.appendChild(hud);
      }
      hud.textContent = message;
      hud.classList.add('visible');
      setTimeout(() => hud.classList.remove('visible'), duration);
  }

  // --- START THE EXTENSION ---
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      init();
  }
})();

