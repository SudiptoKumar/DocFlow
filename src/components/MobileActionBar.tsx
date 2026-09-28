import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Maximize2, FileText, FileType, FileCode, ChevronUp, Check, Loader2, Copy, Trash2, Volume2 } from 'lucide-react';
import type { OutputFormat } from '@/lib/markdown-converter';
import { copyRichContent } from '@/lib/clipboard-utils';
import { toast } from 'sonner';
import ZenModeOverlay from './ZenModeOverlay';
import ReadAloudButton from './ReadAloudButton';

interface MobileActionBarProps {
  onDownload: (format: OutputFormat) => void;
  isConverting: boolean;
  hasContent: boolean;
  activeTab?: 'edit' | 'preview';
  previewRef?: React.RefObject<HTMLElement>;
  previewContentRef?: React.RefObject<HTMLElement | null>;
  getPreviewHtml?: () => string;
  markdown: string;
  onClear?: () => void;
}

const downloadOptions = [
  { format: 'docx' as OutputFormat, label: 'Word Document', sublabel: '.docx', icon: FileText, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
  { format: 'pdf' as OutputFormat, label: 'PDF Document', sublabel: '.pdf', icon: FileType, color: 'from-red-500 to-red-600', bg: 'bg-red-50' },
  { format: 'html' as OutputFormat, label: 'Web Page', sublabel: '.html', icon: FileCode, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50' },
  { format: 'md' as OutputFormat, label: 'Markdown File', sublabel: '.md', icon: FileText, color: 'from-purple-500 to-violet-500', bg: 'bg-purple-50' },
  { format: 'txt' as OutputFormat, label: 'Plain Text', sublabel: '.txt', icon: FileText, color: 'from-gray-500 to-gray-600', bg: 'bg-gray-100' },
  { format: 'md-docx' as OutputFormat, label: 'Raw Markdown', sublabel: '.docx', icon: FileCode, color: 'from-teal-500 to-cyan-500', bg: 'bg-teal-50' },
];

const MobileActionBar = ({ onDownload, isConverting, hasContent, activeTab = 'edit', previewRef, previewContentRef, getPreviewHtml, markdown, onClear }: MobileActionBarProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  

  const handleDownload = (format: OutputFormat) => {
    setSelectedFormat(format);
    setShowDropdown(false);
    onDownload(format);
    setTimeout(() => setSelectedFormat(null), 2000);
  };

  const handleCopy = async () => {
    if (!hasContent || !getPreviewHtml) return;
    
    const htmlContent = getPreviewHtml();
    const success = await copyRichContent(htmlContent);
    
    if (success) {
      setIsCopied(true);
      toast.success('Copied with formatting!');
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      toast.error('Failed to copy. Please try again.');
    }
  };

  return (
    <>
      <ZenModeOverlay isActive={isZenMode} onExit={() => setIsZenMode(false)} markdown={markdown} />
      {/* Dropdown Menu */}
      <AnimatePresence>
        {showDropdown && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowDropdown(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-24 left-4 right-4 z-50 bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden"
            >
              <div className="p-2">
                <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Export Format
                </p>
                {downloadOptions.map((option) => (
                  <motion.button
                    key={option.format}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDownload(option.format)}
                    className="flex items-center gap-4 w-full px-4 py-3 rounded-2xl hover:bg-gray-50 transition-all"
                  >
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${option.color} shadow-lg`}>
                      <option.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-gray-800 font-medium">{option.label}</p>
                      <p className="text-xs text-gray-400">{option.sublabel}</p>
                    </div>
                    {selectedFormat === option.format && (
                      <Check className="w-5 h-5 text-emerald-500" />
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-4 py-4 safe-bottom">
        <div className="flex gap-2">
          {/* Copy Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            disabled={!hasContent || !getPreviewHtml}
            className={`p-4 rounded-2xl transition-all ${
              hasContent && getPreviewHtml
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gray-50 border border-gray-100 text-gray-300'
            }`}
            title="Copy"
          >
            {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </motion.button>

          {/* Primary Download Button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={!hasContent || isConverting}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base transition-all shadow-lg ${
              hasContent && !isConverting
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/25'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {isConverting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download</span>
                <ChevronUp className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </>
            )}
          </motion.button>

          {/* Context-sensitive buttons */}
          {activeTab === 'preview' ? (
            <>
              {/* Read Aloud */}
              <ReadAloudButton markdown={markdown} previewContainer={previewContentRef} compact={true} className="" />

              {/* Zen Mode */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => hasContent && setIsZenMode(true)}
                disabled={!hasContent}
                className={`p-4 rounded-2xl transition-all ${
                  hasContent
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                    : 'bg-gray-50 border border-gray-100 text-gray-300'
                }`}
                title="Zen Mode"
              >
                <Maximize2 className="w-5 h-5" />
              </motion.button>
            </>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { if (hasContent && onClear) { onClear(); } }}
              disabled={!hasContent || !onClear}
              className={`p-4 rounded-2xl transition-all ${
                hasContent && onClear
                  ? 'bg-red-50 border border-red-200 text-red-500 hover:bg-red-100'
                  : 'bg-gray-50 border border-gray-100 text-gray-300'
              }`}
              title="Clear"
            >
              <Trash2 className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </div>
    </>
  );
};

export default memo(MobileActionBar);
