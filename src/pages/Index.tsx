import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Sparkles, BookOpen, GraduationCap, FileSearch, ScanLine, Map } from 'lucide-react';

import type { EditorView } from '@codemirror/view';
import FloatingToolbar from '@/components/FloatingToolbar';
import MarkdownEditor from '@/components/MarkdownEditor';
import MarkdownPreview from '@/components/MarkdownPreview';
import EditablePreview from '@/components/EditablePreview';
import StatusBar from '@/components/StatusBar';
import MobileHeader from '@/components/MobileHeader';
import MobileEditor from '@/components/MobileEditor';
import MobileActionBar from '@/components/MobileActionBar';
import FileUploadButton, { UploadFileType } from '@/components/FileUploadButton';
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal';
import ReadAloudButton from '@/components/ReadAloudButton';

// Lazy-load non-critical components
const AINameRotator = lazy(() => import('@/components/AINameRotator'));
const LaTeXToolbar = lazy(() => import('@/components/LaTeXToolbar'));
const MindMapView = lazy(() => import('@/components/MindMapView'));
const DiffViewerModal = lazy(() => import('@/components/DiffViewerModal'));
import DuoFlowContent from '@/components/duoflow/DuoFlowContent';
import DesktopActionButtons from '@/components/DesktopActionButtons';
import { useAppMode } from '@/contexts/AppModeContext';
import { parseMarkdownToHtml } from '@/lib/markdown-converter';
import type { OutputFormat } from '@/lib/markdown-converter';
import type { HtmlOutputFormat } from '@/lib/html-converter';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollSync } from '@/hooks/use-scroll-sync';
import DOMPurify from 'dompurify';
import { hapticPrimaryAction, hapticPrimarySuccess, hapticError } from '@/lib/haptics';

type ContentType = 'markdown' | 'html';

// Mode transition animations
const modeTransition = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 },
};

