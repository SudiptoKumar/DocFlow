import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EditorView } from '@codemirror/view';
import { BookOpen, Sparkles, GraduationCap, Upload, Shuffle, Download } from 'lucide-react';

import { useAppMode } from '@/contexts/AppModeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import LanguageUploadCard from './LanguageUploadCard';
import MixFilesButton from './MixFilesButton';
import BilingualEditor from './BilingualEditor';
import BilingualPreview from './BilingualPreview';
import MobileActionBar from '@/components/MobileActionBar';
import DesktopActionButtons from '@/components/DesktopActionButtons';
import FloatingToolbar from '@/components/FloatingToolbar';
import DuoFlowTypewriter from './DuoFlowTypewriter';

import { mixFiles, validateBilingualContent } from '@/lib/bilingual-mixer';
import { parseMarkdownToHtml } from '@/lib/markdown-converter';
import type { OutputFormat } from '@/lib/markdown-converter';
import { toast } from 'sonner';
import { hapticPrimaryAction, hapticPrimarySuccess, hapticError } from '@/lib/haptics';

const DuoFlowContent = () => {
  const {
    duoflowSourceContent,
    duoflowTargetContent,
    duoflowMixedContent,
    duoflowPreviewMode,
    setDuoflowSourceContent,
    setDuoflowTargetContent,
    setDuoflowMixedContent,
    setDuoflowPreviewMode
  } = useAppMode();

  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const duoEditorViewRef = useRef<EditorView | null>(null);
  const duoPreviewContentRef = useRef<HTMLDivElement | null>(null);

  // Get preview HTML for copy functionality
  const getPreviewHtml = useCallback(() => {
    return parseMarkdownToHtml(duoflowMixedContent);
  }, [duoflowMixedContent]);

  // Touch-based swipe handling (more reliable than drag)
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
      setActiveTab('preview');
    }
  }, [activeTab]);

  const handleMixFiles = async () => {
    if (!duoflowSourceContent.trim() || !duoflowTargetContent.trim()) {
      hapticError();
      toast.error('Please upload both source and target files');
      return;
    }

    hapticPrimaryAction();
    setIsProcessing(true);
    try {
      // Validate content structure using structure-aware pairing
      const validation = validateBilingualContent(duoflowSourceContent, duoflowTargetContent);

      // Small delay for animation effect
      await new Promise((resolve) => setTimeout(resolve, 300));

      const mixed = mixFiles(duoflowSourceContent, duoflowTargetContent);
      setDuoflowMixedContent(mixed);

      // Show appropriate feedback based on pairing results
      if (validation.unmatchedSourceCount > 0 || validation.unmatchedTargetCount > 0) {
        // Real issues - show warning with specifics
        const issues: string[] = [];
        if (validation.unmatchedSourceCount > 0) {
          issues.push(`Missing ${validation.unmatchedSourceCount} Bangla translation(s)`);
        }
        if (validation.unmatchedTargetCount > 0) {
          issues.push(`${validation.unmatchedTargetCount} extra Bangla block(s)`);
        }
        toast.warning('Files mixed with issues', {
          description: issues.join('. ')
        });
      } else if (validation.autoFixesApplied > 0) {
        // Auto-fixed issues - show success with info
        hapticPrimarySuccess();
        toast.success('Files mixed successfully!', {
          description: `Auto-fixed ${validation.autoFixesApplied} formatting issue${validation.autoFixesApplied > 1 ? 's' : ''}`
        });
      } else {
        hapticPrimarySuccess();
        toast.success('Files mixed successfully!');
      }
    } catch (error) {
      console.error('Error mixing files:', error);
      hapticError();
      toast.error('Failed to mix files');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearContent = () => {
    setDuoflowSourceContent('');
    setDuoflowTargetContent('');
    setDuoflowMixedContent('');
    toast.success('All content cleared');
  };

  const handleDownload = async (format: OutputFormat) => {
    if (!duoflowMixedContent.trim()) {
      hapticError();
      toast.error('Please mix files first');
      return;
    }

    setIsConverting(true);

    try {
      const now = new Date();
      const month = now.toLocaleString('en-US', { month: 'short' });
      const date = now.getDate();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const filename = `DuoFlow ${month} ${date}, ${displayHours}.${minutes} ${ampm}`;

      const { convertMarkdown } = await import('@/lib/markdown-converter');
      await convertMarkdown(duoflowMixedContent, format, filename);
      toast.success(`Downloaded as ${format.toUpperCase()}!`);
    } catch (error) {
      console.error('Conversion error:', error);
      hapticError();
      toast.error('Failed to convert. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const canMix = duoflowSourceContent.trim() && duoflowTargetContent.trim();
  const hasMixedContent = duoflowMixedContent.trim().length > 0;
  const hasAnyContent = duoflowSourceContent.trim() || duoflowTargetContent.trim() || duoflowMixedContent.trim();

  return (
    <div className={`flex flex-col min-h-[calc(100vh-80px)] bg-gradient-to-b from-white via-emerald-50/30 to-white dark:from-gray-900 dark:via-emerald-950/20 dark:to-gray-900 ${isMobile ? 'pb-24' : 'pb-6'}`}>
      {/* Hero Section with motion effects */}
      <div className="relative px-4 py-6 overflow-hidden">
        <div className="absolute top-4 left-8 w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full blur-2xl opacity-60" />
        <div className="absolute top-12 right-12 w-20 h-20 bg-teal-100 dark:bg-teal-900/50 rounded-full blur-2xl opacity-60" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 text-center">

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs font-medium">

            <GraduationCap className="w-3.5 h-3.5" />
            Study Tool
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">

            Duo<span className="text-emerald-500">Flow</span>
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}>

            <DuoFlowTypewriter />
          </motion.div>
        </motion.div>
      </div>

      {/* How It Works */}
      




















      {/* Upload Cards with staggered animation */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}>

            <LanguageUploadCard
              language="english"
              content={duoflowSourceContent}
              onContentChange={setDuoflowSourceContent} />

          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}>

            <LanguageUploadCard
              language="bangla"
              content={duoflowTargetContent}
              onContentChange={setDuoflowTargetContent} />

          </motion.div>
        </div>
      </div>

      {/* Mix Button with animation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="px-4 pb-4 max-w-md mx-auto w-full">

        <MixFilesButton
          onMix={handleMixFiles}
          disabled={!canMix}
          isProcessing={isProcessing} />

      </motion.div>

      {/* Toolbox - Inline on desktop, floating on mobile */}
      {!isMobile &&
      <div className="px-4 pb-4 max-w-2xl mx-auto w-full">
          <FloatingToolbar
          mode={activeTab === 'edit' ? 'codemirror' : 'contenteditable'}
          viewRef={duoEditorViewRef}
          contentRef={duoPreviewContentRef}
          text={duoflowMixedContent}
          inline={true} />

        </div>
      }

      {/* Tab Switcher with animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="px-4 pb-3">

        <div className="flex items-center justify-center gap-3 max-w-2xl mx-auto">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center justify-center gap-2 py-2 px-6 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'edit' ?
              'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' :
              'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
              }>

              <BookOpen className="w-4 h-4" />
              Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center justify-center gap-2 py-2 px-6 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'preview' ?
              'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' :
              'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`
              }>

              <Sparkles className="w-4 h-4" />
              Preview
            </button>
          </div>
        </div>
      </motion.div>

      {/* Content Area with Swipe Support */}
      <div
        className="flex-1 mx-auto mb-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden max-w-4xl w-[calc(100%-2rem)] touch-pan-y"
        style={{ minHeight: '300px', height: 'calc(100vh - 340px)' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>

        <AnimatePresence mode="wait">
          {activeTab === 'edit' ?
          <motion.div
            key="editor"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full">

              <BilingualEditor
              value={duoflowMixedContent}
              onChange={setDuoflowMixedContent}
              externalViewRef={duoEditorViewRef} />

            </motion.div> :

          <motion.div
            key="preview"
            ref={previewRef}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full">

              <BilingualPreview
              sourceContent={duoflowSourceContent}
              targetContent={duoflowTargetContent}
              mixedContent={duoflowMixedContent}
              previewMode={duoflowPreviewMode}
              onChange={setDuoflowMixedContent}
              externalContentRef={duoPreviewContentRef} />

            </motion.div>
          }
        </AnimatePresence>
      </div>


      {/* Floating Toolbar on mobile - above action bar */}
      {isMobile &&
        <FloatingToolbar
          mode={activeTab === 'edit' ? 'codemirror' : 'contenteditable'}
          viewRef={duoEditorViewRef}
          contentRef={duoPreviewContentRef}
          text={duoflowMixedContent}
          inline={false} />
      }

      {/* Action Bar - Different for mobile vs desktop */}
      {isMobile ?
      <MobileActionBar
        onDownload={handleDownload}
        isConverting={isConverting}
        hasContent={!!(hasMixedContent || hasAnyContent)}
        activeTab={activeTab}
        previewRef={previewRef as React.RefObject<HTMLElement>}
        getPreviewHtml={getPreviewHtml}
        markdown={duoflowMixedContent}
        onClear={handleClearContent} /> :


      <DesktopActionButtons
        onDownload={handleDownload}
        getPreviewHtml={getPreviewHtml}
        isConverting={isConverting}
        hasContent={!!(hasMixedContent || hasAnyContent)}
        markdown={duoflowMixedContent} />

      }
    </div>);

};

export default DuoFlowContent;