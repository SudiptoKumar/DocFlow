import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Minimize2, Sun, Moon, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { parseMarkdownToHtml } from '@/lib/markdown-converter';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

interface ZenModeOverlayProps {
  isActive: boolean;
  onExit: () => void;
  markdown: string;
}

const ZenModeOverlay = ({ isActive, onExit, markdown }: ZenModeOverlayProps) => {
  const [showControls, setShowControls] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const html = useMemo(() => parseMarkdownToHtml(markdown), [markdown]);

  // Highlight code blocks
  useEffect(() => {
    if (isActive && contentRef.current) {
      contentRef.current.querySelectorAll('pre code').forEach((block) => {
        if (!(block as HTMLElement).dataset.highlighted) {
          hljs.highlightElement(block as HTMLElement);
        }
      });
    }
  }, [isActive, html]);

  // Wake lock
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.log('Wake Lock failed:', err);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      requestWakeLock();
      setShowControls(true);
      setIsLandscape(false);
      setSearchOpen(false);
      setSearchTerm('');
    } else {
      releaseWakeLock();
    }
  }, [isActive, requestWakeLock, releaseWakeLock]);

  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const handler = async () => {
      if (isActive && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [isActive, requestWakeLock]);

  // Auto-hide controls
  useEffect(() => {
    if (!isActive || searchOpen) return;

    const resetTimer = () => {
      setShowControls(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    resetTimer();
    const handler = () => resetTimer();
    document.addEventListener('touchstart', handler);
    document.addEventListener('mousemove', handler);

    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousemove', handler);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [isActive, searchOpen]);

  // Rotation toggle
  const toggleRotation = useCallback(() => {
    setIsLandscape(prev => !prev);
  }, []);

  const handleExit = useCallback(() => {
    releaseWakeLock();
    setIsLandscape(false);
    setSearchOpen(false);
    setSearchTerm('');
    if (contentRef.current) {
      const marks = contentRef.current.querySelectorAll('mark.zen-highlight');
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
          parent.normalize();
        }
      });
    }
    onExit();
  }, [onExit, releaseWakeLock]);

  // --- Search logic ---
  const clearHighlights = useCallback(() => {
    if (!contentRef.current) return;
    const marks = contentRef.current.querySelectorAll('mark.zen-highlight');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
    setTotalMatches(0);
    setCurrentMatch(0);
  }, []);

  // ESC to exit + Ctrl+F to search
  const handleExitRef = useRef(handleExit);
  handleExitRef.current = handleExit;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isActive) return;
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
          setSearchTerm('');
          clearHighlights();
        } else {
          handleExitRef.current();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isActive, searchOpen, clearHighlights]);


  const applyHighlights = useCallback((term: string) => {
    clearHighlights();
    if (!contentRef.current || !term.trim()) return;

    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    let matchCount = 0;
    const lowerTerm = term.toLowerCase();

    textNodes.forEach((textNode) => {
      const text = textNode.textContent || '';
      const lowerText = text.toLowerCase();
      if (!lowerText.includes(lowerTerm)) return;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      let idx = lowerText.indexOf(lowerTerm, lastIndex);
      while (idx !== -1) {
        if (idx > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
        }
        const mark = document.createElement('mark');
        mark.className = `zen-highlight ${matchCount === 0 ? 'zen-highlight-current' : ''}`;
        mark.textContent = text.slice(idx, idx + term.length);
        mark.dataset.matchIndex = String(matchCount);
        fragment.appendChild(mark);
        matchCount++;
        lastIndex = idx + term.length;
        idx = lowerText.indexOf(lowerTerm, lastIndex);
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    });

    setTotalMatches(matchCount);
    setCurrentMatch(matchCount > 0 ? 1 : 0);

    // Scroll to first match
    if (matchCount > 0) {
      const first = contentRef.current.querySelector('.zen-highlight-current');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [clearHighlights]);

  useEffect(() => {
    if (isActive && searchOpen) {
      const debounce = setTimeout(() => applyHighlights(searchTerm), 200);
      return () => clearTimeout(debounce);
    }
  }, [searchTerm, isActive, searchOpen, applyHighlights]);

  const navigateMatch = useCallback((direction: 'next' | 'prev') => {
    if (totalMatches === 0 || !contentRef.current) return;

    const marks = contentRef.current.querySelectorAll('mark.zen-highlight');
    marks.forEach(m => m.classList.remove('zen-highlight-current'));

    let newIndex = direction === 'next' ? currentMatch : currentMatch - 2;
    if (newIndex >= totalMatches) newIndex = 0;
    if (newIndex < 0) newIndex = totalMatches - 1;

    marks[newIndex]?.classList.add('zen-highlight-current');
    marks[newIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setCurrentMatch(newIndex + 1);
  }, [currentMatch, totalMatches]);

  if (!isActive) return null;

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const themeClasses = 'bg-background text-foreground';

  const rotationStyle = isLandscape
    ? {
        transform: 'rotate(90deg)',
        transformOrigin: 'center center',
        width: '100vh',
        height: '100vw',
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        marginTop: '-50vw',
        marginLeft: '-50vh',
      }
    : {};

  return (
    <div className={`fixed inset-0 z-[9998] ${themeClasses} overflow-hidden`}>
      {/* Inner wrapper for rotation */}
      <div
        ref={wrapperRef}
        style={rotationStyle}
        className="w-full h-full flex flex-col"
      >
        {/* Search Bar - pinned to top with high z-index */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="relative z-[9999] flex items-center gap-2 px-4 py-2 border-b shrink-0 bg-muted border-border"
            >
              <Search className="w-4 h-4 shrink-0 opacity-50" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigateMatch(e.shiftKey ? 'prev' : 'next');
                }}
                placeholder="Find in document..."
                className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              {searchTerm && (
                <span className="text-xs shrink-0 text-muted-foreground">
                  {totalMatches > 0 ? `${currentMatch} of ${totalMatches}` : 'No matches'}
                </span>
              )}
              <button onClick={() => navigateMatch('prev')} className="p-1 rounded hover:bg-black/10">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={() => navigateMatch('next')} className="p-1 rounded hover:bg-black/10">
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setSearchTerm('');
                  clearHighlights();
                }}
                className="p-1 rounded hover:bg-black/10"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Read-only justified content */}
        <div className="flex-1 overflow-auto">
          <div
            ref={contentRef}
            className="markdown-preview p-6 min-h-full"
            style={{
              textAlign: 'justify',
              fontFamily: "'Plus Jakarta Sans', 'SolaimanLipi', sans-serif",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        {/* Floating Controls */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 z-[9999] flex gap-2"
            >
              {/* Rotation */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleRotation}
                className={`p-3 rounded-full shadow-lg backdrop-blur-sm transition-colors ${
                  isLandscape
                    ? 'bg-emerald-500 text-white'
                    : 'bg-black/70 text-white hover:bg-black/80'
                }`}
                title={isLandscape ? 'Portrait Mode' : 'Landscape Mode'}
              >
                <RotateCcw className={`w-5 h-5 transition-transform ${isLandscape ? 'rotate-90' : ''}`} />
              </motion.button>

              {/* Theme */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className={`p-3 rounded-full shadow-lg backdrop-blur-sm transition-colors ${
                  isDark
                    ? 'bg-yellow-500 text-white'
                    : 'bg-black/70 text-white hover:bg-black/80'
                }`}
                title={isDark ? 'Light Mode' : 'Dark Mode'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </motion.button>

              {/* Search */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (!searchOpen) {
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  } else {
                    setSearchTerm('');
                    clearHighlights();
                  }
                }}
                className={`p-3 rounded-full shadow-lg backdrop-blur-sm transition-colors ${
                  searchOpen
                    ? 'bg-emerald-500 text-white'
                    : 'bg-black/70 text-white hover:bg-black/80'
                }`}
                title="Search"
              >
                <Search className="w-5 h-5" />
              </motion.button>

              {/* Exit */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleExit}
                className="p-3 rounded-full bg-red-500/80 text-white shadow-lg backdrop-blur-sm hover:bg-red-600/80 transition-colors"
                title="Exit Zen Mode"
              >
                <Minimize2 className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search highlight styles */}
      <style>{`
        mark.zen-highlight {
          background-color: #fbbf24;
          color: inherit;
          padding: 1px 2px;
          border-radius: 2px;
        }
        mark.zen-highlight-current {
          background-color: #f97316;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default ZenModeOverlay;
