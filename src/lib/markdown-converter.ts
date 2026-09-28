/* DocFlow Markdown Converter - DOCX, PDF, HTML export */
import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  convertInchesToTwip,
  LevelFormat,
  ILevelsOptions,
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathRadical,
  MathSum,
  MathIntegral,
  MathFunction,
  MathRoundBrackets,
  MathSquareBrackets,
  MathCurlyBrackets,
  MathAngledBrackets,
  MathLimitLower,
  MathLimitUpper,
} from 'docx';
import type { MathComponent } from 'docx';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import markdownItMultimdTable from 'markdown-it-multimd-table';
import markdownItContainer from 'markdown-it-container';
import markdownItFootnote from 'markdown-it-footnote';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import markdownItMark from 'markdown-it-mark';
import { full as markdownItEmoji } from 'markdown-it-emoji';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItTocDoneRight from 'markdown-it-toc-done-right';
import { processLatexInHtml, getKatexCssUrl, getKatexStylesInline, latexToPlainText } from './math-renderer';

export type OutputFormat = 'docx' | 'pdf' | 'html' | 'md' | 'txt' | 'md-docx';

// Configure markdown-it with all plugins for Gemini AI support
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
});

// Register plugins
md.use(markdownItMultimdTable, { multiline: true, rowspan: true, headerless: true });
md.use(markdownItFootnote);
md.use(markdownItSub);
md.use(markdownItSup);
md.use(markdownItMark);
md.use(markdownItEmoji);
md.use(markdownItAnchor, { permalink: false });
md.use(markdownItTocDoneRight);

// Register admonition containers
['info', 'warning', 'success', 'tip', 'danger'].forEach(type => {
  md.use(markdownItContainer, type, {
    render(tokens: any[], idx: number) {
      if (tokens[idx].nesting === 1) {
        const title = type.charAt(0).toUpperCase() + type.slice(1);
        return `<div class="admonition admonition-${type}"><p class="admonition-title">${title}</p>\n`;
      }
      return '</div>\n';
    }
  });
});

// Custom fence rules for mermaid diagrams and function plots
const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const lang = token.info.trim().toLowerCase();
  if (lang === 'mermaid') {
    return `<div class="mermaid">${token.content}</div>`;
  }
  if (lang === 'plot') {
    return `<div class="function-plot" data-fn="${token.content.trim().replace(/"/g, '&quot;')}"></div>`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

// Enable task list rendering: - [ ] and - [x]
md.core.ruler.after('inline', 'task-lists', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'inline') continue;
    const content = tokens[i].content;
    if (!content) continue;
    // Check if this inline token starts with [ ] or [x]
    if (/^\[([ xX])\]\s/.test(content)) {
      const checked = content[1].toLowerCase() === 'x';
      tokens[i].content = content.replace(/^\[([ xX])\]\s/, '');
      // Find parent list_item and add class
      // Insert checkbox HTML at beginning
      const checkboxHtml = `<input type="checkbox" ${checked ? 'checked' : ''} disabled class="task-list-checkbox" /> `;
      tokens[i].content = checkboxHtml + tokens[i].content;
      // Mark parent li
      for (let j = i - 1; j >= 0; j--) {
        if (tokens[j].type === 'list_item_open') {
          tokens[j].attrJoin('class', 'task-list-item');
          break;
        }
      }
    }
  }
});

/**
 * Detect if text contains Bengali (Bangla) script characters
 */
const containsBengali = (text: string): boolean => {
  return /[\u0964\u0965\u0980-\u09FF]/.test(text);
};

/**
 * Get the appropriate font configuration for text.
 *
 * NOTE: Microsoft Word does NOT reliably apply per-script fallbacks from a font stack.
 * So for Bengali we must explicitly set the run font to SolaimanLipi.
 */
const getFontConfig = (isCode: boolean = false): { ascii: string; hAnsi: string; cs: string; eastAsia: string } => {
  if (isCode) {
    return { ascii: 'Consolas', hAnsi: 'Consolas', cs: 'Consolas', eastAsia: 'Consolas' };
  }
  return {
    ascii: 'Times New Roman',
    hAnsi: 'Times New Roman',
    cs: 'SolaimanLipi',
    eastAsia: 'Times New Roman',
  };
};

const getBengaliFontConfig = (): { ascii: string; hAnsi: string; cs: string; eastAsia: string } => ({
  ascii: 'SolaimanLipi',
  hAnsi: 'SolaimanLipi',
  cs: 'SolaimanLipi',
  // eastAsia is technically for CJK, but setting it here improves consistency in Word
  eastAsia: 'SolaimanLipi',
});

function splitTextByBengaliScript(text: string): Array<{ text: string; bengali: boolean }> {
  if (!text) return [];

  // Normalize to NFC so combining marks (e.g. য + ় ) join their base character
  // and we never split a grapheme cluster across runs.
  const normalized = text.normalize('NFC');

  const parts: Array<{ text: string; bengali: boolean }> = [];
  let buf = '';
  let currentIsBengali = containsBengali(normalized[0] ?? '');

  for (const ch of normalized) {
    const isBn = containsBengali(ch);
    if (isBn !== currentIsBengali && buf) {
      parts.push({ text: buf, bengali: currentIsBengali });
      buf = '';
      currentIsBengali = isBn;
    }
    buf += ch;
  }

  if (buf) parts.push({ text: buf, bengali: currentIsBengali });
  return parts;
}

function createScriptAwareRuns(options: {
  text: string;
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  size?: number;
  shading?: { fill: string };
  color?: string;
  isCode?: boolean;
}): TextRun[] {
  const {
    text,
    bold,
    italics,
    strike,
    size,
    shading,
    color,
    isCode = false,
  } = options;

  if (!text) return [];
  if (isCode) {
    return [
      new TextRun({
        text,
        bold,
        italics,
        strike,
        font: getFontConfig(true),
        size,
        shading,
        color,
      }),
    ];
  }

  const parts = containsBengali(text) ? splitTextByBengaliScript(text) : [{ text, bengali: false }];

  return parts.map(
    (p) =>
      new TextRun({
        text: p.text,
        bold,
        italics,
        strike,
        font: p.bengali ? getBengaliFontConfig() : getFontConfig(false),
        size,
        shading,
        color,
        // Tag Bengali runs as complex script so Word uses the `cs` font slot
        // (SolaimanLipi) for precomposed characters like য় (U+09DF), ড় (U+09DC), ঢ় (U+09DD).
        ...(p.bengali ? { language: { bidirectional: 'bn-BD', value: 'bn-BD' } } : {}),
      })
  );
}

/**
 * Remove horizontal rules that appear directly before H1 or H2 headings.
 * These are redundant since H1/H2 already render their own visual separator.
 */
function removeHrBeforeMajorHeadings(markdown: string): string {
  // Pattern: horizontal rule (---, ***, ___) followed by optional blank lines, then # or ## heading
  return markdown.replace(
    /^[-*_]{3,}\s*$\n+(?=#{1,2}\s)/gm,
    ''
  );
}

/**
 * Parse markdown to HTML (sanitized to prevent XSS) with LaTeX math support
 */
export function parseMarkdownToHtml(markdown: string): string {
  const preprocessed = removeHrBeforeMajorHeadings(markdown);

  // A. Protect display math blocks from markdown-it processing
  // Use HTML tags with data attributes — they pass through markdown-it (html:true)
  // and DOMPurify preserves standard tags with data-* attributes
  const mathBlocks: string[] = [];
  const protectedMarkdown = preprocessed.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
    mathBlocks.push(match);
    return `<div data-mathblock="${mathBlocks.length - 1}"></div>`;
  });

  // Also protect inline math
  const inlineMathBlocks: string[] = [];
  const fullyProtected = protectedMarkdown.replace(/\$(?!\d)(\S(?:[^$\n]*?\S)?)\$/g, (match) => {
    inlineMathBlocks.push(match);
    return `<span data-imathblock="${inlineMathBlocks.length - 1}"></span>`;
  });

  const rawHtml = md.render(fullyProtected);
  const sanitized = DOMPurify.sanitize(rawHtml);

  // Restore math placeholders with pristine LaTeX content
  // Use regex to handle any minor reformatting by DOMPurify
  let restored = sanitized;
  // IMPORTANT: Use function replacements, NOT string replacements.
  // String replacements treat $$ as a special pattern (inserts literal $),
  // which corrupts LaTeX display math delimiters.
  mathBlocks.forEach((original, i) => {
    const re = new RegExp(`<div[^>]*data-mathblock="${i}"[^>]*>\\s*</div>`, 'g');
    restored = restored.replace(re, () => original);
  });
  inlineMathBlocks.forEach((original, i) => {
    const re = new RegExp(`<span[^>]*data-imathblock="${i}"[^>]*>\\s*</span>`, 'g');
    restored = restored.replace(re, () => original);
  });

  // Process LaTeX math expressions after restoration
  return processLatexInHtml(restored);
}

/**
 * Convert markdown to the specified format and download
 */
export async function convertMarkdown(
  markdown: string,
  format: OutputFormat,
  filename: string = 'document'
): Promise<void> {
  // Structural cleanup: merge split lines, remove page artifacts for cleaner exports
  const { cleanExtractedMarkdown } = await import('./pdf-extractor');
  const cleaned = cleanExtractedMarkdown(markdown);

  switch (format) {
    case 'html':
      return convertToHtml(cleaned, filename);
    case 'pdf':
      return convertToPdf(cleaned, filename);
    case 'docx':
      return convertToDocxViaHtml(cleaned, filename);
    case 'md':
      return convertToMd(cleaned, filename);
    case 'txt':
      return convertToTxt(cleaned, filename);
    case 'md-docx':
      return convertToMdDocx(cleaned, filename);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Convert markdown to .md file and download
 */
function convertToMd(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, `${filename}.md`);
}

/**
 * Convert raw markdown syntax into a DOCX file (monospace, preserving source)
 */
async function convertToMdDocx(markdown: string, filename: string): Promise<void> {
  const lines = markdown.split('\n');
  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line || ' ',
            font: { ascii: 'Courier New', hAnsi: 'Courier New', cs: 'Courier New', eastAsia: 'Courier New' },
            size: 22, // 11pt
          }),
        ],
      })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) },
            margin: {
              top: convertInchesToTwip(0.5),
              right: convertInchesToTwip(0.5),
              bottom: convertInchesToTwip(0.5),
              left: convertInchesToTwip(0.5),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

/**
 * Convert markdown to plain text and download
 */
function convertToTxt(markdown: string, filename: string): void {
  // Strip markdown formatting to get plain text
  let plainText = markdown
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, '').replace(/```$/g, '');
      return code.trim();
    })
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold/italic markers
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/___([^_]+)___/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '---')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove LaTeX display math
    .replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      return latexToPlainText(match.replace(/\$\$/g, ''));
    })
    // Remove LaTeX inline math
    .replace(/\$([^$]+)\$/g, (_, content) => {
      return latexToPlainText(content);
    })
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${filename}.txt`);
}

