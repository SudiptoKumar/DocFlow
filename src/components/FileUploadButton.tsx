import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, FileCode, ChevronDown, Files, X, GripVertical, FileType, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { convertDocxToMarkdown } from '@/lib/docx-to-markdown';
import { hapticFileSelect, hapticError } from '@/lib/haptics';

export type UploadFileType = 'markdown' | 'pdf' | 'docx' | 'ocr';

interface FileUploadButtonProps {
  onFileLoad: (content: string, fileType: UploadFileType) => void;
  onPdfStaged?: (file: File) => void;
  onOcrStaged?: (file: File) => void;
  className?: string;
}

interface QueuedFile {
  id: string;
  file: File;
  name: string;
  type: UploadFileType;
}

const uploadOptions = [
  { 
    type: 'markdown' as UploadFileType, 
    label: 'Markdown Files', 
    extensions: ['.md', '.txt', '.markdown'],
    accept: '.md,.txt,.markdown',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  { 
    type: 'pdf' as UploadFileType, 
    label: 'PDF Files', 
    extensions: ['.pdf'],
    accept: '.pdf',
    icon: FileCode,
    color: 'text-rose-500',
    bgColor: 'bg-rose-50'
  },
  { 
    type: 'docx' as UploadFileType, 
    label: 'Word Documents', 
    extensions: ['.docx'],
    accept: '.docx',
    icon: FileType,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50'
  },
  { 
    type: 'ocr' as UploadFileType, 
    label: 'Scanned PDF (OCR)', 
    extensions: ['.pdf'],
    accept: '.pdf',
    icon: ScanLine,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50'
  },
];

const FileUploadButton = ({ onFileLoad, onPdfStaged, onOcrStaged, className = '' }: FileUploadButtonProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedType, setSelectedType] = useState<UploadFileType | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [showFileList, setShowFileList] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  const handleButtonClick = () => {
    setShowMenu(!showMenu);
  };

  const handleOptionClick = (type: UploadFileType) => {
    setSelectedType(type);
    setShowMenu(false);
    // Trigger file input after a short delay to update accept attribute
    setTimeout(() => {
      inputRef.current?.click();
    }, 50);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedType) return;

    const option = uploadOptions.find(o => o.type === selectedType);
    if (!option) return;

    const validFiles: QueuedFile[] = [];
    const invalidFiles: string[] = [];

    // Process files in the order they were selected
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isValidExt = option.extensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );

      if (!isValidExt) {
        invalidFiles.push(file.name);
        continue;
      }

      const sizeLimit = (selectedType === 'pdf' || selectedType === 'docx' || selectedType === 'ocr') ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      const sizeLimitLabel = (selectedType === 'pdf' || selectedType === 'docx' || selectedType === 'ocr') ? '10MB' : '5MB';
      if (file.size > sizeLimit) {
        hapticError();
        toast.error(`${file.name} exceeds ${sizeLimitLabel} limit`);
        continue;
      }

      validFiles.push({
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        name: file.name,
        type: selectedType
      });
    }

    if (invalidFiles.length > 0) {
      hapticError();
      toast.error(`Invalid file types: ${invalidFiles.slice(0, 3).join(', ')}${invalidFiles.length > 3 ? '...' : ''}`);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    // PDF files: stage for extraction instead of reading content
    if (selectedType === 'pdf' && validFiles.length > 0) {
      if (onPdfStaged) {
        onPdfStaged(validFiles[0].file);
        hapticFileSelect();
        toast.success(`"${validFiles[0].name}" staged. Click "Extract Text" to convert to Markdown.`);
      }
      e.target.value = '';
      setSelectedType(null);
      return;
    }

    // OCR files: stage for OCR extraction
    if (selectedType === 'ocr' && validFiles.length > 0) {
      if (onOcrStaged) {
        onOcrStaged(validFiles[0].file);
        hapticFileSelect();
        toast.success(`"${validFiles[0].name}" staged for OCR. Click "Extract with OCR" to scan.`);
      }
      e.target.value = '';
      setSelectedType(null);
      return;
    }

    // DOCX files: convert to markdown immediately
    if (selectedType === 'docx' && validFiles.length > 0) {
      try {
        setIsProcessing(true);
        const markdown = await convertDocxToMarkdown(validFiles[0].file);
        onFileLoad(markdown, 'docx');
        hapticFileSelect();
        toast.success('Word document converted & formatted!');
      } catch (error) {
        console.error('DOCX conversion error:', error);
        hapticError();
        toast.error('Failed to convert Word document');
      } finally {
        setIsProcessing(false);
      }
      e.target.value = '';
      setSelectedType(null);
      return;
    }

    // If only one file, process immediately without showing list
    if (validFiles.length === 1) {
      await processAndMergeFiles(validFiles);
    } else {
      // Multiple files - show the file list for reordering
      setQueuedFiles(validFiles);
      setShowFileList(true);
      toast.success(`${validFiles.length} files queued. Reorder if needed, then click "Merge Files".`);
    }

    e.target.value = '';
    setSelectedType(null);
  };

  const processAndMergeFiles = async (files: QueuedFile[]) => {
    setIsProcessing(true);
    
    try {
      const contents: string[] = [];
      
      for (const queuedFile of files) {
        const content = await readFileContent(queuedFile.file);
        contents.push(content);
      }

      // Merge all files with page break markers for proper section separation
      const mergedContent = contents.join('\n\n<!-- pagebreak -->\n\n');
      const fileType = files[0]?.type || 'markdown';
      
      onFileLoad(mergedContent, fileType);
      const msg = files.length === 1 ? 'File uploaded & formatted!' : `${files.length} files merged & formatted!`;
      toast.success(msg);
      
      // Reset state
      setQueuedFiles([]);
      setShowFileList(false);
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Failed to process files');
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve(event.target?.result as string);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleMergeClick = () => {
    if (queuedFiles.length > 0) {
      processAndMergeFiles(queuedFiles);
    }
  };

  const handleRemoveFile = (id: string) => {
    setQueuedFiles(prev => {
      const newFiles = prev.filter(f => f.id !== id);
      if (newFiles.length === 0) {
        setShowFileList(false);
      }
      return newFiles;
    });
  };

  const handleCancelQueue = () => {
    setQueuedFiles([]);
    setShowFileList(false);
  };

  // Drag and drop reordering
  const handleDragStart = useCallback((index: number) => {
    dragItemRef.current = index;
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragOverItemRef.current = index;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItemRef.current !== null && dragOverItemRef.current !== null && dragItemRef.current !== dragOverItemRef.current) {
      setQueuedFiles(prev => {
        const newFiles = [...prev];
        const draggedItem = newFiles[dragItemRef.current!];
        newFiles.splice(dragItemRef.current!, 1);
        newFiles.splice(dragOverItemRef.current!, 0, draggedItem);
        return newFiles;
      });
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
  }, []);

  const currentOption = uploadOptions.find(o => o.type === selectedType);

  return (
    <div className="relative" ref={menuRef}>
      <input
        ref={inputRef}
        type="file"
        accept={currentOption?.accept || '.md,.txt,.markdown'}
        onChange={handleFileChange}
        className="hidden"
        {...(selectedType === 'pdf' || selectedType === 'docx' || selectedType === 'ocr' ? {} : { multiple: true })}
      />
      
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleButtonClick}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 text-blue-600 font-medium transition-all hover:border-blue-300 hover:from-blue-100 hover:to-indigo-100 ${className}`}
      >
        <Upload className="w-5 h-5" />
        <span>Upload</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[200px]"
          >
            <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
              <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                <Files className="w-3.5 h-3.5" />
                <span>Select multiple files at once</span>
              </div>
            </div>
            {uploadOptions.map((option, index) => (
              <motion.button
                key={option.type}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleOptionClick(option.type)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
              >
                <div className={`p-2 rounded-lg ${option.bgColor} ${option.color} group-hover:scale-110 transition-transform`}>
                  <option.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{option.label}</p>
                  <p className="text-xs text-gray-400">{option.extensions.join(', ')}</p>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Queue Modal */}
      <AnimatePresence>
        {showFileList && queuedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && handleCancelQueue()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Files className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{queuedFiles.length} Files Queued</h3>
                      <p className="text-xs text-gray-500">Drag to reorder, then merge</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelQueue}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* File List */}
              <div className="max-h-[300px] overflow-y-auto p-3">
                <div className="space-y-2">
                  {queuedFiles.map((file, index) => (
                    <motion.div
                      key={file.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-move hover:bg-gray-100 transition-colors group"
                    >
                      <div className="text-gray-300 group-hover:text-gray-400">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 text-xs font-bold rounded-lg">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{file.type.toUpperCase()}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleCancelQueue}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMergeClick}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Files className="w-4 h-4" />
                      Merge Files
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUploadButton;
