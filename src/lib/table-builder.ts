/**
 * Table Builder: converts raw pasted data (CSV, TSV, pipe-separated, etc.)
 * into a clean Markdown table.
 */

export type Delimiter = 'tab' | 'comma' | 'pipe' | 'spaces';

export function detectDelimiter(text: string): Delimiter {
  const lines = text.trim().split('\n').slice(0, 5); // sample first 5 lines

  const tabCount = lines.reduce((sum, l) => sum + (l.match(/\t/g)?.length || 0), 0);
  const commaCount = lines.reduce((sum, l) => sum + (l.match(/,/g)?.length || 0), 0);
  const pipeCount = lines.reduce((sum, l) => sum + (l.match(/\|/g)?.length || 0), 0);
  const spaceCount = lines.reduce((sum, l) => sum + (l.match(/ {2,}/g)?.length || 0), 0);

  const max = Math.max(tabCount, commaCount, pipeCount, spaceCount);
  if (max === 0) return 'comma'; // fallback

  if (tabCount === max) return 'tab';
  if (commaCount === max) return 'comma';
  if (pipeCount === max) return 'pipe';
  return 'spaces';
}

export function parseRawData(text: string, delimiter?: Delimiter): string[][] {
  const det = delimiter || detectDelimiter(text);
  const lines = text.trim().split('\n');

  const splitter = (line: string): string[] => {
    switch (det) {
      case 'tab':
        return line.split('\t').map(c => c.trim());
      case 'comma':
        return parseCSVLine(line);
      case 'pipe':
        return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      case 'spaces':
        return line.split(/ {2,}/).map(c => c.trim());
    }
  };

  const rows = lines.map(splitter).filter(row => row.some(cell => cell.length > 0));

  // Normalize column count
  const maxCols = Math.max(...rows.map(r => r.length));
  return rows.map(row => {
    while (row.length < maxCols) row.push('');
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function buildMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  const colCount = rows[0].length;
  const colWidths: number[] = Array(colCount).fill(0);

  rows.forEach(row => {
    row.forEach((cell, i) => {
      colWidths[i] = Math.max(colWidths[i], cell.length, 3);
    });
  });

  const header = '| ' + rows[0].map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |';
  const separator = '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |';
  const body = rows.slice(1).map(row =>
    '| ' + row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |'
  ).join('\n');

  return [header, separator, body].filter(Boolean).join('\n');
}

export function rawDataToMarkdownTable(text: string, delimiter?: Delimiter): string {
  const rows = parseRawData(text, delimiter);
  return buildMarkdownTable(rows);
}