/**
 * Convert markdown to HTML and download with LaTeX support
 */
function convertToHtml(markdown: string, filename: string): void {
  const html = parseMarkdownToHtml(markdown);
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename}</title>
  <link rel="stylesheet" href="${getKatexCssUrl()}">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      color: #1a1a1a;
      background: #ffffff;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 0; margin-bottom: 0; line-height: 1.5; }
    h1 { font-size: 2.25em; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.3em; }
    h2 { font-size: 1.75em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
    h3 { font-size: 1.4em; }
    h4 { font-size: 1.2em; }
    p { margin: 0; text-align: justify; }
    ul, ol { margin: 0; padding-left: 2em; }
    li { margin: 0; }
    li > ul, li > ol { margin: 0; }
    code {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      background: #f4f4f5;
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre {
      background: #1e1e2e;
      color: #cdd6f4;
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5em 0;
    }
    pre code { background: transparent; padding: 0; color: inherit; }
    blockquote {
      border-left: 4px solid #3b82f6;
      margin: 1.5em 0;
      padding: 0.5em 1em;
      background: #f8fafc;
      color: #475569;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.5em 0;
    }
    th, td {
      border: 1px solid #e5e5e5;
      padding: 0.75em 1em;
      text-align: left;
    }
    th { background: #f4f4f5; font-weight: 600; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    hr { border: none; border-top: 2px solid #e5e5e5; margin: 2em 0; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    ${getKatexStylesInline()}
  </style>
</head>
<body>
${html}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  saveAs(blob, `${filename}.html`);
}

/**
 * Open a print window with styled HTML content for PDF export.
 * Uses the browser's native print engine for perfect text quality with selectable text.
 */
function openPrintWindow(html: string, title: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please allow pop-ups.');
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="stylesheet" href="${getKatexCssUrl()}">
  <style>
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('https://fonts.maateen.me/solaiman-lipi/SolaimanLipi.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    @page {
      size: A4;
      margin: 12.7mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', 'SolaimanLipi', serif;
      font-size: 12pt;
      line-height: 1.25;
      color: #1a1a1a;
      background: #ffffff;
      padding: 12.7mm;
      max-width: 210mm;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em; margin-bottom: 0.75em; line-height: 1.3; text-align: left;
      page-break-after: avoid;
    }
    h1 { font-size: 24pt; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; }
    h2 { font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
    h3 { font-size: 14pt; }
    h4 { font-size: 12pt; }
    p { margin-bottom: 6pt; margin-top: 0; text-align: justify; }
    ul, ol { margin: 6pt 0; padding-left: 2em; }
    li { margin-bottom: 6pt; text-align: justify; }
    blockquote {
      margin: 1.5em 0; padding: 15px 20px;
      border-left: 4px solid #4a5568; background: #f8f9fa;
      font-style: italic; color: #4a5568;
    }
    code {
      font-family: 'Courier New', monospace; font-size: 10pt;
      background: #f4f4f5; padding: 2px 6px; border-radius: 3px;
    }
    pre {
      background: #1e293b; color: #e2e8f0; padding: 16px;
      border-radius: 6px; overflow-x: auto; margin: 1.5em 0;
      page-break-inside: avoid;
    }
    pre code { background: transparent; padding: 0; color: inherit; }
    table {
      width: 100%; border-collapse: collapse; margin: 1.5em 0;
      page-break-inside: avoid;
    }
    th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; }
    th { background: #f3f4f6; font-weight: bold; }
    tr:nth-child(even) { background: #f9fafb; }
    a { color: #2563eb; text-decoration: underline; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
    img { max-width: 100%; height: auto; }
    ${getKatexStylesInline()}
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

  printWindow.document.write(fullHtml);
  printWindow.document.close();

  // Wait for all stylesheets and fonts to load before printing
  const stylesheets = printWindow.document.querySelectorAll('link[rel="stylesheet"]');
  let loadedCount = 0;
  const totalStylesheets = stylesheets.length;

  const triggerPrint = () => {
    // Additional delay to ensure fonts are rendered
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 800);
  };

  if (totalStylesheets === 0) {
    triggerPrint();
    return;
  }

  const onStylesheetLoad = () => {
    loadedCount++;
    if (loadedCount >= totalStylesheets) {
      // Wait for fonts after stylesheets
      if (printWindow.document.fonts?.ready) {
        printWindow.document.fonts.ready.then(() => triggerPrint());
      } else {
        triggerPrint();
      }
    }
  };

  stylesheets.forEach((link) => {
    link.addEventListener('load', onStylesheetLoad);
    link.addEventListener('error', onStylesheetLoad); // Don't block on failed loads
  });

  // Safety timeout: trigger print even if stylesheets hang
  setTimeout(() => {
    if (loadedCount < totalStylesheets) {
      triggerPrint();
    }
  }, 5000);
}

/**
 * Convert markdown to PDF via the browser's native print dialog.
 * Opens a new window with styled content and triggers window.print().
 */
async function convertToPdf(markdown: string, filename: string): Promise<void> {
  const html = parseMarkdownToHtml(markdown);
  openPrintWindow(html, filename);
}

// ================== DOCX CONVERSION ==================

interface ParsedToken {
  type: string;
  tag?: string;
  content?: string;
  children?: ParsedToken[];
  info?: string;
  markup?: string;
  level?: number;
  nesting?: number;
  attrs?: [string, string][];
}

/**
 * Convert markdown to DOCX using markdown-it tokens for accurate parsing
 */
async function convertToDocxViaHtml(markdown: string, filename: string): Promise<void> {
  try {
    // OMML pipeline is primary: native Word math, proper tables, structured parsing
    await convertToDocxOmml(markdown, filename);
  } catch (err) {
    console.warn('OMML pipeline failed, falling back to TurboDocx:', err);
    try {
      const html = parseMarkdownToHtml(markdown);
      const katexCss = getKatexStylesInline();
      const fullHtml = `<!DOCTYPE html><html><head><style>${katexCss}
        body { font-family: 'Calibri', sans-serif; font-size: 11pt; line-height: 1.5; }
        h1 { font-size: 20pt; font-weight: bold; }
        h2 { font-size: 16pt; font-weight: bold; }
        h3 { font-size: 13pt; font-weight: bold; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; }
        code { font-family: 'Courier New', monospace; background: #f4f4f5; padding: 2px 4px; }
        pre { background: #1e1e2e; color: #cdd6f4; padding: 12px; border-radius: 4px; }
        blockquote { border-left: 3px solid #10b981; padding-left: 12px; color: #555; }
      </style></head><body>${html}</body></html>`;
      
      const HtmlToDocx = (await import('@turbodocx/html-to-docx')).default;
      const docxBlob = await HtmlToDocx(fullHtml, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        header: false,
      });
      saveAs(docxBlob as Blob, `${filename}.docx`);
    } catch (err2) {
      console.error('Both DOCX pipelines failed:', err2);
      throw err2;
    }
  }
}

async function convertToDocxOmml(markdown: string, filename: string): Promise<void> {
  // Yield to let UI render loading spinner before heavy processing
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

  // Preprocess: remove HRs before major headings
  let preprocessed = removeHrBeforeMajorHeadings(markdown);

  // Pre-process LaTeX math to Unicode BEFORE markdown-it tokenization
  // This prevents markdown-it from splitting $...$ across multiple tokens
  // NOTE: We no longer call processLatexForDocx here.
  // Math delimiters remain intact so parseInlineContent can detect them
  // and emit native Word Math objects (MathRun, MathFraction, etc.).

  // Split at <!-- pagebreak --> markers to create independent sections
  const chunks = preprocessed.split(/<!--\s*pagebreak\s*-->/i).map(c => c.trim()).filter(Boolean);

  // Build numbering configs and sections per chunk
  const allNumberingConfigs: { reference: string; levels: ILevelsOptions[] }[] = [];
  const sections: { properties: Record<string, unknown>; children: (Paragraph | Table)[] }[] = [];
  let globalOrderedListCounter = 0;

  const pageMargin = {
    top: convertInchesToTwip(1),
    right: convertInchesToTwip(1),
    bottom: convertInchesToTwip(1),
    left: convertInchesToTwip(1),
  };

  chunks.forEach((chunk, idx) => {
    const bulletRef = idx === 0 ? 'default-bullet' : `bullet-${idx}`;

    allNumberingConfigs.push(
      { reference: bulletRef, levels: getBulletLevels() },
    );

    const tokens = md.parse(chunk, {});
    const children = tokensToDocxElements(tokens, bulletRef, allNumberingConfigs, globalOrderedListCounter);
    // Count how many ordered lists were in this chunk to keep counter in sync
    const orderedListCount = tokens.filter(t => t.type === 'ordered_list_open').length;
    globalOrderedListCounter += orderedListCount;

    sections.push({
      properties: {
        page: { margin: pageMargin },
        ...(idx > 0 ? { type: 'nextPage' as const } : {}),
      },
      children,
    });
  });

  const doc = new Document({
    numbering: { config: allNumberingConfigs },
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { font: getFontConfig(), size: 24 },
          paragraph: { spacing: { line: 300, after: 120 }, alignment: AlignmentType.JUSTIFIED },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: getFontConfig(), size: 48, bold: true, color: '1a1a1a' },
          paragraph: { spacing: { line: 300, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: getFontConfig(), size: 36, bold: true, color: '1a1a1a' },
          paragraph: { spacing: { line: 300, after: 120 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: getFontConfig(), size: 28, bold: true, color: '1a1a1a' },
          paragraph: { spacing: { line: 300, after: 120 } },
        },
        {
          id: 'Code',
          name: 'Code',
          basedOn: 'Normal',
          run: { font: getFontConfig(true), size: 20 },
          paragraph: { spacing: { line: 300, after: 120 } },
        },
      ],
    },
    sections: sections as any,
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `${filename}.docx`);
}

function getBulletLevels(): ILevelsOptions[] {
  return [0, 1, 2, 3, 4].map((level) => ({
    level,
    format: LevelFormat.BULLET,
    text: level % 2 === 0 ? '•' : '◦',
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: convertInchesToTwip(0.25 * (level + 1)), hanging: convertInchesToTwip(0.25) } } },
  }));
}

