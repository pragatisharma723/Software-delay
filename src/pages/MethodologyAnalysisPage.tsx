import { ArrowRight } from 'lucide-react';
import { useMemo } from 'react';
import { PlotlyChart } from '../components/PlotlyChart.tsx';
import { METHODOLOGY_PROFILES } from '../constants/domainKnowledge.ts';
import type { MethodologyName, ProjectRecord } from '../types/project.ts';

interface MethodologyAnalysisPageProps {
  records: ProjectRecord[];
  selectedMethodology: MethodologyName;
  onSelectMethodology: (m: MethodologyName) => void;
  onLaunchPrediction: (m: MethodologyName) => void;
}

export function MethodologyAnalysisPage({
  records,
  selectedMethodology,
  onSelectMethodology,
  onLaunchPrediction,
}: MethodologyAnalysisPageProps) {
  const methMetrics = useMemo(() => {
    return METHODOLOGY_PROFILES.map((mp) => {
      const sub = records.filter((r) => r.Software_Development_Methodology === mp.name);
      const n = sub.length;
      const delayed = sub.filter((r) => r.Is_Delayed === 1).length;
      const avgDelay = n ? sub.reduce((a, b) => a + b.Delay_Days, 0) / n : 0;
      const avgPlanned = n ? sub.reduce((a, b) => a + b.Planned_Duration_Days, 0) / n : 0;
      const avgDuration = n ? sub.reduce((a, b) => a + b.Actual_Duration_Days, 0) / n : 0;
      return {
        ...mp,
        count: n,
        delayRate: n ? Number(((delayed / n) * 100).toFixed(1)) : 0,
        avgDelay: Number(avgDelay.toFixed(1)),
        avgPlanned: Number(avgPlanned.toFixed(1)),
        avgDuration: Number(avgDuration.toFixed(1)),
      };
    });
  }, [records]);

  const activeProfile =
    methMetrics.find((m) => m.name === selectedMethodology) ?? methMetrics[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082441] font-display">
            Software Development Methodology Analysis
          </h1>
          <p className="text-sm text-[#647B92] mt-0.5">
            Empirical delay rates, duration variance, and lifecycle stage parameters observed directly from the active dataset.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onLaunchPrediction(activeProfile.name)}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg inline-flex items-center gap-2 cursor-pointer whitespace-nowrap self-start lg:self-auto"
        >
          Predict with {activeProfile.shortName}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 5 Methodology Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {methMetrics.map((m) => {
          const isSelected = m.name === selectedMethodology;
          return (
            <button
              key={m.name}
              type="button"
              onClick={() => onSelectMethodology(m.name)}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white border-[#082441] ring-1 ring-[#082441]'
                  : 'bg-white border-[#D2DFEC] hover:border-[#4C7DAE]'
              }`}
            >
              <div className="text-xs text-[#647B92] font-mono-tabular mb-1">
                n={m.count} · {m.delayRate}% delayed
              </div>
              <div className="text-sm font-semibold text-[#082441]">{m.name}</div>
              <div className="text-xs text-[#465D75] mt-1 font-mono-tabular">
                Avg delay: {m.avgDelay >= 0 ? '+' : ''}
                {m.avgDelay}d
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Methodology Detail & Lifecycle Phases */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-5 border-b border-[#D2DFEC]">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold text-[#4C7DAE] mb-1">
              {activeProfile.paradigm}
            </div>
            <h2 className="text-xl font-bold text-[#082441] font-display">
              {activeProfile.name}
            </h2>
            <p className="text-sm text-[#465D75] mt-1.5 leading-relaxed">
              {activeProfile.description}
            </p>
            <p className="text-xs text-[#647B92] mt-2">
              Best Suited For: {activeProfile.bestSuitedFor}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-5 shrink-0">
            <div>
              <div className="text-[11px] text-[#647B92]">Delay Rate</div>
              <div className="text-xl font-bold text-[#C85656] font-mono-tabular">
                {activeProfile.delayRate}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#647B92]">Mean Delay</div>
              <div className="text-xl font-bold text-[#082441] font-mono-tabular">
                {activeProfile.avgDelay >= 0 ? '+' : ''}
                {activeProfile.avgDelay}d
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#647B92]">Avg Actual Dur.</div>
              <div className="text-xl font-bold text-[#4C7DAE] font-mono-tabular">
                {activeProfile.avgDuration}d
              </div>
            </div>
          </div>
        </div>

        {/* Sequential / Cyclic Phases */}
        <div>
          <h3 className="text-xs font-semibold text-[#082441] mb-3">
            Lifecycle Stages &amp; Model-Tracked Parameters
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {activeProfile.phases.map((phase, idx) => (
              <div
                key={phase}
                className="border border-[#D2DFEC] rounded-lg p-3 bg-[#EFF4F9]"
              >
                <div className="text-[11px] font-mono-tabular text-[#647B92]">
                  Stage 0{idx + 1}
                </div>
                <div className="text-xs font-semibold text-[#082441] mt-1">{phase}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div>
            <h3 className="text-xs font-semibold text-[#082441] mb-2">
              Observed Delay Drivers in {activeProfile.shortName}
            </h3>
            <ul className="space-y-2 text-sm text-[#465D75]">
              {activeProfile.primaryDelayDrivers.map((drv) => (
                <li key={drv} className="flex items-start gap-2">
                  <span className="text-[#D48A45] font-bold">·</span>
                  <span>{drv}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#082441] mb-2">
              Dynamic Feature Inputs Mapped to ML Pipeline
            </h3>
            <div className="space-y-2">
              {activeProfile.specificInputs.map((inp) => (
                <div
                  key={String(inp.key)}
                  className="flex items-center justify-between text-xs border-b border-[#E3EBF3] pb-1.5"
                >
                  <span className="font-medium text-[#082441]">{inp.label}</span>
                  <span className="text-[#647B92] font-mono-tabular">
                    {inp.min}–{inp.max} {inp.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comparative Methodology Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#082441] mb-1">
            Delay Rate &amp; Average Delay Days by Methodology
          </h3>
          <p className="text-xs text-[#647B92] mb-2">
            Observed across {records.length} projects in the active dataset
          </p>
          <PlotlyChart
            height={290}
            data={[
              {
                type: 'bar',
                name: 'Delay Rate (%)',
                x: methMetrics.map((m) => m.shortName),
                y: methMetrics.map((m) => m.delayRate),
                marker: { color: '#082441' },
              },
              {
                type: 'bar',
                name: 'Avg Delay (Days)',
                x: methMetrics.map((m) => m.shortName),
                y: methMetrics.map((m) => m.avgDelay),
                marker: { color: '#D48A45' },
              },
            ]}
            layout={{
              barmode: 'group',
              margin: { t: 20, r: 16, b: 48, l: 48 },
              legend: { orientation: 'h', y: 1.15 },
            }}
          />
        </div>

        <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#082441] mb-1">
            Mean Planned vs. Actual Duration by Methodology
          </h3>
          <p className="text-xs text-[#647B92] mb-2">
            Schedule baseline vs observed delivery length across the 5 SDLC lifecycles
          </p>
          <PlotlyChart
            height={290}
            data={[
              {
                type: 'bar',
                name: 'Avg Planned (Days)',
                x: methMetrics.map((m) => m.shortName),
                y: methMetrics.map((m) => m.avgPlanned),
                marker: { color: '#6495C6' },
              },
              {
                type: 'bar',
                name: 'Avg Actual (Days)',
                x: methMetrics.map((m) => m.shortName),
                y: methMetrics.map((m) => m.avgDuration),
                marker: { color: '#082441' },
              },
            ]}
            layout={{
              barmode: 'group',
              margin: { t: 20, r: 16, b: 48, l: 48 },
              yaxis: { title: 'Duration (Days)' },
              legend: { orientation: 'h', y: 1.15 },
            }}
          />
        </div>
      </div>
    </div>
  );
}
