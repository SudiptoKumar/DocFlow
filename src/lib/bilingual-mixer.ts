/**
 * Bilingual content mixing utilities
 * Combines English and Bangla markdown files into interwoven format
 * 
 * STRICT RULES:
 * - English ALWAYS comes first
 * - Bangla IMMEDIATELY follows its English counterpart
 * - Never mix languages on the same line
 * - Each unit (heading/paragraph/bullet) is paired separately
 * - Blank line separates each English-Bangla pair
 * - Code blocks are stripped from output
 * - DOCX-safe: no internal line breaks within paragraphs
 */

export interface ParsedBlock {
  type: 'heading' | 'paragraph' | 'list-item' | 'blockquote' | 'code' | 'hr' | 'table' | 'other';
  level?: number; // For headings (1-6)
  content: string;
  raw: string;
  /** Original text before normalization (for splitting merged paragraphs) */
  originalLines?: string[];
  /** For tables: parsed rows */
  tableRows?: string[][];
}

export interface PairingResult {
  pairs: { source: ParsedBlock | null; target: ParsedBlock | null }[];
  pairedCount: number;
  unmatchedSourceCount: number;
  unmatchedTargetCount: number;
  autoFixesApplied: number;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  warnings: string[];
  pairedCount: number;
  unmatchedSourceCount: number;
  unmatchedTargetCount: number;
  autoFixesApplied: number;
}

/**
 * Normalize text for DOCX-safe output
 * Replaces internal newlines with spaces, collapses whitespace
 */
const normalizeForDocx = (text: string): string => {
  return text
    .replace(/\n+/g, ' ')  // Replace newlines with space
    .replace(/\s+/g, ' ')  // Collapse multiple spaces
    .trim();
};

/**
 * Check if a line is a list item marker
 * Supports: -, *, +, ▸ (triangle bullet), → (arrow sub-item), and numbered lists
 */
const isListMarker = (line: string): boolean => {
  const trimmed = line.trim();
  return /^[-*+▸→]\s/.test(trimmed) || /^[\d০-৯]+\.\s/.test(trimmed);
};

/**
 * Check if a line is an arrow sub-item (→)
 */
const isArrowSubItem = (line: string): boolean => {
  return /^→\s/.test(line.trim());
};

/**
 * Check if a line is a heading
 */
const isHeading = (line: string): boolean => {
  return /^#{1,6}\s/.test(line.trim());
};

/**
 * Check if a line is a horizontal rule (---, ***, ___)
 */
const isHorizontalRule = (line: string): boolean => {
  const trimmed = line.trim();
  return /^[-*_]{3,}$/.test(trimmed);
};

/**
 * Check if a paragraph is a bold-styled subheading
 * (entire content wrapped in **...**)
 */
const isBoldSubheading = (content: string): boolean => {
  const trimmed = content.trim();
  return /^\*\*[^*]+\*\*$/.test(trimmed);
};

/**
 * Check if a line is a table row (starts with |)
 */
const isTableRow = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|');
};

/**
 * Check if a line is a table separator (| --- | --- |)
 */
const isTableSeparator = (line: string): boolean => {
  const trimmed = line.trim();
  return isTableRow(line) && /^\|[\s:-]+\|/.test(trimmed) && !trimmed.replace(/[\s|:-]/g, '');
};

/**
 * Parse a table row into cells
 */
const parseTableCells = (line: string): string[] => {
  return line.trim()
    .slice(1, -1) // Remove leading and trailing |
    .split('|')
    .map(cell => cell.trim());
};

/**
 * Parse a complete table from lines
 */
const parseTable = (lines: string[]): ParsedBlock => {
  const rows: string[][] = [];
  
  for (const line of lines) {
    if (isTableSeparator(line)) continue; // Skip separator rows
    rows.push(parseTableCells(line));
  }
  
  return {
    type: 'table',
    content: lines.join('\n'),
    raw: lines.join('\n'),
    tableRows: rows,
  };
};

/**
 * Parse markdown content into blocks with improved handling
 * - Supports multi-line list items (continuation lines)
 * - Normalizes content for DOCX-safe output
 */