function getNumberedLevels(): ILevelsOptions[] {
  return [0, 1, 2, 3, 4].map((level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    start: 1,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: convertInchesToTwip(0.25 * (level + 1)), hanging: convertInchesToTwip(0.25) } } },
  }));
}

/**
 * Convert markdown-it tokens to DOCX elements
 */
function tokensToDocxElements(tokens: ParsedToken[], bulletRef: string = 'default-bullet', numberingConfigs?: { reference: string; levels: ILevelsOptions[] }[], orderedListStartCounter: number = 0): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  let i = 0;
  let currentListType: 'bullet' | 'ordered' | null = null;
  let listLevel = -1;
  let currentNumberRef = '';
  let orderedListIdx = orderedListStartCounter;

  while (i < tokens.length) {
    const token = tokens[i];

    // Handle headings
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag?.replace('h', '') || '1', 10);
      const contentToken = tokens[i + 1];
      if (contentToken?.type === 'inline') {
        elements.push(createHeading(contentToken.content || '', level));
      }
      i += 3; // heading_open, inline, heading_close
      continue;
    }

    // Handle paragraphs (with fallback table detection for pipe-delimited content)
    if (token.type === 'paragraph_open') {
      const contentToken = tokens[i + 1];
      if (contentToken?.type === 'inline') {
        const rawContent = contentToken.content || '';
        const lines = rawContent.split('\n');
        
        // Detect if this looks like a markdown table that markdown-it failed to parse
        const pipeLines = lines.filter(l => l.trim().startsWith('|') && l.trim().endsWith('|'));
        const hasSeparator = lines.some(l => /^\|[\s\-:|]+\|$/.test(l.trim()));
        
        if (pipeLines.length >= 2) {
          // Fallback table parser for pipe-delimited content
          const borderConfig = {
            style: BorderStyle.SINGLE,
            size: 6,
            color: 'b0b0b0',
          };
          const tableRows: TableRow[] = [];
          
          for (let li = 0; li < lines.length; li++) {
            const line = lines[li].trim();
            if (!line.startsWith('|') || !line.endsWith('|')) continue;
            // Skip separator rows
            if (/^\|[\s\-:|]+\|$/.test(line)) continue;
            
            // Split cells: remove outer pipes, split by |
            const cellTexts = line.slice(1, -1).split('|').map(c => c.trim());
            const isHeader = li === 0;
            const cells = cellTexts.map(cellText => {
              // Replace <br> / <br/> with line breaks
              const cellLines = cellText.split(/<br\s*\/?>/gi);
              const cellRuns = cellLines.flatMap((cl, idx) => {
                const runs: (TextRun | DocxMath)[] = splitTextWithMath(cl, { bold: isHeader });
                if (idx < cellLines.length - 1) {
                  runs.push(new TextRun({ break: 1 }));
                }
                return runs;
              });
               return new TableCell({
                children: [new Paragraph({ children: cellRuns, spacing: { after: 0, before: 0 } })],
                shading: isHeader ? { fill: 'f4f4f5' } : undefined,
                width: { size: Math.floor(9638 / (cellTexts.length || 2)), type: WidthType.DXA },
                borders: {
                  top: borderConfig,
                  bottom: borderConfig,
                  left: borderConfig,
                  right: borderConfig,
                },
                margins: {
                  top: convertInchesToTwip(0.04),
                  bottom: convertInchesToTwip(0.04),
                  left: convertInchesToTwip(0.08),
                  right: convertInchesToTwip(0.08),
                },
              });
            });
            tableRows.push(new TableRow({ children: cells, cantSplit: true }));
          }
          
          if (tableRows.length > 0) {
            const fbRowCells = (tableRows[0] as any)?.options?.children;
            const fbColCount = fbRowCells ? fbRowCells.length : 2;
            const fbColWidthDxa = Math.floor(9638 / fbColCount);
            elements.push(
              new Table({
                rows: tableRows,
                width: { size: 9638, type: WidthType.DXA },
                columnWidths: Array(fbColCount).fill(fbColWidthDxa),
                borders: {
                  top: borderConfig,
                  bottom: borderConfig,
                  left: borderConfig,
                  right: borderConfig,
                  insideHorizontal: borderConfig,
                  insideVertical: borderConfig,
                },
              })
            );
            elements.push(new Paragraph({ children: [], spacing: { line: 300, after: 120 } }));
          }
        } else {
          // Normal paragraph
          const paragraphGroups = parseInlineContent(contentToken);
          for (const runs of paragraphGroups) {
            elements.push(new Paragraph({ children: runs, spacing: { line: 300, after: 120 }, alignment: AlignmentType.JUSTIFIED }));
          }
        }
      }
      i += 3; // paragraph_open, inline, paragraph_close
      continue;
    }

    // Handle code blocks
    if (token.type === 'fence' || token.type === 'code_block') {
      const codeLines = (token.content || '').split('\n');
      codeLines.forEach((line) => {
        elements.push(
          new Paragraph({
            children: [new TextRun({ text: line || ' ', font: getFontConfig(true), size: 20 })],
            shading: { fill: 'f4f4f5' },
            spacing: { line: 300, after: 120 },
          })
        );
      });
      i++;
      continue;
    }

    // Handle bullet lists
    if (token.type === 'bullet_list_open') {
      listLevel++;
      currentListType = 'bullet';
      i++;
      continue;
    }

    if (token.type === 'bullet_list_close') {
      listLevel--;
      if (listLevel < 0) currentListType = null;
      i++;
      continue;
    }

    // Handle ordered lists
    if (token.type === 'ordered_list_open') {
      listLevel++;
      // Create a unique numbering reference for each ordered list instance
      currentNumberRef = `ol-${orderedListIdx}`;
      orderedListIdx++;
      if (numberingConfigs) {
        numberingConfigs.push({ reference: currentNumberRef, levels: getNumberedLevels() });
      }
      currentListType = 'ordered';
      i++;
      continue;
    }

    if (token.type === 'ordered_list_close') {
      listLevel--;
      if (listLevel < 0) currentListType = null;
      i++;
      continue;
    }

    // Handle list items
    // Important: markdown-it represents list item text as paragraph/inline tokens INSIDE list_item_open/close.
    // If we don't consume those tokens here, the main loop will also process them as normal paragraphs,
    // resulting in duplicated lines in the exported DOCX.
    if (token.type === 'list_item_open') {
      const level = Math.max(0, listLevel);
      const numberingRef = currentListType === 'ordered' ? currentNumberRef : bulletRef;
      let wroteNumberedParagraph = false;

      // Consume the list_item_open
      i++;

      // Consume content tokens up until either the list_item_close or a nested list starts.
      while (i < tokens.length && tokens[i].type !== 'list_item_close') {
        const t = tokens[i];

        // Stop before nested lists so the outer loop can process them.
        if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
          break;
        }

        // Typical case: paragraph_open -> inline -> paragraph_close
        if (t.type === 'paragraph_open') {
          const contentToken = tokens[i + 1];
          if (contentToken?.type === 'inline') {
            const paragraphGroups = parseInlineContent(contentToken, true);
            // Each group becomes a separate paragraph for proper line separation
            for (let pIdx = 0; pIdx < paragraphGroups.length; pIdx++) {
              const runs = paragraphGroups[pIdx];
              const isFirst = pIdx === 0 && !wroteNumberedParagraph;
              elements.push(
                new Paragraph({
                  children: runs,
                  ...(isFirst
                    ? {
                        numbering: {
                          reference: numberingRef,
                          level,
                        },
                      }
                    : {
                        // Continuation paragraph inside the same list item (no extra bullet/number)
                        indent: { left: convertInchesToTwip(0.25 * (level + 1)) },
                      }),
                  spacing: { line: 300, after: 120 },
                })
              );
              wroteNumberedParagraph = true;
            }
          }

          i += 3; // paragraph_open, inline, paragraph_close
          continue;
        }

        // Tight list case: inline appears without a wrapping paragraph
        if (t.type === 'inline') {
          const paragraphGroups = parseInlineContent(t, true);
          for (let pIdx = 0; pIdx < paragraphGroups.length; pIdx++) {
            const runs = paragraphGroups[pIdx];
            const isFirst = pIdx === 0 && !wroteNumberedParagraph;
            elements.push(
              new Paragraph({
                children: runs,
                ...(isFirst
                  ? {
                      numbering: {
                        reference: numberingRef,
                        level,
                      },
                    }
                  : { indent: { left: convertInchesToTwip(0.25 * (level + 1)) } }),
                spacing: { line: 300, after: 120 },
              })
            );
            wroteNumberedParagraph = true;
          }
          i++;
          continue;
        }

        // Skip any other token types inside the list item (we don't render them directly here)
        i++;
      }

      // If there's no nested list, consume the list_item_close now.
      if (i < tokens.length && tokens[i].type === 'list_item_close') {
        i++;
      }

      continue;
    }

    if (token.type === 'list_item_close') {
      i++;
      continue;
    }

    // Handle blockquotes
    if (token.type === 'blockquote_open') {
      // Collect content until blockquote_close
      let j = i + 1;
      const quoteContent: string[] = [];
      
      while (j < tokens.length && tokens[j].type !== 'blockquote_close') {
        if (tokens[j].type === 'inline') {
          quoteContent.push(tokens[j].content || '');
        }
        j++;
      }

      elements.push(
        new Paragraph({
          children: createScriptAwareRuns({
            text: quoteContent.join(' '),
            italics: true,
            color: '64748b',
            size: 24,
          }),
          indent: { left: convertInchesToTwip(0.5) },
          border: {
            left: { style: BorderStyle.SINGLE, size: 24, color: '3b82f6' },
          },
          spacing: { line: 300, after: 120 },
        })
      );

      i = j + 1;
      continue;
    }

    // Handle tables
    if (token.type === 'table_open') {
      const tableRows: TableRow[] = [];
      let j = i + 1;
      let isHeader = false;
      // Track column alignments from token attrs
      const columnAlignments: string[] = [];

      while (j < tokens.length && tokens[j].type !== 'table_close') {
        if (tokens[j].type === 'thead_open') {
          isHeader = true;
        } else if (tokens[j].type === 'thead_close') {
          isHeader = false;
        } else if (tokens[j].type === 'tr_open') {
          const cells: TableCell[] = [];
          j++;
          let colIdx = 0;

          while (j < tokens.length && tokens[j].type !== 'tr_close') {
            if (tokens[j].type === 'th_open' || tokens[j].type === 'td_open') {
              const cellType = tokens[j].type;
              // Extract alignment from token attrs (markdown-it-multimd-table sets style attrs)
              const attrs = tokens[j].attrs;
              let cellAlignment: string = AlignmentType.LEFT;
              if (attrs) {
                for (const [key, val] of attrs) {
                  if (key === 'style' && val.includes('text-align')) {
                    if (val.includes('center')) cellAlignment = AlignmentType.CENTER;
                    else if (val.includes('right')) cellAlignment = AlignmentType.RIGHT;
                    else cellAlignment = AlignmentType.LEFT;
                  }
                }
              }
              // Store alignment for this column (from header row)
              if (isHeader && colIdx >= columnAlignments.length) {
                columnAlignments.push(cellAlignment);
              }
              // Use stored alignment for body rows
              const finalAlignment = (isHeader ? cellAlignment : (columnAlignments[colIdx] ?? AlignmentType.LEFT)) as typeof AlignmentType[keyof typeof AlignmentType];
              
              j++;
              
              if (tokens[j]?.type === 'inline') {
                const paragraphGroups = parseInlineContent(tokens[j]);
                const cellParagraphs = paragraphGroups.map(runs => 
                  new Paragraph({ 
                    children: runs,
                    spacing: { after: 0, before: 0 },
                    alignment: finalAlignment,
                  })
                );
                cells.push(
                  new TableCell({
                    children: cellParagraphs,
                    shading: cellType === 'th_open' || isHeader ? { fill: 'f4f4f5' } : undefined,
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: 'b0b0b0' },
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'b0b0b0' },
                      left: { style: BorderStyle.SINGLE, size: 6, color: 'b0b0b0' },
                      right: { style: BorderStyle.SINGLE, size: 6, color: 'b0b0b0' },
                    },
                    margins: {
                      top: convertInchesToTwip(0.04),
                      bottom: convertInchesToTwip(0.04),
                      left: convertInchesToTwip(0.08),
                      right: convertInchesToTwip(0.08),
                    },
                  })
                );
                j++; // skip inline content
                j++; // skip th_close/td_close
                colIdx++;
                continue;
              }
            }
            j++;
          }

          if (cells.length > 0) {
            tableRows.push(new TableRow({ children: cells, cantSplit: true }));
          }
        }
        j++;
      }

      if (tableRows.length > 0) {
        const borderConfig = {
          style: BorderStyle.SINGLE,
          size: 6,
          color: 'b0b0b0',
        };
        const mainFirstRow = tableRows[0] as any;
        const mainColCount = mainFirstRow?.options?.children?.length || 2;
        const mainColWidthDxa = Math.floor(9638 / mainColCount);
        tableRows.forEach((row: any) => {
          const rowCells = row?.options?.children;
          if (rowCells) {
            rowCells.forEach((cell: any) => {
              if (cell?.options) {
                cell.options.width = { size: mainColWidthDxa, type: WidthType.DXA };
              }
            });
          }
        });
        elements.push(
          new Table({
            rows: tableRows,
            width: { size: 9638, type: WidthType.DXA },
            columnWidths: Array(mainColCount).fill(mainColWidthDxa),
            borders: {
              top: borderConfig,
              bottom: borderConfig,
              left: borderConfig,
              right: borderConfig,
              insideHorizontal: borderConfig,
              insideVertical: borderConfig,
            },
          })
        );
        elements.push(new Paragraph({ children: [], spacing: { line: 300, after: 120 } }));
      }

      i = j + 1;
      continue;
    }

    // Handle horizontal rule
    if (token.type === 'hr') {
      elements.push(
        new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'e5e5e5' } },
          spacing: { line: 300, after: 120 },
        })
      );
      i++;
      continue;
    }

    // Handle HTML blocks (skip for now)
    if (token.type === 'html_block' || token.type === 'html_inline') {
      i++;
      continue;
    }

    i++;
  }

  return elements;
}

