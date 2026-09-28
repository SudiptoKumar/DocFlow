/**
 * Markdown to plain text with speech hints
 * Since Web Speech API doesn't support SSML directly,
 * we strip markdown and add natural pauses via punctuation.
 */

export function markdownToSpeechText(markdown: string): string {
  let text = markdown;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');

  // Convert headings to paused speech
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '\n\n$1.\n\n');

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Convert links to just text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove bold/italic markers
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');
  text = text.replace(/_(.+?)_/g, '$1');

  // Remove strikethrough
  text = text.replace(/~~(.+?)~~/g, '$1');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove blockquote markers
  text = text.replace(/^>\s*/gm, '');

  // Remove list markers
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // Remove highlight, sub, sup markers
  text = text.replace(/==(.+?)==/g, '$1');
  text = text.replace(/~(.+?)~/g, '$1');
  text = text.replace(/\^(.+?)\^/g, '$1');

  // Remove math
  text = text.replace(/\$\$[\s\S]*?\$\$/g, '');
  text = text.replace(/\$[^$]+\$/g, '');

  // Remove footnotes
  text = text.replace(/\[\^\d+\]/g, '');
  text = text.replace(/\[\^\d+\]:.*$/gm, '');

  // Remove TOC marker
  text = text.replace(/\[\[toc\]\]/gi, '');

  // Remove container markers
  text = text.replace(/^:::\s*\w*$/gm, '');

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}