const Index = () =>  {
  const { mode, docflowContent, setDocflowContent } = useAppMode();
  const [content, setContent] = useState(() => {
    const saved = localStorage.getItem('docflow-autosave');
    return docflowContent || saved || '';
  });
  const [contentType, setContentType] = useState<ContentType>('markdown');
  const [isConverting, setIsConverting] = useState(false);
  const [stagedPdfFile, setStagedPdfFile] = useState<File | null>(null);
  const [stagedOcrFile, setStagedOcrFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);
  const [lastSaved, setLastSaved] = useState(false);
  const mobilePreviewRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const mobileEditorViewRef = useRef<EditorView | null>(null);
  const mobilePreviewContentRef = useRef<HTMLDivElement | null>(null);
  const desktopEditorViewRef = useRef<EditorView | null>(null);
  const desktopPreviewContentRef = useRef<HTMLDivElement | null>(null);
  const { captureEditorScroll, applyScrollToPreview } = useScrollSync();

  // Auto-save to localStorage (debounced 3s)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content) {
        localStorage.setItem('docflow-autosave', content);
        setLastSaved(prev => !prev);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [content]);

  // Keyboard shortcuts: Ctrl+/ and Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        // Save version snapshot
        import('@/components/DiffViewerModal').then(({ saveVersion }) => {
          saveVersion(content);
          toast.success('Version snapshot saved!');
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content]);

  // Expose MobileEditor's CodeMirror view for scroll sync
  const handleMobileEditorViewReady = useCallback((view: EditorView) => {
    mobileEditorViewRef.current = view;
  }, []);

  // Touch-based swipe handling for tab switching
  const touchStartX = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX.current;
    const absDiff = Math.abs(diff);
    const threshold = 100;

    if (diff > threshold && activeTab === 'preview') {
      setActiveTab('edit');
    } else if (diff < -threshold && activeTab === 'edit') {
      captureEditorScroll(mobileEditorViewRef.current);
      setActiveTab('preview');
    }
  }, [activeTab, captureEditorScroll]);
  
  const editSourceRef = useRef<'editor' | 'preview' | null>(null);

  // Sync content with context when mode changes
  useEffect(() => {
    if (mode === 'docflow') {
      setContent(docflowContent);
    }
  }, [mode, docflowContent]);

  useEffect(() => {
    if (activeTab === 'preview' && mobilePreviewRef.current) {
      const scrollContainer = mobilePreviewRef.current.querySelector('.preview-container, .overflow-auto') as HTMLElement;
      if (scrollContainer) {
        applyScrollToPreview(scrollContainer);
      } else {
        applyScrollToPreview(mobilePreviewRef.current);
      }
    }
  }, [activeTab, applyScrollToPreview]);

  const generateFilename = () => {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const date = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `DocFlow ${month} ${date}, ${displayHours}.${minutes} ${ampm}`;
  };

  const handleConvert = async (format: OutputFormat | HtmlOutputFormat) => {
    if (!content.trim()) {
      hapticError();
      toast.error('Please enter some content first');
      return;
    }
    setIsConverting(true);
    try {
      const filename = generateFilename();
      if (contentType === 'html') {
        const { convertHtml } = await import('@/lib/html-converter');
        await convertHtml(content, format as HtmlOutputFormat, filename);
      } else {
        const { convertMarkdown } = await import('@/lib/markdown-converter');
        await convertMarkdown(content, format as OutputFormat, filename);
      }
    } catch (error) {
      console.error('Conversion error:', error);
      hapticError();
      toast.error('Failed to convert. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleClear = () => {
    editSourceRef.current = 'editor';
    setContent('');
    setContentType('markdown');
    if (mode === 'docflow') setDocflowContent('');
    toast.success('Content cleared');
  };

  const handleEditorChange = useCallback((newContent: string) => {
    editSourceRef.current = 'editor';
    setContent(newContent);
    
    if (mode === 'docflow') {
      setDocflowContent(newContent);
    }
    
    if (contentType === 'html' && newContent.trim()) {
      const hasHtmlTags = /<\s*[a-z][^>]*>/i.test(newContent);
      const hasDoctype = /<!DOCTYPE/i.test(newContent);
      const hasHtmlStructure = /<\s*(html|head|body|div|p|span|h[1-6]|ul|ol|li|table|a|img)\s*[^>]*>/i.test(newContent);
      
      if (!hasHtmlTags && !hasDoctype && !hasHtmlStructure) {
        setContentType('markdown');
      }
    }
  }, [contentType, mode, setDocflowContent]);

  const handlePreviewChange = useCallback((newMarkdown: string) => {
    setContent(newMarkdown);
  }, []);

  const handlePreviewEditStart = useCallback(() => {
    editSourceRef.current = 'preview';
  }, []);

  const handleDirectPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        const { formatMarkdown: fmt } = await import('@/lib/markdown-formatter');
        const { formatted } = fmt(text);
        editSourceRef.current = 'editor';
        const newContent = content ? content + '\n\n' + formatted : formatted;
        setContent(newContent);
        if (mode === 'docflow') {
          setDocflowContent(newContent);
        }
        toast.success('Content pasted & formatted!');
      } else {
        hapticError();
        toast.error('Clipboard is empty');
      }
    } catch {
      hapticError();
      toast.error('Unable to access clipboard. Please allow clipboard access.');
    }
  };

  const handleFileLoad = async (fileContent: string, fileType: UploadFileType) => {
    const { formatMarkdown } = await import('@/lib/markdown-formatter');
    const { formatted } = formatMarkdown(fileContent);
    editSourceRef.current = 'editor';
    setContent(formatted);
    setContentType('markdown');
    if (mode === 'docflow') setDocflowContent(formatted);
  };

  const handlePdfStaged = useCallback((file: File) => {
    setStagedPdfFile(file);
  }, []);

  const handleOcrStaged = useCallback((file: File) => {
    setStagedOcrFile(file);
  }, []);

  const handleExtractPdf = useCallback(async () => {
    if (!stagedPdfFile) return;
    hapticPrimaryAction();
    setIsExtracting(true);
    try {
      const { extractMarkdownFromPdf } = await import('@/lib/pdf-extractor');
      const markdown = await extractMarkdownFromPdf(stagedPdfFile);
      const { formatMarkdown } = await import('@/lib/markdown-formatter');
      const { formatted } = formatMarkdown(markdown);
      setContent(formatted);
      setContentType('markdown');
      if (mode === 'docflow') {
        setDocflowContent(formatted);
      }
      setStagedPdfFile(null);
      hapticPrimarySuccess();
      toast.success('PDF extracted & formatted!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to extract PDF';
      hapticError();
      toast.error(message);
    } finally {
      setIsExtracting(false);
    }
  }, [stagedPdfFile, mode, setDocflowContent]);

  const handleExtractOcr = useCallback(async () => {
    if (!stagedOcrFile) return;
    hapticPrimaryAction();
    setIsOcrProcessing(true);
    setOcrProgress('Initializing OCR...');
    try {
      const { extractTextFromScannedPdf } = await import('@/lib/ocr-extractor');
      const text = await extractTextFromScannedPdf(stagedOcrFile, (progress) => {
        setOcrProgress(progress.status);
      });
      const { formatMarkdown } = await import('@/lib/markdown-formatter');
      const { formatted } = formatMarkdown(text);
      setContent(formatted);
      setContentType('markdown');
      if (mode === 'docflow') {
        setDocflowContent(formatted);
      }
      setStagedOcrFile(null);
      hapticPrimarySuccess();
      toast.success('OCR extraction complete & formatted!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'OCR extraction failed';
      hapticError();
      toast.error(message);
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress('');
    }
  }, [stagedOcrFile, mode, setDocflowContent]);

  const handleLatexInsert = useCallback((latex: string) => {
    editSourceRef.current = 'editor';
    setContent(prev => {
      const updated = prev + latex;
      if (mode === 'docflow') setDocflowContent(updated);
      return updated;
    });
  }, [mode, setDocflowContent]);

  const contentRef = useRef(content);
  contentRef.current = content;
  const contentTypeRef = useRef(contentType);
  contentTypeRef.current = contentType;
  
  const getPreviewHtml = useCallback(() => {
    if (contentTypeRef.current === 'html') {
      return DOMPurify.sanitize(contentRef.current);
    }
    return parseMarkdownToHtml(contentRef.current);
  }, []);

  // Mobile Layout
  if (isMobile) {
    return (
      <>
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-emerald-50/30 to-white dark:from-gray-900 dark:via-emerald-950/20 dark:to-gray-900 pb-24">
        <MobileHeader />
        
        <AnimatePresence mode="wait">
          {mode === 'duoflow' ? (
            <motion.div
              key="duoflow"
              initial={modeTransition.initial}
              animate={modeTransition.animate}
              exit={modeTransition.exit}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex-1"
            >
              <DuoFlowContent />
            </motion.div>
          ) : (
            <motion.div
              key="docflow"
              initial={modeTransition.initial}
              animate={modeTransition.animate}
              exit={modeTransition.exit}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="flex-1 flex flex-col"
            >
              {/* Hero Section */}
              <div className="relative px-4 py-8 overflow-hidden">
          <div className="absolute top-4 left-8 w-16 h-16 bg-emerald-100 rounded-full blur-2xl opacity-60" />
          <div className="absolute top-12 right-12 w-20 h-20 bg-blue-100 rounded-full blur-2xl opacity-60" />
          <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-purple-100 rounded-full blur-3xl opacity-40" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="relative z-10 text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full bg-emerald-100 text-emerald-600 text-xs font-medium">
              <GraduationCap className="w-3.5 h-3.5" />
              Study Tool
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Doc<span className="text-emerald-500">Flow</span>
            </h1>
            <Suspense fallback={<div className="h-5" />}><AINameRotator /></Suspense>
          </motion.div>
        </div>

        {/* Action Cards */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <FileUploadButton onFileLoad={handleFileLoad} onPdfStaged={handlePdfStaged} onOcrStaged={handleOcrStaged} className="w-full h-full min-h-[100px] flex-col gap-3" />
            </motion.div>

            <motion.button 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.2 }} 
              whileTap={{ scale: 0.95 }} 
              onClick={handleDirectPaste} 
              className="relative overflow-hidden min-h-[100px] p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-dashed border-purple-200 flex flex-col items-center justify-center gap-2 hover:border-purple-300 transition-all"
            >
              <div className="p-3 rounded-xl bg-white shadow-sm">
                <FileText className="w-6 h-6 text-purple-500" />
              </div>
              <span className="text-sm font-medium text-purple-600">Paste Content</span>
            </motion.button>
          </div>

          {/* Floating Toolbar - positioned above action bar */}
          {stagedPdfFile && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleExtractPdf} disabled={isExtracting}
                className="w-full py-3 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExtracting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileSearch className="w-4 h-4" />
                )}
                <span>{isExtracting ? 'Extracting...' : `Extract Text from "${stagedPdfFile.name}"`}</span>
              </motion.button>
            </motion.div>
          )}

          {/* OCR Extract Button */}
          {stagedOcrFile && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleExtractOcr} disabled={isOcrProcessing}
                className="w-full py-3 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOcrProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{ocrProgress}</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="w-4 h-4" />
                    <span>Extract with OCR from "{stagedOcrFile.name}"</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* Content Type Badge */}
        {content && (
          <div className="px-4 pb-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              contentType === 'html' 
                ? 'bg-orange-100 text-orange-600' 
                : 'bg-blue-100 text-blue-600'
            }`}>
              {contentType === 'html' ? 'HTML Mode' : 'Markdown Mode'}
            </span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="px-4 pb-3">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
            <button 
              onClick={() => setActiveTab('edit')} 
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${activeTab === 'edit' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BookOpen className="w-4 h-4" />
              Editor
            </button>
            <button 
              onClick={() => {
                captureEditorScroll(mobileEditorViewRef.current);
                setActiveTab('preview');
              }} 
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${activeTab === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Sparkles className="w-4 h-4" />
              Preview
            </button>
          </div>
        </div>

        {/* Content Area with Swipe Support */}
        <div 
          className="flex-1 mx-4 mb-4 pb-16 rounded-2xl bg-white border border-gray-100 shadow-lg overflow-hidden touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
            <div className={`h-full ${activeTab === 'edit' ? 'block' : 'hidden'}`}>
              <MobileEditor value={content} onChange={handleEditorChange} onViewReady={handleMobileEditorViewReady} viewRef={mobileEditorViewRef} />
            </div>
            <div 
              ref={mobilePreviewRef}
              className={`h-full overflow-hidden bg-background ${activeTab === 'preview' ? 'block' : 'hidden'}`}
            >
              {content ? (
                contentType === 'html' ? (
                  <div className="p-4 overflow-auto h-full">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                    />
                  </div>
                ) : (
                  <EditablePreview 
                    markdown={content} 
                    onChange={handlePreviewChange}
                    onEditStart={handlePreviewEditStart}
                    isEditorSource={editSourceRef.current === 'editor'}
                    showToolbar={false}
                    mobileStyle={true}
                    externalContentRef={mobilePreviewContentRef}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center px-8">
                  <div className="p-4 rounded-2xl bg-gray-50 mb-4">
                    <Sparkles className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-400 text-sm">Your formatted preview will appear here</p>
                </div>
              )}
            </div>
        </div>


        {/* Floating Toolbar above action bar */}
        <FloatingToolbar
          mode={activeTab === 'edit' ? 'codemirror' : 'contenteditable'}
          viewRef={mobileEditorViewRef}
          contentRef={mobilePreviewContentRef}
          text={content}
          inline={false}
          onContentChange={() => {
            const el = mobilePreviewContentRef.current;
            if (!el) return;
            import('@/lib/html-to-markdown').then(({ htmlToMarkdown }) => {
              const md = htmlToMarkdown(el.innerHTML);
              editSourceRef.current = 'preview';
              setContent(md);
              if (mode === 'docflow') setDocflowContent(md);
            });
          }}
        />

        <MobileActionBar 
          onDownload={handleConvert} 
          isConverting={isConverting} 
          hasContent={!!content.trim()} 
          activeTab={activeTab}
          previewRef={mobilePreviewRef}
          previewContentRef={mobilePreviewContentRef}
          getPreviewHtml={getPreviewHtml}
          markdown={content}
          onClear={handleClear}
        />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </>
    );
  }

  // Desktop Layout
  return (
    <>
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-emerald-50/30 to-white dark:from-gray-900 dark:via-emerald-950/20 dark:to-gray-900">
      <MobileHeader />

      <AnimatePresence mode="wait">
        {mode === 'duoflow' ? (
          <motion.div
            key="duoflow-desktop"
            initial={modeTransition.initial}
            animate={modeTransition.animate}
            exit={modeTransition.exit}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-1"
          >
            <DuoFlowContent />
          </motion.div>
        ) : (
          <motion.div
            key="docflow-desktop"
            initial={modeTransition.initial}
            animate={modeTransition.animate}
            exit={modeTransition.exit}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-1 flex flex-col"
          >
            {/* Hero Section */}
            <div className="relative px-8 py-6 overflow-hidden">
        <div className="absolute top-4 left-16 w-24 h-24 bg-emerald-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-8 right-24 w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-50" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="relative z-10 text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 rounded-full bg-emerald-100 text-emerald-600 text-xs font-medium">
            <GraduationCap className="w-3.5 h-3.5" />
            Study Tool
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Doc<span className="text-emerald-500">Flow</span>
          </h1>
          <Suspense fallback={<div className="h-5" />}><AINameRotator /></Suspense>
        </motion.div>
      </div>

      {/* Action Cards - 2 columns */}
      <div className="px-8 pb-4 max-w-3xl mx-auto w-full">
        <div className="grid grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <FileUploadButton onFileLoad={handleFileLoad} onPdfStaged={handlePdfStaged} onOcrStaged={handleOcrStaged} className="w-full h-full min-h-[100px] flex-col gap-2 text-sm" />
          </motion.div>

          <motion.button 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.15 }} 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }} 
            onClick={handleDirectPaste} 
            className="relative overflow-hidden min-h-[100px] p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-dashed border-purple-200 flex flex-col items-center justify-center gap-2 hover:border-purple-300 hover:shadow-md transition-all"
          >
            <div className="p-2.5 rounded-lg bg-white shadow-sm">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-sm font-medium text-purple-600">Paste Content</span>
          </motion.button>
        </div>

        {/* Toolbox - Inline Toolbar */}
        <div className="mt-3">
          <FloatingToolbar
            mode="codemirror"
            viewRef={desktopEditorViewRef}
            contentRef={desktopPreviewContentRef}
            text={content}
            inline={true}
            onContentChange={() => {
              const el = desktopPreviewContentRef.current;
              if (!el) return;
              import('@/lib/html-to-markdown').then(({ htmlToMarkdown }) => {
                const md = htmlToMarkdown(el.innerHTML);
                editSourceRef.current = 'preview';
                setContent(md);
                if (mode === 'docflow') setDocflowContent(md);
              });
            }}
          />
        </div>
        {stagedPdfFile && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleExtractPdf} disabled={isExtracting}
              className="w-full py-3 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExtracting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSearch className="w-4 h-4" />
              )}
              <span>{isExtracting ? 'Extracting...' : `Extract Text from "${stagedPdfFile.name}"`}</span>
            </motion.button>
          </motion.div>
        )}

        {/* OCR Extract Button */}
        {stagedOcrFile && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleExtractOcr} disabled={isOcrProcessing}
              className="w-full py-3 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOcrProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{ocrProgress}</span>
                </>
              ) : (
                <>
                  <ScanLine className="w-4 h-4" />
                  <span>Extract with OCR from "{stagedOcrFile.name}"</span>
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Content Type Indicator */}
      {content && (
        <div className="px-8 pb-2 max-w-7xl mx-auto w-full">
          <span className={`text-xs px-3 py-1 rounded-full ${
            contentType === 'html' 
              ? 'bg-orange-100 text-orange-600' 
              : 'bg-blue-100 text-blue-600'
          }`}>
            {contentType === 'html' ? '📄 HTML Mode - Download as PDF or Word' : '📝 Markdown Mode'}
          </span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="px-8 pb-3 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-center gap-3">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button 
              onClick={() => setActiveTab('edit')} 
              className={`flex items-center justify-center gap-2 py-2 px-6 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'edit' 
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Editor
            </button>
            <button 
              onClick={() => {
                captureEditorScroll(desktopEditorViewRef.current);
                setActiveTab('preview');
              }} 
              className={`flex items-center justify-center gap-2 py-2 px-6 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'preview' 
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Preview
            </button>
          </div>
          {/* Panel-specific tools */}
          {activeTab === 'edit' && (
            <div className="flex items-center gap-2">
              <Suspense fallback={null}><LaTeXToolbar onInsert={handleLatexInsert} /></Suspense>
              <span className={`text-xs px-2 py-1 rounded-full ${
                contentType === 'html' 
                  ? 'bg-orange-100 text-orange-600' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                {contentType === 'html' ? 'HTML' : 'Markdown'}
              </span>
            </div>
          )}
          {activeTab === 'preview' && (
            <div className="flex items-center gap-2">
              <ReadAloudButton markdown={content} previewContainer={desktopPreviewContentRef} compact={false} />
              <button
                onClick={() => setShowMindMap(!showMindMap)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  showMindMap ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title="Toggle Mind Map"
              >
                <Map className="w-3.5 h-3.5" />
                Mind Map
              </button>
              <span className="text-xs text-purple-600 bg-purple-100 dark:bg-purple-900/50 dark:text-purple-400 px-2 py-1 rounded-full">Editable</span>
            </div>
          )}
        </div>
      </div>

      {/* Single-Panel Content Area */}
      <div 
        className="flex-1 mx-auto mb-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden max-w-4xl w-[calc(100%-4rem)] touch-pan-y"
        style={{ minHeight: '400px', height: 'calc(100vh - 340px)' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'edit' ? (
            <motion.div 
              key="desktop-editor" 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }}
              className="h-full overflow-auto"
            >
              <MarkdownEditor value={content} onChange={handleEditorChange} externalViewRef={desktopEditorViewRef} />
            </motion.div>
          ) : (
            <motion.div 
              key="desktop-preview" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              {showMindMap && content ? (
                <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
                  <MindMapView markdown={content} />
                </Suspense>
              ) : content ? (
                contentType === 'html' ? (
                  <div className="p-4 overflow-auto h-full">
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                    />
                  </div>
                ) : (
                  <EditablePreview 
                    markdown={content} 
                    onChange={handlePreviewChange}
                    onEditStart={handlePreviewEditStart}
                    isEditorSource={editSourceRef.current === 'editor'}
                    showToolbar={false}
                    externalContentRef={desktopPreviewContentRef}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700 mb-4">
                    <Sparkles className="w-8 h-8 text-gray-300 dark:text-gray-500" />
                  </div>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">Your formatted preview will appear here</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Buttons */}
      <DesktopActionButtons
        onDownload={handleConvert}
        getPreviewHtml={getPreviewHtml}
        isConverting={isConverting}
        hasContent={!!content.trim()}
        markdown={content}
      />

      <StatusBar markdown={content} lastSaved={lastSaved} onOpenShortcuts={() => setShowShortcuts(true)} onOpenHistory={() => setShowHistory(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    <Suspense fallback={null}>
      <DiffViewerModal open={showHistory} onClose={() => setShowHistory(false)} currentContent={content} />
    </Suspense>
    </>
  );
};

export default Index;
