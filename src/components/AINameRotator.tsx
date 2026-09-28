import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const aiNames = [
  { name: 'ChatGPT', color: '#10a37f' },
  { name: 'Gemini', color: '#4285f4' },
  { name: 'Claude', color: '#d97706' },
  { name: 'DeepSeek', color: '#6366f1' },
  { name: 'Grok', color: '#000000' },
  { name: 'Copilot', color: '#0078d4' },
  { name: 'Perplexity', color: '#20b2aa' },
];

const AINameRotator = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % aiNames.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <div ref={containerRef} className="flex items-center justify-center gap-1.5 md:gap-2 flex-nowrap whitespace-nowrap">
      <span className="text-sm md:text-base font-medium text-muted-foreground">Convert</span>
      <div className="relative h-12 md:h-16 w-[140px] md:w-[180px] overflow-hidden flex-shrink-0">
        <AnimatePresence mode="wait">
          <motion.span
            key={currentIndex}
            initial={{ y: 40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center font-bold text-2xl md:text-4xl"
            style={{ color: aiNames[currentIndex].color }}
          >
            {aiNames[currentIndex].name}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-sm md:text-base font-medium text-muted-foreground">to Docs</span>
    </div>
  );
};

export default AINameRotator;
