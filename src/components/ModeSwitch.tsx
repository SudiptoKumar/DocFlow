import { motion } from 'framer-motion';
import { ArrowLeftRight } from 'lucide-react';
import { useAppMode } from '@/contexts/AppModeContext';

const ModeSwitch = () => {
  const { mode, toggleMode } = useAppMode();
  const isDuoFlow = mode === 'duoflow';

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={toggleMode}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-full border transition-all duration-300 ${
        isDuoFlow
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 shadow-lg shadow-emerald-500/25'
          : 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-200 dark:from-indigo-900 dark:to-purple-900 dark:border-indigo-700'
      }`}
    >
      {/* Toggle Track */}
      <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
        isDuoFlow ? 'bg-white/20' : 'bg-gray-300 dark:bg-gray-600'
      }`}>
        {/* Toggle Thumb */}
        <motion.div
          initial={false}
          animate={{
            x: isDuoFlow ? 20 : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-md flex items-center justify-center ${
            isDuoFlow ? 'bg-white' : 'bg-white dark:bg-gray-200'
          }`}
        >
          <motion.div
            initial={false}
            animate={{ rotate: isDuoFlow ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            <ArrowLeftRight className={`w-2.5 h-2.5 ${
              isDuoFlow ? 'text-emerald-500' : 'text-gray-500 dark:text-indigo-400'
            }`} />
          </motion.div>
        </motion.div>
      </div>
    </motion.button>
  );
};

export default ModeSwitch;