export const parseMarkdownBlocks = (markdown: string): ParsedBlock[] => {
  const lines = markdown.split('\n');
  const blocks: ParsedBlock[] = [];
  let currentBlock: string[] = [];
  let inCodeBlock = false;
  let inListItem = false;

  const flushBlock = (forceList = false) => {
    if (currentBlock.length === 0) return;
    
    const raw = currentBlock.join('\n').trim();
    if (!raw) {
      currentBlock = [];
      return;
    }

    const firstLine = currentBlock[0].trim();
    
    // Detect block type
    if (isHeading(firstLine)) {
      const match = firstLine.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        blocks.push({
          type: 'heading',
          level: match[1].length,
          content: normalizeForDocx(match[2]),
          raw: firstLine, // Keep heading as-is
        });
      }
    } else if (firstLine.startsWith('>')) {
      blocks.push({
        type: 'blockquote',
        content: normalizeForDocx(raw.replace(/^>\s*/gm, '')),
        raw: normalizeForDocx(raw.replace(/^>\s*/gm, '')),
      });
    } else if (isListMarker(firstLine) || forceList) {
      // Parse as list items with continuation support
      const items = parseListItemsWithContinuation(currentBlock);
      blocks.push(...items);
    } else if (firstLine.startsWith('```')) {
      // Skip code blocks
    } else {
      // Paragraph - keep original lines for potential splitting
      blocks.push({
        type: 'paragraph',
        content: normalizeForDocx(raw),
        raw: normalizeForDocx(raw),
        originalLines: currentBlock.map(l => l.trim()).filter(l => l),
      });
    }
    
    currentBlock = [];
    inListItem = false;
  };

  let inTable = false;
  let tableLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length > 0) {
      blocks.push(parseTable(tableLines));
      tableLines = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle code blocks - skip them entirely
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        currentBlock = [];
        inCodeBlock = false;
      } else {
        flushBlock();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) continue;

    // Handle table rows
    if (isTableRow(line)) {
      flushBlock(); // End any previous block
      inTable = true;
      tableLines.push(line);
      continue;
    }

    // If we were in a table and hit a non-table line, flush the table
    if (inTable && !isTableRow(line)) {
      flushTable();
    }

    // Empty line signals end of block
    if (line.trim() === '') {
      flushBlock();
      flushTable();
      continue;
    }

    // Horizontal rule on its own line
    if (isHorizontalRule(line) && currentBlock.length === 0) {
      blocks.push({
        type: 'hr',
        content: '---',
        raw: '---',
      });
      continue;
    }

    // Heading on its own line
    if (isHeading(line) && currentBlock.length === 0) {
      currentBlock.push(line);
      flushBlock();
      continue;
    }

    // New list item starts
    if (isListMarker(line)) {
      // If we were building a different block type, flush it
      if (currentBlock.length > 0 && !isListMarker(currentBlock[0])) {
        flushBlock();
      }
      currentBlock.push(line);
      inListItem = true;
      continue;
    }

    // Continuation of list item (non-blank line after a list item start)
    if (inListItem && !isListMarker(line) && !isHeading(line)) {
      currentBlock.push(line);
      continue;
    }

    currentBlock.push(line);
  }

  flushBlock();
  flushTable();
  return blocks;
};

/**
 * Parse list items with continuation line support
 * Each bullet/arrow becomes its own block, continuation lines are merged
 */
const parseListItemsWithContinuation = (lines: string[]): ParsedBlock[] => {
  const items: ParsedBlock[] = [];
  let currentItem: string[] = [];

  const flushItem = () => {
    if (currentItem.length === 0) return;
    
    const fullText = currentItem.join(' ');
    const normalized = normalizeForDocx(fullText);
    
    items.push({
      type: 'list-item',
      content: normalized,
      raw: normalized,
    });
    
    currentItem = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Both main bullets and arrow sub-items start new items
    if (isListMarker(trimmed)) {
      flushItem();
      currentItem.push(trimmed);
    } else {
      // Continuation line
      currentItem.push(trimmed);
    }
  }

  flushItem();
  return items;
};

/**
 * Score how well a source block matches a target block by type.
 * Higher score = better match.
 *   3 = exact heading with same level
 *   2 = same block type
 *   1 = compatible types (list-item <-> paragraph)
 *   0 = no match
 */
const typeMatchScore = (source: ParsedBlock, target: ParsedBlock): number => {
  if (source.type === target.type) {
    if (source.type === 'heading' && source.level === target.level) return 3;
    return 2;
  }
  // Compatible cross-type pairs
  if (
    (source.type === 'list-item' && target.type === 'paragraph') ||
    (source.type === 'paragraph' && target.type === 'list-item')
  ) {
    return 1;
  }
  if (
    (source.type === 'heading' && (target.type === 'paragraph' || isBoldSubheading(target.content))) ||
    (target.type === 'heading' && (source.type === 'paragraph' || isBoldSubheading(source.content)))
  ) {
    return 1;
  }
  return 0;
};

