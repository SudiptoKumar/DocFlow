import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#00C853]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onAnimationComplete={() => {
        setTimeout(onComplete, 1800);
      }}
    >
      {/* Centered Logo Circle */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 200, 
          damping: 20,
          delay: 0.1 
        }}
        className="relative"
      >
        {/* Outer glow effect */}
        <div className="absolute inset-0 w-44 h-44 rounded-full bg-gradient-to-br from-emerald-300/40 to-teal-400/30 blur-xl" />
        
        {/* Main circle with gradient */}
        <div className="relative w-44 h-44 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-black/20">
          {/* Inner subtle ring */}
          <div className="absolute inset-2 rounded-full border border-white/10" />
          
          {/* Book Icon */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <BookOpen className="w-20 h-20 text-white" strokeWidth={1.5} />
          </motion.div>
        </div>

        {/* Pulse animation ring */}
        <motion.div
          className="absolute inset-0 w-44 h-44 rounded-full border-2 border-white/30"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity, 
            ease: "easeOut" 
          }}
        />
      </motion.div>
    </motion.div>
  );
};

export default SplashScreen;
