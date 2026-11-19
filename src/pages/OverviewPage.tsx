import { useMemo, useState } from 'react';
import { PlotlyChart } from '../components/PlotlyChart.tsx';
import {
  type ObjectivesNavTarget,
  ProjectObjectivesBand,
} from '../components/ProjectObjectivesBand.tsx';
import { DOMAIN_PROFILES, METHODOLOGY_PROFILES } from '../constants/domainKnowledge.ts';
import type { DomainName, ModelLabSnapshot, ProjectRecord } from '../types/project.ts';

interface OverviewPageProps {
  records: ProjectRecord[];
  snapshot: ModelLabSnapshot;
  onQuickPredict: () => void;
  onNavigate: (section: ObjectivesNavTarget, selectedDomain?: DomainName) => void;
}

export function OverviewPage({ records, snapshot, onQuickPredict, onNavigate }: OverviewPageProps) {
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [methFilter, setMethFilter] = useState<string>('All');
  const [complexityFilter, setComplexityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (domainFilter !== 'All' && r.Domain !== domainFilter) return false;
      if (methFilter !== 'All' && r.Software_Development_Methodology !== methFilter) return false;
      if (complexityFilter !== 'All' && r.Project_Complexity !== complexityFilter) return false;
      if (statusFilter !== 'All' && r.Project_Status !== statusFilter) return false;
      return true;
    });
  }, [records, domainFilter, methFilter, complexityFilter, statusFilter]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const delayed = filtered.filter((r) => r.Is_Delayed === 1).length;
    const onTime = total - delayed;
    const avgDuration = total
      ? filtered.reduce((acc, r) => acc + r.Actual_Duration_Days, 0) / total
      : 0;
    const avgDelay = total ? filtered.reduce((acc, r) => acc + r.Delay_Days, 0) / total : 0;
    const delayPct = total ? (delayed / total) * 100 : 0;

    const methCounts = new Map<string, number>();
    const domainDelaySum = new Map<string, { sum: number; count: number }>();
    filtered.forEach((r) => {
      methCounts.set(
        r.Software_Development_Methodology,
        (methCounts.get(r.Software_Development_Methodology) ?? 0) + 1
      );
      const cur = domainDelaySum.get(r.Domain) ?? { sum: 0, count: 0 };
      cur.sum += r.Delay_Days;
      cur.count += 1;
      domainDelaySum.set(r.Domain, cur);
    });
    const topMeth = [...methCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
    const highestDelayDomain =
      [...domainDelaySum.entries()]
        .map(([d, v]) => ({ d, avg: v.sum / v.count }))
        .sort((a, b) => b.avg - a.avg)[0]?.d ?? 'N/A';

    const bestCls =
      snapshot.classifiers.find((c) => c.id === snapshot.bestClassifierId) ??
      snapshot.classifiers[0];

    return {
      total,
      onTime,
      delayed,
      avgDuration,
      avgDelay,
      delayPct,
      topMeth,
      highestDelayDomain,
      bestCls,
    };
  }, [filtered, snapshot]);

  const domainStats = useMemo(() => {
    return DOMAIN_PROFILES.map((dp) => {
      const sub = filtered.filter((r) => r.Domain === dp.name);
      const avgDelay = sub.length
        ? sub.reduce((a, b) => a + b.Delay_Days, 0) / sub.length
        : 0;
      const delayRate = sub.length
        ? (sub.filter((r) => r.Is_Delayed === 1).length / sub.length) * 100
        : 0;
      return {
        label: dp.shortName,
        count: sub.length,
        avgDelay: Number(avgDelay.toFixed(1)),
        delayRate: Number(delayRate.toFixed(1)),
      };
    });
  }, [filtered]);

  const methStats = useMemo(() => {
    return METHODOLOGY_PROFILES.map((mp) => {
      const sub = filtered.filter((r) => r.Software_Development_Methodology === mp.name);
      const onTime = sub.filter((r) => r.Is_Delayed === 0).length;
      const delayed = sub.length - onTime;
      const avgDelay = sub.length
        ? sub.reduce((a, b) => a + b.Delay_Days, 0) / sub.length
        : 0;
      return {
        label: mp.shortName,
        onTime,
        delayed,
        avgDelay: Number(avgDelay.toFixed(1)),
      };
    });
  }, [filtered]);

  const trendBuckets = useMemo(() => {
    const byMonth = new Map<string, { durSum: number; delaySum: number; count: number }>();
    filtered.forEach((r) => {
      const ym = r.Planned_Start_Date.slice(0, 7);
      const cur = byMonth.get(ym) ?? { durSum: 0, delaySum: 0, count: 0 };
      cur.durSum += r.Actual_Duration_Days;
      cur.delaySum += r.Delay_Days;
      cur.count += 1;
      byMonth.set(ym, cur);
    });
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        avgDuration: Number((v.durSum / v.count).toFixed(1)),
        avgDelay: Number((v.delaySum / v.count).toFixed(1)),
      }));
  }, [filtered]);

  const resetFilters = () => {
    setDomainFilter('All');
    setMethFilter('All');
    setComplexityFilter('All');
    setStatusFilter('All');
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082441] font-display">
            Executive Portfolio Overview
          </h1>
          <p className="text-sm text-[#647B92] mt-0.5">
            {snapshot.datasetName} · {filtered.length} of {records.length} projects shown ·{' '}
            {snapshot.sourceType === 'synthetic' ? 'Configurable Synthetic Benchmark' : 'Uploaded CSV'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-2 text-xs font-medium text-[#465D75] bg-white border border-[#C2D2E3] rounded-lg hover:text-[#082441] cursor-pointer whitespace-nowrap"
          >
            Reset Filters
          </button>
          <button
            type="button"
            onClick={onQuickPredict}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg cursor-pointer whitespace-nowrap"
          >
            Analyze New Project
          </button>
        </div>
      </div>

      {/* Interactive Filter Strip */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-[#647B92] mb-1">Domain</label>
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="w-full text-xs border border-[#C2D2E3] rounded-lg px-2.5 py-2 bg-white text-[#1B324B]"
          >
            <option value="All">All 4 Domains</option>
            {DOMAIN_PROFILES.map((d) => (
              <option key={d.name} value={d.name}>
                {d.shortName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#647B92] mb-1">Methodology</label>
          <select
            value={methFilter}
            onChange={(e) => setMethFilter(e.target.value)}
            className="w-full text-xs border border-[#C2D2E3] rounded-lg px-2.5 py-2 bg-white text-[#1B324B]"
          >
            <option value="All">All Methodologies</option>
            {METHODOLOGY_PROFILES.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#647B92] mb-1">Complexity</label>
          <select
            value={complexityFilter}
            onChange={(e) => setComplexityFilter(e.target.value)}
            className="w-full text-xs border border-[#C2D2E3] rounded-lg px-2.5 py-2 bg-white text-[#1B324B]"
          >
            <option value="All">All Levels</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#647B92] mb-1">Completion Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-xs border border-[#C2D2E3] rounded-lg px-2.5 py-2 bg-white text-[#1B324B]"
          >
            <option value="All">All Statuses</option>
            <option value="On Time">On Time</option>
            <option value="Delayed">Delayed</option>
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-xs text-[#647B92]">Filtered Projects</div>
          <div className="text-2xl font-bold text-[#082441] font-mono-tabular mt-1">{kpis.total}</div>
          <div className="text-xs text-[#465D75] mt-1 font-mono-tabular">
            {kpis.onTime} on time · {kpis.delayed} delayed
          </div>
        </div>

        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-xs text-[#647B92]">Delay Rate</div>
          <div className="text-2xl font-bold text-[#C85656] font-mono-tabular mt-1">
            {kpis.delayPct.toFixed(1)}%
          </div>
          <div className="text-xs text-[#465D75] mt-1">
            Avg {kpis.avgDelay >= 0 ? '+' : ''}
            {kpis.avgDelay.toFixed(1)} delay days
          </div>
        </div>

        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-xs text-[#647B92]">Avg Completion Duration</div>
          <div className="text-2xl font-bold text-[#082441] font-mono-tabular mt-1">
            {kpis.avgDuration.toFixed(1)}d
          </div>
          <div className="text-xs text-[#465D75] mt-1 truncate" title={kpis.topMeth}>
            Top method: {kpis.topMeth}
          </div>
        </div>

        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-xs text-[#647B92]">Highest-Delay Domain</div>
          <div className="text-base font-bold text-[#082441] mt-1.5 truncate" title={kpis.highestDelayDomain}>
            {kpis.highestDelayDomain.split(' ')[0]}
          </div>
          <div className="text-xs text-[#D48A45] mt-1.5 truncate">{kpis.highestDelayDomain}</div>
        </div>

        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4 col-span-2 lg:col-span-1">
          <div className="text-xs text-[#647B92]">Best Classifier (F1 / AUC)</div>
          <div className="text-base font-bold text-[#4C7DAE] mt-1.5 truncate">
            {kpis.bestCls.name}
          </div>
          <div className="text-xs text-[#465D75] mt-1.5 font-mono-tabular">
            F1 {kpis.bestCls.f1.toFixed(3)} · AUC {kpis.bestCls.rocAuc.toFixed(3)}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-12 text-center">
          <p className="text-base font-semibold text-[#082441]">
            No projects match the current filter combination
          </p>
          <p className="text-sm text-[#647B92] mt-1 mb-4">
            Clear one or more filters to restore portfolio visualizations.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] rounded-lg cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Delayed vs On-Time */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#082441] mb-1">
              Delayed vs. On-Time Delivery Split
            </h3>
            <p className="text-xs text-[#647B92] mb-2">
              Historical outcome distribution across filtered projects
            </p>
            <PlotlyChart
              height={280}
              data={[
                {
                  type: 'pie',
                  hole: 0.58,
                  values: [kpis.onTime, kpis.delayed],
                  labels: ['On Time', 'Delayed'],
                  marker: { colors: ['#4C7DAE', '#C85656'] },
                  textinfo: 'label+percent',
                  hovertemplate: '%{label}: %{value} projects (%{percent})<extra></extra>',
                },
              ]}
              layout={{
                margin: { t: 16, r: 16, b: 16, l: 16 },
                showlegend: true,
                legend: { orientation: 'h', y: -0.05 },
              }}
            />
          </div>

          {/* 2. Methodology-wise Delay Comparison */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#082441] mb-1">
              Methodology Delivery Outcomes
            </h3>
            <p className="text-xs text-[#647B92] mb-2">
              On-time vs delayed project volume across all five SDLC models
            </p>
            <PlotlyChart
              height={280}
              data={[
                {
                  type: 'bar',
                  name: 'On Time',
                  x: methStats.map((m) => m.label),
                  y: methStats.map((m) => m.onTime),
                  marker: { color: '#4C7DAE' },
                },
                {
                  type: 'bar',
                  name: 'Delayed',
                  x: methStats.map((m) => m.label),
                  y: methStats.map((m) => m.delayed),
                  marker: { color: '#C85656' },
                },
              ]}
              layout={{
                barmode: 'stack',
                margin: { t: 16, r: 16, b: 44, l: 48 },
                yaxis: { title: 'Projects' },
                legend: { orientation: 'h', y: 1.12 },
              }}
            />
          </div>

          {/* 3. Average Delay by Domain */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#082441] mb-1">
              Average Delay Days across the 4 Domains
            </h3>
            <p className="text-xs text-[#647B92] mb-2">
              Industry-specific schedule variance observed in the active dataset
            </p>
            <PlotlyChart
              height={300}
              data={[
                {
                  type: 'bar',
                  name: 'Avg Delay (Days)',
                  x: domainStats.map((d) => d.label),
                  y: domainStats.map((d) => d.avgDelay),
                  marker: {
                    color: domainStats.map((d) =>
                      d.avgDelay > 8 ? '#C85656' : d.avgDelay > 3 ? '#D48A45' : '#4C7DAE'
                    ),
                  },
                },
              ]}
              layout={{
                margin: { t: 16, r: 16, b: 56, l: 50 },
                yaxis: { title: 'Mean Delay (Days)' },
              }}
            />
          </div>

          {/* 4. Project Completion & Delay Trends Over Time */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#082441] mb-1">
              Project Duration &amp; Delay Trend
            </h3>
            <p className="text-xs text-[#647B92] mb-2">
              Monthly cohort average actual duration vs mean delay days
            </p>
            <PlotlyChart
              height={300}
              data={[
                {
                  type: 'scatter',
                  mode: 'lines+markers',
                  name: 'Avg Actual Duration (d)',
                  x: trendBuckets.map((t) => t.month),
                  y: trendBuckets.map((t) => t.avgDuration),
                  line: { color: '#082441', width: 2 },
                  marker: { size: 5 },
                },
                {
                  type: 'scatter',
                  mode: 'lines+markers',
                  name: 'Avg Delay (d)',
                  x: trendBuckets.map((t) => t.month),
                  y: trendBuckets.map((t) => t.avgDelay),
                  yaxis: 'y2',
                  line: { color: '#6495C6', width: 2 },
                  marker: { size: 5 },
                },
              ]}
              layout={{
                margin: { t: 24, r: 48, b: 48, l: 50 },
                yaxis: { title: 'Actual Duration (d)' },
                yaxis2: { title: 'Delay (d)', overlaying: 'y', side: 'right' },
                legend: { orientation: 'h', y: 1.15 },
              }}
            />
          </div>

          {/* 5. Planned vs Actual Duration Scatter */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#082441] mb-1">
              Planned vs. Actual Duration Variance
            </h3>
            <p className="text-xs text-[#647B92] mb-2">
              Projects above the dashed baseline experienced schedule slippage
            </p>
            <PlotlyChart
              height={280}
              data={[
                {
                  type: 'scatter',
                  mode: 'markers',
                  name: 'On Time',
                  x: filtered.filter((r) => r.Is_Delayed === 0).map((r) => r.Planned_Duration_Days),
                  y: filtered.filter((r) => r.Is_Delayed === 0).map((r) => r.Actual_Duration_Days),
                  marker: { color: '#4C7DAE', size: 6, opacity: 0.78 },
                },
                {
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Delayed',
                  x: filtered.filter((r) => r.Is_Delayed === 1).map((r) => r.Planned_Duration_Days),
                  y: filtered.filter((r) => r.Is_Delayed === 1).map((r) => r.Actual_Duration_Days),
                  marker: { color: '#C85656', size: 6, opacity: 0.78 },
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Schedule Baseline (y=x)',
                  x: [40, 320],
                  y: [40, 320],
                  line: { color: '#8DA2B8', dash: 'dash', width: 1.5 },
                },
              ]}
              layout={{
                margin: { t: 16, r: 16, b: 44, l: 50 },
                xaxis: { title: 'Planned Duration (d)' },
                yaxis: { title: 'Actual Duration (d)' },
                legend: { orientation: 'h', y: 1.14 },
              }}
            />
          </div>

          {/* 6. Algorithm Performance Overview */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[#082441] mb-1">
              Classification Algorithm Performance Overview
            </h3>
            <p className="text-xs text-[#647B92] mb-2">
              Held-out test F1-Score and ROC-AUC across all 7 trained models
            </p>
            <PlotlyChart
              height={280}
              data={[
                {
                  type: 'bar',
                  name: 'F1-Score',
                  x: snapshot.classifiers.map((c) => c.name.replace(' Classifier', '')),
                  y: snapshot.classifiers.map((c) => Number((c.f1 * 100).toFixed(1))),
                  marker: { color: '#082441' },
                },
                {
                  type: 'bar',
                  name: 'ROC-AUC',
                  x: snapshot.classifiers.map((c) => c.name.replace(' Classifier', '')),
                  y: snapshot.classifiers.map((c) => Number((c.rocAuc * 100).toFixed(1))),
                  marker: { color: '#6495C6' },
                },
              ]}
              layout={{
                barmode: 'group',
                margin: { t: 16, r: 16, b: 76, l: 50 },
                xaxis: { tickangle: -25 },
                yaxis: { title: 'Score (%)', range: [0, 105] },
                legend: { orientation: 'h', y: 1.14 },
              }}
            />
          </div>
        </div>
      )}

      <ProjectObjectivesBand onNavigate={onNavigate} compact />
    </div>
  );
}
