import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Type, Highlighter } from 'lucide-react';

interface ColorPickerButtonProps {
  contentRef: React.RefObject<HTMLDivElement>;
  onContentChange: () => void;
  mobileStyle?: boolean;
}

const TEXT_COLORS = [
  { color: '#000000', label: 'Black' },
  { color: '#dc2626', label: 'Red' },
  { color: '#ea580c', label: 'Orange' },
  { color: '#ca8a04', label: 'Yellow' },
  { color: '#16a34a', label: 'Green' },
  { color: '#2563eb', label: 'Blue' },
  { color: '#7c3aed', label: 'Purple' },
  { color: '#db2777', label: 'Pink' },
  { color: '#64748b', label: 'Gray' },
  { color: '#ffffff', label: 'White' },
];

const HIGHLIGHT_COLORS = [
  { color: 'transparent', label: 'None' },
  { color: '#fef08a', label: 'Yellow' },
  { color: '#bbf7d0', label: 'Green' },
  { color: '#bfdbfe', label: 'Blue' },
  { color: '#fbcfe8', label: 'Pink' },
  { color: '#fed7aa', label: 'Orange' },
  { color: '#e9d5ff', label: 'Purple' },
  { color: '#fecaca', label: 'Red' },
  { color: '#e2e8f0', label: 'Gray' },
];

const ColorPickerButton = ({ contentRef, onContentChange, mobileStyle = false }: ColorPickerButtonProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'highlight'>('text');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  const applyTextColor = (color: string) => {
    contentRef.current?.focus();
    document.execCommand('foreColor', false, color);
    setTimeout(onContentChange, 0);
    setShowPicker(false);
  };

  const applyHighlight = (color: string) => {
    contentRef.current?.focus();
    if (color === 'transparent') {
      document.execCommand('removeFormat', false);
    } else {
      document.execCommand('hiliteColor', false, color);
    }
    setTimeout(onContentChange, 0);
    setShowPicker(false);
  };

  const buttonClass = mobileStyle
    ? 'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-pink-500 active:scale-95 transition-transform'
    : 'h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground flex-shrink-0 text-pink-500';

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className={buttonClass}
        title="Color"
      >
        <Palette className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 ${mobileStyle ? 'top-full left-0' : 'top-full left-1/2 -translate-x-1/2'} mt-2 w-52 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden`}
          >
            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('text')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'text'
                    ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50/50 dark:bg-pink-900/20'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                Text Color
              </button>
              <button
                onClick={() => setActiveTab('highlight')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'highlight'
                    ? 'text-yellow-600 border-b-2 border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/20'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Highlighter className="w-3.5 h-3.5" />
                Highlight
              </button>
            </div>

            {/* Color grid */}
            <div className="p-3">
              <div className="grid grid-cols-5 gap-2">
                {(activeTab === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS).map((item) => (
                  <button
                    key={item.color}
                    onClick={() =>
                      activeTab === 'text'
                        ? applyTextColor(item.color)
                        : applyHighlight(item.color)
                    }
                    className="group relative w-8 h-8 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 transition-all hover:scale-110 active:scale-95"
                    style={{ backgroundColor: item.color === 'transparent' ? undefined : item.color }}
                    title={item.label}
                  >
                    {item.color === 'transparent' && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">✕</span>
                    )}
                    {item.color === '#ffffff' && (
                      <span className="absolute inset-0 rounded-lg border border-gray-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ColorPickerButton;
