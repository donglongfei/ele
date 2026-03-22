import type { TabBarItem, TabId } from './types';

/** Callbacks for TabBar interactions. */
export interface TabBarCallbacks {
  /** Called when a tab badge is clicked. */
  onTabClick: (tabId: TabId) => void;

  /** Called when the close button is clicked on a tab. */
  onTabClose: (tabId: TabId) => void;

  /** Called when the new tab button is clicked. */
  onNewTab: () => void;
}

/**
 * TabBar renders minimal numbered badge navigation.
 */
export class TabBar {
  private containerEl: HTMLElement;
  private callbacks: TabBarCallbacks;

  constructor(containerEl: HTMLElement, callbacks: TabBarCallbacks) {
    this.containerEl = containerEl;
    this.callbacks = callbacks;
    this.build();
  }

  /** Builds the tab bar UI. */
  private build(): void {
    this.containerEl.addClass('ele-tab-badges');
  }

  /**
   * Updates the tab bar with new tab data.
   * @param items Tab items to render.
   */
  update(items: TabBarItem[]): void {
    // Clear existing badges
    this.containerEl.empty();

    // Render badges
    for (const item of items) {
      this.renderBadge(item);
    }
  }

  /** Renders a single tab badge. */
  private renderBadge(item: TabBarItem): void {
    // Determine state class (priority: active > attention > streaming > idle)
    let stateClass = 'ele-tab-badge-idle';
    if (item.isActive) {
      stateClass = 'ele-tab-badge-active';
    } else if (item.needsAttention) {
      stateClass = 'ele-tab-badge-attention';
    } else if (item.isStreaming) {
      stateClass = 'ele-tab-badge-streaming';
    }

    // Check if this is the cron tab
    const isCronTab = item.title === '🤖 Cron' || item.id.startsWith('cron-');
    const displayText = isCronTab ? '🤖' : String(item.index);
    const tooltipTitle = isCronTab ? '🤖 Cron Jobs' : item.title;

    const badgeEl = this.containerEl.createDiv({
      cls: `ele-tab-badge ${stateClass}`,
      text: displayText,
    });

    // Add special class for cron tab
    if (isCronTab) {
      badgeEl.addClass('ele-tab-badge-cron');
    }

    // Tooltip with full title
    badgeEl.setAttribute('aria-label', tooltipTitle);
    badgeEl.setAttribute('title', tooltipTitle);

    // Click handler to switch tab
    badgeEl.addEventListener('click', () => {
      this.callbacks.onTabClick(item.id);
    });

    // Right-click to close (if allowed)
    if (item.canClose) {
      badgeEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.callbacks.onTabClose(item.id);
      });
    }
  }

  /** Destroys the tab bar. */
  destroy(): void {
    this.containerEl.empty();
    this.containerEl.removeClass('ele-tab-badges');
  }
}
