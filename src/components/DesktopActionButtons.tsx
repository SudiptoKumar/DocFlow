import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, Maximize2, FileText, FileType, FileCode, ChevronDown, Check, Loader2 } from 'lucide-react';
import { copyRichContent } from '@/lib/clipboard-utils';
import { toast } from 'sonner';
import type { OutputFormat } from '@/lib/markdown-converter';
import ZenModeOverlay from './ZenModeOverlay';

interface DesktopActionButtonsProps {
  onDownload: (format: OutputFormat) => void;
  getPreviewHtml: () => string;
  isConverting: boolean;
  hasContent: boolean;
  markdown: string;
}

const downloadOptions = [
  { format: 'docx' as OutputFormat, label: 'Word Document', sublabel: '.docx', icon: FileText, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
  { format: 'pdf' as OutputFormat, label: 'PDF Document', sublabel: '.pdf', icon: FileType, color: 'from-red-500 to-red-600', bg: 'bg-red-50' },
  { format: 'html' as OutputFormat, label: 'Web Page', sublabel: '.html', icon: FileCode, color: 'from-orange-500 to-amber-500', bg: 'bg-orange-50' },
  { format: 'md' as OutputFormat, label: 'Markdown File', sublabel: '.md', icon: FileText, color: 'from-purple-500 to-violet-500', bg: 'bg-purple-50' },
  { format: 'txt' as OutputFormat, label: 'Plain Text', sublabel: '.txt', icon: FileText, color: 'from-gray-500 to-gray-600', bg: 'bg-gray-100' },
  { format: 'md-docx' as OutputFormat, label: 'Raw Markdown', sublabel: '.docx', icon: FileCode, color: 'from-teal-500 to-cyan-500', bg: 'bg-teal-50' },
];

const DesktopActionButtons = ({ 
  onDownload, 
  getPreviewHtml, 
  isConverting, 
  hasContent,
  markdown,
}: DesktopActionButtonsProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = async () => {
    if (!hasContent) return;
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

  const handleDownload = (format: OutputFormat) => {
    setSelectedFormat(format);
    setShowDropdown(false);
    onDownload(format);
    setTimeout(() => setSelectedFormat(null), 2000);
  };

  return (
    <>
      <ZenModeOverlay isActive={isZenMode} onExit={() => setIsZenMode(false)} markdown={markdown} />

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-gray-100 shadow-2xl">
        {/* Copy Button */}
        <motion.button
          whileHover={hasContent ? { scale: 1.02 } : undefined}
          whileTap={hasContent ? { scale: 0.98 } : undefined}
          onClick={handleCopy}
          disabled={!hasContent}
          className={`flex items-center gap-2 py-2.5 px-5 rounded-xl font-medium text-sm transition-all ${
            hasContent
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </motion.button>

        {/* Download Button with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <motion.button
            whileHover={hasContent && !isConverting ? { scale: 1.02 } : undefined}
            whileTap={hasContent && !isConverting ? { scale: 0.98 } : undefined}
            onClick={() => hasContent && !isConverting && setShowDropdown(!showDropdown)}
            disabled={!hasContent || isConverting}
            className={`flex items-center gap-2 py-2.5 px-5 rounded-xl font-medium text-sm transition-all ${
              hasContent && !isConverting
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isConverting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </>
            )}
          </motion.button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-0 mb-2 z-50 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden min-w-[200px]"
              >
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Export Format
                  </p>
                  {downloadOptions.map((option) => (
                    <motion.button
                      key={option.format}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleDownload(option.format)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all"
                    >
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${option.color} shadow-md`}>
                        <option.icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-gray-800 font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-gray-400">{option.sublabel}</p>
                      </div>
                      {selectedFormat === option.format && (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Zen Mode Button */}
        <motion.button
          whileHover={hasContent ? { scale: 1.02 } : undefined}
          whileTap={hasContent ? { scale: 0.98 } : undefined}
          onClick={() => hasContent && setIsZenMode(true)}
          disabled={!hasContent}
          className={`flex items-center gap-2 py-2.5 px-5 rounded-xl font-medium text-sm transition-all ${
            hasContent
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100'
              : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          <Maximize2 className="w-4 h-4" />
          <span>Zen</span>
        </motion.button>
      </div>
    </>
  );
};

export default DesktopActionButtons;
