import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const duoflowFeatures = [
  'How It Works',
  'Upload & Mix',
  'Interwoven',
  'Side by Side',
  'PDF & Word',
  'Study Notes',
];

const DuoFlowTypewriter = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = duoflowFeatures[currentIndex];
    const typeSpeed = isDeleting ? 40 : 80;
    const pauseTime = 1200;

    if (!isDeleting && displayText === currentWord) {
      const timeout = setTimeout(() => setIsDeleting(true), pauseTime);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % duoflowFeatures.length);
      return;
    }

    const timeout = setTimeout(() => {
      if (isDeleting) {
        setDisplayText(currentWord.substring(0, displayText.length - 1));
      } else {
        setDisplayText(currentWord.substring(0, displayText.length + 1));
      }
    }, typeSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentIndex]);

  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground">
      <motion.span
        className="font-medium text-emerald-500 min-w-[120px] text-center"
        key={currentIndex}
      >
        {displayText}
        <motion.span
          className="inline-block w-0.5 h-4 bg-emerald-500 ml-0.5 align-middle"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        />
      </motion.span>
    </div>
  );
};

export default DuoFlowTypewriter;
