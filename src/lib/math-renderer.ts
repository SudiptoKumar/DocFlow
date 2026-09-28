/**
 * LaTeX Math Rendering Utilities using KaTeX
 * Supports both inline ($...$) and display ($$...$$) math
 */
import katex from 'katex';


/**
 * Render LaTeX math to HTML using KaTeX
 */
export function renderMathToHtml(latex: string, displayMode: boolean = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false,
      trust: true,
      output: 'html',
    });
  } catch (error) {
    console.warn('KaTeX render error:', error);
    return `<span class="math-error" style="color: #cc0000;">${displayMode ? '$$' : '$'}${latex}${displayMode ? '$$' : '$'}</span>`;
  }
}

/**
 * Process markdown/HTML content and render all LaTeX math expressions
 */
export function processLatexInHtml(html: string): string {
  let result = html;

  // Helper to clean up any residual HTML artifacts inside math content
  const cleanMathContent = (latex: string): string => {
    let cleaned = latex;
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    cleaned = cleaned.replace(/&amp;/g, '&');
    cleaned = cleaned.replace(/&lt;/g, '<');
    cleaned = cleaned.replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/&quot;/g, '"');
    return cleaned;
  };

  // Process display math first ($$...$$)
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, latex) => {
    return `<div class="math-display">${renderMathToHtml(cleanMathContent(latex).trim(), true)}</div>`;
  });

  // Process inline math ($...$)
  result = result.replace(/\$(?!\d)(\S(?:[^$\n]*?\S)?)\$/g, (_, latex) => {
    return `<span class="math-inline">${renderMathToHtml(cleanMathContent(latex).trim(), false)}</span>`;
  });

  return result;
}

/**
 * Extract plain text from LaTeX for Word/DOCX export
 * Converts common LaTeX commands to readable text
 */
