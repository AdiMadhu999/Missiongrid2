import React from 'react';

interface MathDiagramProps {
  metadata?: {
    needsDiagram: boolean;
    shape?: string;
    labels?: string[];
  };
  diagram_svg?: string;
}

const MathDiagram: React.FC<MathDiagramProps> = ({ metadata, diagram_svg }) => {
  const [svgError, setSvgError] = React.useState(false);

  // Clean up any markdown code blocks (e.g. ```xml ... ``` or ```svg ... ```) around the SVG
  let cleanedSvg = diagram_svg;
  if (cleanedSvg) {
    cleanedSvg = cleanedSvg.trim();
    if (cleanedSvg.startsWith('```')) {
      cleanedSvg = cleanedSvg.replace(/^```(?:xml|svg|html)?\s*/i, '');
      cleanedSvg = cleanedSvg.replace(/\s*```$/, '');
      cleanedSvg = cleanedSvg.trim();
    }
    // Extract SVG from substring to bypass any leading/trailing AI text or markdown wrapper safely
    const svgStart = cleanedSvg.indexOf('<svg');
    const svgEnd = cleanedSvg.lastIndexOf('</svg>');
    if (svgStart !== -1 && svgEnd !== -1 && svgEnd > svgStart) {
      cleanedSvg = cleanedSvg.substring(svgStart, svgEnd + 6);
    }
  }

  React.useEffect(() => {
    setSvgError(false);
    if (diagram_svg) {
      console.log(`[MathDiagram] Received diagram_svg: length=${diagram_svg.length}, startsWith=${diagram_svg.substring(0, 40).replace(/\n/g, ' ')}`);
      console.log(`[MathDiagram] Cleaned diagram_svg (first 500 ch):`, cleanedSvg ? cleanedSvg.substring(0, 500) : "empty");
    } else {
      console.log("[MathDiagram] No diagram_svg provided.");
    }
  }, [diagram_svg, cleanedSvg]);

  if (cleanedSvg) {
    if (svgError) {
      return (
        <div className="my-4 p-8 bg-rose-50 rounded-xl border border-rose-100 text-rose-500 text-center font-bold text-sm">
          Diagram Rendering Failed
        </div>
      );
    }

    return (
      <div className="my-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-col items-center overflow-hidden">
        <span className="text-[9px] uppercase font-bold text-slate-300 mb-3 tracking-widest">AI Generated Figure</span>
        <div 
          className="w-full max-w-full flex justify-center py-2 animate-fade-in [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:block"
          dangerouslySetInnerHTML={{ __html: cleanedSvg }} 
        />
      </div>
    );
  }

  if (!metadata) return null;

  const needsDiagram = metadata.needsDiagram || (metadata as any).requiresDiagram;
  const shape = metadata.shape || (metadata as any).shapeType;
  const labels = metadata.labels || [];

  if (!needsDiagram || !shape) return null;

  const normalizedShape = shape.trim().toLowerCase();

  const renderShape = () => {
    switch (normalizedShape) {
      case 'circle':
        return (
          <svg viewBox="0 0 100 100" width="128" height="128" className="w-32 h-32 mx-auto select-none">
            <circle cx="50" cy="50" r="40" stroke="#4f46e5" strokeWidth="2.5" fill="rgba(79, 70, 229, 0.05)" />
            {labels[0] && (
              <line x1="50" y1="50" x2="90" y2="50" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="3,3" />
            )}
            {labels[0] && (
              <text x="54" y="45" fill="#312e81" className="text-[10px] font-bold font-sans">{labels[0]}</text>
            )}
          </svg>
        );
      case 'triangle':
        return (
          <svg viewBox="0 0 100 100" width="128" height="128" className="w-32 h-32 mx-auto select-none">
            <polygon points="50,15 90,85 10,85" stroke="#4f46e5" strokeWidth="2.5" fill="rgba(79, 70, 229, 0.05)" />
            {labels[0] && <text x="50" y="11" fill="#312e81" className="text-[10px] font-bold font-sans text-center" textAnchor="middle">{labels[0]}</text>}
            {labels[1] && <text x="92" y="85" fill="#312e81" className="text-[10px] font-bold font-sans">{labels[1]}</text>}
            {labels[2] && <text x="5" y="85" fill="#312e81" className="text-[10px] font-bold font-sans">{labels[2]}</text>}
          </svg>
        );
      case 'square':
      case 'rectangle':
        const isSquare = normalizedShape === 'square';
        const width = isSquare ? 60 : 80;
        const height = 60;
        const x = (100 - width) / 2;
        const y = (100 - height) / 2;
        return (
          <svg viewBox="0 0 100 100" width="128" height="128" className="w-32 h-32 mx-auto select-none">
            <rect x={x} y={y} width={width} height={height} stroke="#4f46e5" strokeWidth="2.5" fill="rgba(79, 70, 229, 0.05)" />
            {labels[0] && <text x="50" y={y - 5} fill="#312e81" className="text-[10px] font-bold font-sans text-center" textAnchor="middle">{labels[0]}</text>}
            {labels[1] && <text x={x + width + 5} y="50" fill="#312e81" className="text-[10px] font-bold font-sans">{labels[1]}</text>}
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="my-4 p-5 bg-gradient-to-b from-indigo-50/40 to-slate-50 border border-slate-200/60 rounded-3xl text-slate-500 flex flex-col items-center shadow-inner">
      <span className="text-[10px] uppercase font-black text-indigo-400 mb-3 tracking-widest bg-white px-2.5 py-0.5 rounded-full shadow-sm border border-slate-100">Figure: {shape}</span>
      <div className="bg-white p-3 rounded-2xl border border-slate-100/50 shadow flex items-center justify-center min-w-[144px]">
        {renderShape()}
      </div>
    </div>
  );
};

export default MathDiagram;
