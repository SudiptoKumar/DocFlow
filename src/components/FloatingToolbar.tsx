import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bold, Italic, List, ListOrdered, ListChecks, Table, Code, CodeSquare,
  Quote, Heading1, Heading2, Heading3, Link, Minus, Strikethrough, Sigma,
  ChevronDown, Undo2, Redo2, Search, Wand2, TableProperties, Highlighter,
  Subscript, Superscript, BookOpen, AlertTriangle, Info, CheckCircle,
  Lightbulb, ShieldAlert, Grid3X3,
} from 'lucide-react';
import type { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import { formatMarkdown } from '@/lib/markdown-formatter';
import { toast } from '@/hooks/use-toast';
import FindReplaceBar from './FindReplaceBar';
import TableBuilderModal from './TableBuilderModal';
import EquationEditorModal from './EquationEditorModal';
import ColorPickerButton from './ColorPickerButton';
import { hapticFormat } from '@/lib/haptics';

const SpreadsheetModal = lazy(() => import('./SpreadsheetModal'));

type ToolbarMode = 'codemirror' | 'contenteditable';

interface FloatingToolbarProps {
  mode: ToolbarMode;
  viewRef?: React.RefObject<EditorView | null>;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  onContentChange?: () => void;
  text?: string; // for stats/format
  inline?: boolean; // sticky inline positioning (for desktop)
}

const editorToolbarItems = [
  { icon: Heading1, label: 'H1', action: '# ', type: 'prefix', color: 'text-purple-500 bg-purple-50' },
  { icon: Heading2, label: 'H2', action: '## ', type: 'prefix', color: 'text-purple-400 bg-purple-50' },
  { icon: Bold, label: 'Bold', action: '**', type: 'wrap', color: 'text-gray-700 bg-gray-50' },
  { icon: Italic, label: 'Italic', action: '*', type: 'wrap', color: 'text-gray-700 bg-gray-50' },
  { icon: Code, label: 'Code', action: '`', type: 'wrap', color: 'text-emerald-500 bg-emerald-50' },
  { icon: List, label: 'Bullet', action: '- ', type: 'prefix', color: 'text-blue-500 bg-blue-50' },
  { icon: ListOrdered, label: 'Number', action: '1. ', type: 'prefix', color: 'text-blue-500 bg-blue-50' },
  { icon: Quote, label: 'Quote', action: '> ', type: 'prefix', color: 'text-amber-500 bg-amber-50' },
  { icon: Link, label: 'Link', action: '[text](url)', type: 'insert', color: 'text-teal-500 bg-teal-50' },
  { icon: Table, label: 'Table', action: '\n| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n', type: 'insert', color: 'text-indigo-500 bg-indigo-50' },
  { icon: Minus, label: 'Divider', action: '\n---\n', type: 'insert', color: 'text-gray-400 bg-gray-50' },
  { icon: Strikethrough, label: 'Strike', action: '~~', type: 'wrap', color: 'text-gray-500 bg-gray-50' },
  { icon: ListChecks, label: 'Task', action: '- [ ] ', type: 'prefix', color: 'text-green-500 bg-green-50' },
  { icon: CodeSquare, label: 'Code Block', action: '\n```\ncode here\n```\n', type: 'insert', color: 'text-cyan-600 bg-cyan-50' },
  { icon: Highlighter, label: 'Highlight', action: '==', type: 'wrap', color: 'text-yellow-500 bg-yellow-50' },
  { icon: Subscript, label: 'Subscript', action: '~', type: 'wrap', color: 'text-gray-600 bg-gray-50' },
  { icon: Superscript, label: 'Superscript', action: '^', type: 'wrap', color: 'text-gray-600 bg-gray-50' },
  { icon: BookOpen, label: 'Footnote', action: '[^1]: Footnote text', type: 'insert', color: 'text-indigo-500 bg-indigo-50' },
  { icon: List, label: 'TOC', action: '\n\n[[toc]]\n\n', type: 'insert', color: 'text-teal-500 bg-teal-50' },
];

const calloutTypes = [
  { type: 'info', icon: Info, label: 'Info', color: 'text-blue-500' },
  { type: 'warning', icon: AlertTriangle, label: 'Warning', color: 'text-amber-500' },
  { type: 'success', icon: CheckCircle, label: 'Success', color: 'text-emerald-500' },
  { type: 'tip', icon: Lightbulb, label: 'Tip', color: 'text-violet-500' },
  { type: 'danger', icon: ShieldAlert, label: 'Danger', color: 'text-red-500' },
];

const mathItems = [
  { label: 'Fraction', action: '$\\frac{a}{b}$', preview: 'a/b' },
  { label: 'Square Root', action: '$\\sqrt{x}$', preview: '√x' },
  { label: 'Power', action: '$x^{n}$', preview: 'xⁿ' },
  { label: 'Subscript', action: '$x_{i}$', preview: 'xᵢ' },
  { label: 'Sum', action: '$\\sum_{i=1}^{n} x_i$', preview: 'Σ' },
  { label: 'Integral', action: '$\\int_{a}^{b} f(x) dx$', preview: '∫' },
  { label: 'Limit', action: '$\\lim_{x \\to \\infty}$', preview: 'lim' },
  { label: 'Pi', action: '$\\pi$', preview: 'π' },
  { label: 'Alpha', action: '$\\alpha$', preview: 'α' },
  { label: 'Beta', action: '$\\beta$', preview: 'β' },
  { label: 'Theta', action: '$\\theta$', preview: 'θ' },
  { label: 'Delta', action: '$\\Delta$', preview: 'Δ' },
  { label: 'Infinity', action: '$\\infty$', preview: '∞' },
  { label: 'Not Equal', action: '$\\neq$', preview: '≠' },
  { label: 'Less/Equal', action: '$\\leq$', preview: '≤' },
  { label: 'Greater/Equal', action: '$\\geq$', preview: '≥' },
  { label: 'Display Math', action: '$$\n\\frac{d}{dx} f(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}\n$$', preview: '⌸' },
];

// Preview toolbar tools (contenteditable mode)
const previewTools = [
  { icon: Heading1, label: 'Heading 1', cmd: 'formatBlock', value: '<h1>', color: 'text-rose-500 bg-rose-50' },
  { icon: Heading2, label: 'Heading 2', cmd: 'formatBlock', value: '<h2>', color: 'text-orange-500 bg-orange-50' },
  { icon: Heading3, label: 'Heading 3', cmd: 'formatBlock', value: '<h3>', color: 'text-amber-500 bg-amber-50' },
  { icon: Bold, label: 'Bold', cmd: 'bold', color: 'text-emerald-500 bg-emerald-50' },
  { icon: Italic, label: 'Italic', cmd: 'italic', color: 'text-teal-500 bg-teal-50' },
  { icon: Strikethrough, label: 'Strikethrough', cmd: 'strikeThrough', color: 'text-gray-500 bg-gray-50' },
  { icon: Code, label: 'Inline Code', cmd: 'code', color: 'text-cyan-500 bg-cyan-50' },
  { icon: CodeSquare, label: 'Code Block', cmd: 'codeBlock', color: 'text-cyan-600 bg-cyan-50' },
  { icon: List, label: 'Bullet List', cmd: 'insertUnorderedList', color: 'text-blue-500 bg-blue-50' },
  { icon: ListOrdered, label: 'Numbered List', cmd: 'insertOrderedList', color: 'text-indigo-500 bg-indigo-50' },
  { icon: ListChecks, label: 'Task List', cmd: 'taskList', color: 'text-green-500 bg-green-50' },
  { icon: Quote, label: 'Blockquote', cmd: 'formatBlock', value: '<blockquote>', color: 'text-violet-500 bg-violet-50' },
  { icon: Table, label: 'Table', cmd: 'table', color: 'text-indigo-500 bg-indigo-50' },
  { icon: Minus, label: 'Divider', cmd: 'insertHorizontalRule', color: 'text-gray-400 bg-gray-50' },
  { icon: Link, label: 'Link', cmd: 'link', color: 'text-purple-500 bg-purple-50' },
];

const FloatingToolbar = ({ mode, viewRef, contentRef, onContentChange, text = '', inline = false }: FloatingToolbarProps) => {
  const [showMathMenu, setShowMathMenu] = useState(false);
  const [showCalloutMenu, setShowCalloutMenu] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showTableBuilder, setShowTableBuilder] = useState(false);
  const [showEquationEditor, setShowEquationEditor] = useState(false);
  const [showSpreadsheet, setShowSpreadsheet] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const mathAnchorRef = useRef<HTMLDivElement>(null);
  const calloutAnchorRef = useRef<HTMLDivElement>(null);

  // ─── CodeMirror mode helpers ───

  const applyFormat = useCallback((action: string, type: string) => {
    hapticFormat();
    const view = viewRef?.current;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to);

    let insert = '';
    let selectionFrom = from;
    let selectionTo = to;

    if (type === 'wrap') {
      if (selectedText) {
        insert = `${action}${selectedText}${action}`;
        selectionFrom = from + action.length;
        selectionTo = selectionFrom + selectedText.length;
      } else {
        insert = `${action}text${action}`;
        selectionFrom = from + action.length;
        selectionTo = selectionFrom + 4;
      }
    } else if (type === 'prefix') {
      const line = view.state.doc.lineAt(from);
      const lineStart = line.from;
      insert = action + view.state.sliceDoc(lineStart, line.to);
      selectionFrom = from + action.length;
      selectionTo = selectionFrom;
      view.dispatch({
        changes: { from: lineStart, to: line.to, insert },
        selection: { anchor: selectionFrom },
      });
      view.focus();
      return;
    } else if (type === 'insert') {
      insert = action;
      selectionFrom = from + action.length;
      selectionTo = selectionFrom;
    }

    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: selectionFrom, head: selectionTo },
    });
    view.focus();
  }, [viewRef]);

  const handleUndo = useCallback(() => {
    if (mode === 'codemirror') {
      const view = viewRef?.current;
      if (view) { undo(view); view.focus(); }
    } else {
      contentRef?.current?.focus();
      document.execCommand('undo');
      setTimeout(() => onContentChange?.(), 0);
    }
  }, [mode, viewRef, contentRef, onContentChange]);

  const handleRedo = useCallback(() => {
    if (mode === 'codemirror') {
      const view = viewRef?.current;
      if (view) { redo(view); view.focus(); }
    } else {
      contentRef?.current?.focus();
      document.execCommand('redo');
      setTimeout(() => onContentChange?.(), 0);
    }
  }, [mode, viewRef, contentRef, onContentChange]);

  const handleFormat = useCallback(() => {
    hapticFormat();
    if (mode !== 'codemirror') return;
    const view = viewRef?.current;
    if (!view) return;
    const { formatted, changeCount } = formatMarkdown(view.state.doc.toString());
    if (changeCount > 0) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
      toast({ title: 'Markdown formatted!', description: `${changeCount} line${changeCount > 1 ? 's' : ''} changed` });
    } else {
      toast({ title: 'Already clean!', description: 'No formatting changes needed' });
    }
  }, [mode, viewRef]);

  const insertMath = useCallback((action: string) => {
    hapticFormat();
    if (mode === 'codemirror') {
      const view = viewRef?.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: action },
        selection: { anchor: from + action.length },
      });
      view.focus();
    } else {
      // contenteditable mode: insert as text
      const el = contentRef?.current;
      if (el) {
        el.focus();
        document.execCommand('insertText', false, action);
        setTimeout(() => onContentChange?.(), 0);
      }
    }
    setShowMathMenu(false);
  }, [mode, viewRef, contentRef, onContentChange]);

  const insertAtCursor = useCallback((textToInsert: string) => {
    if (mode === 'codemirror') {
      const view = viewRef?.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: textToInsert },
        selection: { anchor: from + textToInsert.length },
      });
      view.focus();
    }
  }, [mode, viewRef]);

  // ─── Contenteditable mode helpers ───

  const execPreviewCommand = useCallback((cmd: string, value?: string) => {
    hapticFormat();
    const el = contentRef?.current;
    if (!el) return;
    el.focus();

    if (cmd === 'code') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      if (selectedText) {
        const code = document.createElement('code');
        code.textContent = selectedText;
        range.deleteContents();
        range.insertNode(code);
        selection.collapseToEnd();
      }
    } else if (cmd === 'codeBlock') {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = 'code here';
      pre.appendChild(code);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(pre);
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        pre.parentNode?.insertBefore(p, pre.nextSibling);
        selection.collapseToEnd();
      }
    } else if (cmd === 'table') {
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const tbody = document.createElement('tbody');
      const headerRow = document.createElement('tr');
      ['Column 1', 'Column 2', 'Column 3'].forEach(t => {
        const th = document.createElement('th');
        th.textContent = t;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      const bodyRow = document.createElement('tr');
      ['Cell 1', 'Cell 2', 'Cell 3'].forEach(t => {
        const td = document.createElement('td');
        td.textContent = t;
        bodyRow.appendChild(td);
      });
      tbody.appendChild(bodyRow);
      table.appendChild(thead);
      table.appendChild(tbody);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(table);
        selection.collapseToEnd();
      }
    } else if (cmd === 'taskList') {
      const ul = document.createElement('ul');
      ul.style.listStyle = 'none';
      ul.style.paddingLeft = '0';
      const li = document.createElement('li');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.style.marginRight = '8px';
      li.appendChild(checkbox);
      li.appendChild(document.createTextNode('Task item'));
      ul.appendChild(li);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(ul);
        selection.collapseToEnd();
      }
    } else if (cmd === 'link') {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';
      const url = window.prompt('Enter URL:', 'https://');
      if (!url) return;
      el.focus();
      if (selectedText) {
        document.execCommand('createLink', false, url);
      } else {
        const linkText = window.prompt('Enter link text:', url) || url;
        const link = document.createElement('a');
        link.href = url;
        link.textContent = linkText;
        const range = selection?.getRangeAt(0);
        if (range) {
          range.insertNode(link);
          selection?.collapseToEnd();
        }
      }
    } else if (cmd === 'formatBlock') {
      document.execCommand('formatBlock', false, value);
    } else {
      document.execCommand(cmd, false, value);
    }

    setTimeout(() => onContentChange?.(), 0);
  }, [contentRef, onContentChange]);

  const btnClass = "flex items-center justify-center p-2 rounded-xl border border-gray-100 dark:border-gray-700 transition-all shrink-0 shadow-sm active:scale-90";

  return (
    <>
      <div
        ref={toolbarRef}
        className={inline
          ? "sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-gray-700"
          : "fixed bottom-24 left-3 right-3 z-40 md:bottom-[80px] md:left-1/2 md:-translate-x-1/2 md:max-w-3xl md:w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700"
        }
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide">
          {/* Undo/Redo */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleUndo}
            className={`${btnClass} text-gray-500 bg-gray-50 dark:bg-gray-800`} title="Undo">
            <Undo2 className="w-4 h-4" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleRedo}
            className={`${btnClass} text-gray-500 bg-gray-50 dark:bg-gray-800`} title="Redo">
            <Redo2 className="w-4 h-4" />
          </motion.button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

          {mode === 'codemirror' ? (
            <>
              {/* Find & Replace */}
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowFindReplace(!showFindReplace)}
                className={`${btnClass} text-orange-500 bg-orange-50 dark:bg-orange-900/30 ${showFindReplace ? 'ring-2 ring-orange-300' : ''}`}
                title="Find & Replace">
                <Search className="w-4 h-4" />
              </motion.button>

              {/* Format */}
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleFormat}
                className={`${btnClass} text-violet-500 bg-violet-50 dark:bg-violet-900/30`}
                title="Format Markdown">
                <Wand2 className="w-4 h-4" />
              </motion.button>

              {/* Table Builder */}
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowTableBuilder(true)}
                className={`${btnClass} text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30`}
                title="Table Builder">
                <TableProperties className="w-4 h-4" />
              </motion.button>

              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

              {editorToolbarItems.map((item, index) => (
                <motion.button key={index} whileTap={{ scale: 0.9 }}
                  onClick={() => applyFormat(item.action, item.type)}
                  className={`${btnClass} ${item.color} dark:bg-opacity-20`}
                  title={item.label}>
                  <item.icon className="w-4 h-4" />
                </motion.button>
              ))}

              {/* Math/LaTeX */}
              <div className="relative" ref={(el) => { if (el) mathAnchorRef.current = el; }}>
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowMathMenu(!showMathMenu); setShowCalloutMenu(false); }}
                  className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-rose-500 bg-rose-50 dark:bg-rose-900/30 border border-gray-100 dark:border-gray-700 transition-all shrink-0 shadow-sm ${showMathMenu ? 'ring-2 ring-rose-300' : ''}`}
                  title="Math Formulas">
                  <Sigma className="w-4 h-4" />
                  <ChevronDown className={`w-3 h-3 transition-transform ${showMathMenu ? 'rotate-180' : ''}`} />
                </motion.button>
              </div>

              {/* Callout/Admonition dropdown */}
              <div className="relative" ref={(el) => { if (el) calloutAnchorRef.current = el; }}>
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowCalloutMenu(!showCalloutMenu); setShowMathMenu(false); }}
                  className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-blue-500 bg-blue-50 dark:bg-blue-900/30 border border-gray-100 dark:border-gray-700 transition-all shrink-0 shadow-sm ${showCalloutMenu ? 'ring-2 ring-blue-300' : ''}`}
                  title="Callout Boxes">
                  <Info className="w-4 h-4" />
                  <ChevronDown className={`w-3 h-3 transition-transform ${showCalloutMenu ? 'rotate-180' : ''}`} />
                </motion.button>
              </div>

            </>
          ) : (
            <>
              {/* Preview mode tools */}
              {previewTools.map((tool, index) => (
                <motion.button key={index} whileTap={{ scale: 0.9 }}
                  onClick={() => execPreviewCommand(tool.cmd, tool.value)}
                  className={`${btnClass} ${tool.color} dark:bg-opacity-20`}
                  title={tool.label}>
                  <tool.icon className="w-4 h-4" />
                </motion.button>
              ))}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
              {contentRef && (
                <ColorPickerButton contentRef={contentRef as React.RefObject<HTMLDivElement>} onContentChange={onContentChange || (() => {})} mobileStyle={true} />
              )}

              {/* Math/LaTeX - also in preview mode */}
              <div className="relative">
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMathMenu(!showMathMenu)}
                  className={`flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-rose-500 bg-rose-50 dark:bg-rose-900/30 border border-gray-100 dark:border-gray-700 transition-all shrink-0 shadow-sm ${showMathMenu ? 'ring-2 ring-rose-300' : ''}`}
                  title="Math Formulas">
                  <Sigma className="w-4 h-4" />
                  <ChevronDown className={`w-3 h-3 transition-transform ${showMathMenu ? 'rotate-180' : ''}`} />
                </motion.button>
              </div>
            </>
          )}
        </div>

        {/* Find & Replace bar (CodeMirror mode only) */}
        {mode === 'codemirror' && (
          <FindReplaceBar view={viewRef?.current ?? null} open={showFindReplace} onClose={() => setShowFindReplace(false)} />
        )}
      </div>

      {/* Math dropdown - rendered outside toolbar to avoid overflow clipping */}
      <AnimatePresence>
        {showMathMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[60] w-48 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700"
            style={{
              bottom: (toolbarRef.current ? window.innerHeight - toolbarRef.current.getBoundingClientRect().top + 8 : 180),
              right: 16,
            }}
          >
            <div className="p-2">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 py-1 mb-1">LaTeX Templates</div>
              {mathItems.map((item, index) => (
                <button key={index} onClick={() => insertMath(item.action)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                  <span className="text-lg text-rose-500">{item.preview}</span>
                </button>
              ))}
              <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                <button onClick={() => { setShowMathMenu(false); setShowEquationEditor(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors text-rose-600 dark:text-rose-400 font-medium">
                  Advanced Editor →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Callout dropdown - rendered outside toolbar to avoid overflow clipping */}
      <AnimatePresence>
        {showCalloutMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[60] w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700"
            style={{
              bottom: (toolbarRef.current ? window.innerHeight - toolbarRef.current.getBoundingClientRect().top + 8 : 180),
              right: 16,
            }}
          >
            <div className="p-2">
              <div className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 py-1 mb-1">Callout Boxes</div>
              {calloutTypes.map((ct) => (
                <button key={ct.type} onClick={() => {
                  applyFormat(`\n::: ${ct.type}\nYour content here\n:::\n`, 'insert');
                  setShowCalloutMenu(false);
                }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <ct.icon className={`w-4 h-4 ${ct.color}`} />
                  <span className="text-gray-700 dark:text-gray-300">{ct.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      {mode === 'codemirror' && (
        <TableBuilderModal open={showTableBuilder} onClose={() => setShowTableBuilder(false)} onInsert={insertAtCursor} />
      )}
      <EquationEditorModal open={showEquationEditor} onClose={() => setShowEquationEditor(false)} onInsert={(latex) => insertMath(latex)} />
      {mode === 'codemirror' && (
        <Suspense fallback={null}>
          <SpreadsheetModal open={showSpreadsheet} onClose={() => setShowSpreadsheet(false)} onInsert={insertAtCursor} />
        </Suspense>
      )}
    </>
  );
};

export default FloatingToolbar;
