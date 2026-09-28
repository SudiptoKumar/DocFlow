import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sigma, ChevronDown } from 'lucide-react';
import EquationEditorModal from './EquationEditorModal';
import { hapticFormat } from '@/lib/haptics';

interface LaTeXToolbarProps {
  onInsert: (latex: string) => void;
  className?: string;
}

// LaTeX math templates
const mathItems = [
  { label: 'Fraction', action: '$\\frac{a}{b}$', preview: 'a/b' },
  { label: 'Square Root', action: '$\\sqrt{x}$', preview: '√x' },
  { label: 'Power', action: '$x^{n}$', preview: 'xⁿ' },
  { label: 'Subscript', action: '$x_{i}$', preview: 'xᵢ' },
  { label: 'Sum', action: '$\\sum_{i=1}^{n} x_i$', preview: 'Σ' },
  { label: 'Integral', action: '$\\int_{a}^{b} f(x) dx$', preview: '∫' },
  { label: 'Limit', action: '$\\lim_{x \\to \\infty}$', preview: 'lim' },
  { label: 'Pi', action: '$\\pi$', preview: 'π' },
  { label: 'Alpha', action: '$\\alpha$', preview: 'α' },
  { label: 'Beta', action: '$\\beta$', preview: 'β' },
  { label: 'Theta', action: '$\\theta$', preview: 'θ' },
  { label: 'Delta', action: '$\\Delta$', preview: 'Δ' },
  { label: 'Infinity', action: '$\\infty$', preview: '∞' },
  { label: 'Not Equal', action: '$\\neq$', preview: '≠' },
  { label: 'Less/Equal', action: '$\\leq$', preview: '≤' },
  { label: 'Greater/Equal', action: '$\\geq$', preview: '≥' },
  { label: 'Display Math', action: '$$\n\\frac{d}{dx} f(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}\n$$', preview: '⌸' },
];

const LaTeXToolbar = ({ onInsert, className = '' }: LaTeXToolbarProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEquationEditor, setShowEquationEditor] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInsert = (action: string) => {
    hapticFormat();
    onInsert(action);
    setShowMenu(false);
  };

  return (
    <>
      <div className={`relative ${className}`} ref={menuRef}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          onClick={() => setShowMenu(!showMenu)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 transition-all shadow-sm hover:shadow-md ${showMenu ? 'ring-2 ring-rose-300 dark:ring-rose-700' : ''}`}
          title="Insert Math Formula"
        >
          <Sigma className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">Math</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
        </motion.button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 z-50 w-52 max-h-72 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700"
            >
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1.5 mb-1 uppercase tracking-wider">LaTeX Templates</div>
                {mathItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleInsert(item.action)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                  >
                    <span className="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">{item.label}</span>
                    <span className="text-lg text-rose-500 font-medium">{item.preview}</span>
                  </button>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                  <button
                    onClick={() => { setShowMenu(false); setShowEquationEditor(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors text-rose-600 dark:text-rose-400 font-medium"
                  >
                    Advanced Editor →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <EquationEditorModal
        open={showEquationEditor}
        onClose={() => setShowEquationEditor(false)}
        onInsert={(latex) => { onInsert(latex); setShowEquationEditor(false); }}
      />
    </>
  );
};

export default LaTeXToolbar;