/**
 * Create a heading paragraph
 */
function createHeading(text: string, level: number): Paragraph {
  const headingMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };

  const sizeMap: Record<number, number> = {
    1: 48,
    2: 36,
    3: 28,
    4: 24,
    5: 22,
    6: 20,
  };

  const size = sizeMap[level] || 24;

  // Parse inline formatting in heading, including math
  const parsedRuns = parseInlineText(text);
  const children: (TextRun | DocxMath)[] = [];

  for (const run of parsedRuns) {
    if (run.isMath && run.latexContent) {
      // Emit native Word Math for math segments in headings
      const mathComponents = latexToMathComponents(run.latexContent);
      children.push(new DocxMath({ children: mathComponents }));
    } else {
      children.push(
        ...createScriptAwareRuns({
          text: run.text,
          bold: true,
          italics: run.italics,
          strike: run.strike,
          size,
          isCode: run.font === 'Consolas',
        })
      );
    }
  }

  return new Paragraph({
    heading: headingMap[level] || HeadingLevel.HEADING_1,
    children,
    spacing: { line: 300, after: 120 },
    alignment: AlignmentType.LEFT,
  });
}

interface TextRunOptions {
  text: string;
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  font?: string;
  highlight?: string;
  isMath?: boolean;
  latexContent?: string;
}

/**
 * Process text and convert LaTeX to readable format for DOCX
 */
function processLatexForDocx(text: string): string {
  let result = text;
  
  // Process display math ($$...$$)
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
    return `[${latexToPlainText(latex.trim())}]`;
  });
  
  // Process inline math ($...$)
  result = result.replace(/\$([^\$\n]+?)\$/g, (_, latex) => {
    return latexToPlainText(latex.trim());
  });
  
  return result;
}

/**
 * Extract a brace-delimited group from a string, properly handling nested braces.
 * Starts at the position of the opening '{'.
 * Returns { content, endIndex } where endIndex is the index AFTER the closing '}'.
 */
function extractBracedGroup(str: string, startIndex: number): { content: string; endIndex: number } | null {
  if (str[startIndex] !== '{') return null;
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: str.slice(startIndex + 1, i), endIndex: i + 1 };
      }
    }
  }
  // Unmatched brace -- return rest of string
  return { content: str.slice(startIndex + 1), endIndex: str.length };
}

/**
 * Unicode command map for MathRun rendering
 */
const MATH_CMD_MAP: Record<string, string> = {
  'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε',
  'varepsilon': 'ε', 'zeta': 'ζ', 'eta': 'η', 'theta': 'θ', 'vartheta': 'ϑ',
  'iota': 'ι', 'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ', 'nu': 'ν',
  'xi': 'ξ', 'pi': 'π', 'varpi': 'ϖ', 'rho': 'ρ', 'varrho': 'ϱ',
  'sigma': 'σ', 'varsigma': 'ς', 'tau': 'τ', 'upsilon': 'υ', 'phi': 'φ',
  'varphi': 'ϕ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω',
  'Gamma': 'Γ', 'Delta': 'Δ', 'Theta': 'Θ', 'Lambda': 'Λ', 'Xi': 'Ξ',
  'Pi': 'Π', 'Sigma': 'Σ', 'Phi': 'Φ', 'Psi': 'Ψ', 'Omega': 'Ω',
  'times': '×', 'div': '÷', 'pm': '±', 'mp': '∓', 'cdot': '·',
  'leq': '≤', 'geq': '≥', 'neq': '≠', 'ne': '≠', 'approx': '≈', 'equiv': '≡',
  'sim': '∼', 'propto': '∝',
  'infty': '∞', 'partial': '∂', 'nabla': '∇',
  'ldots': '…', 'cdots': '⋯', 'vdots': '⋮', 'ddots': '⋱',
  'rightarrow': '→', 'leftarrow': '←', 'Rightarrow': '⇒', 'Leftarrow': '⇐',
  'leftrightarrow': '↔', 'Leftrightarrow': '⇔',
  'to': '→', 'gets': '←', 'iff': '⇔', 'implies': '⇒',
  'in': '∈', 'notin': '∉', 'subset': '⊂', 'supset': '⊃',
  'subseteq': '⊆', 'supseteq': '⊇', 'cup': '∪', 'cap': '∩',
  'forall': '∀', 'exists': '∃', 'neg': '¬', 'land': '∧', 'lor': '∨',
  'mid': '|', 'langle': '⟨', 'rangle': '⟩',
  'lceil': '⌈', 'rceil': '⌉', 'lfloor': '⌊', 'rfloor': '⌋',
  // Additional integrals
  'iint': '∬', 'iiint': '∭', 'oint': '∮',
  // Spacing & misc
  'hline': '', 'quad': '  ', 'qquad': '    ',
  ',': ' ', ';': ' ', '!': '', ':': ' ',
  'left': '', 'right': '',
  // Arrows
  'uparrow': '↑', 'downarrow': '↓', 'mapsto': '↦',
  'hookrightarrow': '↪', 'hookleftarrow': '↩',
  'longrightarrow': '⟶', 'longleftarrow': '⟵',
  'Longrightarrow': '⟹', 'Longleftarrow': '⟸',
  'longmapsto': '⟼', 'nearrow': '↗', 'searrow': '↘',
  'nwarrow': '↖', 'swarrow': '↙',
  // Additional symbols
  'dagger': '†', 'ddagger': '‡', 'star': '⋆', 'circ': '∘',
  'bullet': '∙', 'diamond': '⋄', 'triangle': '△', 'triangledown': '▽',
  'triangleleft': '◁', 'triangleright': '▷',
  'square': '□', 'blacksquare': '■', 'lozenge': '◊',
  'bigcirc': '◯', 'oplus': '⊕', 'otimes': '⊗', 'odot': '⊙',
  'oslash': '⊘', 'ominus': '⊖',
  'amalg': '⨿', 'ast': '∗', 'setminus': '∖', 'backslash': '∖',
  'wr': '≀', 'surd': '√',
  // Comparison & relations
  'll': '≪', 'gg': '≫', 'le': '≤', 'ge': '≥',
  'prec': '≺', 'succ': '≻', 'preceq': '⪯', 'succeq': '⪰',
  'cong': '≅', 'simeq': '≃', 'doteq': '≐',
  'perp': '⊥', 'parallel': '∥', 'asymp': '≍',
  'bowtie': '⋈', 'vdash': '⊢', 'dashv': '⊣',
  'models': '⊨', 'smile': '⌣', 'frown': '⌢',
  // Dots
  'dots': '…',
  // Logic
  'therefore': '∴', 'because': '∵',
  'emptyset': '∅', 'varnothing': '∅',
  // Misc
  'aleph': 'ℵ', 'hbar': 'ℏ', 'ell': 'ℓ', 'wp': '℘',
  'Re': 'ℜ', 'Im': 'ℑ', 'complement': '∁',
  'angle': '∠', 'measuredangle': '∡',
  'prime': '′', 'backprime': '‵',
  'flat': '♭', 'natural': '♮', 'sharp': '♯',
  'clubsuit': '♣', 'diamondsuit': '♢', 'heartsuit': '♡', 'spadesuit': '♠',
  'checkmark': '✓', 'maltese': '✠',
};

