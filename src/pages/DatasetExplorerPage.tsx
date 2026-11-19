import { Download, RefreshCw, Search, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { PlotlyChart } from '../components/PlotlyChart.tsx';
import type { DatasetMeta, ModelLabSnapshot, ProjectRecord } from '../types/project.ts';

interface DatasetExplorerPageProps {
  datasets: DatasetMeta[];
  snapshot: ModelLabSnapshot;
  records: ProjectRecord[];
  onUploadCsv: (name: string, csvText: string) => Promise<string[]>;
  onGenerateSynthetic: (rowCount: number, seed: number) => Promise<void>;
  onActivateDataset: (datasetId: number) => Promise<void>;
}

export function DatasetExplorerPage({
  datasets,
  snapshot,
  records,
  onUploadCsv,
  onGenerateSynthetic,
  onActivateDataset,
}: DatasetExplorerPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [genCount, setGenCount] = useState(420);
  const [genSeed, setGenSeed] = useState(42);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const pageSize = 12;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      `${r.Project_ID} ${r.Project_Name} ${r.Domain} ${r.Software_Development_Methodology} ${r.Project_Status}`
        .toLowerCase()
        .includes(q)
    );
  }, [records, search]);

  const pageRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const warnings = await onUploadCsv(file.name.replace(/\.csv$/i, ''), text);
      setPage(0);
      setMessage({
        type: 'ok',
        text: `Dataset "${file.name}" ingested and all ML pipelines retrained.${
          warnings.length ? ' Notes: ' + warnings.join(' ') : ''
        }`,
      });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to upload CSV.',
      });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await onGenerateSynthetic(genCount, genSeed);
      setPage(0);
      setMessage({
        type: 'ok',
        text: `Generated synthetic benchmark dataset (n=${genCount}, seed=${genSeed}) and retrained all models.`,
      });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Generation failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async (id: number) => {
    setBusy(true);
    setMessage(null);
    try {
      await onActivateDataset(id);
      setPage(0);
      setMessage({ type: 'ok', text: 'Switched active dataset and retrained ML models.' });
    } catch (err) {
      setMessage({ type: 'err', text: err instanceof Error ? err.message : 'Switch failed.' });
    } finally {
      setBusy(false);
    }
  };

  // EDA correlation between key numeric drivers and Delay_Days
  const edaCorrelations = useMemo(() => {
    const features: Array<{ key: keyof ProjectRecord; label: string }> = [
      { key: 'Dependency_Delay', label: 'Dependency Delay' },
      { key: 'Critical_Bugs', label: 'Critical Bugs' },
      { key: 'Requirement_Changes', label: 'Requirement Changes' },
      { key: 'Rework_Hours', label: 'Rework Hours' },
      { key: 'Testing_Completion_Percentage', label: 'Testing Completion %' },
      { key: 'Completion_Percentage', label: 'Task Completion %' },
      { key: 'Team_Productivity', label: 'Team Productivity' },
      { key: 'Resource_Availability', label: 'Resource Availability' },
    ];
    const y = records.map((r) => r.Delay_Days);
    const yMean = y.reduce((a, b) => a + b, 0) / Math.max(1, y.length);

    return features
      .map((f) => {
        const x = records.map((r) => Number(r[f.key]));
        const xMean = x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
        let num = 0;
        let dx2 = 0;
        let dy2 = 0;
        for (let i = 0; i < x.length; i++) {
          const dx = x[i] - xMean;
          const dy = y[i] - yMean;
          num += dx * dy;
          dx2 += dx * dx;
          dy2 += dy * dy;
        }
        const corr = dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0;
        return { label: f.label, corr: Number(corr.toFixed(3)) };
      })
      .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082441] font-display">
            Dataset Explorer &amp; Preprocessing Audit
          </h1>
          <p className="text-sm text-[#647B92] mt-0.5">
            Inspect active records, upload custom CSV datasets, download sample records, and review zero-leakage preprocessing statistics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/dataset/download"
            className="px-3.5 py-2 text-xs font-medium text-[#082441] bg-white border border-[#C2D2E3] hover:border-[#082441] rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download Sample CSV
          </a>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] disabled:opacity-60 rounded-lg inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            {busy ? 'Processing...' : 'Upload Custom CSV'}
          </button>
        </div>
      </div>

      {/* Explicit Provenance Notice */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-[#465D75] leading-relaxed">
          <strong className="text-[#082441]">Data Provenance Disclosure:</strong>{' '}
          {snapshot.sourceType === 'synthetic'
            ? 'The active dataset is a configurable synthetic software engineering benchmark (seed=42) covering the 4 core industry domains and 5 methodologies cleanly. It is not misrepresented as proprietary real-world corporate telemetry.'
            : 'You are analyzing a user-uploaded CSV dataset. All missing cells, duplicate IDs, and scaling parameters are fitted strictly on the 80% training split.'}
        </div>
        <span className="text-xs font-mono-tabular font-semibold text-[#4C7DAE] whitespace-nowrap shrink-0">
          Split: {snapshot.trainSize} train / {snapshot.testSize} test
        </span>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs ${
            message.type === 'ok'
              ? 'bg-[#EAF1F8] border-[#4C7DAE]/45 text-[#082441]'
              : 'bg-[#FDF2F2] border-[#C85656]/40 text-[#9B2C2C]'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Data Quality Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-[11px] text-[#647B92]">Total Records</div>
          <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
            {snapshot.dataQuality.totalRows}
          </div>
        </div>
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-[11px] text-[#647B92]">Schema Features</div>
          <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
            {snapshot.dataQuality.featureCount}
          </div>
        </div>
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-[11px] text-[#647B92]">Missing Imputed</div>
          <div className="text-xl font-bold text-[#4C7DAE] font-mono-tabular mt-1">
            {snapshot.dataQuality.missingValuesImputed}
          </div>
        </div>
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-[11px] text-[#647B92]">Duplicates Removed</div>
          <div className="text-xl font-bold text-[#4C7DAE] font-mono-tabular mt-1">
            {snapshot.dataQuality.duplicatesRemoved}
          </div>
        </div>
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-[11px] text-[#647B92]">IQR Outliers Flagged</div>
          <div className="text-xl font-bold text-[#D48A45] font-mono-tabular mt-1">
            {snapshot.dataQuality.outliersDetectedIQR}
          </div>
        </div>
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-4">
          <div className="text-[11px] text-[#647B92]">Delayed Class Share</div>
          <div className="text-xl font-bold text-[#C85656] font-mono-tabular mt-1">
            {(snapshot.dataQuality.classBalance.delayedRatio * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Configurable Synthetic Generator & Dataset Switcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#D2DFEC] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#082441]">
            Configurable Synthetic Dataset Generator
          </h3>
          <p className="text-xs text-[#647B92]">
            Generate a fresh benchmark cohort and automatically retrain all regression and classification models.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#647B92] mb-1">Project Rows (80–1000)</label>
              <input
                type="number"
                min={80}
                max={1000}
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
                className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#647B92] mb-1">Random Seed</label>
              <input
                type="number"
                min={1}
                max={9999}
                value={genSeed}
                onChange={(e) => setGenSeed(Number(e.target.value))}
                className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleGenerate}
            className="w-full px-4 py-2 text-xs font-semibold text-[#082441] bg-[#EFF4F9] border border-[#C2D2E3] hover:border-[#082441] rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Generate &amp; Retrain Pipeline
          </button>

          {datasets.length > 1 && (
            <div className="pt-3 border-t border-[#D2DFEC]">
              <div className="text-xs font-semibold text-[#082441] mb-2">Saved SQLite Datasets</div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {datasets.map((ds) => (
                  <div
                    key={ds.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-[#E3EBF3]"
                  >
                    <div className="truncate pr-2">
                      <span className="font-medium text-[#082441]">{ds.name}</span>
                      <span className="text-[#647B92] ml-2 font-mono-tabular">n={ds.row_count}</span>
                    </div>
                    {ds.is_active ? (
                      <span className="text-[11px] font-semibold text-[#4C7DAE] shrink-0">Active</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleActivate(ds.id)}
                        className="text-[11px] font-medium text-[#356594] hover:underline shrink-0 cursor-pointer"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* EDA Feature Correlation with Delay Days */}
        <div className="lg:col-span-7 bg-white border border-[#D2DFEC] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#082441] mb-1">
            Exploratory Correlation with Project Delay Days (Pearson r)
          </h3>
          <p className="text-xs text-[#647B92] mb-2">
            Positive r values increase schedule overrun; negative r values protect on-time delivery
          </p>
          <PlotlyChart
            height={270}
            data={[
              {
                type: 'bar',
                orientation: 'h',
                y: [...edaCorrelations].reverse().map((c) => c.label),
                x: [...edaCorrelations].reverse().map((c) => c.corr),
                marker: {
                  color: [...edaCorrelations]
                    .reverse()
                    .map((c) => (c.corr >= 0 ? '#C85656' : '#4C7DAE')),
                },
              },
            ]}
            layout={{
              margin: { t: 16, r: 20, b: 40, l: 150 },
              xaxis: { title: 'Pearson Correlation (r)', range: [-1, 1] },
            }}
          />
        </div>
      </div>

      {/* Numeric Feature Summary Table */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D2DFEC]">
          <h3 className="text-sm font-semibold text-[#082441]">
            Exploratory Numeric Summary Statistics
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#E3EBF3] text-[#465D75] border-b border-[#D2DFEC]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Feature</th>
                <th className="text-right px-4 py-2.5 font-medium">Mean</th>
                <th className="text-right px-4 py-2.5 font-medium">Std Dev</th>
                <th className="text-right px-4 py-2.5 font-medium">Min</th>
                <th className="text-right px-4 py-2.5 font-medium">Median</th>
                <th className="text-right px-4 py-2.5 font-medium">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3EBF3]">
              {snapshot.dataQuality.numericSummary.map((row) => (
                <tr key={row.feature} className="hover:bg-[#EFF4F9]/70">
                  <td className="px-4 py-2 font-medium text-[#082441]">{row.feature}</td>
                  <td className="px-4 py-2 text-right font-mono-tabular">{row.mean}</td>
                  <td className="px-4 py-2 text-right font-mono-tabular">{row.std}</td>
                  <td className="px-4 py-2 text-right font-mono-tabular">{row.min}</td>
                  <td className="px-4 py-2 text-right font-mono-tabular">{row.median}</td>
                  <td className="px-4 py-2 text-right font-mono-tabular">{row.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Preview Table */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D2DFEC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#082441]">Historical Records Preview</h3>
            <p className="text-xs text-[#647B92]">
              Showing {pageRows.length} of {filteredRows.length} matching records
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-[#647B92] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search ID, project, domain..."
              className="w-full text-xs border border-[#C2D2E3] rounded-lg pl-8 pr-3 py-2"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#E3EBF3] text-[#465D75] border-b border-[#D2DFEC]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">ID</th>
                <th className="text-left px-4 py-2.5 font-medium">Project Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Domain</th>
                <th className="text-left px-4 py-2.5 font-medium">Methodology</th>
                <th className="text-right px-4 py-2.5 font-medium">Planned</th>
                <th className="text-right px-4 py-2.5 font-medium">Actual</th>
                <th className="text-right px-4 py-2.5 font-medium">Delay</th>
                <th className="text-right px-4 py-2.5 font-medium">Bugs (Crit)</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3EBF3]">
              {pageRows.map((r) => (
                <tr key={r.Project_ID} className="hover:bg-[#EFF4F9]/70">
                  <td className="px-4 py-2.5 font-mono-tabular text-[#465D75]">{r.Project_ID}</td>
                  <td className="px-4 py-2.5 font-medium text-[#082441] max-w-[200px] truncate">
                    {r.Project_Name}
                  </td>
                  <td className="px-4 py-2.5 text-[#465D75]">{r.Domain.split(' ')[0]}</td>
                  <td className="px-4 py-2.5 text-[#465D75]">{r.Software_Development_Methodology}</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">
                    {r.Planned_Duration_Days}d
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">
                    {r.Actual_Duration_Days}d
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono-tabular font-medium ${
                      r.Delay_Days > 0 ? 'text-[#C85656]' : 'text-[#4C7DAE]'
                    }`}
                  >
                    {r.Delay_Days > 0 ? `+${r.Delay_Days}d` : `${r.Delay_Days}d`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">
                    {r.Bugs_Reported} ({r.Critical_Bugs})
                  </td>
                  <td
                    className={`px-4 py-2.5 font-medium ${
                      r.Project_Status === 'Delayed' ? 'text-[#C85656]' : 'text-[#4C7DAE]'
                    }`}
                  >
                    {r.Project_Status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-[#D2DFEC] flex items-center justify-between text-xs text-[#647B92]">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1 border border-[#C2D2E3] rounded disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1 border border-[#C2D2E3] rounded disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
