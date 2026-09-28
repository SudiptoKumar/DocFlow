import mammoth from 'mammoth';
import { turndownService } from './html-to-markdown';

/**
 * Convert a DOCX file to Markdown.
 * Pipeline: DOCX binary → HTML (mammoth) → Markdown (turndown)
 */
export async function convertDocxToMarkdown(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
      ],
    }
  );

  if (result.messages.length > 0) {
    console.warn('DOCX conversion warnings:', result.messages);
  }

  let markdown = turndownService.turndown(result.value);

  // Fix escaped periods in numbered lists (e.g., "1\." → "1.")
  markdown = markdown.replace(/(\d+)\\\./g, '$1.');

  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}