/**
 * Blackboard bold Unicode map
 */
const BB_MAP: Record<string, string> = {
  'R': 'ℝ', 'Z': 'ℤ', 'N': 'ℕ', 'Q': 'ℚ', 'C': 'ℂ', 'P': 'ℙ',
  'H': 'ℍ', 'E': '𝔼', 'F': '𝔽',
};

/**
 * Unicode calligraphic (script) map for \mathcal
 */
const MATHCAL_MAP: Record<string, string> = {
  'A': '𝒜', 'B': 'ℬ', 'C': '𝒞', 'D': '𝒟', 'E': 'ℰ', 'F': 'ℱ',
  'G': '𝒢', 'H': 'ℋ', 'I': 'ℐ', 'J': '𝒥', 'K': '𝒦', 'L': 'ℒ',
  'M': 'ℳ', 'N': '𝒩', 'O': '𝒪', 'P': '𝒫', 'Q': '𝒬', 'R': 'ℛ',
  'S': '𝒮', 'T': '𝒯', 'U': '𝒰', 'V': '𝒱', 'W': '𝒲', 'X': '𝒳',
  'Y': '𝒴', 'Z': '𝒵',
};

/**
 * Unicode combining accent map for \hat, \bar, etc.
 */
const ACCENT_MAP: Record<string, string> = {
  'hat': '\u0302',   // combining circumflex accent
  'bar': '\u0304',   // combining macron
  'overline': '\u0304',
  'tilde': '\u0303', // combining tilde
  'vec': '\u20D7',   // combining right arrow above
  'dot': '\u0307',   // combining dot above
  'ddot': '\u0308',  // combining diaeresis
  'check': '\u030C', // combining caron
  'breve': '\u0306', // combining breve
  'acute': '\u0301', // combining acute
  'grave': '\u0300', // combining grave
  'widehat': '\u0302',
  'widetilde': '\u0303',
};

/**
 * Named math functions that should use MathFunction
 */
const NAMED_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan',
  'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp',
  'det', 'dim', 'ker', 'hom',
  'max', 'min', 'sup', 'inf',
  'gcd', 'lcm', 'deg', 'arg',
]);

/**
 * Render a LaTeX environment (\begin{env}...\end{env}) into MathComponents.
 * Handles matrix, pmatrix, bmatrix, vmatrix, cases, aligned, array.
 */
function renderEnvironment(envName: string, content: string): MathComponent[] {
  // Parse rows by \\ and columns by &
  const rows = content.split(/\\\\/).map(r => r.trim()).filter(r => r.length > 0 && r !== '\\hline');

  switch (envName) {
    case 'pmatrix': {
      const cellComponents = renderMatrixCells(rows);
      return [new MathRoundBrackets({ children: cellComponents })];
    }
    case 'bmatrix': {
      const cellComponents = renderMatrixCells(rows);
      return [new MathSquareBrackets({ children: cellComponents })];
    }
    case 'Bmatrix': {
      const cellComponents = renderMatrixCells(rows);
      return [new MathCurlyBrackets({ children: cellComponents })];
    }
    case 'vmatrix': {
      const cellComponents = renderMatrixCells(rows);
      return [new MathRun('|'), ...cellComponents, new MathRun('|')];
    }
    case 'Vmatrix': {
      const cellComponents = renderMatrixCells(rows);
      return [new MathRun('‖'), ...cellComponents, new MathRun('‖')];
    }
    case 'matrix': {
      return renderMatrixCells(rows);
    }
    case 'smallmatrix': {
      // Same as matrix but conceptually smaller - Word doesn't have a size variant
      return renderMatrixCells(rows);
    }
    case 'cases': {
      const caseComponents: MathComponent[] = [];
      rows.forEach((row, idx) => {
        if (idx > 0) caseComponents.push(new MathRun('; '));
        const cols = row.split('&').map(c => c.trim());
        if (cols.length >= 2) {
          caseComponents.push(...latexToMathComponents(cols[0]));
          caseComponents.push(new MathRun(' if '));
          caseComponents.push(...latexToMathComponents(cols[1]));
        } else {
          caseComponents.push(...latexToMathComponents(cols[0]));
        }
      });
      return [new MathCurlyBrackets({ children: caseComponents })];
    }
    case 'rcases': {
      // Right-side brace version of cases
      const rcaseComponents: MathComponent[] = [];
      rows.forEach((row, idx) => {
        if (idx > 0) rcaseComponents.push(new MathRun('; '));
        const cols = row.split('&').map(c => c.trim());
        rcaseComponents.push(...latexToMathComponents(cols.join(' ')));
      });
      return [...rcaseComponents, new MathRun('}')];
    }
    case 'aligned':
    case 'align':
    case 'align*': {
      const alignedComponents: MathComponent[] = [];
      rows.forEach((row, idx) => {
        if (idx > 0) alignedComponents.push(new MathRun('; '));
        const cleaned = row.replace(/&/g, ' ').trim();
        alignedComponents.push(...latexToMathComponents(cleaned));
      });
      return alignedComponents;
    }
    case 'gathered':
    case 'gather':
    case 'gather*': {
      // Like aligned but centered (no alignment points)
      const gatheredComponents: MathComponent[] = [];
      rows.forEach((row, idx) => {
        if (idx > 0) gatheredComponents.push(new MathRun('; '));
        gatheredComponents.push(...latexToMathComponents(row.trim()));
      });
      return gatheredComponents;
    }
    case 'split': {
      // Like aligned but within a single equation number
      const splitComponents: MathComponent[] = [];
      rows.forEach((row, idx) => {
        if (idx > 0) splitComponents.push(new MathRun('; '));
        const cleaned = row.replace(/&/g, ' ').trim();
        splitComponents.push(...latexToMathComponents(cleaned));
      });
      return splitComponents;
    }
    case 'multline':
    case 'multline*': {
      const multiComponents: MathComponent[] = [];
      rows.forEach((row, idx) => {
        if (idx > 0) multiComponents.push(new MathRun('; '));
        multiComponents.push(...latexToMathComponents(row.trim()));
      });
      return multiComponents;
    }
    case 'equation':
    case 'equation*':
    case 'displaymath': {
      // Single equation - just render the content
      return latexToMathComponents(content.trim());
    }
    case 'array': {
      return renderMatrixCells(rows);
    }
    default: {
      // Unknown environment - try to parse content as math before falling back to plain text
      const mathResult = latexToMathComponents(content.trim());
      if (mathResult.length > 0) return mathResult;
      const plainText = latexToPlainText(content);
      return [new MathRun(plainText)];
    }
  }
}

/**
 * Render matrix rows/columns into flat MathComponent array with comma/semicolon separators.
 */
function renderMatrixCells(rows: string[]): MathComponent[] {
  const components: MathComponent[] = [];
  rows.forEach((row, rowIdx) => {
    if (rowIdx > 0) components.push(new MathRun('; '));
    const cols = row.split('&').map(c => c.replace(/\\hline/g, '').trim()).filter(Boolean);
    cols.forEach((col, colIdx) => {
      if (colIdx > 0) components.push(new MathRun(', '));
      components.push(...latexToMathComponents(col));
    });
  });
  return components;
}

/**
 * Parse a LaTeX string into native Word Math components.
 * Uses brace-depth counting for proper nested brace handling.
 */
