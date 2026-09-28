import { useRef, useMemo, useCallback, useEffect, forwardRef } from 'react';
import DOMPurify from 'dompurify';
import { parseMarkdownToHtml } from '@/lib/markdown-converter';
import { htmlToMarkdown } from '@/lib/html-to-markdown';
import { processSmartPaste } from '@/lib/smart-paste';
import hljs from 'highlight.js/lib/core';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

interface EditablePreviewProps {
  markdown: string;
  onChange: (markdown: string) => void;
  onEditStart: () => void;
  isEditorSource: boolean;
  className?: string;
  showToolbar?: boolean;
  mobileStyle?: boolean;
  externalContentRef?: React.MutableRefObject<HTMLDivElement | null>;
}

const EditablePreview = forwardRef<HTMLDivElement, EditablePreviewProps>(({ 
  markdown, 
  onChange, 
  onEditStart,
  isEditorSource,
  className = '',
  showToolbar = true,
  mobileStyle = false,
  externalContentRef,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const hasInitialized = useRef(false);
  
  // Parse markdown to HTML
  const html = useMemo(() => parseMarkdownToHtml(markdown), [markdown]);

  // Expose contentRef to parent
  useEffect(() => {
    if (externalContentRef && contentRef.current) {
      externalContentRef.current = contentRef.current;
    }
  }, [externalContentRef]);

  // Set initial content on mount (only once)
  useEffect(() => {
    if (contentRef.current && !hasInitialized.current) {
      contentRef.current.innerHTML = DOMPurify.sanitize(html);
      hasInitialized.current = true;
      contentRef.current.querySelectorAll('pre code').forEach((block) => {
        if (!(block as HTMLElement).dataset.highlighted) {
          hljs.highlightElement(block as HTMLElement);
        }
      });
      // Render mermaid diagrams
      import('@/lib/mermaid-init').then(({ renderMermaidDiagrams }) => {
        if (contentRef.current) renderMermaidDiagrams(contentRef.current);
      });
    }
  }, [html]);

  // Update content when markdown changes from external source (editor)
  useEffect(() => {
    if (!hasInitialized.current) return;
    
    if (isEditorSource && contentRef.current && !isInternalUpdate.current) {
      contentRef.current.innerHTML = DOMPurify.sanitize(html);
      contentRef.current.querySelectorAll('pre code').forEach((block) => {
        if (!(block as HTMLElement).dataset.highlighted) {
          hljs.highlightElement(block as HTMLElement);
        }
      });
      import('@/lib/mermaid-init').then(({ renderMermaidDiagrams }) => {
        if (contentRef.current) renderMermaidDiagrams(contentRef.current);
      });
    }
    isInternalUpdate.current = false;
  }, [html, isEditorSource]);

  // Handle content changes from the contenteditable
  const handleInput = useCallback(() => {
    if (!contentRef.current) return;
    isInternalUpdate.current = true;
    onEditStart();
    const newMarkdown = htmlToMarkdown(contentRef.current.innerHTML);
    onChange(newMarkdown);
  }, [onChange, onEditStart]);

  // Trigger change after toolbar formatting
  const handleToolbarChange = useCallback(() => {
    handleInput();
  }, [handleInput]);

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const smartResult = processSmartPaste(e.clipboardData);
    if (smartResult) {
      document.execCommand('insertText', false, smartResult);
      handleInput();
      return;
    }
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    handleInput();
  }, [handleInput]);

  return (
    <div ref={containerRef} className={`h-full flex flex-col overflow-hidden bg-background relative ${className}`}>
      <div className="flex-1 overflow-auto min-h-0 preview-container">
        <div
          id="printable-content"
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          className="markdown-preview p-6 pb-36 min-h-full outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset"
          style={{ fontFamily: "'Plus Jakarta Sans', 'SolaimanLipi', sans-serif" }}
        />
      </div>
    </div>
  );
});

EditablePreview.displayName = 'EditablePreview';

export default EditablePreview;