/**
 * Apply post-match auto-fixes on a paired source+target:
 * - Heading level enforcement (wrap non-heading target in heading syntax)
 * Returns the (possibly modified) target block and whether a fix was applied.
 */
const applyPairAutoFix = (
  source: ParsedBlock,
  target: ParsedBlock
): { target: ParsedBlock; fixed: boolean } => {
  // Heading level enforcement: if source is heading but target isn't
  if (source.type === 'heading' && target.type !== 'heading') {
    let targetContent = target.content;
    if (/^\*\*.*\*\*$/.test(targetContent)) {
      targetContent = targetContent.slice(2, -2);
    }
    const headingPrefix = '#'.repeat(source.level || 1);
    return {
      target: {
        type: 'heading',
        level: source.level,
        content: normalizeForDocx(targetContent),
        raw: `${headingPrefix} ${normalizeForDocx(targetContent)}`,
      },
      fixed: true,
    };
  }
  return { target, fixed: false };
};

/**
 * Type-aware lookahead alignment of source (English) and target (Bangla) blocks.
 *
 * Instead of blind sequential pairing, this searches a window of upcoming target
 * blocks for the best type-match, preventing cascade misalignment when documents
 * have structural differences (extra headings, split paragraphs, etc.).
 *
 * Order-preserving: target indices always increase.
 */
const LOOKAHEAD_WINDOW = 5;

export const structureAwarePairing = (
  sourceBlocks: ParsedBlock[],
  targetBlocks: ParsedBlock[]
): PairingResult => {
  const pairs: { source: ParsedBlock | null; target: ParsedBlock | null }[] = [];
  let autoFixesApplied = 0;
  const targetUsed = new Set<number>();
  let nextTargetStart = 0;

  for (const sourceBlock of sourceBlocks) {
    let bestScore = 0;
    let bestIdx = -1;

    // Search within the lookahead window for best type match
    const windowEnd = Math.min(nextTargetStart + LOOKAHEAD_WINDOW, targetBlocks.length);
    for (let j = nextTargetStart; j < windowEnd; j++) {
      if (targetUsed.has(j)) continue;
      const score = typeMatchScore(sourceBlock, targetBlocks[j]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = j;
        if (score === 3) break; // perfect match, stop early
      }
    }

    if (bestIdx >= 0) {
      // Emit any skipped target blocks (between nextTargetStart and bestIdx) as unmatched
      for (let k = nextTargetStart; k < bestIdx; k++) {
        if (!targetUsed.has(k)) {
          pairs.push({ source: null, target: targetBlocks[k] });
          targetUsed.add(k);
        }
      }

      // Apply auto-fixes on the matched pair
      const matchedTarget = targetBlocks[bestIdx];
      const { target: fixedTarget, fixed } = applyPairAutoFix(sourceBlock, matchedTarget);
      if (fixed) autoFixesApplied++;

      pairs.push({ source: sourceBlock, target: fixedTarget });
      targetUsed.add(bestIdx);
      nextTargetStart = bestIdx + 1;
    } else {
      // No match in window — source is unmatched
      pairs.push({ source: sourceBlock, target: null });
    }
  }

  // Remaining unmatched target blocks
  for (let j = nextTargetStart; j < targetBlocks.length; j++) {
    if (!targetUsed.has(j)) {
      pairs.push({ source: null, target: targetBlocks[j] });
    }
  }

  const pairedCount = pairs.filter(p => p.source && p.target).length;
  const unmatchedSourceCount = pairs.filter(p => p.source && !p.target).length;
  const unmatchedTargetCount = pairs.filter(p => !p.source && p.target).length;

  return {
    pairs,
    pairedCount,
    unmatchedSourceCount,
    unmatchedTargetCount,
    autoFixesApplied,
  };
};

/**
 * Create a bilingual table by merging English and Bangla tables
 * Each cell shows English on top, Bangla below
 */
