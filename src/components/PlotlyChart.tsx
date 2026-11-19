import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

interface PlotlyChartProps {
  data: Array<Record<string, unknown>>;
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
  height?: number;
  className?: string;
}

export function PlotlyChart({
  data,
  layout = {},
  config = {},
  height = 320,
  className = '',
}: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mergedLayout = {
      autosize: true,
      height,
      margin: { t: 36, r: 20, b: 48, l: 54 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        family: "'DM Sans', system-ui, sans-serif",
        size: 12,
        color: '#1B324B',
      },
      hoverlabel: {
        bgcolor: '#082441',
        bordercolor: '#082441',
        font: { color: '#FFFFFF', size: 12, family: "'DM Sans', sans-serif" },
      },
      ...layout,
    };

    const mergedConfig = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
      ...config,
    };

    Plotly.react(el, data as Plotly.Data[], mergedLayout as Partial<Plotly.Layout>, mergedConfig);

    const ro = new ResizeObserver(() => {
      if (el) {
        Plotly.Plots.resize(el);
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [data, layout, config, height]);

  useEffect(() => {
    const el = containerRef.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, []);

  return <div ref={containerRef} className={`w-full ${className}`} style={{ minHeight: height }} />;
}
