import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, Type, Clock, Save, Keyboard, History } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface StatusBarProps {
  markdown: string;
  lastSaved?: boolean;
  onOpenShortcuts?: () => void;
  onOpenHistory?: () => void;
}

const StatusBar = ({ markdown, lastSaved, onOpenShortcuts, onOpenHistory }: StatusBarProps) => {
  const wordCount = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
  const charCount = markdown.length;
  const lineCount = markdown.split('\n').length;
  const isMobile = useIsMobile();
  const [showSaved, setShowSaved] = useState(false);
  const saveCountRef = useRef(0);

  useEffect(() => {
    // lastSaved toggles on each save; detect any change
    saveCountRef.current++;
    if (saveCountRef.current > 1) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  const stats = [
    { icon: <Type className="w-3.5 h-3.5" />, label: 'Words', value: wordCount },
    { icon: <FileText className="w-3.5 h-3.5" />, label: 'Characters', value: charCount },
    { icon: <Clock className="w-3.5 h-3.5" />, label: 'Lines', value: lineCount },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="status-bar flex items-center gap-6 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800"
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-2 text-xs text-gray-400">
          {stat.icon}
          <span className="font-medium text-gray-700 dark:text-gray-300">{stat.value.toLocaleString()}</span>
          <span>{stat.label}</span>
        </div>
      ))}

      <div className="flex-1" />

      {showSaved && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1 text-xs text-emerald-500"
        >
          <Save className="w-3 h-3" />
          <span>Saved</span>
        </motion.div>
      )}

      {!isMobile && onOpenHistory && (
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Version History"
        >
          <History className="w-3.5 h-3.5" />
        </button>
      )}

      {!isMobile && onOpenShortcuts && (
        <button
          onClick={onOpenShortcuts}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Keyboard Shortcuts (Ctrl+/)"
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
};

export default StatusBar;
