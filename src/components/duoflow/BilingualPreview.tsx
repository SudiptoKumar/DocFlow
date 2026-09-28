import { useMemo, useState, useCallback } from 'react';
import { parseMarkdownToHtml } from '@/lib/markdown-converter';
import { parseMarkdownBlocks, prepareSideBySide } from '@/lib/bilingual-mixer';
import { PreviewMode } from '@/contexts/AppModeContext';
import EditablePreview from '@/components/EditablePreview';
import 'katex/dist/katex.min.css';

interface BilingualPreviewProps {
  sourceContent: string;
  targetContent: string;
  mixedContent: string;
  previewMode: PreviewMode;
  onChange?: (markdown: string) => void;
  externalContentRef?: React.MutableRefObject<HTMLDivElement | null>;
}

const BilingualPreview = ({ sourceContent, targetContent, mixedContent, previewMode, onChange, externalContentRef }: BilingualPreviewProps) => {
  const [isEditorSource, setIsEditorSource] = useState(true);

  const handleEditStart = useCallback(() => {
    setIsEditorSource(false);
  }, []);

  const handleChange = useCallback((newMarkdown: string) => {
    onChange?.(newMarkdown);
  }, [onChange]);

  // Side-by-side: pair blocks for column layout
  const sideBySidePairs = useMemo(() => {
    if (previewMode !== 'side-by-side') return [];
    const sourceBlocks = parseMarkdownBlocks(sourceContent);
    const targetBlocks = parseMarkdownBlocks(targetContent);
    return prepareSideBySide(sourceBlocks, targetBlocks);
  }, [sourceContent, targetContent, previewMode]);

  if (!mixedContent && !sourceContent && !targetContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-8">
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 mb-4">
          <span className="text-3xl">📄</span>
        </div>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Upload files and mix them to see the bilingual preview
        </p>
      </div>
    );
  }

  if (previewMode === 'interwoven') {
    return (
      <EditablePreview
        markdown={mixedContent}
        onChange={handleChange}
        onEditStart={handleEditStart}
        isEditorSource={isEditorSource}
        showToolbar={false}
        externalContentRef={externalContentRef}
      />
    );
  }

  // Side-by-side view
  return (
    <div className="h-full overflow-auto">
      <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700 min-h-full">
        {/* English Column Header */}
        <div className="sticky top-0 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 border-b border-gray-200 dark:border-gray-700 z-10">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">English</span>
        </div>
        {/* Bangla Column Header */}
        <div className="sticky top-0 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 border-b border-gray-200 dark:border-gray-700 z-10">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">বাংলা</span>
        </div>

        {/* Content Pairs */}
        {sideBySidePairs.map((pair, index) => (
          <div key={`pair-${index}`} className="contents">
            <div className="p-4 bg-white dark:bg-gray-900">
              {pair.source && (
                <div
                  className="markdown-preview prose prose-sm max-w-none dark:prose-invert"
                  style={{ fontFamily: "'Plus Jakarta Sans', 'SolaimanLipi', sans-serif" }}
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(pair.source.raw) }}
                />
              )}
            </div>
            <div className="p-4 bg-white dark:bg-gray-900">
              {pair.target && (
                <div
                  className="markdown-preview prose prose-sm max-w-none dark:prose-invert"
                  style={{ fontFamily: "'Plus Jakarta Sans', 'SolaimanLipi', sans-serif" }}
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(pair.target.raw) }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BilingualPreview;
