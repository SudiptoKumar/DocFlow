import { useState, useEffect } from 'react';

const docflowFeatures = [
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
];

interface HeaderTypewriterProps {
  mode?: 'docflow' | 'duoflow';
}

const HeaderTypewriter = ({ mode = 'docflow' }: HeaderTypewriterProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Typewriter effect - always call useEffect, but only run logic for DocFlow mode
  useEffect(() => {
    // Skip typewriter logic if in DuoFlow mode
    if (mode === 'duoflow') return;

    const currentWord = docflowFeatures[currentIndex];
    const typeSpeed = isDeleting ? 40 : 80;
    const pauseTime = 1200;

    if (!isDeleting && displayText === currentWord) {
      const timeout = setTimeout(() => setIsDeleting(true), pauseTime);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % docflowFeatures.length);
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
  }, [displayText, isDeleting, currentIndex, mode]);

  // Static text for DuoFlow mode
  if (mode === 'duoflow') {
    return (
      <div className="text-xs text-emerald-500 font-medium h-4 w-[80px]">
        <span>Bilingual</span>
      </div>
    );
  }

  // Typewriter for DocFlow mode
  return (
    <div className="text-xs text-emerald-500 font-medium h-4 w-[80px]">
      <span>{displayText}</span>
      <span className="inline-block w-0.5 h-3 bg-emerald-500 ml-0.5 animate-[pulse_1s_ease-in-out_infinite]" />
    </div>
  );
};

export default HeaderTypewriter;
