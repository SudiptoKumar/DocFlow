import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronUp, ChevronDown, Replace, ReplaceAll, Regex, CaseSensitive } from 'lucide-react';
import { EditorView } from '@codemirror/view';

interface FindReplaceBarProps {
  view: EditorView | null;
  open: boolean;
  onClose: () => void;
}

interface MatchInfo {
  from: number;
  to: number;
}

const FindReplaceBar = ({ view, open, onClose }: FindReplaceBarProps) => {
  const [search, setSearch] = useState('');
  const [replace, setReplace] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [currentMatch, setCurrentMatch] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const findMatches = useCallback(() => {
    if (!view || !search) {
      setMatches([]);
      setCurrentMatch(-1);
      return;
    }

    const doc = view.state.doc.toString();
    const found: MatchInfo[] = [];

    try {
      if (useRegex) {
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(search, flags);
        let match: RegExpExecArray | null;
        while ((match = regex.exec(doc)) !== null) {
          if (match[0].length === 0) break; // prevent infinite loop on zero-width matches
          found.push({ from: match.index, to: match.index + match[0].length });
        }
      } else {
        const searchStr = caseSensitive ? search : search.toLowerCase();
        const docStr = caseSensitive ? doc : doc.toLowerCase();
        let pos = 0;
        while (pos < docStr.length) {
          const idx = docStr.indexOf(searchStr, pos);
          if (idx === -1) break;
          found.push({ from: idx, to: idx + search.length });
          pos = idx + 1;
        }
      }
    } catch {
      // Invalid regex
    }

    setMatches(found);
    setCurrentMatch(found.length > 0 ? 0 : -1);

    // Highlight first match
    if (found.length > 0 && view) {
      view.dispatch({
        selection: { anchor: found[0].from, head: found[0].to },
        scrollIntoView: true,
      });
    }
  }, [view, search, useRegex, caseSensitive]);

  useEffect(() => {
    findMatches();
  }, [findMatches]);

  const goToMatch = (index: number) => {
    if (!view || matches.length === 0) return;
    const i = ((index % matches.length) + matches.length) % matches.length;
    setCurrentMatch(i);
    const m = matches[i];
    view.dispatch({
      selection: { anchor: m.from, head: m.to },
      scrollIntoView: true,
    });
    view.focus();
  };

  const handleReplace = () => {
    if (!view || currentMatch < 0 || matches.length === 0) return;
    const m = matches[currentMatch];
    view.dispatch({
      changes: { from: m.from, to: m.to, insert: replace },
    });
    // Re-find after replace
    setTimeout(findMatches, 10);
  };

  const handleReplaceAll = () => {
    if (!view || matches.length === 0) return;
    // Apply replacements from end to start to preserve positions
    const sorted = [...matches].sort((a, b) => b.from - a.from);
    const changes = sorted.map(m => ({ from: m.from, to: m.to, insert: replace }));
    view.dispatch({ changes });
    setTimeout(findMatches, 10);
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-3 py-2"
    >
      <div className="flex flex-col gap-2">
        {/* Search row */}
        <div className="flex items-center gap-2">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') goToMatch(currentMatch + 1);
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Find..."
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={`p-1.5 rounded-lg border transition-colors ${useRegex ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-600' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            title="Use Regular Expression"
          >
            <Regex className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`p-1.5 rounded-lg border transition-colors ${caseSensitive ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-600' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            title="Case Sensitive"
          >
            <CaseSensitive className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px] text-center">
            {matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : 'No results'}
          </span>
          <button onClick={() => goToMatch(currentMatch - 1)} disabled={matches.length === 0} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors" title="Previous">
            <ChevronUp className="w-4 h-4" />
          </button>
          <button onClick={() => goToMatch(currentMatch + 1)} disabled={matches.length === 0} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors" title="Next">
            <ChevronDown className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Replace row */}
        <div className="flex items-center gap-2">
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleReplace();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Replace..."
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <button onClick={handleReplace} disabled={matches.length === 0} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors" title="Replace">
            <Replace className="w-3.5 h-3.5" /> Replace
          </button>
          <button onClick={handleReplaceAll} disabled={matches.length === 0} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors" title="Replace All">
            <ReplaceAll className="w-3.5 h-3.5" /> All
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default FindReplaceBar;
