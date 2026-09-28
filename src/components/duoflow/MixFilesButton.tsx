import { motion } from 'framer-motion';
import { Shuffle } from 'lucide-react';

interface MixFilesButtonProps {
  onMix: () => void;
  disabled: boolean;
  isProcessing?: boolean;
}

const MixFilesButton = ({ onMix, disabled, isProcessing = false }: MixFilesButtonProps) => {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={onMix}
      disabled={disabled}
      className={`w-full py-3 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
        disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30'
      }`}
    >
      {isProcessing ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <Shuffle className="w-4 h-4" />
      )}
      <span>{isProcessing ? 'Mixing...' : 'Mix Files'}</span>
    </motion.button>
  );
};

export default MixFilesButton;