const createBilingualTable = (sourceTable: ParsedBlock, targetTable: ParsedBlock): string => {
  const sourceRows = sourceTable.tableRows || [];
  const targetRows = targetTable.tableRows || [];
  
  if (sourceRows.length === 0) return '';
  
  const maxCols = Math.max(...sourceRows.map(r => r.length), ...targetRows.map(r => r.length));
  const output: string[] = [];
  
  // Process each row
  for (let rowIdx = 0; rowIdx < Math.max(sourceRows.length, targetRows.length); rowIdx++) {
    const sourceRow = sourceRows[rowIdx] || [];
    const targetRow = targetRows[rowIdx] || [];
    
    const cells: string[] = [];
    for (let colIdx = 0; colIdx < maxCols; colIdx++) {
      const sourceCell = sourceRow[colIdx] || '';
      const targetCell = targetRow[colIdx] || '';
      
      // Combine English and Bangla in same cell with line break
      if (sourceCell && targetCell) {
        cells.push(`${sourceCell}<br>${targetCell}`);
      } else {
        cells.push(sourceCell || targetCell);
      }
    }
    
    output.push(`| ${cells.join(' | ')} |`);
    
    // Add separator after header row
    if (rowIdx === 0) {
      output.push(`| ${Array(maxCols).fill('---').join(' | ')} |`);
    }
  }
  
  return output.join('\n');
};

/**
 * Interweave source (English) and target (Bangla) blocks using structure-aware pairing
 * STRICT DOCX-SAFE STRUCTURE:
 * - For bullets: English bullet, then Bangla text directly below (same bullet point)
 * - For tables: Merged bilingual table with English/Bangla in each cell
 * - For others: English block, blank line, Bangla block
 */
