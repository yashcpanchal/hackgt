import {
  HighlightData,
  HighlightMatch,
  NodeRange,
  ExtensionMessage,
  MessageResponse,
  ChromeStorageData,
  CONSTANTS,
  COLORS
} from './types';

/**
 * Notion Highlighter Extension - Content Script
 * Provides persistent text highlighting with floating overlay system
 */
class NotionHighlighter {
  // State management
  private isProcessing = false;
  private isInitialized = false;
  private lastUrl = window.location.href;
  private persistentHighlights = new Map<string, HighlightData>();
  private searchHighlights = new Map<string, HighlightData>();
  private overlayContainer: HTMLElement | null = null;
  private mutationObserver: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private debounceTimer: number | null = null;
  private isScrolling = false;
  private scrollEndTimer: number | null = null;
  private isReapplying = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize the extension
   */
  private init(): void {
    if (this.isInitialized || !window.location.hostname.endsWith('notion.so')) {
      return;
    }

    this.isInitialized = true;
    console.log('🚀 Notion Highlighter Initialized');

    // Create overlay container
    this.createOverlayContainer();

    // Initial load of highlights
    setTimeout(() => this.loadHighlights(), 500);

    // Add all event listeners
    this.addEventListeners();

    // Set up observers
    this.setupMutationObserver();
    this.setupResizeObserver();
    this.setupPeriodicValidation();
  }

  /**
   * Set up event listeners
   */
  private addEventListeners(): void {
    // Chrome extension messages
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);

    // Double-click highlighting
    document.addEventListener('dblclick', this.handleDoubleClick.bind(this), true);

    // Scroll handling with state tracking
    this.setupScrollHandler();

