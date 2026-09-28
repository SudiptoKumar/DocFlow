import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const features = [
  'DOCX Math',
  'OCR Scan',
  'Mind Map',
  'Zen Mode',
  'Diff View',
  'PDF Export',
  'LaTeX Math',
  'Dark Mode',
  'Live Preview',
  'Code Blocks',
  'File Upload',
];

const TypewriterRotator = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = features[currentIndex];
    const typeSpeed = isDeleting ? 50 : 100;
    const pauseTime = 1500;

    if (!isDeleting && displayText === currentWord) {
      // Finished typing, pause then start deleting
      const timeout = setTimeout(() => setIsDeleting(true), pauseTime);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayText === '') {
      // Finished deleting, move to next word
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % features.length);
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
    <div className="flex items-center justify-center gap-2 text-xl text-muted-foreground">
      <span>Study & Convert</span>
      <div className="relative inline-flex items-center">
        <motion.span
          className="font-bold text-primary min-w-[140px] text-left"
          key={currentIndex}
        >
          {displayText}
          <motion.span
            className="inline-block w-0.5 h-5 bg-primary ml-0.5 align-middle"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          />
        </motion.span>
      </div>
    </div>
  );
};

export default TypewriterRotator;
