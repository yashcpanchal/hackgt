// Type definitions for Notion Highlighter Extension

export interface HighlightData {
  text: string;
  blockId: string;
  highlightId: string;
}

export interface HighlightMatch {
  text: string;
  rects: DOMRect[];
}

export interface NodeRange {
  node: Text;
  start: number;
  end: number;
}

export interface ExtensionMessage {
  type: 'highlight-selection' | 'clear-highlights' | 'search-text';
  text?: string;
}

export interface MessageResponse {
  status: string;
}

export interface NotionHighlights {
  [pageUrl: string]: HighlightData[];
}

export interface ChromeStorageData {
  notionHighlights?: NotionHighlights;
}

// Constants
export const CONSTANTS = {
  HIGHLIGHT_CLASS: 'notion-highlight-overlay',
  SEARCH_HIGHLIGHT_CLASS: 'search-highlight-overlay',
  HIGHLIGHT_ID_ATTR: 'data-highlight-id',
  NOTION_CONTENT_SELECTOR: '.notion-page-content',
  OVERLAY_CONTAINER_ID: 'notion-highlighter-overlays'
} as const;

// CSS Colors
export const COLORS = {
  HIGHLIGHT: {
    BACKGROUND: 'rgba(255, 240, 138, 0.5)',
    BORDER: 'rgba(255, 201, 25, 0.6)'
  },
  SEARCH_HIGHLIGHT: {
    BACKGROUND: 'rgba(255, 240, 138, 0.6)',
    BORDER: 'rgba(255, 201, 25, 0.8)'
  }
} as const;

// Utility types
export type HighlightType = 'persistent' | 'search';
export type EventListenerCallback = (event: Event) => void;