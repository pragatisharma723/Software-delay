import {
  Activity,
  BarChart3,
  Cpu,
  Database,
  FlaskConical,
  GitBranch,
  Layers,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DatasetExplorerPage } from './pages/DatasetExplorerPage.tsx';
import { DomainExplorerPage } from './pages/DomainExplorerPage.tsx';
import { LandingPage, type NavSection } from './pages/LandingPage.tsx';
import { MethodologyAnalysisPage } from './pages/MethodologyAnalysisPage.tsx';
import { ModelComparisonPage } from './pages/ModelComparisonPage.tsx';
import { ModelLabPage } from './pages/ModelLabPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { ProjectPredictionPage } from './pages/ProjectPredictionPage.tsx';
import {
  activateDatasetApi,
  fetchProjects,
  fetchWorkspace,
  generateSyntheticDatasetApi,
  retrainModelsApi,
  runProjectPredictionApi,
  uploadDatasetCsv,
} from './services/api.ts';
import type {
  DatasetMeta,
  DomainName,
  MethodologyName,
  ModelLabSnapshot,
  PredictionReport,
  ProjectPredictionInput,
  ProjectRecord,
} from './types/project.ts';

const NAV_ITEMS: Array<{
  id: Exclude<NavSection, 'landing'>;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'domains', label: 'Domain Explorer', icon: Layers },
  { id: 'methodologies', label: 'Methodology Analysis', icon: GitBranch },
  { id: 'dataset', label: 'Dataset Explorer', icon: Database },
  { id: 'predict', label: 'Project Prediction', icon: Activity },
  { id: 'lab', label: 'ML Model Laboratory', icon: FlaskConical },
  { id: 'comparison', label: 'Model Comparison', icon: BarChart3 },
];

