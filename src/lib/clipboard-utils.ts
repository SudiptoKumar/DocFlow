/**
 * Rich clipboard copy utility - copies HTML content with formatting preserved
 * Works like ChatGPT/Gemini copy feature - pastes with full formatting into Word/Google Docs
 */
import DOMPurify from 'dompurify';

/**
 * Strip HTML tags and return plain text with proper paragraph breaks
 */
function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(html);
  
  // Replace <br> with newlines before extracting text
  div.querySelectorAll('br').forEach(br => {
    br.replaceWith('\n');
  });
  
  // Add double newlines after block elements for paragraph breaks
  div.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6').forEach(el => {
    el.append('\n\n');
  });
  
  return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Convert <br> tags to proper paragraph structure for Word/Google Docs compatibility
 * This ensures proper paragraph breaks instead of soft line breaks
 */
function convertBreaksToParagraphs(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(html);
  
  // Process each element that might contain <br> tags
  const processElement = (element: Element) => {
    const children = Array.from(element.childNodes);
    let currentFragment: Node[] = [];
    const newChildren: Node[] = [];
    
    children.forEach((child) => {
      if (child.nodeName === 'BR') {
        // When we hit a <br>, wrap current fragment in <p> and start new one
        if (currentFragment.length > 0) {
          const p = document.createElement('p');
          p.style.margin = '0';
          p.style.marginBottom = '0.5em';
          // Word does not reliably do per-script fallback from a font-family stack.
          // So we set Times New Roman as the base and later wrap Bengali ranges with SolaimanLipi spans.
          p.style.fontFamily = "'Times New Roman', serif";
          currentFragment.forEach(node => p.appendChild(node.cloneNode(true)));
          newChildren.push(p);
          currentFragment = [];
        }
      } else {
        currentFragment.push(child);
      }
    });

    // Handle remaining fragment
    if (currentFragment.length > 0) {
      const p = document.createElement('p');
      p.style.margin = '0';
      p.style.marginBottom = '0.5em';
      p.style.fontFamily = "'Times New Roman', serif";
      currentFragment.forEach(node => p.appendChild(node.cloneNode(true)));
      newChildren.push(p);
    }
    
    // Only replace if we found <br> tags and created paragraphs
    if (newChildren.length > 1) {
      element.innerHTML = '';
      newChildren.forEach(child => element.appendChild(child));
    }
  };
  
  // Process paragraph and heading elements that contain <br> tags
  div.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div.markdown-preview > *').forEach(el => {
    if (el.querySelector('br')) {
      processElement(el);
    }
  });
  
  // Also handle direct <br> children of the root
  if (div.querySelector(':scope > br')) {
    processElement(div);
  }
  
  return div.innerHTML;
}

/**
 * Wrap Bengali text segments in spans with SolaimanLipi so Microsoft Word applies the font.
 * Word often ignores per-character fallback in "font-family: Times, SolaimanLipi".
 */
function applyWordFriendlyScriptFonts(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = DOMPurify.sanitize(html);

  // Base font for all non-Bengali text
  root.style.fontFamily = "'Times New Roman', serif";
  root.style.fontSize = '12pt';
  root.style.lineHeight = '1.5';

  const splitByBengali = (text: string): Array<{ text: string; bengali: boolean }> => {
    const parts: Array<{ text: string; bengali: boolean }> = [];
    let buf = '';
    let currentIsBn = /[\u0964\u0965\u0980-\u09FF]/.test(text[0] ?? '');

    for (const ch of text) {
      const isBn = /[\u0964\u0965\u0980-\u09FF]/.test(ch);
      if (isBn !== currentIsBn && buf) {
        parts.push({ text: buf, bengali: currentIsBn });
        buf = '';
        currentIsBn = isBn;
      }
      buf += ch;
    }

    if (buf) parts.push({ text: buf, bengali: currentIsBn });
    return parts;
  };

  const shouldSkip = (el: Element | null): boolean => {
    if (!el) return true;
    return Boolean(el.closest('code, pre, script, style'));
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const node of textNodes) {
    const text = node.nodeValue ?? '';
    if (!/[\u0964\u0965\u0980-\u09FF]/.test(text)) continue;
    if (shouldSkip(node.parentElement)) continue;

    const parts = splitByBengali(text);
    const frag = document.createDocumentFragment();

    for (const part of parts) {
      if (!part.text) continue;
      if (part.bengali) {
        const span = document.createElement('span');
        span.style.fontFamily = "'SolaimanLipi', serif";
        span.textContent = part.text;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(part.text));
      }
    }

    node.replaceWith(frag);
  }

  // Keep the wrapper div so Word receives the base font too.
  return root.outerHTML;
}

/**
 * Copy rich HTML content to clipboard with formatting preserved
 * Uses ClipboardItem API for both text/html and text/plain MIME types
 */
export async function copyRichContent(htmlContent: string): Promise<boolean> {
  try {
    // Convert <br> tags to proper paragraph structure
    const processedHtml = convertBreaksToParagraphs(htmlContent);

    // Apply Word-friendly per-script fonts
    const wordHtml = applyWordFriendlyScriptFonts(processedHtml);

    // Create both HTML and plain text versions
    const plainText = htmlToPlainText(wordHtml);

    // Use ClipboardItem API for rich copy
    const htmlBlob = new Blob([wordHtml], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });

    const clipboardItem = new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob,
    });

    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (error) {
    console.error('Rich copy failed, falling back to plain text:', error);

    // Fallback to plain text copy
    try {
      const plainText = htmlToPlainText(htmlContent);
      await navigator.clipboard.writeText(plainText);
      return true;
    } catch (fallbackError) {
      console.error('Plain text copy also failed:', fallbackError);
      return false;
    }
  }
}