function latexToMathComponents(latex: string): MathComponent[] {
  const components: MathComponent[] = [];
  let pos = 0;

  while (pos < latex.length) {
    // Skip whitespace
    if (latex[pos] === ' ' || latex[pos] === '\t') {
      pos++;
      continue;
    }

    // --- \frac, \dfrac, \tfrac, \cfrac ---
    if (latex.startsWith('\\frac', pos) || latex.startsWith('\\dfrac', pos) || 
        latex.startsWith('\\tfrac', pos) || latex.startsWith('\\cfrac', pos)) {
      const cmdLen = latex.startsWith('\\frac', pos) ? 5 : 6;
      pos += cmdLen;
      const num = extractBracedGroup(latex, pos);
      if (num) {
        pos = num.endIndex;
        const den = extractBracedGroup(latex, pos);
        if (den) {
          pos = den.endIndex;
          components.push(new MathFraction({
            numerator: latexToMathComponents(num.content),
            denominator: latexToMathComponents(den.content),
          }));
          continue;
        }
      }
      components.push(new MathRun('frac'));
      continue;
    }

    // --- \sqrt[degree]{content} or \sqrt{content} ---
    if (latex.startsWith('\\sqrt', pos)) {
      pos += 5;
      let degree: MathComponent[] | undefined;
      if (latex[pos] === '[') {
        const closeB = latex.indexOf(']', pos);
        if (closeB !== -1) {
          degree = latexToMathComponents(latex.slice(pos + 1, closeB));
          pos = closeB + 1;
        }
      }
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        components.push(new MathRadical({
          children: latexToMathComponents(body.content),
          degree,
        }));
        continue;
      }
      components.push(new MathRun('√'));
      continue;
    }

    // --- \sum, \prod ---
    if (latex.startsWith('\\sum', pos) || latex.startsWith('\\prod', pos)) {
      const isSum = latex.startsWith('\\sum', pos);
      pos += isSum ? 4 : 5;
      const { sub, sup, newPos } = parseSubSuperScriptAt(latex, pos);
      pos = newPos;
      // Collect the next token as children
      const children = parseNextMathToken(latex, pos);
      pos = children.newPos;
      components.push(new MathSum({
        children: children.components,
        subScript: sub,
        superScript: sup,
      }));
      continue;
    }

    // --- \int ---
    if (latex.startsWith('\\int', pos)) {
      pos += 4;
      const { sub, sup, newPos } = parseSubSuperScriptAt(latex, pos);
      pos = newPos;
      const children = parseNextMathToken(latex, pos);
      pos = children.newPos;
      components.push(new MathIntegral({
        children: children.components,
        subScript: sub,
        superScript: sup,
      }));
      continue;
    }

    // --- \lim ---
    if (latex.startsWith('\\lim', pos)) {
      pos += 4;
      const { sub, newPos } = parseSubSuperScriptAt(latex, pos);
      pos = newPos;
      if (sub) {
        components.push(new MathLimitLower({
          children: [new MathRun('lim')],
          limit: sub,
        }));
      } else {
        components.push(new MathFunction({
          name: [new MathRun('lim')],
          children: [],
        }));
      }
      continue;
    }

    // --- \left( ... \right) and similar delimiters ---
    if (latex.startsWith('\\left', pos)) {
      pos += 5;
      // Determine opening delimiter
      let openDelim = '';
      if (latex.startsWith('\\{', pos)) {
        openDelim = '{'; pos += 2;
      } else if (latex.startsWith('\\|', pos)) {
        openDelim = '‖'; pos += 2;
      } else if (pos < latex.length) {
        openDelim = latex[pos]; pos++;
      }
      // Find matching \right
      const rightIdx = findMatchingRight(latex, pos);
      if (rightIdx !== -1) {
        const inner = latex.slice(pos, rightIdx);
        pos = rightIdx + 6; // skip \right
        // Skip closing delimiter
        if (latex.startsWith('\\}', pos)) {
          pos += 2;
        } else if (latex.startsWith('\\|', pos)) {
          pos += 2;
        } else if (pos < latex.length) {
          pos++;
        }
        const innerComponents = latexToMathComponents(inner);
        // Choose bracket type based on opening delimiter
        if (openDelim === '{') {
          components.push(new MathCurlyBrackets({ children: innerComponents }));
        } else if (openDelim === '[') {
          components.push(new MathSquareBrackets({ children: innerComponents }));
        } else if (openDelim === '|') {
          components.push(new MathRun('|'), ...innerComponents, new MathRun('|'));
        } else if (openDelim === '‖') {
          components.push(new MathRun('‖'), ...innerComponents, new MathRun('‖'));
        } else if (openDelim === '⟨' || openDelim === '<') {
          components.push(new MathAngledBrackets({ children: innerComponents }));
        } else if (openDelim === '.') {
          // Invisible delimiter - just output content
          components.push(...innerComponents);
        } else {
          components.push(new MathRoundBrackets({ children: innerComponents }));
        }
        continue;
      }
    }

    // --- \begin{env}...\end{env} ---
    if (latex.startsWith('\\begin{', pos)) {
      const envNameEnd = latex.indexOf('}', pos + 7);
      if (envNameEnd !== -1) {
        const envName = latex.slice(pos + 7, envNameEnd);
        const endTag = `\\end{${envName}}`;
        const endIdx = latex.indexOf(endTag, envNameEnd);
        if (endIdx !== -1) {
          const envContent = latex.slice(envNameEnd + 1, endIdx);
          pos = endIdx + endTag.length;
          const envComponents = renderEnvironment(envName, envContent);
          components.push(...envComponents);
          continue;
        }
      }
    }

    // --- \binom, \dbinom, \tbinom ---
    if (latex.startsWith('\\binom', pos) || latex.startsWith('\\dbinom', pos) || latex.startsWith('\\tbinom', pos)) {
      const cmdLen = latex.startsWith('\\binom', pos) ? 6 : 7;
      pos += cmdLen;
      const top = extractBracedGroup(latex, pos);
      if (top) {
        pos = top.endIndex;
        const bottom = extractBracedGroup(latex, pos);
        if (bottom) {
          pos = bottom.endIndex;
          components.push(new MathRoundBrackets({
            children: [new MathFraction({
              numerator: latexToMathComponents(top.content),
              denominator: latexToMathComponents(bottom.content),
            })],
          }));
          continue;
        }
      }
      components.push(new MathRun('C'));
      continue;
    }

    // --- \overset{top}{base} ---
    if (latex.startsWith('\\overset', pos)) {
      pos += 8;
      const topGroup = extractBracedGroup(latex, pos);
      if (topGroup) {
        pos = topGroup.endIndex;
        const baseGroup = extractBracedGroup(latex, pos);
        if (baseGroup) {
          pos = baseGroup.endIndex;
          components.push(new MathLimitUpper({
            children: latexToMathComponents(baseGroup.content),
            limit: latexToMathComponents(topGroup.content),
          }));
          continue;
        }
      }
    }

    // --- \underset{bottom}{base} ---
    if (latex.startsWith('\\underset', pos)) {
      pos += 9;
      const bottomGroup = extractBracedGroup(latex, pos);
      if (bottomGroup) {
        pos = bottomGroup.endIndex;
        const baseGroup = extractBracedGroup(latex, pos);
        if (baseGroup) {
          pos = baseGroup.endIndex;
          components.push(new MathLimitLower({
            children: latexToMathComponents(baseGroup.content),
            limit: latexToMathComponents(bottomGroup.content),
          }));
          continue;
        }
      }
    }

    // --- \stackrel{top}{bottom} ---
    if (latex.startsWith('\\stackrel', pos)) {
      pos += 9;
      const topGroup = extractBracedGroup(latex, pos);
      if (topGroup) {
        pos = topGroup.endIndex;
        const baseGroup = extractBracedGroup(latex, pos);
        if (baseGroup) {
          pos = baseGroup.endIndex;
          components.push(new MathLimitUpper({
            children: latexToMathComponents(baseGroup.content),
            limit: latexToMathComponents(topGroup.content),
          }));
          continue;
        }
      }
    }

    // --- \substack{a \\ b \\ c} - multiline subscript ---
    if (latex.startsWith('\\substack', pos)) {
      pos += 9;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        const lines = body.content.split(/\\\\/).map(l => l.trim()).filter(Boolean);
        const subComponents: MathComponent[] = [];
        lines.forEach((line, idx) => {
          if (idx > 0) subComponents.push(new MathRun(', '));
          subComponents.push(...latexToMathComponents(line));
        });
        components.push(...subComponents);
        continue;
      }
    }

    // --- \xrightarrow[below]{above}, \xleftarrow[below]{above} ---
    if (latex.startsWith('\\xrightarrow', pos) || latex.startsWith('\\xleftarrow', pos)) {
      const isRight = latex.startsWith('\\xrightarrow', pos);
      pos += isRight ? 12 : 11;
      let belowContent: string | undefined;
      // Optional [below]
      if (latex[pos] === '[') {
        const closeB = latex.indexOf(']', pos);
        if (closeB !== -1) {
          belowContent = latex.slice(pos + 1, closeB);
          pos = closeB + 1;
        }
      }
      // Required {above}
      const above = extractBracedGroup(latex, pos);
      if (above) {
        pos = above.endIndex;
        const arrowSymbol = isRight ? '→' : '←';
        if (belowContent) {
          components.push(new MathLimitLower({
            children: [new MathLimitUpper({
              children: [new MathRun(arrowSymbol)],
              limit: latexToMathComponents(above.content),
            })],
            limit: latexToMathComponents(belowContent),
          }));
        } else {
          components.push(new MathLimitUpper({
            children: [new MathRun(arrowSymbol)],
            limit: latexToMathComponents(above.content),
          }));
        }
        continue;
      }
      components.push(new MathRun(isRight ? '→' : '←'));
      continue;
    }

    // --- \cancel{content}, \bcancel{content}, \xcancel{content} ---
    if (latex.startsWith('\\cancel', pos) || latex.startsWith('\\bcancel', pos) || latex.startsWith('\\xcancel', pos)) {
      const cmdMatch2 = latex.slice(pos).match(/^\\[bx]?cancel/);
      if (cmdMatch2) {
        pos += cmdMatch2[0].length;
        const body = extractBracedGroup(latex, pos);
        if (body) {
          pos = body.endIndex;
          // OMML doesn't have strikethrough math - render content with visual indicator
          components.push(...latexToMathComponents(body.content));
          continue;
        }
      }
    }

    // --- \phantom{content}, \hphantom{content}, \vphantom{content} ---
    if (latex.startsWith('\\phantom', pos) || latex.startsWith('\\hphantom', pos) || latex.startsWith('\\vphantom', pos)) {
      const phantomMatch = latex.slice(pos).match(/^\\[hv]?phantom/);
      if (phantomMatch) {
        pos += phantomMatch[0].length;
        const body = extractBracedGroup(latex, pos);
        if (body) {
          pos = body.endIndex;
          // Phantom creates invisible space - approximate with spaces
          components.push(new MathRun(' '.repeat(Math.max(1, body.content.length))));
          continue;
        }
      }
    }

    // --- \color{colorname}{content} ---
    if (latex.startsWith('\\color', pos)) {
      pos += 6;
      const colorBody = extractBracedGroup(latex, pos);
      if (colorBody) {
        pos = colorBody.endIndex;
        // Check if next char starts content group
        if (latex[pos] === '{') {
          const contentBody = extractBracedGroup(latex, pos);
          if (contentBody) {
            pos = contentBody.endIndex;
            // OMML doesn't support color - just render content
            components.push(...latexToMathComponents(contentBody.content));
            continue;
          }
        }
        // \color{red} without braced content - color applies to rest
        // Just continue parsing
        continue;
      }
    }

    // --- \tag{...} and \notag ---
    if (latex.startsWith('\\tag', pos)) {
      pos += 4;
      if (latex[pos] === '*') pos++; // \tag*
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        components.push(new MathRun(`(${body.content})`));
        continue;
      }
    }
    if (latex.startsWith('\\notag', pos)) {
      pos += 6;
      continue;
    }

    // --- \choose (old TeX binomial) ---
    if (latex.startsWith('\\choose', pos)) {
      pos += 7;
      // \choose splits: {n \choose k} → treat preceding components as numerator
      const numComponents = components.splice(0, components.length);
      const rest = latex.slice(pos);
      const denomComponents = latexToMathComponents(rest);
      components.push(new MathRoundBrackets({
        children: [new MathFraction({
          numerator: numComponents,
          denominator: denomComponents,
        })],
      }));
      pos = latex.length; // consumed everything
      continue;
    }

    // --- \mathcal{X} ---
    if (latex.startsWith('\\mathcal', pos)) {
      pos += 8;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        const mapped = [...body.content].map(c => MATHCAL_MAP[c] ?? c).join('');
        components.push(new MathRun(mapped));
        continue;
      }
    }

    // --- \mathrm{...} ---
    if (latex.startsWith('\\mathrm', pos)) {
      pos += 7;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        // Parse content for subscripts/superscripts inside mathrm
        components.push(...latexToMathComponents(body.content));
        continue;
      }
    }

    // --- \mathbf{...} ---
    if (latex.startsWith('\\mathbf', pos)) {
      pos += 7;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        components.push(...latexToMathComponents(body.content));
        continue;
      }
    }

    // --- Accent commands: \hat{x}, \bar{x}, etc. ---
    if (latex[pos] === '\\') {
      const accentMatch = latex.slice(pos).match(/^\\(hat|bar|overline|tilde|vec|dot|ddot|check|breve|acute|grave|widehat|widetilde)/);
      if (accentMatch && ACCENT_MAP[accentMatch[1]]) {
        const accentCmd = accentMatch[1];
        pos += accentMatch[0].length;
        const body = extractBracedGroup(latex, pos);
        if (body) {
          pos = body.endIndex;
          // Render content with combining accent
          const innerText = body.content;
          components.push(new MathRun(innerText + ACCENT_MAP[accentCmd]));
          continue;
        } else if (pos < latex.length && latex[pos] !== '\\') {
          // Single char without braces: \hat x
          components.push(new MathRun(latex[pos] + ACCENT_MAP[accentCmd]));
          pos++;
          continue;
        }
      }
    }

    // --- \overbrace{content}^{label} ---
    if (latex.startsWith('\\overbrace', pos)) {
      pos += 10;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        const innerComponents = latexToMathComponents(body.content);
        // Check for ^{label}
        if (latex[pos] === '^') {
          pos++;
          if (latex[pos] === '{') {
            const label = extractBracedGroup(latex, pos);
            if (label) {
              pos = label.endIndex;
              components.push(new MathLimitUpper({
                children: innerComponents,
                limit: latexToMathComponents(label.content),
              }));
              continue;
            }
          }
        }
        components.push(...innerComponents);
        continue;
      }
    }

    // --- \underbrace{content}_{label} ---
    if (latex.startsWith('\\underbrace', pos)) {
      pos += 11;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        const innerComponents = latexToMathComponents(body.content);
        // Check for _{label}
        if (latex[pos] === '_') {
          pos++;
          if (latex[pos] === '{') {
            const label = extractBracedGroup(latex, pos);
            if (label) {
              pos = label.endIndex;
              components.push(new MathLimitLower({
                children: innerComponents,
                limit: latexToMathComponents(label.content),
              }));
              continue;
            }
          }
        }
        components.push(...innerComponents);
        continue;
      }
    }

    // --- \boxed{content} ---
    if (latex.startsWith('\\boxed', pos)) {
      pos += 6;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        // No MathBorderBox in docx - render content normally
        components.push(...latexToMathComponents(body.content));
        continue;
      }
    }

    // --- \overrightarrow{...}, \overleftarrow{...} ---
    if (latex.startsWith('\\overrightarrow', pos) || latex.startsWith('\\overleftarrow', pos)) {
      const cmdLen = latex.startsWith('\\overrightarrow', pos) ? 15 : 14;
      pos += cmdLen;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        components.push(new MathRun(body.content + '\u20D7'));
        continue;
      }
    }

    // --- \text{...} ---
    if (latex.startsWith('\\text', pos) && latex[pos + 5] === '{') {
      pos += 5;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        components.push(new MathRun(body.content));
        continue;
      }
    }

    // --- \mathbb{X} ---
    if (latex.startsWith('\\mathbb', pos)) {
      pos += 7;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        components.push(new MathRun(BB_MAP[body.content] ?? body.content));
        continue;
      }
    }

    // --- \operatorname{...} ---
    if (latex.startsWith('\\operatorname', pos)) {
      pos += 13;
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        components.push(new MathFunction({
          name: [new MathRun(body.content)],
          children: [],
        }));
        continue;
      }
    }

    // --- Named functions: \sin, \cos, etc. ---
    const cmdMatch = latex.slice(pos).match(/^\\([a-zA-Z]+)/);
    if (cmdMatch) {
      const cmd = cmdMatch[1];
      if (NAMED_FUNCTIONS.has(cmd)) {
        pos += cmdMatch[0].length;
        // Check for subscript on the function (e.g., \log_2)
        const { sub, newPos } = parseSubSuperScriptAt(latex, pos);
        pos = newPos;
        const funcName: MathComponent[] = sub
          ? [new MathSubScript({ children: [new MathRun(cmd)], subScript: sub })]
          : [new MathRun(cmd)];
        components.push(new MathFunction({
          name: funcName,
          children: [],
        }));
        continue;
      }

      // Known symbol command
      if (MATH_CMD_MAP[cmd] !== undefined) {
        pos += cmdMatch[0].length;
        // Skip spacing commands
        if (cmd === ',' || cmd === ';' || cmd === 'quad' || cmd === 'qquad' ||
            cmd === 'left' || cmd === 'right') {
          if (MATH_CMD_MAP[cmd]) components.push(new MathRun(MATH_CMD_MAP[cmd]));
          continue;
        }
        components.push(new MathRun(MATH_CMD_MAP[cmd]));
        continue;
      }

      // Unknown command with braced arg - just render content
      pos += cmdMatch[0].length;
      if (pos < latex.length && latex[pos] === '{') {
        const body = extractBracedGroup(latex, pos);
        if (body) {
          pos = body.endIndex;
          components.push(...latexToMathComponents(body.content));
          continue;
        }
      }
      // Unknown command without args - render name
      components.push(new MathRun(cmd));
      continue;
    }

    // --- Superscript ^{...} or ^x ---
    if (latex[pos] === '^') {
      pos++;
      let supComponents: MathComponent[];
      if (latex[pos] === '{') {
        const body = extractBracedGroup(latex, pos);
        if (body) {
          pos = body.endIndex;
          supComponents = latexToMathComponents(body.content);
        } else {
          supComponents = [new MathRun('')];
        }
      } else if (pos < latex.length) {
        supComponents = [new MathRun(latex[pos])];
        pos++;
      } else {
        supComponents = [new MathRun('')];
      }
      const base = components.length > 0 ? components.pop()! : new MathRun('');
      // Check for combined sub+superscript
      if (latex[pos] === '_') {
        pos++;
        let subComponents: MathComponent[];
        if (latex[pos] === '{') {
          const body = extractBracedGroup(latex, pos);
          if (body) {
            pos = body.endIndex;
            subComponents = latexToMathComponents(body.content);
          } else {
            subComponents = [new MathRun('')];
          }
        } else if (pos < latex.length) {
          subComponents = [new MathRun(latex[pos])];
          pos++;
        } else {
          subComponents = [new MathRun('')];
        }
        components.push(new MathSubSuperScript({
          children: [base],
          superScript: supComponents,
          subScript: subComponents,
        }));
      } else {
        components.push(new MathSuperScript({
          children: [base],
          superScript: supComponents,
        }));
      }
      continue;
    }

    // --- Subscript _{...} or _x ---
    if (latex[pos] === '_') {
      pos++;
      let subComponents: MathComponent[];
      if (latex[pos] === '{') {
        const body = extractBracedGroup(latex, pos);
        if (body) {
          pos = body.endIndex;
          subComponents = latexToMathComponents(body.content);
        } else {
          subComponents = [new MathRun('')];
        }
      } else if (pos < latex.length) {
        subComponents = [new MathRun(latex[pos])];
        pos++;
      } else {
        subComponents = [new MathRun('')];
      }
      const base = components.length > 0 ? components.pop()! : new MathRun('');
      // Check for combined sub+superscript: x_{a}^{b}
      if (latex[pos] === '^') {
        pos++;
        let supComponents: MathComponent[];
        if (latex[pos] === '{') {
          const body = extractBracedGroup(latex, pos);
          if (body) {
            pos = body.endIndex;
            supComponents = latexToMathComponents(body.content);
          } else {
            supComponents = [new MathRun('')];
          }
        } else if (pos < latex.length) {
          supComponents = [new MathRun(latex[pos])];
          pos++;
        } else {
          supComponents = [new MathRun('')];
        }
        components.push(new MathSubSuperScript({
          children: [base],
          subScript: subComponents,
          superScript: supComponents,
        }));
      } else {
        components.push(new MathSubScript({
          children: [base],
          subScript: subComponents,
        }));
      }
      continue;
    }

    // --- Skip braces ---
    if (latex[pos] === '{') {
      const body = extractBracedGroup(latex, pos);
      if (body) {
        pos = body.endIndex;
        components.push(...latexToMathComponents(body.content));
        continue;
      }
    }
    if (latex[pos] === '}') {
      pos++;
      continue;
    }

    // --- \\ (newline in environments) ---
    if (latex[pos] === '\\' && pos + 1 < latex.length && latex[pos + 1] === '\\') {
      pos += 2;
      components.push(new MathRun('; '));
      continue;
    }

    // --- '\ ' (backslash-space = spacing command) ---
    if (latex[pos] === '\\' && pos + 1 < latex.length && latex[pos + 1] === ' ') {
      components.push(new MathRun(' '));
      pos += 2;
      continue;
    }

    // --- '-' (hyphen → Unicode minus sign) ---
    if (latex[pos] === '-') {
      components.push(new MathRun('\u2212'));
      pos++;
      continue;
    }

    // --- Plain text segment ---
    const plainMatch = latex.slice(pos).match(/^[^\\^_{}$\s\-]+/);
    if (plainMatch) {
      components.push(new MathRun(plainMatch[0]));
      pos += plainMatch[0].length;
      continue;
    }

    // Single character fallback
    components.push(new MathRun(latex[pos]));
    pos++;
  }

  return components;
}