export function latexToPlainText(latex: string): string {
  let text = latex;

  // Common fraction handling - simple single-char args get compact form
  text = text.replace(/\\frac\{([^}])\}\{([^}])\}/g, '$1/$2');
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

  // Greek letters
  const greekLetters: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
    '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
    '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
    '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
    '\\Alpha': 'Α', '\\Beta': 'Β', '\\Gamma': 'Γ', '\\Delta': 'Δ',
    '\\Epsilon': 'Ε', '\\Zeta': 'Ζ', '\\Eta': 'Η', '\\Theta': 'Θ',
    '\\Iota': 'Ι', '\\Kappa': 'Κ', '\\Lambda': 'Λ', '\\Mu': 'Μ',
    '\\Nu': 'Ν', '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Rho': 'Ρ',
    '\\Sigma': 'Σ', '\\Tau': 'Τ', '\\Upsilon': 'Υ', '\\Phi': 'Φ',
    '\\Chi': 'Χ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
  };

  for (const [cmd, letter] of Object.entries(greekLetters)) {
    text = text.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), letter);
  }

  // Common math symbols
  const symbols: Record<string, string> = {
    '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
    '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
    '\\equiv': '≡', '\\sim': '∼', '\\propto': '∝',
    '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
    '\\sum': 'Σ', '\\prod': 'Π', '\\int': '∫',
    '\\iint': '∬', '\\iiint': '∭', '\\oint': '∮',
    '\\sqrt': '√', '\\cdot': '·', '\\ldots': '…', '\\cdots': '⋯',
    '\\rightarrow': '→', '\\leftarrow': '←', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐',
    '\\leftrightarrow': '↔', '\\Leftrightarrow': '⇔',
    '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃',
    '\\subseteq': '⊆', '\\supseteq': '⊇', '\\cup': '∪', '\\cap': '∩',
    '\\forall': '∀', '\\exists': '∃', '\\neg': '¬', '\\land': '∧', '\\lor': '∨',
    // Additional symbols
    '\\to': '→', '\\mid': '|', '\\iff': '⇔', '\\implies': '⇒',
    '\\det': 'det', '\\lim': 'lim', '\\sin': 'sin', '\\cos': 'cos',
    '\\tan': 'tan', '\\log': 'log', '\\ln': 'ln', '\\max': 'max', '\\min': 'min',
    '\\left': '', '\\right': '', '\\,': ' ', '\\;': ' ', '\\quad': '  ', '\\qquad': '    ',
    '\\langle': '⟨', '\\rangle': '⟩', '\\lceil': '⌈', '\\rceil': '⌉',
    '\\lfloor': '⌊', '\\rfloor': '⌋',
    '\\mapsto': '↦', '\\hookrightarrow': '↪', '\\hookleftarrow': '↩',
    '\\uparrow': '↑', '\\downarrow': '↓',
  };

  for (const [cmd, symbol] of Object.entries(symbols)) {
    text = text.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), symbol);
  }

  // Handle \text{...} and \operatorname{...} -- extract content
  text = text.replace(/\\text\{([^}]*)\}/g, '$1');
  text = text.replace(/\\operatorname\{([^}]*)\}/g, '$1');
  text = text.replace(/\\mathrm\{([^}]*)\}/g, '$1');
  text = text.replace(/\\mathbf\{([^}]*)\}/g, '$1');
  text = text.replace(/\\mathit\{([^}]*)\}/g, '$1');

  // Handle \mathcal{X} -- map to script Unicode
  const calMap: Record<string, string> = {
    'A': '𝒜', 'B': 'ℬ', 'C': '𝒞', 'D': '𝒟', 'E': 'ℰ', 'F': 'ℱ',
    'G': '𝒢', 'H': 'ℋ', 'I': 'ℐ', 'J': '𝒥', 'K': '𝒦', 'L': 'ℒ',
    'M': 'ℳ', 'N': '𝒩', 'O': '𝒪', 'P': '𝒫', 'Q': '𝒬', 'R': 'ℛ',
    'S': '𝒮', 'T': '𝒯', 'U': '𝒰', 'V': '𝒱', 'W': '𝒲', 'X': '𝒳',
    'Y': '𝒴', 'Z': '𝒵',
  };
  text = text.replace(/\\mathcal\{([A-Z]+)\}/g, (_, chars) =>
    [...chars].map((c: string) => calMap[c] ?? c).join('')
  );

  // Handle \mathbb{X} -- map to double-struck Unicode
  const bbMap: Record<string, string> = {
    'R': 'ℝ', 'Z': 'ℤ', 'N': 'ℕ', 'Q': 'ℚ', 'C': 'ℂ', 'P': 'ℙ',
  };
  text = text.replace(/\\mathbb\{([A-Z])\}/g, (_, ch) => bbMap[ch] ?? ch);

  // Handle \binom{n}{k}
  text = text.replace(/\\binom\{([^}]+)\}\{([^}]+)\}/g, 'C($1,$2)');

  // Handle accents: \hat{x}, \bar{x}, \tilde{x}, etc.
  const accentUnicode: Record<string, string> = {
    'hat': '\u0302', 'bar': '\u0304', 'overline': '\u0304',
    'tilde': '\u0303', 'vec': '\u20D7', 'dot': '\u0307',
    'ddot': '\u0308', 'check': '\u030C', 'breve': '\u0306',
    'widehat': '\u0302', 'widetilde': '\u0303',
  };
  for (const [cmd, acc] of Object.entries(accentUnicode)) {
    const re = new RegExp(`\\\\${cmd}\\{([^}]*)\\}`, 'g');
    text = text.replace(re, (_, inner) => inner + acc);
  }

  // Handle \overbrace and \underbrace - strip to content
  text = text.replace(/\\overbrace\{([^}]*)\}/g, '$1');
  text = text.replace(/\\underbrace\{([^}]*)\}/g, '$1');

  // Handle \boxed{...} - strip box
  text = text.replace(/\\boxed\{([^}]*)\}/g, '[$1]');

  // Handle \overrightarrow{...}
  text = text.replace(/\\overrightarrow\{([^}]*)\}/g, '$1\u20D7');

  // Handle \begin{...}...\end{...} environments -- strip delimiters
  text = text.replace(/\\begin\{[^}]*\}/g, '');
  text = text.replace(/\\end\{[^}]*\}/g, '');
  text = text.replace(/\\\\/g, '; ');
  text = text.replace(/&/g, ', ');

  // Unicode superscript map for common characters
  const superscriptMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ',
  };
  const subscriptMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ',
  };

  const toUnicode = (s: string, map: Record<string, string>): string | null => {
    const result = [...s].map(c => map[c]);
    return result.every(Boolean) ? result.join('') : null;
  };

  // Superscripts: ^{...} or ^x
  text = text.replace(/\^{([^}]+)}/g, (_, inner) => {
    const u = toUnicode(inner, superscriptMap);
    return u ?? `^(${inner})`;
  });
  text = text.replace(/\^([0-9a-zA-Z])/g, (_, ch) => {
    return superscriptMap[ch] ?? `^${ch}`;
  });

  // Subscripts: _{...} or _x
  text = text.replace(/_{([^}]+)}/g, (_, inner) => {
    const u = toUnicode(inner, subscriptMap);
    return u ?? `_(${inner})`;
  });
  text = text.replace(/_([0-9a-zA-Z])/g, (_, ch) => {
    return subscriptMap[ch] ?? `_${ch}`;
  });

  // Preserve unknown LaTeX commands by stripping only the backslash
  text = text.replace(/\\([a-zA-Z]+)/g, '\\$1');
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Check if text contains LaTeX math expressions
 */
export function containsLatex(text: string): boolean {
  return /\$\$([\s\S]+?)\$\$/.test(text) || /\$(?!\d)(\S(?:[^$\n]*?\S)?)\$/.test(text);
}

/**
 * Get KaTeX CSS as a string for embedding in exports
 */
export function getKatexCssUrl(): string {
  return 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
}

/**
 * Get inline KaTeX CSS for self-contained exports
 */
export function getKatexStylesInline(): string {
  return `
    /* KaTeX Math Styles */
    .math-display {
      display: block;
      text-align: center;
      margin: 1em 0;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .math-inline {
      display: inline;
    }
    .math-error {
      color: #cc0000;
      font-family: monospace;
    }
    .katex {
      font-size: 1.1em;
      line-height: 1.2;
    }
    .katex-display {
      margin: 0.5em 0;
    }
    .katex-display > .katex {
      text-align: center;
    }
  `;
}
