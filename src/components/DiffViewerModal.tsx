import { useState, useEffect, lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Trash2 } from 'lucide-react';

const ReactDiffViewer = lazy(() => import('react-diff-viewer-continued'));

interface Version {
  timestamp: number;
  content: string;
  label: string;
}

interface DiffViewerModalProps {
  open: boolean;
  onClose: () => void;
  currentContent: string;
}

const STORAGE_KEY = 'docflow-versions';
const MAX_VERSIONS = 10;

export function saveVersion(content: string): void {
  if (!content.trim()) return;
  
  const versions: Version[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const now = Date.now();
  
  // Don't save if content is identical to last version
  if (versions.length > 0 && versions[0].content === content) return;

  const date = new Date(now);
  const label = date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true,
  });

  versions.unshift({ timestamp: now, content, label });
  
  // Keep only the most recent MAX_VERSIONS
  if (versions.length > MAX_VERSIONS) {
    versions.length = MAX_VERSIONS;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
}

const DiffViewerModal = ({ open, onClose, currentContent }: DiffViewerModalProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) {
      const stored: Version[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setVersions(stored);
      setSelectedIdx(0);
    }
  }, [open]);

  const handleDelete = (idx: number) => {
    const updated = versions.filter((_, i) => i !== idx);
    setVersions(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (selectedIdx >= updated.length) {
      setSelectedIdx(Math.max(0, updated.length - 1));
    }
  };

  const selectedVersion = versions[selectedIdx];

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-500" />
            Version History
          </DialogTitle>
        </DialogHeader>

        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No saved versions yet</p>
            <p className="text-gray-400 text-xs mt-1">Press Ctrl+S to save a snapshot</p>
          </div>
        ) : (
          <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
            {/* Version list */}
            <div className="w-48 shrink-0 overflow-y-auto border-r border-gray-100 pr-3 space-y-1">
              {versions.map((v, i) => (
                <div
                  key={v.timestamp}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                    i === selectedIdx ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                  onClick={() => setSelectedIdx(i)}
                >
                  <span className="truncate">{v.label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(i); }}
                    className="p-1 hover:text-red-500 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Diff view */}
            <div className="flex-1 overflow-auto min-h-0">
              <Suspense fallback={<div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
                <ReactDiffViewer
                  oldValue={selectedVersion?.content || ''}
                  newValue={currentContent}
                  splitView={true}
                  leftTitle={`Saved: ${selectedVersion?.label || ''}`}
                  rightTitle="Current"
                  useDarkTheme={document.documentElement.classList.contains('dark')}
                />
              </Suspense>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DiffViewerModal;