/**
 * Parse optional subscript and superscript at current position.
 * Handles _{ } and ^{ } in either order.
 */
function parseSubSuperScriptAt(latex: string, pos: number): {
  sub?: MathComponent[];
  sup?: MathComponent[];
  newPos: number;
} {
  let sub: MathComponent[] | undefined;
  let sup: MathComponent[] | undefined;
  // Skip spaces
  while (pos < latex.length && latex[pos] === ' ') pos++;

  for (let pass = 0; pass < 2; pass++) {
    while (pos < latex.length && latex[pos] === ' ') pos++;
    if (latex[pos] === '_') {
      pos++;
      if (latex[pos] === '{') {
        const body = extractBracedGroup(latex, pos);
        if (body) { sub = latexToMathComponents(body.content); pos = body.endIndex; }
      } else if (pos < latex.length) {
        sub = [new MathRun(latex[pos])]; pos++;
      }
    } else if (latex[pos] === '^') {
      pos++;
      if (latex[pos] === '{') {
        const body = extractBracedGroup(latex, pos);
        if (body) { sup = latexToMathComponents(body.content); pos = body.endIndex; }
      } else if (pos < latex.length) {
        sup = [new MathRun(latex[pos])]; pos++;
      }
    } else {
      break;
    }
  }
  return { sub, sup, newPos: pos };
}