export default function App() {
  const [section, setSection] = useState<NavSection>('landing');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [snapshot, setSnapshot] = useState<ModelLabSnapshot | null>(null);
  const [records, setRecords] = useState<ProjectRecord[]>([]);

  const [selectedDomain, setSelectedDomain] = useState<DomainName>(
    'Healthcare and Medical Software'
  );
  const [selectedMethodology, setSelectedMethodology] = useState<MethodologyName>('Agile (Scrum)');
  const [latestReport, setLatestReport] = useState<PredictionReport | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ws, projRes] = await Promise.all([
        fetchWorkspace(),
        fetchProjects({ limit: 500 }),
      ]);
      setDatasets(ws.datasets);
      setSnapshot(ws.snapshot);
      if (ws.predictions.length > 0) {
        setLatestReport(ws.predictions[0]);
      }
      setRecords(projRes.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ML workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleNavigate = (next: NavSection, dom?: DomainName) => {
    if (dom) setSelectedDomain(dom);
    setSection(next);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadCsv = async (name: string, csvText: string) => {
    const res = await uploadDatasetCsv(name, csvText);
    const projRes = await fetchProjects({ limit: 500 });
    setDatasets(res.datasets);
    setSnapshot(res.snapshot);
    setRecords(projRes.records);
    return res.warnings;
  };

  const handleGenerateSynthetic = async (rowCount: number, seed: number) => {
    const res = await generateSyntheticDatasetApi(rowCount, seed);
    const projRes = await fetchProjects({ limit: 500 });
    setDatasets(res.datasets);
    setSnapshot(res.snapshot);
    setRecords(projRes.records);
  };

  const handleActivateDataset = async (datasetId: number) => {
    const res = await activateDatasetApi(datasetId);
    const projRes = await fetchProjects({ limit: 500 });
    setDatasets(res.datasets);
    setSnapshot(res.snapshot);
    setRecords(projRes.records);
  };

  const handleChangeSimpleFeature = async (feature: string) => {
    const res = await retrainModelsApi({ simpleFeature: feature, onlySimple: true });
    setSnapshot(res.snapshot);
  };

  const handleRunPrediction = async (input: ProjectPredictionInput) => {
    const res = await runProjectPredictionApi(input);
    setLatestReport(res.report);
    return res.report;
  };

  if (loading || !snapshot) {
    return (
      <div className="min-h-screen bg-[#EFF4F9] flex items-center justify-center p-6">
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-8 max-w-md w-full text-center space-y-3">
          <Cpu className="w-8 h-8 text-[#4C7DAE] mx-auto" />
          <h1 className="text-base font-bold text-[#082441] font-display">
            Initializing ProjectPulse AI Pipelines
          </h1>
          <p className="text-xs text-[#647B92]">
            {error
              ? error
              : 'Training regression and 7 classification models on the active SQLite dataset...'}
          </p>
          {error && (
            <button
              type="button"
              onClick={loadAll}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg cursor-pointer"
            >
              Retry Connection
            </button>
          )}
        </div>
      </div>
    );
  }

  if (section === 'landing') {
    return <LandingPage snapshot={snapshot} onNavigate={handleNavigate} />;
  }

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === section)?.label ?? 'Overview';

  return (
    <div className="min-h-screen bg-[#EFF4F9] flex">
      {/* Desktop Sidebar (256px) — Deep Midnight Navy rail with crisp white active tab */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#082441] text-[#DCE5EE] border-r border-[#163A5E]">
        <div className="px-5 py-5 border-b border-[#163A5E]">
          <button
            type="button"
            onClick={() => handleNavigate('landing')}
            className="text-left cursor-pointer group"
          >
            <div className="text-base font-bold text-white font-display tracking-tight">
              ProjectPulse <span className="text-[#6495C6] group-hover:text-white transition-colors">AI</span>
            </div>
            <div className="text-[11px] text-[#9EB7D0] mt-0.5">
              Delay Prediction &amp; Model Lab
            </div>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white text-[#082441] font-semibold shadow-sm'
                    : 'text-[#B8CCE0] font-medium hover:bg-[#0E3154] hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#082441]' : 'text-[#6495C6]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-[#163A5E] text-[11px] text-[#9EB7D0] space-y-1">
          <div className="truncate text-white font-medium">{snapshot.datasetName}</div>
          <div className="font-mono-tabular">
            n={snapshot.dataQuality.totalRows} · {snapshot.trainSize}/{snapshot.testSize} split
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#07213B]/65"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#082441] text-[#DCE5EE] flex flex-col z-10">
            <div className="px-5 py-4 border-b border-[#163A5E] flex items-center justify-between">
              <span className="text-base font-bold text-white font-display">
                ProjectPulse <span className="text-[#6495C6]">AI</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#9EB7D0] hover:text-white p-1"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs cursor-pointer ${
                      active
                        ? 'bg-white text-[#082441] font-semibold'
                        : 'text-[#B8CCE0] font-medium hover:bg-[#0E3154]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#082441]' : 'text-[#6495C6]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="bg-white border-b border-[#D2DFEC] px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-[#C2D2E3] text-[#082441]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs text-[#647B92] truncate">
              <button
                type="button"
                onClick={() => handleNavigate('landing')}
                className="hover:text-[#082441] cursor-pointer"
              >
                ProjectPulse AI
              </button>
              <span className="mx-2">/</span>
              <span className="font-semibold text-[#082441]">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('predict')}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg cursor-pointer whitespace-nowrap"
            >
              Analyze Project
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1360px] w-full mx-auto">
          {section === 'overview' && (
            <OverviewPage
              records={records}
              snapshot={snapshot}
              onQuickPredict={() => handleNavigate('predict')}
              onNavigate={handleNavigate}
            />
          )}

          {section === 'domains' && (
            <DomainExplorerPage
              records={records}
              selectedDomain={selectedDomain}
              onSelectDomain={setSelectedDomain}
              onLaunchPrediction={(dom) => handleNavigate('predict', dom)}
            />
          )}

          {section === 'methodologies' && (
            <MethodologyAnalysisPage
              records={records}
              selectedMethodology={selectedMethodology}
              onSelectMethodology={setSelectedMethodology}
              onLaunchPrediction={(meth) => {
                setSelectedMethodology(meth);
                handleNavigate('predict');
              }}
            />
          )}

          {section === 'dataset' && (
            <DatasetExplorerPage
              datasets={datasets}
              snapshot={snapshot}
              records={records}
              onUploadCsv={handleUploadCsv}
              onGenerateSynthetic={handleGenerateSynthetic}
              onActivateDataset={handleActivateDataset}
            />
          )}

          {section === 'predict' && (
            <ProjectPredictionPage
              snapshot={snapshot}
              initialDomain={selectedDomain}
              initialMethodology={selectedMethodology}
              latestReport={latestReport}
              onRunPrediction={handleRunPrediction}
            />
          )}

          {section === 'lab' && (
            <ModelLabPage
              snapshot={snapshot}
              onChangeSimpleFeature={handleChangeSimpleFeature}
            />
          )}

          {section === 'comparison' && <ModelComparisonPage snapshot={snapshot} />}
        </main>
      </div>
    </div>
  );
}
