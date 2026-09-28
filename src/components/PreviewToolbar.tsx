import { Button } from '@/components/ui/button';
import { Heading1, Heading2, Heading3, Bold, Italic, Code, CodeSquare, List, ListOrdered, ListChecks, Quote, Link, Minus, Table, Strikethrough, Undo2, Redo2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ColorPickerButton from './ColorPickerButton';

interface PreviewToolbarProps {
  contentRef: React.RefObject<HTMLDivElement>;
  onContentChange: () => void;
  mobileStyle?: boolean;
}

const PreviewToolbar = ({ contentRef, onContentChange, mobileStyle = false }: PreviewToolbarProps) => {
  const execCommand = (command: string, value?: string) => {
    // Focus the contenteditable div before executing command
    contentRef.current?.focus();
    
    // Execute the command
    document.execCommand(command, false, value);
    
    // Trigger content change after formatting
    setTimeout(onContentChange, 0);
  };

  const formatBlock = (tag: string) => {
    execCommand('formatBlock', tag);
  };

  const handleUndo = () => {
    contentRef.current?.focus();
    document.execCommand('undo');
    setTimeout(onContentChange, 0);
  };

  const handleRedo = () => {
    contentRef.current?.focus();
    document.execCommand('redo');
    setTimeout(onContentChange, 0);
  };

  const wrapWithCode = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (selectedText) {
      const code = document.createElement('code');
      code.textContent = selectedText;
      range.deleteContents();
      range.insertNode(code);
      selection.collapseToEnd();
      onContentChange();
    }
  };

  const insertCodeBlock = () => {
    contentRef.current?.focus();
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = 'code here';
    pre.appendChild(code);
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(pre);
      // Add a paragraph after so user can continue typing
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      pre.parentNode?.insertBefore(p, pre.nextSibling);
      selection.collapseToEnd();
    }
    setTimeout(onContentChange, 0);
  };

  const insertTable = () => {
    contentRef.current?.focus();
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const headerRow = document.createElement('tr');
    ['Column 1', 'Column 2', 'Column 3'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    const bodyRow = document.createElement('tr');
    ['Cell 1', 'Cell 2', 'Cell 3'].forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      bodyRow.appendChild(td);
    });
    tbody.appendChild(bodyRow);
    table.appendChild(thead);
    table.appendChild(tbody);
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(table);
      selection.collapseToEnd();
    }
    setTimeout(onContentChange, 0);
  };

  const insertDivider = () => {
    contentRef.current?.focus();
    document.execCommand('insertHorizontalRule');
    setTimeout(onContentChange, 0);
  };

  const toggleStrikethrough = () => {
    execCommand('strikeThrough');
  };

  const insertTaskList = () => {
    contentRef.current?.focus();
    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';
    ul.style.paddingLeft = '0';
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.style.marginRight = '8px';
    li.appendChild(checkbox);
    li.appendChild(document.createTextNode('Task item'));
    ul.appendChild(li);
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(ul);
      selection.collapseToEnd();
    }
    setTimeout(onContentChange, 0);
  };

  const insertLink = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    
    const url = window.prompt('Enter URL:', 'https://');
    if (!url) return;
    
    contentRef.current?.focus();
    
    if (selectedText) {
      // Wrap selected text with link
      document.execCommand('createLink', false, url);
    } else {
      // Insert link with URL as text
      const linkText = window.prompt('Enter link text:', url) || url;
      const link = document.createElement('a');
      link.href = url;
      link.textContent = linkText;
      
      const range = selection?.getRangeAt(0);
      if (range) {
        range.insertNode(link);
        selection?.collapseToEnd();
      }
    }
    
    setTimeout(onContentChange, 0);
  };

  const undoRedoTools = [
    { icon: Undo2, label: 'Undo', action: handleUndo, shortcut: 'Ctrl+Z', color: 'text-gray-500' },
    { icon: Redo2, label: 'Redo', action: handleRedo, shortcut: 'Ctrl+Y', color: 'text-gray-500' },
  ];

  const tools = [
    { icon: Heading1, label: 'Heading 1', action: () => formatBlock('<h1>'), shortcut: 'H1', color: 'text-rose-500' },
    { icon: Heading2, label: 'Heading 2', action: () => formatBlock('<h2>'), shortcut: 'H2', color: 'text-orange-500' },
    { icon: Heading3, label: 'Heading 3', action: () => formatBlock('<h3>'), shortcut: 'H3', color: 'text-amber-500' },
    { icon: Bold, label: 'Bold', action: () => execCommand('bold'), shortcut: 'Ctrl+B', color: 'text-emerald-500' },
    { icon: Italic, label: 'Italic', action: () => execCommand('italic'), shortcut: 'Ctrl+I', color: 'text-teal-500' },
    { icon: Strikethrough, label: 'Strikethrough', action: toggleStrikethrough, shortcut: 'S', color: 'text-gray-500' },
    { icon: Code, label: 'Inline Code', action: wrapWithCode, shortcut: 'Code', color: 'text-cyan-500' },
    { icon: CodeSquare, label: 'Code Block', action: insertCodeBlock, shortcut: '```', color: 'text-cyan-600' },
    { icon: List, label: 'Bullet List', action: () => execCommand('insertUnorderedList'), shortcut: 'List', color: 'text-blue-500' },
    { icon: ListOrdered, label: 'Numbered List', action: () => execCommand('insertOrderedList'), shortcut: '1.', color: 'text-indigo-500' },
    { icon: ListChecks, label: 'Task List', action: insertTaskList, shortcut: '☑', color: 'text-green-500' },
    { icon: Quote, label: 'Blockquote', action: () => formatBlock('<blockquote>'), shortcut: 'Quote', color: 'text-violet-500' },
    { icon: Table, label: 'Table', action: insertTable, shortcut: 'Table', color: 'text-indigo-500' },
    { icon: Minus, label: 'Horizontal Rule', action: insertDivider, shortcut: '---', color: 'text-gray-400' },
    { icon: Link, label: 'Insert Link', action: insertLink, shortcut: 'Link', color: 'text-purple-500' },
  ];

  const colorPicker = <ColorPickerButton contentRef={contentRef} onContentChange={onContentChange} mobileStyle={mobileStyle} />;

  if (mobileStyle) {
    return (
      <div className="sticky top-0 z-10 flex items-center gap-1 px-3 py-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-hide" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
        {/* Undo/Redo buttons */}
        {undoRedoTools.map((tool, index) => (
          <button
            key={`undo-redo-${index}`}
            onClick={tool.action}
            className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm ${tool.color} active:scale-95 transition-transform`}
          >
            <tool.icon className="h-4 w-4" />
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 flex-shrink-0" />
        {/* Formatting tools */}
        {tools.map((tool, index) => (
          <button
            key={index}
            onClick={tool.action}
            className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm ${tool.color} active:scale-95 transition-transform`}
          >
            <tool.icon className="h-4 w-4" />
          </button>
        ))}
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 flex-shrink-0" />
        {colorPicker}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="sticky top-0 z-10 flex items-center gap-1 px-3 py-2 bg-muted/90 backdrop-blur-sm border-b border-border overflow-x-auto">
        {/* Undo/Redo buttons */}
        {undoRedoTools.map((tool, index) => (
          <Tooltip key={`undo-redo-${index}`}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={tool.action}
                className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground flex-shrink-0"
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />
        {/* Formatting tools */}
        {tools.map((tool, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={tool.action}
                className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground flex-shrink-0"
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />
        {colorPicker}
        <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Select text then click to format</span>
      </div>
    </TooltipProvider>
  );
};

export default PreviewToolbar;