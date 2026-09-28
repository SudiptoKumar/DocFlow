/**
 * Lazy Mermaid initialization - renders mermaid diagrams in preview
 */

let mermaidLoaded = false;

export async function renderMermaidDiagrams(container: HTMLElement): Promise<void> {
  const elements = container.querySelectorAll('.mermaid:not([data-processed])');
  if (elements.length === 0) return;

  const mermaid = (await import('mermaid')).default;

  if (!mermaidLoaded) {
    mermaid.initialize({
      startOnLoad: false,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    });
    mermaidLoaded = true;
  }

  // Process each element
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;
    const code = el.textContent || '';
    if (!code.trim()) continue;

    try {
      const id = `mermaid-${Date.now()}-${i}`;
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
      el.setAttribute('data-processed', 'true');
    } catch (err) {
      console.warn('Mermaid render error:', err);
      el.innerHTML = `<pre class="text-red-500 text-sm p-2">Diagram error: ${(err as Error).message}</pre>`;
      el.setAttribute('data-processed', 'true');
    }
  }
}
