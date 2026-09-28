import { useMemo, useRef, useEffect } from 'react';
import { parseMarkdownToHtml } from '@/lib/markdown-converter';
import ZenModeButton from './ZenModeButton';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

interface MarkdownPreviewProps {
  markdown: string;
  className?: string;
  showZenMode?: boolean;
}

const MarkdownPreview = ({ markdown, className = '', showZenMode = true }: MarkdownPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => parseMarkdownToHtml(markdown), [markdown]);

  // Apply syntax highlighting + mermaid + function plots after render
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.querySelectorAll('pre code').forEach((block) => {
        if (!(block as HTMLElement).dataset.highlighted) {
          hljs.highlightElement(block as HTMLElement);
        }
      });

      // Render mermaid diagrams
      import('@/lib/mermaid-init').then(({ renderMermaidDiagrams }) => {
        if (contentRef.current) renderMermaidDiagrams(contentRef.current);
      });

      // Render function plots
      import('@/lib/plot-init').then(({ renderFunctionPlots }) => {
        if (contentRef.current) renderFunctionPlots(contentRef.current);
      });
    }
  }, [html]);

  return (
    <div ref={containerRef} className={`h-full overflow-auto preview-container relative bg-background ${className}`}>
      <div 
        id="printable-content"
        ref={contentRef}
        className="markdown-preview p-6"
        style={{ fontFamily: "'Plus Jakarta Sans', 'SolaimanLipi', sans-serif" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {showZenMode && markdown.trim() && (
        <ZenModeButton targetRef={containerRef} markdown={markdown} />
      )}
    </div>
  );
};

export default MarkdownPreview;