export const mixInterwoven = (sourceBlocks: ParsedBlock[], targetBlocks: ParsedBlock[]): string => {
  const { pairs: rawPairs } = structureAwarePairing(sourceBlocks, targetBlocks);
  
  // Post-process: re-pair adjacent unmatched Bangla-only + English-only list items
  // This fixes cases where the lookahead emits skipped Bangla targets before matched English sources
  const pairs: typeof rawPairs = [];
  for (let i = 0; i < rawPairs.length; i++) {
    const curr = rawPairs[i];
    const next = rawPairs[i + 1];
    
    // Unmatched Bangla list-item followed by unmatched English list-item → merge into one pair
    if (
      !curr.source && curr.target?.type === 'list-item' &&
      next && next.source?.type === 'list-item' && !next.target
    ) {
      pairs.push({ source: next.source, target: curr.target });
      i++; // skip the next entry, we consumed it
      continue;
    }
    // Also handle unmatched Bangla paragraph that should pair with English list-item (cross-type)
    if (
      !curr.source && curr.target && (curr.target.type === 'list-item' || curr.target.type === 'paragraph') &&
      next && next.source && (next.source.type === 'list-item' || next.source.type === 'paragraph') && !next.target
    ) {
      pairs.push({ source: next.source, target: curr.target });
      i++;
      continue;
    }
    pairs.push(curr);
  }
  
  const output: string[] = [];

  for (let idx = 0; idx < pairs.length; idx++) {
    const pair = pairs[idx];
    const nextPair = pairs[idx + 1];

    // Skip HR blocks that directly precede H1/H2 headings (redundant visual separator)
    if (pair.source?.type === 'hr' || pair.target?.type === 'hr') {
      const nextIsH1OrH2 = nextPair?.source?.type === 'heading' && 
                           (nextPair.source.level === 1 || nextPair.source.level === 2);
      if (nextIsH1OrH2) {
        continue; // Skip this HR entirely
      }
      // Otherwise output HR once (no duplication)
      output.push('---');
      continue;
    }

    // Skip Bangla translation for headings - output English heading only
    if (pair.source?.type === 'heading') {
      output.push(pair.source.raw);
      output.push(''); // Add blank line after heading
      continue;
    }

    // Skip Bangla translation for bold-styled subheadings (e.g., **Key Points**)
    if (pair.source?.type === 'paragraph' && isBoldSubheading(pair.source.content)) {
      output.push(pair.source.raw);
      output.push(''); // Add blank line after subheading
      continue;
    }

    // Special handling for tables: merge into bilingual table
    if (pair.source?.type === 'table' && pair.target?.type === 'table') {
      output.push(createBilingualTable(pair.source, pair.target));
      continue;
    }
    
    // Single table (no pair)
    if (pair.source?.type === 'table') {
      output.push(pair.source.raw);
      continue;
    }
    if (pair.target?.type === 'table') {
      output.push(pair.target.raw);
      continue;
    }

    // Special handling for list items: English bullet with Bangla directly below, aligned with content
    if (pair.source?.type === 'list-item' && pair.target) {
      // Output English bullet (keep original formatting with marker)
      output.push(pair.source.raw);
      
      const sourceRaw = pair.source.raw;
      
      // Check if it's a numbered list or bullet list
      const numberedMatch = sourceRaw.match(/^(\d+\.\s+)/);
      const bulletMatch = sourceRaw.match(/^([-*+▸→]\s*)/);
      
      // Strip any bullet markers from Bangla content
      let banglaContent = pair.target.content;
      // Strip English markers: -, *, +, ▸, →, ➜ and numbered (1., 2.)
      // Strip Bangla numerals: ০-৯ followed by .
      banglaContent = banglaContent
        .replace(/^[-*+▸→➜]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/^[০-৯]+\.\s*/, '');
      
      if (numberedMatch) {
        // For numbered lists: indent by the length of "1. " or "10. " etc.
        const indent = ' '.repeat(numberedMatch[1].length);
        output.push(indent + normalizeForDocx(banglaContent));
      } else if (bulletMatch) {
        // For bullet lists: use space indentation matching the marker width
        const indent = ' '.repeat(bulletMatch[1].length);
        output.push(indent + normalizeForDocx(banglaContent));
      } else {
        // Default: use 2-space indent
        output.push('  ' + normalizeForDocx(banglaContent));
      }
      
      output.push(''); // Add blank line after each pair for separation
      continue;
    }

    // English block first (if exists)
    if (pair.source) {
      output.push(pair.source.raw);
    }

    // Blank line between English and Bangla so they render as separate paragraphs
    if (pair.source && pair.target) {
      output.push('');
    }

    // Bangla block as separate paragraph (if exists)
    if (pair.target) {
      output.push(pair.target.raw);
    }
    
    // Add blank line after each pair
    output.push('');
  }

  // Join with single newlines, trim extra whitespace
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Prepare content for side-by-side display using structure-aware pairing
 */
export interface SideBySidePair {
  source: ParsedBlock | null;
  target: ParsedBlock | null;
}

export const prepareSideBySide = (sourceBlocks: ParsedBlock[], targetBlocks: ParsedBlock[]): SideBySidePair[] => {
  const { pairs } = structureAwarePairing(sourceBlocks, targetBlocks);
  return pairs;
};

/**
 * Mix two markdown files into bilingual format with strict English-first rules
 */
export const mixFiles = (sourceContent: string, targetContent: string): string => {
  const sourceBlocks = parseMarkdownBlocks(sourceContent);
  const targetBlocks = parseMarkdownBlocks(targetContent);
  return mixInterwoven(sourceBlocks, targetBlocks);
};

/**
 * Validate bilingual content using structure-aware pairing
 * Returns detailed information about pairing success/failures
 */
export const validateBilingualContent = (sourceContent: string, targetContent: string): ValidationResult => {
  const sourceBlocks = parseMarkdownBlocks(sourceContent);
  const targetBlocks = parseMarkdownBlocks(targetContent);
  const warnings: string[] = [];

  if (sourceBlocks.length === 0) {
    return {
      valid: false,
      message: 'Source (English) content is empty',
      warnings,
      pairedCount: 0,
      unmatchedSourceCount: 0,
      unmatchedTargetCount: 0,
      autoFixesApplied: 0,
    };
  }

  if (targetBlocks.length === 0) {
    return {
      valid: false,
      message: 'Target (Bangla) content is empty',
      warnings,
      pairedCount: 0,
      unmatchedSourceCount: sourceBlocks.length,
      unmatchedTargetCount: 0,
      autoFixesApplied: 0,
    };
  }

  // Run structure-aware pairing
  const result = structureAwarePairing(sourceBlocks, targetBlocks);

  // Generate helpful warnings
  if (result.unmatchedSourceCount > 0) {
    warnings.push(`Missing ${result.unmatchedSourceCount} Bangla translation(s)`);
  }

  if (result.unmatchedTargetCount > 0) {
    warnings.push(`${result.unmatchedTargetCount} extra Bangla block(s)`);
  }

  const isFullyPaired = result.unmatchedSourceCount === 0 && result.unmatchedTargetCount === 0;

  let message: string;
  if (isFullyPaired) {
    if (result.autoFixesApplied > 0) {
      message = `Matched ${result.pairedCount} blocks (auto-fixed ${result.autoFixesApplied} formatting issue${result.autoFixesApplied > 1 ? 's' : ''})`;
    } else {
      message = `Successfully matched ${result.pairedCount} blocks`;
    }
  } else {
    message = `Matched ${result.pairedCount} blocks with issues`;
  }

  return {
    valid: true,
    message,
    warnings,
    pairedCount: result.pairedCount,
    unmatchedSourceCount: result.unmatchedSourceCount,
    unmatchedTargetCount: result.unmatchedTargetCount,
    autoFixesApplied: result.autoFixesApplied,
  };
};
