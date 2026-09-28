import { useState, useCallback, useRef, useEffect, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Square, Pause, Play } from 'lucide-react';
import { markdownToSpeechText } from '@/lib/markdown-to-ssml';
import { toast } from 'sonner';

interface ReadAloudButtonProps {
  markdown: string;
  previewContainer?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  className?: string;
  compact?: boolean;
}

const ReadAloudButton = forwardRef<HTMLDivElement, ReadAloudButtonProps>(({ markdown, previewContainer, className = '', compact = false }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sentencesRef = useRef<string[]>([]);
  const currentIndexRef = useRef(0);
  const resumeTimerRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      clearHighlights();
      if (resumeTimerRef.current) clearInterval(resumeTimerRef.current);
    };
  }, []);

  // Chrome workaround: Chrome pauses speech after ~15s, so we periodically resume
  const startChromeWorkaround = useCallback(() => {
    if (resumeTimerRef.current) clearInterval(resumeTimerRef.current);
    resumeTimerRef.current = window.setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }, []);

  const stopChromeWorkaround = useCallback(() => {
    if (resumeTimerRef.current) {
      clearInterval(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const resolveContainer = useCallback((): HTMLElement | null => {
    if (!previewContainer) return null;
    if (typeof previewContainer === 'object' && 'current' in previewContainer) {
      return previewContainer.current;
    }
    return previewContainer as HTMLElement;
  }, [previewContainer]);

  const clearHighlights = useCallback(() => {
    const container = resolveContainer();
    if (container) {
      container.querySelectorAll('.reading-highlight').forEach(el => {
        el.classList.remove('reading-highlight');
      });
    }
  }, [resolveContainer]);

  const highlightSentence = useCallback((sentenceIndex: number) => {
    const container = resolveContainer();
    if (!container) return;
    clearHighlights();

    const sentence = sentencesRef.current[sentenceIndex];
    if (!sentence) return;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      if (node.textContent && node.textContent.includes(sentence.trim().substring(0, 30))) {
        const parent = node.parentElement;
        if (parent) {
          parent.classList.add('reading-highlight');
          parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
    }
  }, [resolveContainer, clearHighlights]);

  const splitIntoSentences = (text: string): string[] => {
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0);
  };

  const getVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;
    // Prefer an English voice
    const english = voices.find(v => v.lang.startsWith('en') && v.localService);
    return english || voices.find(v => v.lang.startsWith('en')) || voices[0];
  };

  const startSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    clearHighlights();

    const speechText = markdownToSpeechText(markdown);
    const sentences = splitIntoSentences(speechText);
    sentencesRef.current = sentences;
    currentIndexRef.current = 0;

    if (sentences.length === 0) {
      toast.error('No readable content found');
      return;
    }

    const voice = getVoice();

    const speakSentence = (index: number) => {
      if (index >= sentences.length) {
        setIsPlaying(false);
        setIsPaused(false);
        clearHighlights();
        stopChromeWorkaround();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(sentences[index]);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        currentIndexRef.current = index;
        highlightSentence(index);
      };

      utterance.onend = () => {
        speakSentence(index + 1);
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('Speech error:', e.error);
        }
        setIsPlaying(false);
        setIsPaused(false);
        clearHighlights();
        stopChromeWorkaround();
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    setIsPlaying(true);
    setIsPaused(false);
    startChromeWorkaround();
    speakSentence(0);
  }, [markdown, clearHighlights, highlightSentence, startChromeWorkaround, stopChromeWorkaround]);

  const handlePlay = useCallback(() => {
    if (!markdown.trim()) {
      toast.error('No content to read');
      return;
    }

    if (!window.speechSynthesis) {
      toast.error('Speech synthesis not supported in this browser');
      return;
    }

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      startChromeWorkaround();
      return;
    }

    // Ensure voices are loaded before speaking
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Voices not loaded yet - wait for them
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        startSpeaking();
      };
      // Fallback: start anyway after 500ms
      setTimeout(() => {
        if (!isPlaying) startSpeaking();
      }, 500);
    } else {
      startSpeaking();
    }
  }, [markdown, isPaused, isPlaying, startSpeaking, startChromeWorkaround]);

  const handlePause = useCallback(() => {
    window.speechSynthesis.pause();
    setIsPaused(true);
    stopChromeWorkaround();
  }, [stopChromeWorkaround]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    clearHighlights();
    stopChromeWorkaround();
  }, [clearHighlights, stopChromeWorkaround]);

  if (compact) {
    return (
      <div ref={ref} className={`flex items-center gap-1 ${className}`}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={isPlaying ? (isPaused ? handlePlay : handlePause) : handlePlay}
          className={`p-2 rounded-xl transition-all ${
            isPlaying
              ? 'bg-blue-100 text-blue-600'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
          title={isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Read Aloud'}
        >
          {isPlaying ? (isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />) : <Volume2 className="w-4 h-4" />}
        </motion.button>
        {isPlaying && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStop}
            className="p-2 rounded-xl bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={`flex items-center gap-1 ${className}`}>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={isPlaying ? (isPaused ? handlePlay : handlePause) : handlePlay}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isPlaying
            ? 'bg-blue-100 text-blue-600'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {isPlaying ? (
          isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
        <span>{isPlaying ? (isPaused ? 'Resume' : 'Pause') : 'Read Aloud'}</span>
      </motion.button>
      {isPlaying && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStop}
          className="p-1.5 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
          title="Stop"
        >
          <Square className="w-3.5 h-3.5" />
        </motion.button>
      )}
    </div>
  );
});

ReadAloudButton.displayName = 'ReadAloudButton';

export default ReadAloudButton;
