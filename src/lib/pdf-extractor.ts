import pdf2md from '@opendocsg/pdf2md';

/**
 * Check if a line is a metadata/noise header that should be removed.
 */
function isNoiseeLine(line: string): boolean {
  const trimmed = line.trim();
  // Chapter/page references: ## Chapter -1 (page no-22 to 31)
  if (/^#{1,4}\s+Chapter\s*-?\s*\d+\s*\(page\s*no/i.test(trimmed)) return true;
  // Single conjunction/fragment headings: ## and, ## Edition., ## or
  if (/^#{1,4}\s+(and|or|the|Edition\.?)$/i.test(trimmed)) return true;
  // Page number metadata headings
  if (/^#{1,4}\s+.*page\s*no/i.test(trimmed)) return true;
  // Formatting artifacts like **_th_**
  if (/^\*\*_[a-z]{1,4}_\*\*$/i.test(trimmed)) return true;
  // Page markers like --- PAGE X ---
  if (/^-{3,}\s*PAGE\s*\d+\s*-{3,}$/i.test(trimmed)) return true;
  // Short noise headings (single word, 3 chars or less)
  if (/^#{1,4}\s+\S{1,3}$/.test(trimmed) && !/^#{1,4}\s+\d/.test(trimmed)) return true;
  return false;
}

/**
 * Unwrap bold from text that is clearly a paragraph, not a definition.
 */
function unwrapBoldParagraph(line: string): string {
  const boldMatch = line.match(/^\*\*(.+)\*\*$/);
  if (!boldMatch) return line;

  const inner = boldMatch[1];

  // Short bold lines stay bold (definitions, labels)
  if (inner.length < 40) return line;

  // Check for definition pattern: **Term:** rest
  const defMatch = inner.match(/^([^:]+:)\s+(.+)/);
  if (defMatch && defMatch[1].length < 40) {
    // Keep bold on the term only
    return `**${defMatch[1]}** ${defMatch[2]}`;
  }

  // Long text -> unwrap
  return inner;
}

/**
 * Post-process raw pdf2md output into clean, structured markdown.
 */
export function cleanExtractedMarkdown(raw: string): string {
  const lines = raw.split('\n');

  const startsWithParagraphLabel = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;

    const boldLabelMatch = trimmed.match(/^\*\*([^*\n]{1,48})\*\*(?:\s|$)/u);
    if (boldLabelMatch) {
      return /[:\uFF1A]\s*$/.test(boldLabelMatch[1].trim());
    }

    const plainLabelMatch = trimmed.match(/^([^\n:]{1,48}[:\uFF1A])(?:\s|$)/u);
    if (!plainLabelMatch) return false;

    const labelText = plainLabelMatch[1].replace(/[:\uFF1A]\s*$/u, '').trim();
    const wordCount = labelText ? labelText.split(/\s+/u).length : 0;
    return wordCount > 0 && wordCount <= 5;
  };

  // Step 0: Remove metadata/noise lines
  const filtered: string[] = [];
  for (const line of lines) {
    if (!isNoiseeLine(line)) {
      filtered.push(line);
    }
  }

  // Step 1: Demote h5/h6 to bold text
  const processed: string[] = [];
  for (let i = 0; i < filtered.length; i++) {
    let line = filtered[i];
    const h6Match = line.match(/^######\s+(.*)/);
    const h5Match = line.match(/^#####\s+(.*)/);
    if (h6Match) {
      line = `**${h6Match[1].trim()}**`;
    } else if (h5Match) {
      line = `**${h5Match[1].trim()}**`;
    }
    processed.push(line);
  }

  // Step 2: Merge consecutive same-level headings
  const merged: string[] = [];
  for (let i = 0; i < processed.length; i++) {
    const headingMatch = processed[i].match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1];
      let text = headingMatch[2].trim();
      while (i + 1 < processed.length) {
        const nextMatch = processed[i + 1].match(/^(#{1,4})\s+(.*)/);
        if (nextMatch && nextMatch[1] === level) {
          text += ' ' + nextMatch[2].trim();
          i++;
        } else {
          break;
        }
      }
      merged.push(`${level} ${text}`);
    } else {
      merged.push(processed[i]);
    }
  }

  // Step 3: Merge consecutive bold lines (demoted headings)
  const boldMerged: string[] = [];
  for (let i = 0; i < merged.length; i++) {
    const boldMatch = merged[i].match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      let text = boldMatch[1];
      while (i + 1 < merged.length) {
        const nextBold = merged[i + 1].match(/^\*\*(.+)\*\*$/);
        if (nextBold) {
          text += ' ' + nextBold[1];
          i++;
        } else if (merged[i + 1].trim() === '' && i + 2 < merged.length) {
          const afterBlank = merged[i + 2].match(/^\*\*(.+)\*\*$/);
          if (afterBlank) {
            i++; // skip blank
            text += ' ' + afterBlank[1];
            i++; // skip bold line
          } else {
            break;
          }
        } else {
          break;
        }
      }
      boldMerged.push(`**${text}**`);
    } else {
      boldMerged.push(merged[i]);
    }
  }

  // Step 4: Unwrap bold from long paragraph text
  const boldUnwrapped: string[] = [];
  for (const line of boldMerged) {
    boldUnwrapped.push(unwrapBoldParagraph(line));
  }

  // Step 5: Join broken paragraphs (enhanced - bold lines are now joinable)
  const isSpecialLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^#{1,4}\s/.test(trimmed)) return true;
    if (/^[-*+]\s/.test(trimmed)) return true;
    if (/^\d+\.\s/.test(trimmed)) return true;
    if (/^>/.test(trimmed)) return true;
    if (/^---+$/.test(trimmed)) return true;
    if (/^```/.test(trimmed)) return true;
    if (/^\|/.test(trimmed)) return true;               // table row
    if (/^\|?[\s-:|]+\|/.test(trimmed)) return true;    // table separator
    if (/^<!--/.test(trimmed)) return true;
    if (startsWithParagraphLabel(trimmed)) return true;
    // Bold-only lines that are short definitions remain special
    const boldMatch = trimmed.match(/^\*\*(.+)\*\*$/);
    if (boldMatch && boldMatch[1].length < 30) return true;
    return false;
  };

  const endsWithTerminal = (line: string): boolean => {
    const trimmed = line.trim();
    return /[.!?:]$/.test(trimmed);
  };

  const stripBoldWrap = (text: string): string => {
    const m = text.match(/^\*\*(.+)\*\*$/);
    return m ? m[1] : text;
  };

  const joined: string[] = [];
  let i = 0;
  while (i < boldUnwrapped.length) {
    const line = boldUnwrapped[i];

    // Handle list items with continuations (preserve leading indentation for nested lists)
    if (/^[-*+]\s/.test(line.trim())) {
      const leadingWhitespace = line.match(/^(\s*)/)?.[1] || '';
      let listItem = leadingWhitespace + line.trim();
      i++;
      // Join non-special continuation lines to the list item
      while (i < boldUnwrapped.length) {
        const next = boldUnwrapped[i];
        if (next.trim() === '') {
          // Check if next non-blank is a continuation (not a new list/heading)
          if (i + 1 < boldUnwrapped.length && !isSpecialLine(boldUnwrapped[i + 1]) && boldUnwrapped[i + 1].trim()) {
            i++; // skip blank
            listItem += ' ' + stripBoldWrap(boldUnwrapped[i].trim());
            i++;
            continue;
          }
          break;
        }
        if (isSpecialLine(next)) break;
        listItem += ' ' + stripBoldWrap(next.trim());
        i++;
      }
      joined.push(listItem);
      continue;
    }

    if (isSpecialLine(line) || !line.trim()) {
      joined.push(line);
      i++;
      continue;
    }

    // Non-special content line — try to join with following lines
    let paragraph = line.trim();
    i++;

    while (i < boldUnwrapped.length) {
      const next = boldUnwrapped[i];

      // Skip single blank lines between paragraph fragments
      if (next.trim() === '' && i + 1 < boldUnwrapped.length && !isSpecialLine(boldUnwrapped[i + 1]) && boldUnwrapped[i + 1].trim()) {
        const nextContent = boldUnwrapped[i + 1].trim();
        if (endsWithTerminal(paragraph) && /^[A-Z*]/.test(nextContent)) {
          break;
        }
        i++; // skip blank
        paragraph += ' ' + stripBoldWrap(boldUnwrapped[i].trim());
        i++;
        continue;
      }

      if (isSpecialLine(next) || !next.trim()) {
        break;
      }

      paragraph += ' ' + stripBoldWrap(next.trim());
      i++;
    }

    // Final unwrap if the whole joined paragraph ended up bold-wrapped
    paragraph = unwrapBoldParagraph(paragraph);
    joined.push(paragraph);
  }

  // Step 6: Collapse excessive blank lines & remove page markers
  const final: string[] = [];
  let blankCount = 0;
  for (const line of joined) {
    // Remove page markers that might have survived
    if (/^-{3,}\s*PAGE\s*\d+\s*-{3,}$/i.test(line.trim())) continue;

    if (line.trim() === '') {
      blankCount++;
      if (blankCount <= 2) {
        final.push('');
      }
    } else {
      blankCount = 0;
      final.push(line.trimEnd());
    }
  }

  return final.join('\n').trim();
}

/**
 * Extract markdown content from a PDF file using @opendocsg/pdf2md.
 * Falls back to basic pdfjs-dist text extraction if pdf2md fails.
 */
export async function extractMarkdownFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  try {
    const markdown = await pdf2md(uint8Array);

    if (!markdown || !markdown.trim()) {
      throw new Error('EMPTY_RESULT');
    }

    return cleanExtractedMarkdown(markdown);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage === 'EMPTY_RESULT') {
      throw new Error(
        'This PDF appears to be scanned (image-based). OCR is not supported yet. Please use a digitally-born PDF with selectable text.'
      );
    }

    // Fallback: try pdfjs-dist directly for basic text extraction
    try {
      const pdfjs = await import('pdfjs-dist');
      
      // Set worker source
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

      const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
      const pages: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .join(' ');

        if (pageText.trim()) {
          pages.push(`## Page ${i}\n\n${pageText.trim()}`);
        }
      }

      const result = pages.join('\n\n---\n\n');

      if (!result.trim()) {
        throw new Error(
          'This PDF appears to be scanned (image-based). OCR is not supported yet. Please use a digitally-born PDF with selectable text.'
        );
      }

      return cleanExtractedMarkdown(result);
    } catch (fallbackError: unknown) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : '';
      if (fallbackMessage.includes('scanned')) {
        throw fallbackError;
      }
      throw new Error(
        'Failed to extract text from this PDF. The file may be corrupted or in an unsupported format.'
      );
    }
  }
}
