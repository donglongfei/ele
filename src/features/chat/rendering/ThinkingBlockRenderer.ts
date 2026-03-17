import { collapseElement, setupCollapsible } from './collapsible';

export type RenderContentFn = (el: HTMLElement, markdown: string) => Promise<void>;

export interface ThinkingBlockState {
  wrapperEl: HTMLElement;
  contentEl: HTMLElement;
  labelEl: HTMLElement;
  content: string;
  startTime: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  isExpanded: boolean;
}

export function createThinkingBlock(
  parentEl: HTMLElement,
  renderContent: RenderContentFn
): ThinkingBlockState {
  const wrapperEl = parentEl.createDiv({ cls: 'claudian-thinking-block' });

  // Header (clickable to expand/collapse)
  const header = wrapperEl.createDiv({ cls: 'claudian-thinking-header' });
  header.setAttribute('tabindex', '0');
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-label', '思考过程 - 点击展开');

  // Collapse/expand arrow icon - starts pointing right (collapsed)
  const arrowEl = header.createSpan({ cls: 'claudian-thinking-arrow' });
  arrowEl.innerHTML = '▶'; // Right arrow (collapsed state)

  // Label with timer - show <思考中> with elapsed time
  const labelEl = header.createSpan({ cls: 'claudian-thinking-label' });
  const startTime = Date.now();
  labelEl.setText('思考中 0s...');

  // Start timer interval to update label every second
  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    labelEl.setText(`思考中 ${elapsed}s...`);
  }, 1000);

  // Collapsible content (collapsed by default)
  const contentEl = wrapperEl.createDiv({ cls: 'claudian-thinking-content' });

  // Create state object first so toggle can reference it
  const state: ThinkingBlockState = {
    wrapperEl,
    contentEl,
    labelEl,
    content: '',
    startTime,
    timerInterval,
    isExpanded: false,
  };

  // Setup collapsible behavior (handles click, keyboard, ARIA, CSS)
  setupCollapsible(wrapperEl, header, contentEl, state);

  return state;
}

export async function appendThinkingContent(
  state: ThinkingBlockState,
  content: string,
  renderContent: RenderContentFn
) {
  state.content += content;
  await renderContent(state.contentEl, state.content);
}

export function finalizeThinkingBlock(state: ThinkingBlockState): number {
  // Stop the timer
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  // Calculate final duration
  const durationSeconds = Math.floor((Date.now() - state.startTime) / 1000);

  // Update label to show <思考过程> with duration
  state.labelEl.setText(`思考过程 ${durationSeconds}s`);

  // Collapse when done and sync state
  const header = state.wrapperEl.querySelector('.claudian-thinking-header');
  if (header) {
    collapseElement(state.wrapperEl, header as HTMLElement, state.contentEl, state);
  }

  return durationSeconds;
}

export function cleanupThinkingBlock(state: ThinkingBlockState | null) {
  if (state?.timerInterval) {
    clearInterval(state.timerInterval);
  }
}

export function renderStoredThinkingBlock(
  parentEl: HTMLElement,
  content: string,
  durationSeconds: number | undefined,
  renderContent: RenderContentFn
): HTMLElement {
  const wrapperEl = parentEl.createDiv({ cls: 'claudian-thinking-block' });

  // Header (clickable to expand/collapse)
  const header = wrapperEl.createDiv({ cls: 'claudian-thinking-header' });
  header.setAttribute('tabindex', '0');
  header.setAttribute('role', 'button');
  header.setAttribute('aria-label', '思考过程 - 点击展开');

  // Collapse/expand arrow icon - starts pointing right (collapsed)
  const arrowEl = header.createSpan({ cls: 'claudian-thinking-arrow' });
  arrowEl.innerHTML = '▶'; // Right arrow (collapsed state)

  // Label with duration - show <思考过程>
  const labelEl = header.createSpan({ cls: 'claudian-thinking-label' });
  const labelText = durationSeconds !== undefined ? `思考过程 ${durationSeconds}s` : '思考过程';
  labelEl.setText(labelText);

  // Collapsible content with gray styling
  const contentEl = wrapperEl.createDiv({ cls: 'claudian-thinking-content claudian-thinking-content-gray' });
  renderContent(contentEl, content);

  // Setup collapsible behavior (handles click, keyboard, ARIA, CSS)
  const state = { isExpanded: false };
  setupCollapsible(wrapperEl, header, contentEl, state);

  return wrapperEl;
}
