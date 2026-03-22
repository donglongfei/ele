export function updateContextRowHasContent(contextRowEl: HTMLElement): void {
  const editorIndicator = contextRowEl.querySelector('.ele-selection-indicator') as HTMLElement | null;
  const browserIndicator = contextRowEl.querySelector('.ele-browser-selection-indicator') as HTMLElement | null;
  const canvasIndicator = contextRowEl.querySelector('.ele-canvas-indicator') as HTMLElement | null;
  const fileIndicator = contextRowEl.querySelector('.ele-file-indicator') as HTMLElement | null;
  const imagePreview = contextRowEl.querySelector('.ele-image-preview') as HTMLElement | null;

  const hasEditorSelection = editorIndicator?.style.display === 'block';
  const hasBrowserSelection = browserIndicator !== null && browserIndicator.style.display === 'block';
  const hasCanvasSelection = canvasIndicator?.style.display === 'block';
  const hasFileChips = fileIndicator?.style.display === 'flex';
  const hasImageChips = imagePreview?.style.display === 'flex';

  contextRowEl.classList.toggle(
    'has-content',
    hasEditorSelection || hasBrowserSelection || hasCanvasSelection || hasFileChips || hasImageChips
  );
}
