import { motion } from 'framer-motion';
import { Upload, FileText, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { hapticFileSelect, hapticError } from '@/lib/haptics';

interface LanguageUploadCardProps {
  language: 'english' | 'bangla';
  content: string;
  onContentChange: (content: string) => void;
}

const languageConfig = {
  english: {
    label: 'Source',
    sublabel: 'English',
    icon: '📤',
    gradient: 'from-blue-50 to-indigo-50',
    border: 'border-blue-200 hover:border-blue-300',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-600',
  },
  bangla: {
    label: 'Translation',
    sublabel: 'বাংলা',
    icon: '📥',
    gradient: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-200 hover:border-emerald-300',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-500',
    textColor: 'text-emerald-600',
  },
};

const LanguageUploadCard = ({ language, content, onContentChange }: LanguageUploadCardProps) => {
  const config = languageConfig[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Check file type
    const validTypes = ['.md', '.txt', '.markdown'];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validTypes.includes(extension)) {
      hapticError();
      toast.error('Please upload a .md, .txt, or .markdown file');
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      hapticError();
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      const text = await file.text();
      onContentChange(text);
      hapticFileSelect();
      toast.success(`${config.label} file loaded!`);
    } catch (error) {
      console.error('Error reading file:', error);
      hapticError();
      toast.error('Failed to read file');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onContentChange('');
    toast.success(`${config.label} content cleared`);
  };

  const hasContent = content.trim().length > 0;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative overflow-hidden min-h-[120px] p-4 rounded-2xl bg-gradient-to-br ${config.gradient} border-2 border-dashed ${config.border} flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
        isDragging ? 'scale-[1.02] shadow-lg' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.markdown"
        onChange={handleInputChange}
        className="hidden"
      />

      {hasContent ? (
        <>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleClear}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </motion.button>
          <div className={`p-3 rounded-xl ${config.iconBg} shadow-sm`}>
            <FileText className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <div className="text-center">
            <span className={`text-sm font-medium ${config.textColor}`}>{config.sublabel}</span>
            <p className="text-xs text-gray-500 mt-0.5">{wordCount} words loaded</p>
          </div>
        </>
      ) : (
        <>
          <div className={`p-3 rounded-xl bg-white shadow-sm`}>
            <Upload className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <div className="text-center">
            <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
            <p className="text-xs text-gray-500 mt-0.5">{config.sublabel}</p>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default LanguageUploadCard;
