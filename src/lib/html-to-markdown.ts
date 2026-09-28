import TurndownService from 'turndown';

// Initialize Turndown with options optimized for bidirectional editing
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
});

// Custom rule for code blocks with language
turndownService.addRule('fencedCodeBlock', {
  filter: (node) => {
    return (
      node.nodeName === 'PRE' &&
      node.firstChild &&
      node.firstChild.nodeName === 'CODE'
    );
  },
  replacement: (_content, node) => {
    const codeNode = node.firstChild as HTMLElement;
    const code = codeNode.textContent || '';
    const className = codeNode.className || '';
    const langMatch = className.match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : '';
    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  },
});

// Custom rule for inline code to prevent issues with nested elements
turndownService.addRule('inlineCode', {
  filter: (node) => {
    return node.nodeName === 'CODE' && 
           node.parentNode !== null && 
           node.parentNode.nodeName !== 'PRE';
  },
  replacement: (content) => {
    return `\`${content}\``;
  },
});

/**
 * Convert HTML content to Markdown
 * Used for bidirectional editing from contenteditable preview
 */
export { turndownService };

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  
  try {
    // Create a temporary container to parse HTML
    const container = document.createElement('div');
    container.innerHTML = html;
    
    // Remove any script or style tags for safety
    container.querySelectorAll('script, style').forEach(el => el.remove());
    
    // Convert to markdown
    const markdown = turndownService.turndown(container);
    
    // Clean up excessive newlines
    return markdown.replace(/\n{3,}/g, '\n\n').trim();
  } catch (error) {
    console.error('HTML to Markdown conversion error:', error);
    return html; // Fallback to original HTML if conversion fails
  }
}

export default htmlToMarkdown;
