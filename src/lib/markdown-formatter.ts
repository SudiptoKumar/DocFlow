/**
 * Markdown Formatter / Beautifier
 * Normalizes and cleans up messy markdown text.
 * 20-step pipeline handling real-world messiness from PDFs, AI, web pastes.
 */

export interface FormatResult {
  formatted: string;
  changeCount: number;
}

export function formatMarkdown(input: string): FormatResult {
  let changeCount = 0;
  const original = input;

  let text = input;

  // 1. Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Trim trailing whitespace from each line
  text = text.replace(/[ \t]+$/gm, '');

  // 3. Remove invisible characters (zero-width spaces, BOM, non-breaking spaces)
  text = text.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
  text = text.replace(/\u00A0/g, ' ');

  // 4. Strip inline HTML tags → markdown equivalents
  text = processOutsideCodeBlocks(text, stripInlineHTML);

  // 5. Smart quote cleanup (curly → straight)
  text = processOutsideCodeBlocks(text, smartQuoteCleanup);

  // 6. Remove extra spaces within lines (preserve leading indentation)
  text = text.replace(/^(\s*\S)(.*)$/gm, (_, start, rest) => {
    return start + rest.replace(/ {2,}/g, ' ');
  });

  // 7. Smart sentence spacing (add space after .!? when followed by letter)
  text = processOutsideCodeBlocks(text, (t) => {
    return t.replace(/([.!?])([A-Za-z])/g, '$1 $2');
  });

  // 8. Fix broken markdown links: [text] (url) → [text](url)
  text = text.replace(/\[(.*?)\]\s+\((.*?)\)/g, '[$1]($2)');

  // 9. Normalize heading syntax: ensure space after #
  text = text.replace(/^(#{1,6})([^ #\n])/gm, '$1 $2');

  // 10. Heading hierarchy fixer
  text = processOutsideCodeBlocks(text, fixHeadingHierarchy);

  // 11. Ensure blank line before headings (unless at start of doc)
  text = text.replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');

  // 12. Ensure blank line after headings
  text = text.replace(/^(#{1,6} .+)\n([^\n#])/gm, '$1\n\n$2');

  // 13. Normalize unordered list markers to `-`
  text = text.replace(/^(\s*)[*+] /gm, '$1- ');

  // 14. Normalize bullet indentation (to 2-space depth)
  text = processOutsideCodeBlocks(text, normalizeBulletIndentation);

  // 15. Renumber ordered lists
  text = processOutsideCodeBlocks(text, renumberOrderedLists);

  // 16. Remove blank lines inside lists
  text = processOutsideCodeBlocks(text, removeBlankLinesInsideLists);

  // 17. Unwrap hard line breaks (PDF paste fix)
  text = processOutsideCodeBlocks(text, unwrapHardLineBreaks);

  // 18. Collapse 3+ consecutive blank lines into 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // 19. Align markdown table columns
  text = alignTables(text);

  // 20. Ensure file ends with single newline
  text = text.replace(/\n*$/, '\n');

  // Count changes (simple line-by-line diff)
  const origLines = original.split('\n');
  const newLines = text.split('\n');
  const maxLen = Math.max(origLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if ((origLines[i] ?? '') !== (newLines[i] ?? '')) {
      changeCount++;
    }
  }

  return { formatted: text, changeCount };
}

// ─── Helper: Process text outside fenced code blocks ───

function processOutsideCodeBlocks(text: string, fn: (segment: string) => string): string {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    // Odd indices are code blocks (captured groups)
    if (i % 2 === 1) return part;
    return fn(part);
  }).join('');
}

// ─── Feature 4: Strip Inline HTML ───

function stripInlineHTML(text: string): string {
  // <br> / <br/> → newline
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // <b>...</b> and <strong>...</strong> → **...**
  text = text.replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, '**$2**');

  // <i>...</i> and <em>...</em> → *...*
  text = text.replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, '*$2*');

  // <code>...</code> → `...`
  text = text.replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`');

  // <a href="url">text</a> → [text](url)
  text = text.replace(/<a\s+href=["'](.*?)["'].*?>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // <p>...</p> → unwrap with blank lines
  text = text.replace(/<p>([\s\S]*?)<\/p>/gi, '\n$1\n');

  // Strip remaining <span>, <div> wrappers (keep content)
  text = text.replace(/<\/?(span|div|section|article)[^>]*>/gi, '');

  // Strip <img> with alt → ![alt](src)
  text = text.replace(/<img\s+[^>]*alt=["'](.*?)["'][^>]*src=["'](.*?)["'][^>]*\/?>/gi, '![$1]($2)');
  text = text.replace(/<img\s+[^>]*src=["'](.*?)["'][^>]*alt=["'](.*?)["'][^>]*\/?>/gi, '![$2]($1)');

  return text;
}

// ─── Feature 5: Smart Quote Cleanup ───

function smartQuoteCleanup(text: string): string {
  text = text.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"');
  text = text.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  return text;
}

// ─── Feature 10: Heading Hierarchy Fixer ───

function fixHeadingHierarchy(text: string): string {
  const lines = text.split('\n');
  const headingPattern = /^(#{1,6}) (.+)$/;

  // Find all heading levels used
  const levels: number[] = [];
  for (const line of lines) {
    const match = line.match(headingPattern);
    if (match) levels.push(match[1].length);
  }

  if (levels.length === 0) return text;

  // Build a mapping: sort unique levels and assign sequential levels starting from 1
  const uniqueLevels = [...new Set(levels)].sort((a, b) => a - b);
  const levelMap: Record<number, number> = {};
  uniqueLevels.forEach((level, idx) => {
    levelMap[level] = idx + 1;
  });

  // If no change needed, return early
  if (uniqueLevels.every((level, idx) => level === idx + 1)) return text;

  return lines.map(line => {
    const match = line.match(headingPattern);
    if (match) {
      const oldLevel = match[1].length;
      const newLevel = levelMap[oldLevel];
      return '#'.repeat(newLevel) + ' ' + match[2];
    }
    return line;
  }).join('\n');
}

// ─── Feature 14: Normalize Bullet Indentation ───

function normalizeBulletIndentation(text: string): string {
  return text.replace(/^( +)(- )/gm, (_, spaces, marker) => {
    // Calculate depth: every 2+ chars of indent = one level
    const rawDepth = Math.round(spaces.length / 2);
    const depth = Math.max(1, rawDepth);
    return '  '.repeat(depth) + marker;
  });
}

// ─── Feature 15: Renumber Ordered Lists ───

function renumberOrderedLists(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let listCounter = 0;
  let inList = false;
  let currentIndent = '';
  let blankLineBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
    if (match) {
      const indent = match[1];
      
      // If we had buffered blank lines and we're continuing a list at the same indent, skip those blanks
      if (inList && indent === currentIndent && blankLineBuffer.length > 0) {
        // Discard blank lines between same-indent list items (they were separating items)
        blankLineBuffer = [];
        listCounter++;
      } else if (!inList || indent !== currentIndent) {
        // Flush any buffered blank lines
        result.push(...blankLineBuffer);
        blankLineBuffer = [];
        // New list or different indent level
        listCounter = 1;
        currentIndent = indent;
        inList = true;
      } else {
        result.push(...blankLineBuffer);
        blankLineBuffer = [];
        listCounter++;
      }
      result.push(`${indent}${listCounter}. ${match[2]}`);
    } else if (lines[i].trim() === '' && inList) {
      // Buffer blank lines - might be between list items
      blankLineBuffer.push(lines[i]);
    } else {
      // Non-list, non-blank line: flush buffer and reset
      result.push(...blankLineBuffer);
      blankLineBuffer = [];
      if (inList) {
        inList = false;
        listCounter = 0;
      }
      result.push(lines[i]);
    }
  }
  
  // Flush remaining buffer
  result.push(...blankLineBuffer);

  return result.join('\n');
}

// ─── Feature 16: Remove Blank Lines Inside Lists ───

function removeBlankLinesInsideLists(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  const listItemPattern = /^\s*(?:[-*+]|\d+\.)\s/;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      // Check if surrounded by list items
      const prevIsList = i > 0 && listItemPattern.test(lines[i - 1]);
      const nextIsList = i + 1 < lines.length && listItemPattern.test(lines[i + 1]);
      if (prevIsList && nextIsList) {
        continue; // Skip this blank line
      }
    }
    result.push(lines[i]);
  }

  return result.join('\n');
}

// ─── Feature 17: Unwrap Hard Line Breaks ───

function unwrapHardLineBreaks(text: string): string {
  // Join lines where current line ends with a lowercase letter or comma
  // and the next line starts with a lowercase letter
  // This preserves intentional paragraph breaks (blank lines) and headings
  return text.replace(/([a-z,])\n([a-z])/g, '$1 $2');
}

// ─── Existing: Align Tables ───

function alignTables(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      result.push(...formatTable(tableLines));
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join('\n');
}

function isTableRow(line: string): boolean {
  return /^\s*\|/.test(line) && /\|\s*$/.test(line.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|[\s:*-]+\|/.test(line);
}

function formatTable(lines: string[]): string[] {
  const rows = lines.map(line =>
    line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
  );

  if (rows.length === 0) return lines;

  const colCount = Math.max(...rows.map(r => r.length));
  const colWidths: number[] = Array(colCount).fill(0);

  rows.forEach((row, rowIndex) => {
    if (rowIndex === 1 && /^[-:]+$/.test(row[0] || '')) return;
    row.forEach((cell, colIdx) => {
      if (colIdx < colCount) {
        colWidths[colIdx] = Math.max(colWidths[colIdx], cell.length, 3);
      }
    });
  });

  return rows.map((row, rowIndex) => {
    const cells = Array(colCount).fill('').map((_, colIdx) => {
      const cell = row[colIdx] || '';
      if (rowIndex === 1 && /^[-:]+$/.test(rows[1]?.[0] || '')) {
        return '-'.repeat(colWidths[colIdx]);
      }
      return cell.padEnd(colWidths[colIdx]);
    });
    return '| ' + cells.join(' | ') + ' |';
  });
}
