import { useRef, useCallback } from 'react';
import { EditorView } from '@codemirror/view';

/**
 * Hook for proportional scroll sync between editor and preview.
 * Captures scroll % from the editor and applies it to the preview on tab switch.
 */
export function useScrollSync() {
  const scrollPercent = useRef(0);

  /** Call this to capture the current scroll position from a CodeMirror EditorView */
  const captureEditorScroll = useCallback((view: EditorView | null) => {
    if (!view) return;
    const dom = view.scrollDOM;
    const maxScroll = dom.scrollHeight - dom.clientHeight;
    scrollPercent.current = maxScroll > 0 ? dom.scrollTop / maxScroll : 0;
  }, []);

  /** Call this after the preview mounts/switches to scroll it to the captured position */
  const applyScrollToPreview = useCallback((container: HTMLElement | null) => {
    if (!container) return;
    // Use requestAnimationFrame to ensure DOM is laid out
    requestAnimationFrame(() => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      container.scrollTop = scrollPercent.current * maxScroll;
    });
  }, []);

  return { captureEditorScroll, applyScrollToPreview, scrollPercent };
}