    // Mouse event protection
    this.setupMouseEventProtection();
  }

  /**
   * Set up scroll event handling
   */
  private setupScrollHandler(): void {
    let isScrollUpdating = false;

    document.addEventListener('scroll', () => {
      this.isScrolling = true;
      if (this.scrollEndTimer) clearTimeout(this.scrollEndTimer);

      if (isScrollUpdating) return;
      isScrollUpdating = true;

      requestAnimationFrame(() => {
        this.updateOverlayPositions();
        isScrollUpdating = false;
      });

      // Mark scrolling as ended and ensure highlights are refreshed
      this.scrollEndTimer = setTimeout(() => {
        this.isScrolling = false;
        requestAnimationFrame(() => {
          this.updateOverlayPositions();
        });
      }, 150);
    }, true);
  }

  /**
   * Set up mouse event protection during scrolling
   */
  private setupMouseEventProtection(): void {
    const mouseEvents = ['mouseenter', 'mouseleave', 'mouseover', 'mouseout'];

    mouseEvents.forEach(eventType => {
      document.addEventListener(eventType, (e: Event) => {
        // During scrolling, be extra protective
        if (this.isScrolling) {
          e.stopPropagation();
          if (eventType === 'mouseenter' || eventType === 'mouseleave') {
            e.preventDefault();
          }
          return;
        }

        // Protect overlay container
        const target = e.target as Element;
        if (target?.closest && target.closest(`#${CONSTANTS.OVERLAY_CONTAINER_ID}`)) {
          e.stopPropagation();
        }
      }, true);
    });
  }

  /**
   * Create the overlay container for highlights
   */
  private createOverlayContainer(): void {
    if (this.overlayContainer) return;

    // Check if container exists in DOM
    const existing = document.getElementById(CONSTANTS.OVERLAY_CONTAINER_ID);
    if (existing) {
      this.overlayContainer = existing;
      return;
    }

    try {
      this.overlayContainer = document.createElement('div');
      this.overlayContainer.id = CONSTANTS.OVERLAY_CONTAINER_ID;
      this.overlayContainer.style.cssText = `
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
        document.body.appendChild(this.overlayContainer);
        this.overlayContainer.setAttribute('data-extension', 'notion-highlighter');
        this.overlayContainer.setAttribute('data-protected', 'true');
        console.log('Overlay container created successfully');
      } else {
        console.error('Document body not available for overlay container');
        this.overlayContainer = null;
      }
    } catch (error) {
      console.error('Failed to create overlay container:', error);
      this.overlayContainer = null;
    }
  }

  /**
   * Create a highlight overlay element
   */
  private createHighlightOverlay(rect: DOMRect, highlightId: string, isSearch = false): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = isSearch ? CONSTANTS.SEARCH_HIGHLIGHT_CLASS : CONSTANTS.HIGHLIGHT_CLASS;
    overlay.setAttribute(CONSTANTS.HIGHLIGHT_ID_ATTR, highlightId);

    const colors = isSearch ? COLORS.SEARCH_HIGHLIGHT : COLORS.HIGHLIGHT;

    overlay.style.cssText = `
      position: absolute;
      left: ${rect.left + window.scrollX}px;
      top: ${rect.top + window.scrollY}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background-color: ${colors.BACKGROUND};
      border-bottom: 2px solid ${colors.BORDER};
      border-radius: 3px;
      pointer-events: none;
      z-index: 1;
    `;

    return overlay;
  }

  /**
   * Update positions of all overlay elements
   */
  private updateOverlayPositions(): void {
    if (!this.overlayContainer) {
      console.warn('Overlay container not found during position update, recreating...');
      this.createOverlayContainer();
      if (!this.overlayContainer) return;
    }

    // Check if overlay container is still in the DOM
    if (!document.body.contains(this.overlayContainer)) {
      console.warn('Overlay container was removed from DOM, recreating...');
      this.overlayContainer = null;
      this.createOverlayContainer();
      if (!this.overlayContainer) return;
    }

    // Ensure overlays stay non-interactive
    if (this.overlayContainer) {
      this.overlayContainer.style.pointerEvents = 'none';
    }

    try {
      // Update persistent highlights
      this.persistentHighlights.forEach((highlightData, highlightId) => {
        this.updateSingleHighlight(highlightId, highlightData, false);
      });

      // Update search highlights
      this.searchHighlights.forEach((highlightData, highlightId) => {
        this.updateSingleHighlight(highlightId, highlightData, true);
      });
    } catch (error) {
      console.error('Error updating overlay positions:', error);
    }
  }

  /**
   * Update a single highlight's position
   */
  private updateSingleHighlight(highlightId: string, highlightData: HighlightData, isSearch: boolean): void {
    if (!this.overlayContainer) return;

    // Remove all existing overlays for this highlight
    const existingOverlays = this.overlayContainer.querySelectorAll(`[${CONSTANTS.HIGHLIGHT_ID_ATTR}^="${highlightId}"]`);
    existingOverlays.forEach(overlay => overlay.remove());

    // Find the text in the current DOM
    const textElement = this.findTextInDOM(highlightData.text, highlightData.blockId);
    if (!textElement) return;

    try {
      const rects = this.getTextBoundingRects(textElement, highlightData.text);
      if (rects.length === 0) return;

      // Create new overlays for each rect
      rects.forEach((rect, index) => {
        const overlay = this.createHighlightOverlay(rect, `${highlightId}-${index}`, isSearch);
        this.overlayContainer!.appendChild(overlay);
      });
    } catch (error) {
      console.warn('Error updating highlight:', highlightId, error);
    }
  }

  /**
   * Find text node in DOM by block ID
   */
  private findTextInDOM(text: string, blockId: string): Text | null {
    const block = document.querySelector(`[data-block-id="${blockId}"]`);
    if (!block) return null;

    const walker = document.createTreeWalker(
      block,
      NodeFilter.SHOW_TEXT
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      if (node.nodeValue?.includes(text)) {
        return node;
      }
    }
    return null;
  }

  /**
   * Get bounding rectangles for text within a text node
   */
  private getTextBoundingRects(textNode: Text, text: string): DOMRect[] {
    const range = document.createRange();
    const nodeValue = textNode.nodeValue || '';
    const startIndex = nodeValue.indexOf(text);

    if (startIndex === -1) return [];

    range.setStart(textNode, startIndex);
    range.setEnd(textNode, startIndex + text.length);

    const rects = Array.from(range.getClientRects()) as DOMRect[];
    return rects.filter(rect => rect.width > 0 && rect.height > 0);
  }

  /**
   * Handle chrome extension messages
   */
  private handleMessage(
    request: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean {
    console.log('Message received:', request);

    switch (request.type) {
      case 'highlight-selection':
        this.highlightSelection();
        sendResponse({ status: 'highlighted' });
        break;
      case 'clear-highlights':
        this.clearHighlights();
        sendResponse({ status: 'cleared page' });
        break;
      case 'search-text':
        if (request.text) {
          this.searchAndHighlightText(request.text);
        }
        sendResponse({ status: 'search complete' });
        break;
      default:
        sendResponse({ status: 'unknown command' });
        break;
    }
    return true;
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const activeElement = document.activeElement as Element;
    if (!activeElement?.closest('[contenteditable="true"]')) return;

    if (e.altKey && !e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      this.highlightSelection();
    } else if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      this.clearHighlights();
    }
  }

  /**
   * Handle double-click events
   */
  private handleDoubleClick(event: MouseEvent): void {
    const target = event.target as Element;
    const contentEditable = target.closest('[contenteditable="true"]');
    if (!contentEditable) return;

    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim()) {
        this.highlightSelection();
      }
    }, 50);
  }

  /**
   * Highlight the current text selection
   */
  private highlightSelection(): void {
    if (this.isProcessing) return;
    if (!this.isInitialized) {
      this.showHUD('Extension still initializing...');
      return;
    }
    if (!this.overlayContainer) {
      this.showHUD('Overlay system not ready...');
      return;
    }

    this.isProcessing = true;

    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        this.showHUD('No text selected.');
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      if (!selectedText) {
        this.showHUD('Please select some text.');
        return;
      }

      const contentEditable = range.startContainer.parentElement?.closest('[contenteditable="true"]');
      if (!contentEditable) {
        this.showHUD('Cannot highlight here.');
        return;
      }

      const block = range.startContainer.parentElement?.closest('[data-block-id]');
      if (!block) {
        this.showHUD('Could not find Notion block.');
        return;
      }

      const blockId = block.getAttribute('data-block-id')!;
      const highlightId = `nh-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Get bounding rectangles for the selection
      const rects = Array.from(range.getClientRects()) as DOMRect[];
      const validRects = rects.filter(rect => rect.width > 0 && rect.height > 0);

      if (validRects.length === 0) {
        this.showHUD('Could not determine text position.');
        return;
      }

      // Store highlight data
      const highlightData: HighlightData = {
        text: selectedText,
        blockId: blockId,
        highlightId: highlightId,
      };

      // Add to persistent highlights
      this.persistentHighlights.set(highlightId, highlightData);

      // Create overlay elements
      validRects.forEach((rect, index) => {
        const overlay = this.createHighlightOverlay(rect, `${highlightId}-${index}`, false);
        this.overlayContainer!.appendChild(overlay);
      });

      // Save to storage
      this.saveHighlight(highlightData);

      selection.removeAllRanges();
      this.showHUD('Highlight added!');
    } catch (error) {
      console.error('Error highlighting selection:', error);
      this.showHUD('Error: Could not highlight.');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Search and highlight text across the page
   */
  private searchAndHighlightText(searchText: string): void {
    this.clearSearchHighlights();
    if (!searchText?.trim()) return;

    const content = document.querySelector(CONSTANTS.NOTION_CONTENT_SELECTOR);
    if (!content) {
      this.showHUD('Could not find Notion content area.');
      return;
    }

    let matchCount = 0;
    const blocks = content.querySelectorAll('[data-block-id]');

    blocks.forEach(block => {
      const blockId = block.getAttribute('data-block-id')!;
      const blockMatches = this.findTextAcrossNodes(block as HTMLElement, searchText);

      blockMatches.forEach(match => {
        const highlightId = `search-${Date.now()}-${matchCount}`;
        const highlightData: HighlightData = {
          text: match.text,
          blockId: blockId,
          highlightId: highlightId,
        };

        this.searchHighlights.set(highlightId, highlightData);

        if (!this.overlayContainer) {
          this.createOverlayContainer();
        }

        match.rects.forEach((rect, index) => {
          const overlay = this.createHighlightOverlay(rect, `${highlightId}-${index}`, true);
          if (this.overlayContainer) {
            this.overlayContainer.appendChild(overlay);
          }
        });

        matchCount++;
      });
    });

    if (matchCount > 0) {
      this.showHUD(`Found ${matchCount} matches.`);
      const firstOverlay = this.overlayContainer?.querySelector(`.${CONSTANTS.SEARCH_HIGHLIGHT_CLASS}`);
      if (firstOverlay) {
        firstOverlay.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      this.showHUD('No matches found.');
    }
  }

  /**
   * Find text across multiple nodes (handles bold/italic splits)
   */
  private findTextAcrossNodes(container: HTMLElement, searchText: string): HighlightMatch[] {
    const matches: HighlightMatch[] = [];
    const searchLower = searchText.toLowerCase();

    if (container.closest('button, a, [role="button"]')) {
      return matches;
    }

    // Get all text nodes
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT
    );

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      if (!node.parentElement?.closest('button, a, [role="button"]')) {
        textNodes.push(node);
      }
    }

    if (textNodes.length === 0) return matches;

    // Combine text content
    const fullText = textNodes.map(n => n.nodeValue || '').join('');
    const fullTextLower = fullText.toLowerCase();

    let searchIndex = 0;
    while ((searchIndex = fullTextLower.indexOf(searchLower, searchIndex)) !== -1) {
      const matchEnd = searchIndex + searchText.length;
      const nodeRanges: NodeRange[] = [];
      let currentPos = 0;

      // Map match to nodes
      for (let i = 0; i < textNodes.length; i++) {
        const nodeLength = textNodes[i].nodeValue?.length || 0;
        const nodeStart = currentPos;
        const nodeEnd = currentPos + nodeLength;

        if (nodeStart < matchEnd && nodeEnd > searchIndex) {
          const startInNode = Math.max(0, searchIndex - nodeStart);
          const endInNode = Math.min(nodeLength, matchEnd - nodeStart);

          nodeRanges.push({
            node: textNodes[i],
            start: startInNode,
            end: endInNode
          });
        }

        currentPos = nodeEnd;
      }

      // Create ranges and collect rectangles
      const rects: DOMRect[] = [];
      nodeRanges.forEach(nodeRange => {
        try {
          const range = document.createRange();
          range.setStart(nodeRange.node, nodeRange.start);
          range.setEnd(nodeRange.node, nodeRange.end);

          const nodeRects = Array.from(range.getClientRects()) as DOMRect[];
          rects.push(...nodeRects.filter(rect => rect.width > 0 && rect.height > 0));
        } catch (error) {
          console.warn('Error creating range for search match:', error);
        }
      });

      if (rects.length > 0) {
        matches.push({
          text: fullText.substring(searchIndex, matchEnd),
          rects: rects
        });
      }

      searchIndex += searchText.length;
    }

    return matches;
  }

  /**
   * Clear all persistent highlights
   */
  private async clearHighlights(): Promise<void> {
    const highlightCount = this.persistentHighlights.size;
    if (highlightCount === 0) {
      this.showHUD('No highlights to clear.');
      return;
    }

    // Clear overlay elements
    if (this.overlayContainer) {
      const highlightOverlays = this.overlayContainer.querySelectorAll(`.${CONSTANTS.HIGHLIGHT_CLASS}`);
      highlightOverlays.forEach(overlay => overlay.remove());
    }

    this.persistentHighlights.clear();

    // Clear from storage
    const result = await chrome.storage.local.get(['notionHighlights']);
    const allHighlights = result.notionHighlights || {};
    if (allHighlights[window.location.href]) {
      delete allHighlights[window.location.href];
      await chrome.storage.local.set({ notionHighlights: allHighlights });
    }

    this.showHUD(`Cleared ${highlightCount} highlights.`);
  }

  /**
   * Clear search highlights
   */
  private clearSearchHighlights(): void {
    if (this.overlayContainer) {
      const searchOverlays = this.overlayContainer.querySelectorAll(`.${CONSTANTS.SEARCH_HIGHLIGHT_CLASS}`);
      searchOverlays.forEach(overlay => overlay.remove());
    }

    this.searchHighlights.clear();
  }

  /**
   * Save highlight to storage
   */
  private async saveHighlight(highlightData: HighlightData): Promise<void> {
    const { notionHighlights = {} } = await chrome.storage.local.get('notionHighlights') as ChromeStorageData;
    const pageUrl = window.location.href;
    const pageHighlights = notionHighlights[pageUrl] || [];
    pageHighlights.push(highlightData);
    notionHighlights[pageUrl] = pageHighlights;
    await chrome.storage.local.set({ notionHighlights });
  }

  /**
   * Load highlights for current page
   */
  private loadHighlights(): void {
    this.reapplyHighlights();
  }

  /**
   * Reapply highlights from storage
   */
  private async reapplyHighlights(): Promise<void> {
    if (this.isReapplying) {
      console.warn('Reapply already in progress, skipping...');
      return;
    }

    this.isReapplying = true;

    try {
      const { notionHighlights = {} } = await chrome.storage.local.get('notionHighlights') as ChromeStorageData;
      const pageHighlights = notionHighlights[window.location.href] || [];

      if (pageHighlights.length === 0) return;

      if (!this.overlayContainer) {
        this.createOverlayContainer();
      }

      // Clear existing overlays
      if (this.overlayContainer) {
        const existingOverlays = this.overlayContainer.querySelectorAll(`.${CONSTANTS.HIGHLIGHT_CLASS}`);
        existingOverlays.forEach(overlay => overlay.remove());
      }
      this.persistentHighlights.clear();

      pageHighlights.forEach(h => {
        this.persistentHighlights.set(h.highlightId, h);

        const textElement = this.findTextInDOM(h.text, h.blockId);
        if (textElement && this.overlayContainer) {
          try {
            const rects = this.getTextBoundingRects(textElement, h.text);
            rects.forEach((rect, index) => {
              const overlay = this.createHighlightOverlay(rect, `${h.highlightId}-${index}`, false);
              this.overlayContainer!.appendChild(overlay);
            });
          } catch (error) {
            console.warn('Error applying highlight:', h.highlightId, error);
          }
        }
      });
    } catch (error) {
      console.error('Error in reapplyHighlights:', error);
    } finally {
      this.isReapplying = false;
    }
  }

  /**
   * Set up mutation observer
   */
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
      if (this.isScrolling) return;

      const isOurMutation = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
          const element = node as Element;
          return element.id === CONSTANTS.OVERLAY_CONTAINER_ID ||
                 (element.parentElement?.id === CONSTANTS.OVERLAY_CONTAINER_ID) ||
                 (element.className && typeof element.className === 'string' &&
                  (element.className.includes('notion-highlight-overlay') ||
                   element.className.includes('search-highlight-overlay')));
        });
      });

      if (isOurMutation) return;

      const hasSignificantChanges = mutations.some(mutation => {
        if (mutation.type === 'attributes') {
          const ignoredAttributes = ['style', 'class', 'data-selected', 'data-focused', 'aria-selected'];
          return !ignoredAttributes.includes(mutation.attributeName || '');
        }

        return mutation.type === 'childList' &&
               (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) &&
               Array.from(mutation.addedNodes).some(node => {
                 const element = node as Element;
                 return element.nodeType === Node.ELEMENT_NODE &&
                        (element.classList?.contains('notion-page-content') ||
                         element.querySelector?.('[data-block-id]')) &&
                        !element.classList?.contains('notion-cursor') &&
                        !element.classList?.contains('notion-hover');
               });
      });

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        if (window.location.href !== this.lastUrl) {
          this.lastUrl = window.location.href;
          console.log('URL changed, reloading highlights.');
          this.loadHighlights();
        } else if (hasSignificantChanges) {
          console.log('Significant content changes detected, updating highlights...');
          this.updateOverlayPositions();
        }
      }, 500);
    });

    const contentArea = document.querySelector(CONSTANTS.NOTION_CONTENT_SELECTOR) || document.body;
    this.mutationObserver.observe(contentArea, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-block-id', 'contenteditable'],
      characterData: false
    });
  }

  /**
   * Set up resize observer
   */
  private setupResizeObserver(): void {
    if (!window.ResizeObserver) return;

    let isResizeUpdating = false;
    this.resizeObserver = new ResizeObserver(() => {
      if (isResizeUpdating) return;
      isResizeUpdating = true;
      requestAnimationFrame(() => {
        this.updateOverlayPositions();
        isResizeUpdating = false;
      });
    });

    this.resizeObserver.observe(document.body);
  }

  /**
   * Set up periodic validation to ensure highlights persist
   */
  private setupPeriodicValidation(): void {
    setInterval(() => {
      if (!this.overlayContainer || this.persistentHighlights.size === 0) return;

      const visibleOverlays = this.overlayContainer.querySelectorAll(`.${CONSTANTS.HIGHLIGHT_CLASS}`);

      if (this.persistentHighlights.size > 0 && visibleOverlays.length === 0) {
        console.log('Highlights lost, restoring...');
        this.updateOverlayPositions();
      }
    }, 3000);
  }

  /**
   * Show HUD notification
   */
  private showHUD(message: string, duration = 3000): void {
    let hud = document.getElementById('notion-highlighter-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'notion-highlighter-hud';
      document.body.appendChild(hud);
    }
    hud.textContent = message;
    hud.classList.add('visible');

    const existingTimer = (hud as any).timeoutId;
    if (existingTimer) clearTimeout(existingTimer);

    (hud as any).timeoutId = setTimeout(() => {
      hud!.classList.remove('visible');
    }, duration);
  }
}

// Initialize the extension when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new NotionHighlighter());
} else {
  new NotionHighlighter();
}