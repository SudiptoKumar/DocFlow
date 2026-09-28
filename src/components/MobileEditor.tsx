import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { processSmartPaste } from '@/lib/smart-paste';
import EditorStatsBar from './EditorStatsBar';
interface MobileEditorProps {
  value: string;
  onChange: (value: string) => void;
  onViewReady?: (view: EditorView) => void;
  viewRef?: React.MutableRefObject<EditorView | null>;
}

const MobileEditor = ({ value, onChange, onViewReady, viewRef: externalViewRef }: MobileEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isLocalUpdate = useRef(false);
  const [isDark, setIsDark] = useState(false);
  const [editorEmpty, setEditorEmpty] = useState(!value);

  // Light theme styles for mobile editor
  const lightTheme = EditorView.theme({
    '&': { height: '100%', fontSize: '14px', backgroundColor: 'transparent', outline: 'none !important' },
    '&.cm-focused': { outline: 'none !important' },
    '.cm-scroller': { fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace", overflow: 'auto' },
    '.cm-content': { padding: '16px', paddingBottom: '140px', caretColor: '#10b981', outline: 'none !important' },
    '.cm-cursor': { borderLeftColor: '#10b981', borderLeftWidth: '2px' },
    '.cm-selectionBackground': { backgroundColor: 'rgba(16, 185, 129, 0.15) !important' },
    '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(16, 185, 129, 0.2) !important' },
    '.cm-activeLine': { backgroundColor: 'transparent !important', outline: 'none !important', border: 'none !important' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent !important' },
    '.cm-gutters': { display: 'none !important' },
    '.cm-line': { border: 'none !important', outline: 'none !important' },
    '.cm-focused .cm-activeLine': { backgroundColor: 'transparent !important', boxShadow: 'none !important', outline: 'none !important', border: 'none !important' },
  }, { dark: false });

  // Dark theme styles for mobile editor
  const darkTheme = EditorView.theme({
    '&': { height: '100%', fontSize: '14px', backgroundColor: 'transparent', outline: 'none !important' },
    '&.cm-focused': { outline: 'none !important' },
    '.cm-scroller': { fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace", overflow: 'auto' },
    '.cm-content': { padding: '16px', paddingBottom: '140px', caretColor: '#22d3ee', color: '#e2e8f0', outline: 'none !important' },
    '.cm-cursor': { borderLeftColor: '#22d3ee', borderLeftWidth: '2px' },
    '.cm-selectionBackground': { backgroundColor: 'rgba(34, 211, 238, 0.15) !important' },
    '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(34, 211, 238, 0.2) !important' },
    '.cm-activeLine': { backgroundColor: 'transparent !important', outline: 'none !important', border: 'none !important' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent !important' },
    '.cm-gutters': { display: 'none !important' },
    '.cm-line': { border: 'none !important', outline: 'none !important' },
    '.cm-focused .cm-activeLine': { backgroundColor: 'transparent !important', boxShadow: 'none !important', outline: 'none !important', border: 'none !important' },
  }, { dark: true });

  // Syntax highlighting (light)
  const lightHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, color: '#c026d3', fontWeight: 'bold' },
    { tag: tags.heading2, color: '#d946ef', fontWeight: 'bold' },
    { tag: tags.heading3, color: '#e879f9', fontWeight: 'bold' },
    { tag: tags.heading4, color: '#f0abfc', fontWeight: 'bold' },
    { tag: tags.heading5, color: '#f0abfc', fontWeight: 'bold' },
    { tag: tags.heading6, color: '#f0abfc', fontWeight: 'bold' },
    { tag: tags.strong, color: '#ca8a04', fontWeight: 'bold' },
    { tag: tags.emphasis, color: '#0891b2', fontStyle: 'italic' },
    { tag: tags.link, color: '#0d9488', textDecoration: 'underline' },
    { tag: tags.url, color: '#14b8a6' },
    { tag: tags.monospace, color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
    { tag: tags.contentSeparator, color: '#9ca3af' },
    { tag: tags.processingInstruction, color: '#9ca3af' },
    { tag: tags.meta, color: '#9ca3af' },
  ]);

  // Syntax highlighting (dark)
  const darkHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, color: '#f472b6', fontWeight: 'bold' },
    { tag: tags.heading2, color: '#f472b6', fontWeight: 'bold' },
    { tag: tags.heading3, color: '#f9a8d4', fontWeight: 'bold' },
    { tag: tags.heading4, color: '#fbcfe8', fontWeight: 'bold' },
    { tag: tags.heading5, color: '#fbcfe8', fontWeight: 'bold' },
    { tag: tags.heading6, color: '#fbcfe8', fontWeight: 'bold' },
    { tag: tags.strong, color: '#facc15', fontWeight: 'bold' },
    { tag: tags.emphasis, color: '#22d3ee', fontStyle: 'italic' },
    { tag: tags.link, color: '#2dd4bf', textDecoration: 'underline' },
    { tag: tags.url, color: '#5eead4' },
    { tag: tags.monospace, color: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.15)' },
    { tag: tags.contentSeparator, color: '#64748b' },
    { tag: tags.processingInstruction, color: '#64748b' },
    { tag: tags.meta, color: '#64748b' },
  ]);

  // Watch for theme changes
  useEffect(() => {
    const checkDarkMode = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleEditorChange = useCallback((update: { state: EditorState; docChanged: boolean }) => {
    if (update.docChanged) {
      isLocalUpdate.current = true;
      const newText = update.state.doc.toString();
      setEditorEmpty(newText.length === 0);
      onChangeRef.current(newText);
    }
  }, []);

  // Smart paste handler for CodeMirror
  const smartPasteHandler = EditorView.domEventHandlers({
    paste(event, view) {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return false;
      const result = processSmartPaste(clipboardData);
      if (result) {
        event.preventDefault();
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: result },
          selection: { anchor: from + result.length },
        });
        return true;
      }
      return false;
    },
  });

  useEffect(() => {
    if (!editorRef.current) return;
    viewRef.current?.destroy();

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        markdown(),
        isDark ? darkTheme : lightTheme,
        syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of(handleEditorChange),
        EditorView.lineWrapping,
        smartPasteHandler,
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;
    if (externalViewRef) externalViewRef.current = view;
    onViewReady?.(view);

    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  // Keep external value in sync
  useEffect(() => {
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value === current) {
      setEditorEmpty(value.length === 0);
      return;
    }
    // Temporarily disable the change listener to avoid setting isLocalUpdate
    isLocalUpdate.current = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    setEditorEmpty(value.length === 0);
    // Reset after a tick so the flag from our own dispatch is consumed
    requestAnimationFrame(() => { isLocalUpdate.current = false; });
  }, [value]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 relative">
      {/* Stats bar at top */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
        <EditorStatsBar text={value} />
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative min-h-0 overflow-auto bg-gradient-to-b from-amber-50/50 to-white dark:from-gray-800/50 dark:to-gray-900">
        {editorEmpty && !value && (
          <div className="absolute inset-0 pointer-events-none p-4 z-0 font-mono text-sm leading-relaxed">
            <p className="text-gray-400 dark:text-gray-500 mb-4">
              Start typing or paste your markdown content here...
            </p>
            <div className="text-gray-500 dark:text-gray-400 mb-1">
              <span>📚</span> <span className="text-gray-600 dark:text-gray-300">Supports content from:</span>
            </div>
            <ul className="text-gray-500 dark:text-gray-400 ml-4 space-y-0.5 mb-4">
              <li>• ChatGPT, Claude, Gemini</li>
              <li>• DeepSeek, Grok, Perplexity</li>
              <li>• And any other AI assistant</li>
            </ul>
            <p className="text-gray-500 dark:text-gray-400">
              <span>💡</span> <span className="text-amber-600 dark:text-amber-400">Tip:</span> Use the <span className="text-rose-500">Σ</span> button for math formulas!
            </p>
          </div>
        )}
        <div ref={editorRef} className="w-full flex-1" style={{ minHeight: '250px' }} />
      </div>

    </div>
  );
};

export default MobileEditor;