/**
 * Parse the next single math token at position (a braced group or single char/command).
 */
function parseNextMathToken(latex: string, pos: number): { components: MathComponent[]; newPos: number } {
  while (pos < latex.length && latex[pos] === ' ') pos++;
  if (pos >= latex.length) return { components: [], newPos: pos };

  if (latex[pos] === '{') {
    const body = extractBracedGroup(latex, pos);
    if (body) return { components: latexToMathComponents(body.content), newPos: body.endIndex };
  }

  // Parse a single token by running main parser for one character or command
  if (latex[pos] === '\\') {
    const cmdMatch = latex.slice(pos).match(/^\\([a-zA-Z]+)/);
    if (cmdMatch) {
      // Let the main parser handle it
      const singleResult = latexToMathComponents(latex.slice(pos, pos + cmdMatch[0].length));
      return { components: singleResult, newPos: pos + cmdMatch[0].length };
    }
  }

  return { components: [new MathRun(latex[pos])], newPos: pos + 1 };
}

/**
 * Find matching \right for a \left delimiter, handling nesting.
 */
function findMatchingRight(latex: string, pos: number): number {
  let depth = 1;
  let i = pos;
  while (i < latex.length) {
    if (latex.startsWith('\\left', i)) {
      depth++;
      i += 5;
      if (i < latex.length) i++; // skip delimiter char
      continue;
    }
    if (latex.startsWith('\\right', i)) {
      depth--;
      if (depth === 0) return i;
      i += 6;
      if (i < latex.length) i++; // skip delimiter char
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * Split text content into segments of plain text and math.
 * Returns an array of runs (TextRun or DocxMath wrapped in appropriate containers).
 */
function splitTextWithMath(
  text: string,
  options: { bold?: boolean; italics?: boolean; strike?: boolean; size?: number; isCode?: boolean; shading?: { fill: string } }
): (TextRun | DocxMath)[] {
  const results: (TextRun | DocxMath)[] = [];
  // Regex to find $$...$$ or $...$
  const mathRegex = /\$\$([\s\S]+?)\$\$|\$(?!\d)(\S(?:[^$\n]*?\S)?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      const plainText = text.slice(lastIndex, match.index);
      results.push(
        ...createScriptAwareRuns({
          text: plainText,
          bold: options.bold,
          italics: options.italics,
          strike: options.strike,
          size: options.size ?? 24,
          shading: options.shading,
          isCode: options.isCode,
        })
      );
    }

    const latexContent = match[1] ?? match[2]; // display or inline
    if (latexContent) {
      const mathComponents = latexToMathComponents(latexContent.trim());
      results.push(new DocxMath({ children: mathComponents }));
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text after last match
  if (lastIndex < text.length) {
    const plainText = text.slice(lastIndex);
    results.push(
      ...createScriptAwareRuns({
        text: plainText,
        bold: options.bold,
        italics: options.italics,
        strike: options.strike,
        size: options.size ?? 24,
        shading: options.shading,
        isCode: options.isCode,
      })
    );
  }

  return results;
}

/**
 * Parse inline content from markdown-it token with LaTeX support.
 * Returns an array of TextRun arrays - each sub-array represents content for a separate paragraph.
 * This allows softbreaks/hardbreaks to create real paragraph separations in DOCX.
 */
function parseInlineContent(token: ParsedToken, splitOnSoftbreak: boolean = false): (TextRun | DocxMath)[][] {
  if (!token.children || token.children.length === 0) {
    const content = token.content || '';
    return [[...splitTextWithMath(content, { size: 24 })]];
  }

  // C. Reconstruct full text to detect display math that was split across tokens
  const fullText = token.children.map(c => {
    if (c.type === 'softbreak' || c.type === 'hardbreak') return '\n';
    return c.content || '';
  }).join('');

  if (fullText.includes('$$')) {
    // Display math detected - process as a single unit for correct OMML conversion
    return [[...splitTextWithMath(fullText, { size: 24 })]];
  }

  const paragraphs: (TextRun | DocxMath)[][] = [];
  let currentRuns: (TextRun | DocxMath)[] = [];
  let currentStyle = { bold: false, italic: false, strike: false, code: false };

  for (let ci = 0; ci < token.children.length; ci++) {
    const child = token.children[ci];
    if (child.type === 'text') {
      const content = child.content || '';
      currentRuns.push(
        ...splitTextWithMath(content, {
          bold: currentStyle.bold,
          italics: currentStyle.italic,
          strike: currentStyle.strike,
          size: currentStyle.code ? 20 : 24,
          shading: currentStyle.code ? { fill: 'f4f4f5' } : undefined,
          isCode: currentStyle.code,
        })
      );
    } else if (child.type === 'code_inline') {
      currentRuns.push(
        new TextRun({
          text: child.content || '',
          font: getFontConfig(true),
          size: 20,
          shading: { fill: 'f4f4f5' },
        })
      );
    } else if (child.type === 'strong_open') {
      currentStyle.bold = true;
    } else if (child.type === 'strong_close') {
      currentStyle.bold = false;
    } else if (child.type === 'em_open') {
      currentStyle.italic = true;
    } else if (child.type === 'em_close') {
      currentStyle.italic = false;
    } else if (child.type === 's_open') {
      currentStyle.strike = true;
    } else if (child.type === 's_close') {
      currentStyle.strike = false;
    } else if (child.type === 'softbreak') {
      // Lookahead: treat softbreak as a paragraph break when immediately
      // followed by a bold label ending with ':' (e.g. **Simple:**, **Example:**,
      // **বাংলায় বুঝো:**) so DOCX matches the web preview.
      let isBoldLabelAhead = false;
      if (!splitOnSoftbreak) {
        const next = token.children[ci + 1];
        const nextText = token.children[ci + 2];
        if (
          next && next.type === 'strong_open' &&
          nextText && nextText.type === 'text' &&
          typeof nextText.content === 'string' &&
          /[:\uFF1A]\s*$/.test(nextText.content.trim())
        ) {
          isBoldLabelAhead = true;
        }
      }

      if (splitOnSoftbreak || isBoldLabelAhead) {
        if (currentRuns.length > 0) {
          paragraphs.push(currentRuns);
          currentRuns = [];
        }
      } else {
        // Use space instead of line break to keep text flowing inline (prevents justified stretching)
        currentRuns.push(new TextRun({ text: ' ' }));
      }
    } else if (child.type === 'hardbreak') {
      // Create a new paragraph for proper separation in DOCX
      if (currentRuns.length > 0) {
        paragraphs.push(currentRuns);
        currentRuns = [];
      }
    } else if (child.type === 'html_inline') {
      // Support explicit <br> tags inside markdown (used e.g. in bilingual tables)
      const html = (child.content || '').trim().toLowerCase();
      if (/^<br\s*\/?\s*>$/.test(html)) {
        // Create a new paragraph for proper separation in DOCX
        if (currentRuns.length > 0) {
          paragraphs.push(currentRuns);
          currentRuns = [];
        }
      }
    } else if (child.type === 'link_open') {
      // Links are handled as regular text in DOCX for simplicity
    } else if (child.type === 'link_close') {
      // End link
    }
  }

  // Push remaining runs as the final paragraph
  if (currentRuns.length > 0) {
    paragraphs.push(currentRuns);
  }

  return paragraphs.length > 0
    ? paragraphs
    : [[...createScriptAwareRuns({ text: token.content || '', size: 24 })]];
}

/**
 * Parse inline text with markdown formatting (for headings) with LaTeX support
 */
function parseInlineText(text: string): TextRunOptions[] {
  const runs: TextRunOptions[] = [];
  // First process any LaTeX in the text
  let remaining = text;

  while (remaining.length > 0) {
    // Display math ($$...$$)
    let match = remaining.match(/^\$\$([\s\S]+?)\$\$/);
    if (match) {
      runs.push({ text: match[0], isMath: true, latexContent: match[1].trim() });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Inline math ($...$) - same pattern as INLINE_MATH_REGEX
    match = remaining.match(/^\$(?!\d)(\S(?:[^$\n]*?\S)?)\$/);
    if (match) {
      runs.push({ text: match[0], isMath: true, latexContent: match[1].trim() });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bold + italic (***text***)
    match = remaining.match(/^\*\*\*(.+?)\*\*\*/);
    if (match) {
      runs.push({ text: match[1], bold: true, italics: true });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bold (**text**)
    match = remaining.match(/^\*\*(.+?)\*\*/);
    if (match) {
      runs.push({ text: match[1], bold: true });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic (*text* or _text_)
    match = remaining.match(/^\*([^*]+)\*/) || remaining.match(/^_([^_]+)_/);
    if (match) {
      runs.push({ text: match[1], italics: true });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Inline code (`text`)
    match = remaining.match(/^`([^`]+)`/);
    if (match) {
      runs.push({ text: match[1], font: 'Consolas' });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Strikethrough (~~text~~)
    match = remaining.match(/^~~(.+?)~~/);
    if (match) {
      runs.push({ text: match[1], strike: true });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Plain text until next special character or dollar sign
    match = remaining.match(/^[^*_`~$]+/);
    if (match) {
      runs.push({ text: match[0] });
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Single special character (including $ that didn't match math patterns)
    runs.push({ text: remaining[0] });
    remaining = remaining.slice(1);
  }

  return runs;
}
