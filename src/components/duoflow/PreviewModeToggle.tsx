import { motion } from 'framer-motion';
import { Rows, Columns } from 'lucide-react';
import { PreviewMode } from '@/contexts/AppModeContext';

interface PreviewModeToggleProps {
  mode: PreviewMode;
  onChange: (mode: PreviewMode) => void;
}

const PreviewModeToggle = ({ mode, onChange }: PreviewModeToggleProps) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onChange('interwoven')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          mode === 'interwoven'
            ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <Rows className="w-3.5 h-3.5" />
        Interwoven
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onChange('side-by-side')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          mode === 'side-by-side'
            ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <Columns className="w-3.5 h-3.5" />
        Side-by-Side
      </motion.button>
    </div>
  );
};

export default PreviewModeToggle;
