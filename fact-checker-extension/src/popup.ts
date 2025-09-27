import { ExtensionMessage } from './types';

/**
 * Popup script for Notion Highlighter Extension
 * Handles UI interactions in the extension popup
 */
class PopupController {
  private clearPageBtn!: HTMLButtonElement;
  private clearAllBtn!: HTMLButtonElement;
  private searchBtn!: HTMLButtonElement;
  private searchInput!: HTMLInputElement;

  constructor() {
    this.initializeElements();
    this.setupEventListeners();
  }

  /**
   * Initialize DOM elements
   */
  private initializeElements(): void {
    this.clearPageBtn = this.getElement('clearPage') as HTMLButtonElement;
    this.clearAllBtn = this.getElement('clearAll') as HTMLButtonElement;
    this.searchBtn = this.getElement('searchBtn') as HTMLButtonElement;
    this.searchInput = this.getElement('searchText') as HTMLInputElement;
  }

  /**
   * Get element by ID with error handling
   */
  private getElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id '${id}' not found`);
    }
    return element;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    this.clearPageBtn.addEventListener('click', () => {
      this.sendMessageToActiveTab({ type: 'clear-highlights' });
    });

    this.clearAllBtn.addEventListener('click', () => {
      this.handleClearAll();
    });

    this.searchBtn.addEventListener('click', () => {
      this.handleSearch();
    });

    this.searchInput.addEventListener('keypress', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        this.handleSearch();
      }
    });
  }

  /**
   * Send message to the active tab's content script
   */
  private async sendMessageToActiveTab(message: ExtensionMessage): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url?.includes('notion.so')) {
        this.showError('This extension only works on notion.so pages.');
        return;
      }

      if (!tab.id) {
        this.showError('Unable to identify active tab.');
        return;
      }

      await chrome.tabs.sendMessage(tab.id, message);
      window.close();
    } catch (error) {
      console.error(`Error sending message: ${message.type}`, error);
      this.showError('Could not connect to the Notion page. Please refresh the page and try again.');
    }
  }

  /**
   * Handle clear all button click
   */
  private handleClearAll(): void {
    const confirmed = confirm(
      'Are you sure you want to clear ALL highlights across ALL pages? This cannot be undone.'
    );

    if (!confirmed) return;

    // Clear all highlights from storage
    chrome.storage.local.set({ notionHighlights: {} }, () => {
      // Notify all open Notion tabs to clear their highlights
      chrome.tabs.query({ url: '*://*.notion.so/*' }, (tabs) => {
        const clearPromises = tabs.map(tab => {
          if (tab.id) {
            return chrome.tabs.sendMessage(tab.id, { type: 'clear-highlights' })
              .catch(err => console.log('Could not message tab, it might be inactive:', tab.url, err));
          }
          return Promise.resolve();
        });

        Promise.allSettled(clearPromises).then(() => {
          window.close();
        });
      });
    });
  }

  /**
   * Handle search functionality
   */
  private handleSearch(): void {
    const searchText = this.searchInput.value.trim();
    if (!searchText) {
      this.showError('Please enter text to search for.');
      return;
    }

    this.sendMessageToActiveTab({
      type: 'search-text',
      text: searchText
    });
  }

  /**
   * Show error message to user
   */
  private showError(message: string): void {
    alert(message);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});