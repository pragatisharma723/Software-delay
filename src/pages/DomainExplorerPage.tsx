import { ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DomainIcon } from '../components/DomainIcon.tsx';
import { PlotlyChart } from '../components/PlotlyChart.tsx';
import { DOMAIN_PROFILES } from '../constants/domainKnowledge.ts';
import type { DomainName, ProjectRecord } from '../types/project.ts';

interface DomainExplorerPageProps {
  records: ProjectRecord[];
  selectedDomain: DomainName;
  onSelectDomain: (d: DomainName) => void;
  onLaunchPrediction: (d: DomainName) => void;
}

export function DomainExplorerPage({
  records,
  selectedDomain,
  onSelectDomain,
  onLaunchPrediction,
}: DomainExplorerPageProps) {
  const [hoveredDomain, setHoveredDomain] = useState<DomainName | null>(null);
  const activeName = hoveredDomain ?? selectedDomain;
  const profile =
    DOMAIN_PROFILES.find((d) => d.name === activeName) ?? DOMAIN_PROFILES[0];

  const domainRows = useMemo(
    () => records.filter((r) => r.Domain === profile.name),
    [records, profile.name]
  );

  const stats = useMemo(() => {
    const n = domainRows.length;
    const delayed = domainRows.filter((r) => r.Is_Delayed === 1).length;
    const avgPlanned = n ? domainRows.reduce((s, r) => s + r.Planned_Duration_Days, 0) / n : 0;
    const avgActual = n ? domainRows.reduce((s, r) => s + r.Actual_Duration_Days, 0) / n : 0;
    const avgDelay = n ? domainRows.reduce((s, r) => s + r.Delay_Days, 0) / n : 0;
    const avgBugs = n ? domainRows.reduce((s, r) => s + r.Bugs_Reported, 0) / n : 0;
    return {
      n,
      delayRate: n ? (delayed / n) * 100 : 0,
      avgPlanned,
      avgActual,
      avgDelay,
      avgBugs,
    };
  }, [domainRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082441] font-display">
            Industry Domain Explorer
          </h1>
          <p className="text-sm text-[#647B92] mt-0.5">
            Select a software sector to inspect domain risk indicators, historical benchmarks, and launch prediction.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onLaunchPrediction(profile.name)}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          Analyze {profile.shortName} Project
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 4-Domain Interactive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DOMAIN_PROFILES.map((dom) => {
          const isSelected = dom.name === selectedDomain;
          const count = records.filter((r) => r.Domain === dom.name).length;
          return (
            <button
              key={dom.name}
              type="button"
              onClick={() => onSelectDomain(dom.name)}
              onMouseEnter={() => setHoveredDomain(dom.name)}
              onMouseLeave={() => setHoveredDomain(null)}
              className={`text-left p-5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white border-[#082441] ring-1 ring-[#082441]'
                  : 'bg-white border-[#D2DFEC] hover:border-[#4C7DAE]'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: dom.softBgHex }}
                >
                  <DomainIcon domain={dom.name} className="w-5 h-5" color={dom.accentHex} />
                </div>
                <span className="text-xs text-[#647B92] font-mono-tabular">
                  {count} projects
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#082441] mb-1">{dom.name}</h3>
              <p className="text-xs text-[#465D75] leading-relaxed">{dom.tagline}</p>
            </button>
          );
        })}
      </div>

      {/* Selected Domain Intelligence Panel */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#D2DFEC]">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: profile.softBgHex }}
            >
              <DomainIcon domain={profile.name} className="w-6 h-6" color={profile.accentHex} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#082441] font-display">{profile.name}</h2>
              <p className="text-sm text-[#465D75] mt-1 max-w-2xl">{profile.description}</p>
              <p className="text-xs text-[#647B92] mt-1.5">
                Compliance &amp; Architecture Context: {profile.regulatoryContext}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
            <div>
              <div className="text-[11px] text-[#647B92]">Delay Rate</div>
              <div className="text-lg font-bold text-[#C85656] font-mono-tabular">
                {stats.delayRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#647B92]">Avg Delay</div>
              <div className="text-lg font-bold text-[#082441] font-mono-tabular">
                {stats.avgDelay >= 0 ? '+' : ''}
                {stats.avgDelay.toFixed(1)}d
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#647B92]">Avg Actual Dur.</div>
              <div className="text-lg font-bold text-[#082441] font-mono-tabular">
                {stats.avgActual.toFixed(0)}d
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[#647B92]">Avg Bugs</div>
              <div className="text-lg font-bold text-[#4C7DAE] font-mono-tabular">
                {stats.avgBugs.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-[#082441] mb-2">
                Representative Software Systems
              </h3>
              <ul className="space-y-1.5 text-sm text-[#465D75]">
                {profile.examples.map((ex) => (
                  <li key={ex} className="flex items-center gap-2">
                    <span className="text-[#4C7DAE] font-mono-tabular">·</span>
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-4 border-t border-[#D2DFEC]">
              <h3 className="text-xs font-semibold text-[#082441] mb-2">
                Domain-Specific Delay Indicators
              </h3>
              <ul className="space-y-1.5 text-sm text-[#465D75]">
                {profile.keyRiskIndicators.map((ind) => (
                  <li key={ind} className="flex items-center gap-2">
                    <span className="text-[#D48A45] font-mono-tabular">·</span>
                    <span>{ind}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-7">
            <h3 className="text-xs font-semibold text-[#082441] mb-1">
              Planned vs. Actual Duration ({profile.shortName} Cohort)
            </h3>
            <p className="text-xs text-[#647B92] mb-2">
              Points above the diagonal reference line experienced schedule overrun
            </p>
            <PlotlyChart
              height={260}
              data={[
                {
                  type: 'scatter',
                  mode: 'markers',
                  name: 'On Time',
                  x: domainRows.filter((r) => r.Is_Delayed === 0).map((r) => r.Planned_Duration_Days),
                  y: domainRows.filter((r) => r.Is_Delayed === 0).map((r) => r.Actual_Duration_Days),
                  text: domainRows.filter((r) => r.Is_Delayed === 0).map((r) => r.Project_Name),
                  marker: { color: '#4C7DAE', size: 8, opacity: 0.85 },
                },
                {
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Delayed',
                  x: domainRows.filter((r) => r.Is_Delayed === 1).map((r) => r.Planned_Duration_Days),
                  y: domainRows.filter((r) => r.Is_Delayed === 1).map((r) => r.Actual_Duration_Days),
                  text: domainRows.filter((r) => r.Is_Delayed === 1).map((r) => r.Project_Name),
                  marker: { color: '#C85656', size: 8, opacity: 0.85 },
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  name: 'On-Schedule Line (y=x)',
                  x: [40, 320],
                  y: [40, 320],
                  line: { color: '#8DA2B8', dash: 'dash', width: 1.5 },
                },
              ]}
              layout={{
                margin: { t: 16, r: 16, b: 44, l: 52 },
                xaxis: { title: 'Planned Duration (Days)' },
                yaxis: { title: 'Actual Duration (Days)' },
                legend: { orientation: 'h', y: 1.15 },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
