/**
 * Lazy function-plot initialization - renders math function graphs in preview
 */

export async function renderFunctionPlots(container: HTMLElement): Promise<void> {
  const elements = container.querySelectorAll('.function-plot:not([data-processed])');
  if (elements.length === 0) return;

  const functionPlot = (await import('function-plot')).default;

  elements.forEach((el) => {
    const fnExpr = (el as HTMLElement).dataset.fn;
    if (!fnExpr) return;

    try {
      // Parse the expression - support multiple functions separated by semicolons
      const fns = fnExpr.split(';').map(f => f.trim()).filter(Boolean);
      const data = fns.map(fn => ({ fn, color: undefined as string | undefined }));

      // Clear element and set dimensions
      el.innerHTML = '';
      (el as HTMLElement).style.width = '100%';
      (el as HTMLElement).style.maxWidth = '500px';
      (el as HTMLElement).style.margin = '1em auto';

      functionPlot({
        target: el as HTMLElement,
        width: 480,
        height: 300,
        grid: true,
        data,
      });

      el.setAttribute('data-processed', 'true');
    } catch (err) {
      console.warn('Function plot error:', err);
      el.innerHTML = `<pre class="text-red-500 text-sm p-2">Plot error: ${(err as Error).message}</pre>`;
      el.setAttribute('data-processed', 'true');
    }
  });
}
