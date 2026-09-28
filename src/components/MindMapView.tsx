import { useEffect, useRef, useCallback, useState } from 'react';

interface MindMapViewProps {
  markdown: string;
  className?: string;
}

const MindMapView = ({ markdown, className = '' }: MindMapViewProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  const renderMap = useCallback(async () => {
    if (!svgRef.current || !markdown.trim()) return;

    try {
      const { Transformer } = await import('markmap-lib');
      const { Markmap } = await import('markmap-view');

      const transformer = new Transformer();
      const { root } = transformer.transform(markdown);

      // Clear previous
      svgRef.current.innerHTML = '';

      mmRef.current = Markmap.create(svgRef.current, {
        autoFit: true,
        duration: 300,
        color: (node: any) => {
          const depth = node.depth || 0;
          const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];
          return colors[depth % colors.length];
        },
      }, root);

      setError(null);
    } catch (err) {
      console.error('Markmap error:', err);
      setError('Failed to render mind map');
    }
  }, [markdown]);

  useEffect(() => {
    const timer = setTimeout(renderMap, 500);
    return () => clearTimeout(timer);
  }, [renderMap]);

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full text-red-500 text-sm ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={`h-full w-full overflow-hidden bg-background ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default MindMapView;
