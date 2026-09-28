import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import HeaderTypewriter from './HeaderTypewriter';
import ModeSwitch from './ModeSwitch';
import { useAppMode } from '@/contexts/AppModeContext';

const MobileHeader = () => {
  const { mode } = useAppMode();

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3"
      >
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
          mode === 'duoflow'
            ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/25'
            : 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/25'
        }`}>
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <motion.span 
            key={mode}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight"
          >
            {mode === 'duoflow' ? (
              <>Duo<span className="text-emerald-500">Flow</span></>
            ) : (
              <>Doc<span className="text-emerald-500">Flow</span></>
            )}
          </motion.span>
          <HeaderTypewriter mode={mode} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2"
      >
        <ModeSwitch />
      </motion.div>
    </header>
  );
};

export default MobileHeader;
