import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, Plus, Minus } from 'lucide-react';

interface SpreadsheetModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (markdownTable: string) => void;
}

const SpreadsheetModal = ({ open, onClose, onInsert }: SpreadsheetModalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const jspreadsheetRef = useRef<any>(null);
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    let cleanup: (() => void) | undefined;

    const init = async () => {
      const jspreadsheet = (await import('jspreadsheet-ce')).default;
      await import('jsuites/dist/jsuites.css');
      await import('jspreadsheet-ce/dist/jspreadsheet.css');

      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';

      const data = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

      jspreadsheetRef.current = (jspreadsheet as any)(containerRef.current, {
        data,
        minDimensions: [cols, rows],
        tableOverflow: true,
        tableWidth: '100%',
        tableHeight: '300px',
        columnSorting: false,
      });

      setLoaded(true);

      cleanup = () => {
        if (jspreadsheetRef.current) {
          jspreadsheetRef.current.destroy?.();
          jspreadsheetRef.current = null;
        }
        setLoaded(false);
      };
    };

    init();

    return () => cleanup?.();
  }, [open, rows, cols]);

  const handleInsert = () => {
    if (!jspreadsheetRef.current) return;

    const data = jspreadsheetRef.current.getData() as string[][];
    if (!data || data.length === 0) return;

    // Build markdown table
    const numCols = data[0].length;
    const header = '| ' + data[0].map((cell: string) => cell || 'Column').join(' | ') + ' |';
    const separator = '| ' + Array(numCols).fill('---').join(' | ') + ' |';
    const bodyRows = data.slice(1).map((row: string[]) =>
      '| ' + row.map((cell: string) => cell || '').join(' | ') + ' |'
    );

    const markdownTable = [header, separator, ...bodyRows].join('\n');
    onInsert('\n' + markdownTable + '\n');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table className="w-5 h-5 text-indigo-500" />
            Spreadsheet Table Editor
          </DialogTitle>
        </DialogHeader>

        {/* Size controls */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Rows:</span>
            <button onClick={() => setRows(Math.max(2, rows - 1))} className="p-1 rounded hover:bg-gray-100"><Minus className="w-3 h-3" /></button>
            <span className="font-medium w-6 text-center">{rows}</span>
            <button onClick={() => setRows(Math.min(20, rows + 1))} className="p-1 rounded hover:bg-gray-100"><Plus className="w-3 h-3" /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Cols:</span>
            <button onClick={() => setCols(Math.max(2, cols - 1))} className="p-1 rounded hover:bg-gray-100"><Minus className="w-3 h-3" /></button>
            <span className="font-medium w-6 text-center">{cols}</span>
            <button onClick={() => setCols(Math.min(10, cols + 1))} className="p-1 rounded hover:bg-gray-100"><Plus className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Spreadsheet container */}
        <div ref={containerRef} className="border rounded-lg overflow-hidden min-h-[200px]" />

        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!loaded}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
          >
            <Table className="w-4 h-4" />
            Insert Table
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SpreadsheetModal;
