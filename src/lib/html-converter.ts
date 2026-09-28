/* HTML to PDF/DOCX Converter */
import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertInchesToTwip,
} from 'docx';
import DOMPurify from 'dompurify';

export type HtmlOutputFormat = 'pdf' | 'docx';

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

/**
 * Convert HTML to the specified format and download
 */
export async function convertHtml(
  html: string,
  format: HtmlOutputFormat,
  filename: string = 'document'
): Promise<void> {
  switch (format) {
    case 'pdf':
      return convertHtmlToPdf(html, filename);
    case 'docx':
      return convertHtmlToDocx(html, filename);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Convert HTML to PDF via the browser's native print dialog.
 */
async function convertHtmlToPdf(html: string, filename: string): Promise<void> {
  const sanitizedHtml = sanitizeHtml(html);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please allow pop-ups.');
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  
  <style>
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('https://fonts.maateen.me/solaiman-lipi/SolaimanLipi.woff2') format('woff2');
      font-weight: normal; font-style: normal; font-display: swap;
    }
    @page { size: A4; margin: 12.7mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Times New Roman', 'SolaimanLipi', serif;
      font-size: 12pt; line-height: 1.25; color: #1a1a1a;
      padding: 12.7mm; max-width: 210mm; margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; line-height: 1.3; }
    h1 { font-size: 24pt; border-bottom: 2px solid #1a1a1a; padding-bottom: 0.3em; }
    h2 { font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
    h3 { font-size: 14pt; }
    p { margin: 0 0 6pt 0; text-align: justify; }
    ul, ol { margin: 1em 0; padding-left: 2em; }
    li { margin: 0.5em 0; }
    code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f4f4f5; padding: 2px 6px; border-radius: 3px; }
    pre { background: #1e293b; color: #e2e8f0; padding: 1em; border-radius: 6px; overflow-x: auto; margin: 1.5em 0; }
    pre code { background: transparent; padding: 0; color: inherit; }
    blockquote { margin: 1.5em 0; padding: 0.5em 1em; border-left: 4px solid #4a5568; background: #f8f9fa; font-style: italic; color: #4a5568; }
    table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
    th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; }
    th { background: #f3f4f6; font-weight: bold; }
    a { color: #2563eb; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${sanitizedHtml}
</body>
</html>`;

  printWindow.document.write(fullHtml);
  printWindow.document.close();

  const stylesheets = printWindow.document.querySelectorAll('link[rel="stylesheet"]');
  let loadedCount = 0;
  const totalStylesheets = stylesheets.length;

  const triggerPrint = () => {
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
      if (printWindow.document.fonts?.ready) {
        printWindow.document.fonts.ready.then(() => triggerPrint());
      } else {
        triggerPrint();
      }
    }
  };

  stylesheets.forEach((link) => {
    link.addEventListener('load', onStylesheetLoad);
    link.addEventListener('error', onStylesheetLoad);
  });

  setTimeout(() => {
    if (loadedCount < totalStylesheets) {
      triggerPrint();
    }
  }, 5000);
}

/**
 * Convert HTML to DOCX
 */
async function convertHtmlToDocx(html: string, filename: string): Promise<void> {
  const sanitizedHtml = sanitizeHtml(html);
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizedHtml;
  
  const children = htmlNodesToDocx(tempDiv);
  
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { font: 'Times New Roman', size: 24 },
          paragraph: { spacing: { line: 300, after: 120 }, alignment: AlignmentType.JUSTIFIED },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Times New Roman', size: 48, bold: true, color: '1a1a1a' },
          paragraph: { spacing: { line: 300, after: 120 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Times New Roman', size: 36, bold: true, color: '1a1a1a' },
          paragraph: { spacing: { line: 300, after: 120 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: 'Times New Roman', size: 28, bold: true, color: '1a1a1a' },
          paragraph: { spacing: { line: 300, after: 120 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, `${filename}.docx`);
}

/**
 * Convert HTML DOM nodes to DOCX paragraphs
 */
function htmlNodesToDocx(element: HTMLElement): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  function processNode(node: Node, style: { bold?: boolean; italic?: boolean } = {}): TextRun[] {
    const runs: TextRun[] = [];
    
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        runs.push(new TextRun({
          text: text,
          bold: style.bold,
          italics: style.italic,
        }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      
      if (tagName === 'br') {
        runs.push(new TextRun({ break: 1 }));
        return runs;
      }
      
      let newStyle = { ...style };
      if (tagName === 'strong' || tagName === 'b') newStyle.bold = true;
      if (tagName === 'em' || tagName === 'i') newStyle.italic = true;
      
      for (const child of Array.from(node.childNodes)) {
        runs.push(...processNode(child, newStyle));
      }
    }
    
    return runs;
  }

  function processElement(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text })],
        }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      
      switch (tagName) {
        case 'h1':
          paragraphs.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: processNode(el),
            alignment: AlignmentType.LEFT,
          }));
          break;
        case 'h2':
          paragraphs.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: processNode(el),
            alignment: AlignmentType.LEFT,
          }));
          break;
        case 'h3':
          paragraphs.push(new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: processNode(el),
            alignment: AlignmentType.LEFT,
          }));
          break;
        case 'h4':
        case 'h5':
        case 'h6':
          paragraphs.push(new Paragraph({
            heading: HeadingLevel.HEADING_4,
            children: processNode(el),
            alignment: AlignmentType.LEFT,
          }));
          break;
        case 'p':
          paragraphs.push(new Paragraph({
            children: processNode(el),
            spacing: { line: 300, after: 120 },
            alignment: AlignmentType.JUSTIFIED,
          }));
          break;
        case 'ul':
        case 'ol':
          for (const li of Array.from(el.querySelectorAll(':scope > li'))) {
            const textRuns: TextRun[] = [];
            for (const child of Array.from(li.childNodes)) {
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim();
                if (text) {
                  textRuns.push(new TextRun({ text }));
                }
              } else if (child.nodeType === Node.ELEMENT_NODE) {
                const childEl = child as HTMLElement;
                const childTag = childEl.tagName.toLowerCase();
                if (childTag !== 'ul' && childTag !== 'ol') {
                  textRuns.push(...processNode(child));
                }
              }
            }
            if (textRuns.length > 0) {
              paragraphs.push(new Paragraph({
                children: [
                  new TextRun({ text: tagName === 'ol' ? '1. ' : '• ' }),
                  ...textRuns,
                ],
                spacing: { line: 300, after: 120 },
              }));
            }
            for (const nestedList of Array.from(li.querySelectorAll(':scope > ul, :scope > ol'))) {
              processElement(nestedList);
            }
          }
          break;
        case 'pre':
        case 'code':
          paragraphs.push(new Paragraph({
            children: [new TextRun({ 
              text: el.textContent || '', 
              font: 'Consolas',
              size: 20,
            })],
            spacing: { line: 300, after: 120 },
          }));
          break;
        case 'blockquote':
          paragraphs.push(new Paragraph({
            children: [new TextRun({ 
              text: el.textContent || '', 
              italics: true,
              color: '64748b',
            })],
            indent: { left: convertInchesToTwip(0.5) },
            spacing: { line: 300, after: 120 },
          }));
          break;
        case 'div':
        case 'section':
        case 'article':
        case 'main':
        case 'body':
          for (const child of Array.from(el.childNodes)) {
            processElement(child);
          }
          break;
        default:
          const text = el.textContent?.trim();
          if (text && !['script', 'style', 'head', 'meta', 'link'].includes(tagName)) {
            paragraphs.push(new Paragraph({
              children: processNode(el),
              spacing: { line: 300, after: 120 },
            }));
          }
          break;
      }
    }
  }

  for (const child of Array.from(element.childNodes)) {
    processElement(child);
  }

  return paragraphs;
}
