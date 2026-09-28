import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clipboard, Check, BookOpen } from 'lucide-react';

interface PasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (content: string) => void;
}

const aiTools = ['ChatGPT', 'Gemini', 'Claude', 'DeepSeek', 'Grok', 'Copilot', 'Perplexity'];
const toolColors = ['bg-emerald-100 text-emerald-600', 'bg-blue-100 text-blue-600', 'bg-orange-100 text-orange-600', 'bg-purple-100 text-purple-600', 'bg-rose-100 text-rose-600', 'bg-teal-100 text-teal-600', 'bg-pink-100 text-pink-600'];

const PasteModal = ({ isOpen, onClose, onInsert }: PasteModalProps) => {
  const [content, setContent] = useState('');
  const [isPasted, setIsPasted] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
      setIsPasted(true);
      setTimeout(() => setIsPasted(false), 2000);
    } catch {
      // Clipboard access denied
    }
  };

  const handleInsert = async () => {
    if (content.trim()) {
      const { formatMarkdown } = await import('@/lib/markdown-formatter');
      const { formatted } = formatMarkdown(content);
      onInsert(formatted);
      setContent('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-gray-100 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">
                  Paste AI Content
                </h2>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </motion.button>
            </div>

            {/* AI Tools Pills */}
            <div className="px-5 pt-4">
              <div className="flex flex-wrap gap-2">
                {aiTools.map((tool, index) => (
                  <span
                    key={tool}
                    className={`px-3 py-1 text-xs font-medium rounded-full ${toolColors[index]}`}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-5">
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your markdown content here..."
                  className="w-full h-48 p-4 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-emerald-300 focus:bg-white focus:ring-0 outline-none resize-none text-gray-700 placeholder:text-gray-400 transition-all font-mono text-sm"
                />
                
                {/* Paste Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePaste}
                  className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-all text-sm font-medium shadow-sm"
                >
                  {isPasted ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-500">Pasted!</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Paste</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 pb-5 safe-bottom">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-all"
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleInsert}
                disabled={!content.trim()}
                className={`flex-1 py-3.5 rounded-2xl font-semibold transition-all ${
                  content.trim()
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                Insert Content
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PasteModal;
