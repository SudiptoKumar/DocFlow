import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Table, ArrowRight } from 'lucide-react';
import { rawDataToMarkdownTable, detectDelimiter, type Delimiter } from '@/lib/table-builder';

interface TableBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (markdown: string) => void;
}

const TableBuilderModal = ({ open, onClose, onInsert }: TableBuilderModalProps) => {
  const [rawData, setRawData] = useState('');
  const [preview, setPreview] = useState('');
  const [detectedDelimiter, setDetectedDelimiter] = useState<Delimiter>('comma');

  const handleDataChange = useCallback((text: string) => {
    setRawData(text);
    if (text.trim()) {
      const del = detectDelimiter(text);
      setDetectedDelimiter(del);
      try {
        setPreview(rawDataToMarkdownTable(text));
      } catch {
        setPreview('');
      }
    } else {
      setPreview('');
    }
  }, []);

  const handleInsert = () => {
    if (preview) {
      onInsert('\n' + preview + '\n');
      setRawData('');
      setPreview('');
      onClose();
    }
  };

  const delimiterLabels: Record<Delimiter, string> = {
    tab: 'Tab',
    comma: 'Comma',
    pipe: 'Pipe',
    spaces: 'Spaces',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Table Builder</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paste your data (CSV, TSV, or pipe-separated)
                </label>
                <textarea
                  value={rawData}
                  onChange={(e) => handleDataChange(e.target.value)}
                  placeholder={"Name, Age, City\nAlice, 25, New York\nBob, 30, London"}
                  className="w-full h-32 px-3 py-2 text-sm font-mono rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
                {rawData.trim() && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Detected delimiter: <span className="font-medium text-indigo-500">{delimiterLabels[detectedDelimiter]}</span>
                  </p>
                )}
              </div>

              {preview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</label>
                  <pre className="px-4 py-3 text-sm font-mono rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre">
                    {preview}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleInsert}
                disabled={!preview}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                Insert Table <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TableBuilderModal;
