import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import katex from 'katex';

interface EquationEditorModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
}

const categories = [
  {
    name: 'Greek',
    symbols: [
      { label: 'α', latex: '\\alpha' }, { label: 'β', latex: '\\beta' }, { label: 'γ', latex: '\\gamma' },
      { label: 'δ', latex: '\\delta' }, { label: 'ε', latex: '\\epsilon' }, { label: 'θ', latex: '\\theta' },
      { label: 'λ', latex: '\\lambda' }, { label: 'μ', latex: '\\mu' }, { label: 'π', latex: '\\pi' },
      { label: 'σ', latex: '\\sigma' }, { label: 'φ', latex: '\\phi' }, { label: 'ω', latex: '\\omega' },
      { label: 'Γ', latex: '\\Gamma' }, { label: 'Δ', latex: '\\Delta' }, { label: 'Θ', latex: '\\Theta' },
      { label: 'Λ', latex: '\\Lambda' }, { label: 'Π', latex: '\\Pi' }, { label: 'Σ', latex: '\\Sigma' },
      { label: 'Φ', latex: '\\Phi' }, { label: 'Ω', latex: '\\Omega' },
    ],
  },
  {
    name: 'Operators',
    symbols: [
      { label: '×', latex: '\\times' }, { label: '÷', latex: '\\div' }, { label: '±', latex: '\\pm' },
      { label: '·', latex: '\\cdot' }, { label: '∑', latex: '\\sum' }, { label: '∏', latex: '\\prod' },
      { label: '∫', latex: '\\int' }, { label: '∂', latex: '\\partial' }, { label: '∇', latex: '\\nabla' },
    ],
  },
  {
    name: 'Relations',
    symbols: [
      { label: '≠', latex: '\\neq' }, { label: '<', latex: '\\lt' }, { label: '>', latex: '\\gt' },
      { label: '≤', latex: '\\leq' }, { label: '≥', latex: '\\geq' }, { label: '≈', latex: '\\approx' },
      { label: '≡', latex: '\\equiv' }, { label: '⊂', latex: '\\subset' }, { label: '⊃', latex: '\\supset' },
      { label: '∈', latex: '\\in' }, { label: '∉', latex: '\\notin' },
    ],
  },
  {
    name: 'Arrows',
    symbols: [
      { label: '→', latex: '\\rightarrow' }, { label: '←', latex: '\\leftarrow' },
      { label: '⇒', latex: '\\Rightarrow' }, { label: '⇐', latex: '\\Leftarrow' },
      { label: '↔', latex: '\\leftrightarrow' }, { label: '⇔', latex: '\\Leftrightarrow' },
      { label: '↑', latex: '\\uparrow' }, { label: '↓', latex: '\\downarrow' },
    ],
  },
  {
    name: 'Structures',
    symbols: [
      { label: 'a/b', latex: '\\frac{a}{b}' }, { label: '√x', latex: '\\sqrt{x}' },
      { label: 'xⁿ', latex: 'x^{n}' }, { label: 'xᵢ', latex: 'x_{i}' },
      { label: '(n k)', latex: '\\binom{n}{k}' },
      { label: '2×2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
      { label: '3×3', latex: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}' },
      { label: 'cases', latex: '\\begin{cases} x & \\text{if } x > 0 \\\\ -x & \\text{otherwise} \\end{cases}' },
    ],
  },
  {
    name: 'Calculus',
    symbols: [
      { label: 'lim', latex: '\\lim_{x \\to \\infty}' },
      { label: '∞', latex: '\\infty' },
      { label: '∫ab', latex: '\\int_{a}^{b}' },
      { label: 'dx', latex: '\\,dx' }, { label: 'dy', latex: '\\,dy' },
      { label: '∑n', latex: '\\sum_{i=1}^{n}' },
    ],
  },
  {
    name: 'Accents',
    symbols: [
      { label: 'x̂', latex: '\\hat{x}' }, { label: 'x̄', latex: '\\bar{x}' },
      { label: 'x⃗', latex: '\\vec{x}' }, { label: 'ẋ', latex: '\\dot{x}' },
      { label: 'x̃', latex: '\\tilde{x}' },
    ],
  },
];

const EquationEditorModal = ({ open, onClose, onInsert }: EquationEditorModalProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [formula, setFormula] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  // Render KaTeX preview
  useEffect(() => {
    if (!previewRef.current) return;
    if (!formula.trim()) {
      previewRef.current.innerHTML = '<span class="text-gray-400 text-sm">Your equation will appear here...</span>';
      return;
    }
    try {
      katex.render(formula, previewRef.current, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      previewRef.current.innerHTML = '<span class="text-red-400 text-sm">Invalid LaTeX</span>';
    }
  }, [formula]);

  const addToFormula = (latex: string) => {
    setFormula(prev => prev + latex);
  };

  const handleInsertInline = () => {
    if (formula.trim()) {
      onInsert(`$${formula}$`);
      setFormula('');
      onClose();
    }
  };

  const handleInsertBlock = () => {
    if (formula.trim()) {
      onInsert(`$$\n${formula}\n$$`);
      setFormula('');
      onClose();
    }
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
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Equation Editor</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 px-4 pt-3 overflow-x-auto scrollbar-hide">
              {categories.map((cat, i) => (
                <button
                  key={cat.name}
                  onClick={() => setActiveTab(i)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === i
                      ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Symbol grid */}
            <div className="px-4 py-3 min-h-[120px]">
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {categories[activeTab].symbols.map((sym, i) => (
                  <button
                    key={i}
                    onClick={() => addToFormula(sym.latex)}
                    className="flex items-center justify-center p-2.5 text-base rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-300 dark:hover:border-rose-700 transition-colors text-gray-800 dark:text-gray-200"
                    title={sym.latex}
                  >
                    {sym.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Formula input */}
            <div className="px-4 pb-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">LaTeX Formula</label>
              <input
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="Type or click symbols above..."
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-300"
              />
            </div>

            {/* KaTeX preview */}
            <div className="mx-4 mb-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-h-[60px] flex items-center justify-center overflow-x-auto">
              <div ref={previewRef} />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleInsertInline}
                disabled={!formula.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Inline $...$
              </button>
              <button
                onClick={handleInsertBlock}
                disabled={!formula.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Block $$...$$
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EquationEditorModal;
