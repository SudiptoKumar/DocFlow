import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { processSmartPaste } from '@/lib/smart-paste';
import EditorStatsBar from './EditorStatsBar';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  onViewReady?: (view: EditorView) => void;
  externalViewRef?: React.MutableRefObject<EditorView | null>;
}

// Light study theme styles
const studyTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', backgroundColor: '#fffef8' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace", overflow: 'auto' },
  '.cm-content': { caretColor: '#10b981', padding: '16px 0', paddingBottom: '72px' },
  '.cm-cursor': { borderLeftColor: '#10b981', borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  '.cm-gutters': { backgroundColor: '#fefce8', borderRight: '1px solid #e5e7eb', color: '#9ca3af' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 16px 0 8px' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(16, 185, 129, 0.2) !important' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(16, 185, 129, 0.15) !important' },
}, { dark: false });

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: '#c026d3', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading2, color: '#d946ef', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading3, color: '#e879f9', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading4, color: '#f0abfc', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#f0abfc', fontWeight: 'bold' },
  { tag: tags.heading6, color: '#f0abfc', fontWeight: 'bold' },
  { tag: tags.strong, color: '#ca8a04', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#0891b2', fontStyle: 'italic' },
  { tag: tags.link, color: '#0d9488', textDecoration: 'underline' },
  { tag: tags.url, color: '#14b8a6' },
  { tag: tags.monospace, color: '#059669', backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  { tag: tags.meta, color: '#9ca3af' },
  { tag: tags.processingInstruction, color: '#9ca3af' },
  { tag: tags.contentSeparator, color: '#9ca3af' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#6b7280' },
]);

// Neon dark theme styles
const neonDarkTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', backgroundColor: '#000000' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace", overflow: 'auto' },
  '.cm-content': { caretColor: '#22d3ee', padding: '16px 0', paddingBottom: '72px', color: '#e2e8f0' },
  '.cm-cursor': { borderLeftColor: '#22d3ee', borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: 'rgba(34, 211, 238, 0.05)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(34, 211, 238, 0.05)' },
  '.cm-gutters': { backgroundColor: '#050505', borderRight: '1px solid #1a1a1a', color: '#4a6080' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 16px 0 8px' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(34, 211, 238, 0.2) !important' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(34, 211, 238, 0.15) !important' },
}, { dark: true });

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: '#f472b6', fontWeight: 'bold', fontSize: '1.3em' },
  { tag: tags.heading2, color: '#f472b6', fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading3, color: '#f9a8d4', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading4, color: '#fbcfe8', fontWeight: 'bold' },
  { tag: tags.heading5, color: '#fbcfe8', fontWeight: 'bold' },
  { tag: tags.heading6, color: '#fbcfe8', fontWeight: 'bold' },
  { tag: tags.strong, color: '#facc15', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#22d3ee', fontStyle: 'italic' },
  { tag: tags.link, color: '#2dd4bf', textDecoration: 'underline' },
  { tag: tags.url, color: '#5eead4' },
  { tag: tags.monospace, color: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.15)' },
  { tag: tags.meta, color: '#64748b' },
  { tag: tags.processingInstruction, color: '#64748b' },
  { tag: tags.contentSeparator, color: '#64748b' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#64748b' },
]);

const MarkdownEditor = ({ value, onChange, className = '', onViewReady, externalViewRef }: MarkdownEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isLocalUpdate = useRef(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleChange = useCallback((update: { state: EditorState; docChanged: boolean }) => {
    if (update.docChanged) {
      isLocalUpdate.current = true;
      onChangeRef.current(update.state.doc.toString());
    }
  }, []);

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

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        markdown(),
        isDark ? neonDarkTheme : studyTheme,
        syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of(handleChange),
        EditorView.lineWrapping,
        smartPasteHandler,
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;
    if (externalViewRef) externalViewRef.current = view;
    onViewReady?.(view);
    return () => { view.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  useEffect(() => {
    if (isLocalUpdate.current) { isLocalUpdate.current = false; return; }
    const view = viewRef.current;
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div className={`h-full w-full flex flex-col overflow-hidden relative ${isDark ? 'bg-black' : 'bg-amber-50/30'} ${className}`}>
      {/* Stats bar at top */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
        <EditorStatsBar text={value} />
      </div>

      {/* Editor content */}
      <div ref={editorRef} className="flex-1 overflow-auto" />

    </div>
  );
};

export default MarkdownEditor;
