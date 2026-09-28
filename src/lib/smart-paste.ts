/**
 * Smart Paste utility - converts pasted HTML from Word/Excel/PowerPoint into clean Markdown.
 * Detects rich HTML clipboard content and converts tables, formatting, and structure.
 */

import DOMPurify from 'dompurify';
import { htmlToMarkdown } from './html-to-markdown';

/**
 * Check if clipboard HTML looks like it came from an Office application
 */
function isOfficeHtml(html: string): boolean {
  return /class="?Mso|xmlns:o=|xmlns:w=|<o:|<w:|urn:schemas-microsoft-com/i.test(html);
}

/**
 * Check if clipboard HTML contains a spreadsheet table (Excel/Google Sheets)
 */
function isSpreadsheetHtml(html: string): boolean {
  return /<table[\s>]/i.test(html) && (
    /class="?xl|google-sheets-html/i.test(html) ||
    isOfficeHtml(html)
  );
}

/**
 * Clean Office-specific HTML cruft while preserving meaningful structure
 */
function cleanOfficeHtml(html: string): string {
  let cleaned = html;
  
  // Remove Office XML namespaces and comments
  cleaned = cleaned.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/<o:p>[\s\S]*?<\/o:p>/gi, '');
  cleaned = cleaned.replace(/<w:[\s\S]*?<\/w:[^>]*>/gi, '');
  cleaned = cleaned.replace(/\s*class="Mso[^"]*"/gi, '');
  
  // Remove empty spans and normalize whitespace in style attrs
  cleaned = cleaned.replace(/<span\s*>([\s\S]*?)<\/span>/gi, '$1');
  
  // Remove Word-specific style attributes that don't translate
  cleaned = cleaned.replace(/\s*mso-[^;"]*;?/gi, '');
  cleaned = cleaned.replace(/\s*style="\s*"/gi, '');
  
  return cleaned;
}

/**
 * Convert an HTML table to Markdown table format
 */
function htmlTableToMarkdown(tableHtml: string): string {
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(tableHtml);
  const table = div.querySelector('table');
  if (!table) return '';

  const rows: string[][] = [];
  
  table.querySelectorAll('tr').forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll('td, th').forEach((cell) => {
      cells.push((cell.textContent || '').trim().replace(/\|/g, '\\|'));
    });
    if (cells.length > 0) rows.push(cells);
  });
  
  if (rows.length === 0) return '';
  
  // Normalize column count
  const maxCols = Math.max(...rows.map(r => r.length));
  rows.forEach(r => {
    while (r.length < maxCols) r.push('');
  });

  // Build markdown table
  const lines: string[] = [];
  
  // Header row
  lines.push('| ' + rows[0].join(' | ') + ' |');
  lines.push('| ' + rows[0].map(() => '---').join(' | ') + ' |');
  
  // Data rows
  for (let i = 1; i < rows.length; i++) {
    lines.push('| ' + rows[i].join(' | ') + ' |');
  }
  
  return lines.join('\n');
}

/**
 * Process a paste event and return clean Markdown if it's from Office.
 * Returns null if the paste is not from Office (let normal paste handle it).
 */
export function processSmartPaste(clipboardData: DataTransfer): string | null {
  const html = clipboardData.getData('text/html');
  const plain = clipboardData.getData('text/plain');
  
  // If no HTML or it's not Office content, skip smart paste
  if (!html || (!isOfficeHtml(html) && !isSpreadsheetHtml(html))) {
    return null;
  }
  
  try {
    // For spreadsheet content, extract and convert the table
    if (isSpreadsheetHtml(html)) {
      const div = document.createElement('div');
      div.innerHTML = DOMPurify.sanitize(html);
      const table = div.querySelector('table');
      if (table) {
        return htmlTableToMarkdown(table.outerHTML);
      }
    }

    // For Word/PowerPoint content, clean and convert
    const cleanedHtml = cleanOfficeHtml(html);
    const markdown = htmlToMarkdown(cleanedHtml);
    
    // If conversion produced something meaningful, use it
    if (markdown.trim().length > 0) {
      return markdown;
    }
    
    // Fallback to plain text
    return plain || null;
  } catch (error) {
    console.error('Smart paste conversion failed:', error);
    return null;
  }
}
