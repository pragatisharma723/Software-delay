import { Check, Download, FileSpreadsheet, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DomainIcon } from '../components/DomainIcon.tsx';
import { PlotlyChart } from '../components/PlotlyChart.tsx';
import {
  DEFAULT_PREDICTION_INPUT,
  DOMAIN_PROFILES,
  METHODOLOGY_PROFILES,
} from '../constants/domainKnowledge.ts';
import { exportPredictionCsv, exportPredictionPdf } from '../services/reportExport.ts';
import type {
  ComplexityLevel,
  DomainName,
  MethodologyName,
  ModelLabSnapshot,
  PredictionReport,
  ProjectPredictionInput,
} from '../types/project.ts';

interface ProjectPredictionPageProps {
  snapshot: ModelLabSnapshot;
  initialDomain?: DomainName;
  initialMethodology?: MethodologyName;
  latestReport: PredictionReport | null;
  onRunPrediction: (input: ProjectPredictionInput) => Promise<PredictionReport>;
}

const ALL_MODELS = [
  { id: 'simple_linear', label: 'Simple Linear Regression', task: 'Regression' },
  { id: 'multiple_linear', label: 'Multiple Linear Regression', task: 'Regression' },
  { id: 'logistic_regression', label: 'Logistic Regression', task: 'Classification' },
  { id: 'naive_bayes', label: 'Gaussian Naive Bayes', task: 'Classification' },
  { id: 'decision_tree', label: 'Decision Tree Classifier', task: 'Classification' },
  { id: 'svm', label: 'Support Vector Machine (SVM)', task: 'Classification' },
  { id: 'knn', label: 'K-Nearest Neighbors (KNN)', task: 'Classification' },
  { id: 'random_forest', label: 'Random Forest Classifier', task: 'Ensemble' },
  { id: 'gradient_boosting', label: 'Gradient Boosting Classifier', task: 'Ensemble' },
];

export function ProjectPredictionPage({
  snapshot,
  initialDomain,
  initialMethodology,
  latestReport,
  onRunPrediction,
}: ProjectPredictionPageProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [form, setForm] = useState<ProjectPredictionInput>(() => ({
    ...DEFAULT_PREDICTION_INPUT,
    ...(initialDomain ? { Domain: initialDomain } : {}),
    ...(initialMethodology ? { Software_Development_Methodology: initialMethodology } : {}),
  }));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<PredictionReport | null>(latestReport);

  useEffect(() => {
    if (initialDomain) {
      const prof = DOMAIN_PROFILES.find((d) => d.name === initialDomain);
      if (prof) {
        setForm((prev) => ({
          ...prev,
          ...prof.presetInput,
          Domain: prof.name,
          Software_Development_Methodology:
            initialMethodology ??
            prof.presetInput.Software_Development_Methodology ??
            prev.Software_Development_Methodology,
        }));
      }
    } else if (initialMethodology) {
      setForm((prev) => ({
        ...prev,
        Software_Development_Methodology: initialMethodology,
      }));
    }
  }, [initialDomain, initialMethodology]);

  const activeDomainProfile =
    DOMAIN_PROFILES.find((d) => d.name === form.Domain) ?? DOMAIN_PROFILES[0];
  const activeMethProfile =
    METHODOLOGY_PROFILES.find((m) => m.name === form.Software_Development_Methodology) ??
    METHODOLOGY_PROFILES[0];

  const applyDomainPreset = (domName: DomainName) => {
    const prof = DOMAIN_PROFILES.find((d) => d.name === domName);
    if (!prof) return;
    setForm((prev) => ({
      ...prev,
      ...prof.presetInput,
      Domain: prof.name,
    }));
  };

  const updateNum = (key: keyof ProjectPredictionInput, raw: string) => {
    const val = Number(raw);
    const cleanVal = Number.isFinite(val) ? val : 0;
    setForm((prev) => {
      const next = { ...prev, [key]: cleanVal };
      if (key === 'Number_of_Tasks' || key === 'Tasks_Completed') {
        const total = Math.max(1, key === 'Number_of_Tasks' ? cleanVal : next.Number_of_Tasks);
        const comp = Math.min(total, Math.max(0, key === 'Tasks_Completed' ? cleanVal : next.Tasks_Completed));
        next.Tasks_Completed = comp;
        next.Tasks_Pending = Math.max(0, total - comp);
      }
      if (key === 'Bugs_Reported') {
        const bugs = Math.max(0, cleanVal);
        next.Bugs_Reported = bugs;
        next.Critical_Bugs = Math.min(next.Critical_Bugs, bugs);
        next.Bugs_Resolved = Math.min(bugs, Math.round(bugs * 0.72));
      }
      if (key === 'Critical_Bugs') {
        next.Critical_Bugs = Math.min(next.Bugs_Reported, Math.max(0, cleanVal));
      }
      return next;
    });
  };

  const validateForm = (): string | null => {
    if (!form.Project_Name.trim()) return 'Please provide a Project Name.';
    if (form.Planned_Duration_Days < 10) return 'Planned Duration must be at least 10 days.';
    if (form.Team_Size < 1) return 'Team Size must be at least 1 developer.';
    if (form.Tasks_Completed > form.Number_of_Tasks) {
      return 'Tasks Completed cannot exceed Total Number of Tasks.';
    }
    if (form.Critical_Bugs > form.Bugs_Reported) {
      return 'Critical Bugs cannot exceed Bugs Reported.';
    }
    if (form.selectedModels.length === 0) {
      return 'Select at least one prediction algorithm.';
    }
    return null;
  };

  const handlePredict = async () => {
    const err = validateForm();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setRunning(true);
    try {
      const res = await onRunPrediction(form);
      setReport(res);
      setStep(5);
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Prediction request failed.');
    } finally {
      setRunning(false);
    }
  };

  const toggleModel = (id: string) => {
    setForm((prev) => {
      const exists = prev.selectedModels.includes(id);
      const next = exists
        ? prev.selectedModels.filter((m) => m !== id)
        : [...prev.selectedModels, id];
      return { ...prev, selectedModels: next };
    });
  };

  const riskBadgeColor = (risk: string) => {
    if (risk === 'Low') return 'text-[#2A5786] bg-[#EAF1F8] border-[#4C7DAE]/40';
    if (risk === 'Moderate') return 'text-[#8C5A1E] bg-[#FDF5EC] border-[#D48A45]/45';
    if (risk === 'High') return 'text-[#A34D18] bg-[#FFF3E8] border-[#D48A45]/60';
    return 'text-[#A33939] bg-[#FDF2F2] border-[#C85656]/40';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082441] font-display">
            Analyze Your Project
          </h1>
          <p className="text-sm text-[#647B92] mt-0.5">
            Guided multi-model prediction workspace · Domain: {activeDomainProfile.shortName} · Methodology:{' '}
            {form.Software_Development_Methodology}
          </p>
        </div>

        <button
          type="button"
          disabled={running}
          onClick={handlePredict}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] disabled:opacity-60 rounded-lg inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Play className="w-3.5 h-3.5" />
          {running ? 'Running ML Pipeline...' : 'Run Prediction Analysis'}
        </button>
      </div>

      {/* 5-Step Progress Navigation */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl p-2 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {[
          { num: 1 as const, title: '01. Domain' },
          { num: 2 as const, title: '02. Methodology' },
          { num: 3 as const, title: '03. Project Details' },
          { num: 4 as const, title: '04. Select Models' },
          { num: 5 as const, title: '05. Analysis Report' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setStep(s.num)}
            className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              step === s.num
                ? 'bg-[#082441] text-white'
                : 'text-[#465D75] hover:bg-[#EFF4F9] hover:text-[#082441]'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {validationError && (
        <div className="p-3.5 rounded-xl bg-[#FDF2F2] border border-[#C85656]/40 text-xs text-[#9B2C2C]">
          {validationError}
        </div>
      )}

      {/* STEP 1: Domain Selection */}
      {step === 1 && (
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#082441]">
                Step 1: Select Industry Domain
              </h2>
              <p className="text-xs text-[#647B92] mt-0.5">
                Choose from the 4 core software sectors to load calibrated sector defaults.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg cursor-pointer whitespace-nowrap"
            >
              Continue to Methodology →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DOMAIN_PROFILES.map((dom) => {
              const selected = form.Domain === dom.name;
              return (
                <button
                  key={dom.name}
                  type="button"
                  onClick={() => applyDomainPreset(dom.name)}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    selected
                      ? 'border-[#082441] bg-[#EFF4F9]/60 ring-1 ring-[#082441]'
                      : 'border-[#D2DFEC] hover:border-[#4C7DAE]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: dom.softBgHex }}
                    >
                      <DomainIcon domain={dom.name} className="w-4 h-4" color={dom.accentHex} />
                    </div>
                    {selected && <Check className="w-4 h-4 text-[#4C7DAE]" />}
                  </div>
                  <div className="text-sm font-semibold text-[#082441]">{dom.name}</div>
                  <div className="text-xs text-[#647B92] mt-1">{dom.examples.slice(0, 2).join(' · ')}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Methodology Selection */}
      {step === 2 && (
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#082441]">
                Step 2: Select Software Development Methodology
              </h2>
              <p className="text-xs text-[#647B92] mt-0.5">
                Step 3 will dynamically surface methodology-specific telemetry fields for your selection.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg cursor-pointer whitespace-nowrap"
            >
              Continue to Project Details →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {METHODOLOGY_PROFILES.map((mp) => {
              const selected = form.Software_Development_Methodology === mp.name;
              return (
                <button
                  key={mp.name}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      Software_Development_Methodology: mp.name,
                    }))
                  }
                  className={`text-left p-5 rounded-xl border transition-all cursor-pointer ${
                    selected
                      ? 'border-[#082441] bg-[#EFF4F9]/60 ring-1 ring-[#082441]'
                      : 'border-[#D2DFEC] hover:border-[#4C7DAE]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#4C7DAE] font-semibold">{mp.paradigm}</span>
                    {selected && <Check className="w-4 h-4 text-[#4C7DAE]" />}
                  </div>
                  <div className="text-base font-semibold text-[#082441] mb-1.5">{mp.name}</div>
                  <p className="text-xs text-[#465D75] leading-relaxed">{mp.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: Streamlined Project Details Form */}
      {step === 3 && (
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D2DFEC]">
            <div>
              <h2 className="text-base font-bold text-[#082441]">
                Step 3: Project Details &amp; {activeMethProfile.shortName} Parameters
              </h2>
              <p className="text-xs text-[#647B92] mt-0.5">
                Focused core planning, quality, and methodology metrics processed through the standardized ML pipeline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg cursor-pointer whitespace-nowrap"
            >
              Continue to Model Selection →
            </button>
          </div>

          {/* Core Identity & Planning (6 inputs) */}
          <div>
            <h3 className="text-xs font-semibold text-[#1B4268] mb-3">
              Project Identification &amp; Planning
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs text-[#465D75] mb-1">Project Name</label>
                <input
                  type="text"
                  value={form.Project_Name}
                  onChange={(e) => setForm({ ...form, Project_Name: e.target.value })}
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-[#465D75] mb-1">Complexity</label>
                <select
                  value={form.Project_Complexity}
                  onChange={(e) =>
                    setForm({ ...form, Project_Complexity: e.target.value as ComplexityLevel })
                  }
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#465D75] mb-1">Planned Duration (Days)</label>
                <input
                  type="number"
                  min={10}
                  max={730}
                  value={form.Planned_Duration_Days}
                  onChange={(e) => updateNum('Planned_Duration_Days', e.target.value)}
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-[#465D75] mb-1">Team Size (Devs)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.Team_Size}
                  onChange={(e) => updateNum('Team_Size', e.target.value)}
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#465D75] mb-1">Total Tasks</label>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={form.Number_of_Tasks}
                    onChange={(e) => updateNum('Number_of_Tasks', e.target.value)}
                    className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#465D75] mb-1">
                    Completed ({form.Tasks_Pending} left)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={form.Number_of_Tasks}
                    value={form.Tasks_Completed}
                    onChange={(e) => updateNum('Tasks_Completed', e.target.value)}
                    className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quality, Dependencies & Team Execution (Reduced to 5 essential inputs) */}
          <div className="pt-4 border-t border-[#D2DFEC]">
            <h3 className="text-xs font-semibold text-[#1B4268] mb-3">
              Quality, Dependencies &amp; Team Execution
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs text-[#465D75] mb-1">Bugs Reported</label>
                <input
                  type="number"
                  min={0}
                  value={form.Bugs_Reported}
                  onChange={(e) => updateNum('Bugs_Reported', e.target.value)}
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-[#465D75] mb-1">Critical Bugs</label>
                <input
                  type="number"
                  min={0}
                  max={form.Bugs_Reported}
                  value={form.Critical_Bugs}
                  onChange={(e) => updateNum('Critical_Bugs', e.target.value)}
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-[#465D75] mb-1">Testing Completion (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.Testing_Completion_Percentage}
                  onChange={(e) => updateNum('Testing_Completion_Percentage', e.target.value)}
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-[#465D75] mb-1">Dependency Delay (Days)</label>
                <input
                  type="number"
                  min={0}
                  value={form.Dependency_Delay}
                  onChange={(e) => updateNum('Dependency_Delay', e.target.value)}
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs text-[#465D75] mb-1">Team Productivity (%)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.Team_Productivity}
                  onChange={(e) => updateNum('Team_Productivity', e.target.value)}
                  className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                />
              </div>
            </div>
          </div>

          {/* Methodology-Specific Dynamic Inputs */}
          <div className="pt-4 border-t border-[#D2DFEC]">
            <h3 className="text-xs font-semibold text-[#4C7DAE] mb-3">
              {activeMethProfile.name} Specific Telemetry
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeMethProfile.specificInputs.map((spec) => (
                <div key={String(spec.key)}>
                  <label className="block text-xs text-[#082441] font-medium mb-1">
                    {spec.label} ({spec.unit})
                  </label>
                  <input
                    type="number"
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    value={Number(form[spec.key] ?? 0)}
                    onChange={(e) => updateNum(spec.key, e.target.value)}
                    className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 font-mono-tabular"
                  />
                  <span className="block text-[11px] text-[#647B92] mt-1">{spec.help}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Select Prediction Models */}
      {step === 4 && (
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#082441]">
                Step 4: Select Machine Learning Algorithms &amp; Parameters
              </h2>
              <p className="text-xs text-[#647B92] mt-0.5">
                Run an individual algorithm, compare a subset, or execute all 9 regression and classification models simultaneously.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, selectedModels: ALL_MODELS.map((m) => m.id) }))
                }
                className="px-3 py-1.5 text-xs font-medium border border-[#C2D2E3] rounded-lg cursor-pointer hover:border-[#082441]"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    selectedModels: ['multiple_linear', snapshot.bestClassifierId],
                  }))
                }
                className="px-3 py-1.5 text-xs font-medium border border-[#C2D2E3] rounded-lg cursor-pointer hover:border-[#082441]"
              >
                Top Models Only
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_MODELS.map((m) => {
              const active = form.selectedModels.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleModel(m.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    active
                      ? 'border-[#082441] bg-[#EFF4F9]/60 ring-1 ring-[#082441]'
                      : 'border-[#D2DFEC] hover:border-[#4C7DAE]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-[#647B92] mb-1">
                    <span>{m.task}</span>
                    {active && <Check className="w-3.5 h-3.5 text-[#4C7DAE]" />}
                  </div>
                  <div className="text-xs font-semibold text-[#082441]">{m.label}</div>
                </button>
              );
            })}
          </div>

          {/* Model Hyperparameters */}
          <div className="pt-4 border-t border-[#D2DFEC] grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#465D75] mb-1">
                Simple Linear Regression Feature
              </label>
              <select
                value={form.simpleRegressionFeature ?? 'Planned_Duration_Days'}
                onChange={(e) => setForm({ ...form, simpleRegressionFeature: e.target.value })}
                className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 bg-white"
              >
                <option value="Planned_Duration_Days">Planned Duration (Days)</option>
                <option value="Completion_Percentage">Completion Percentage (%)</option>
                <option value="Team_Productivity">Team Productivity (%)</option>
                <option value="Tasks_Pending">Tasks Pending</option>
                <option value="Testing_Completion_Percentage">Testing Completion (%)</option>
                <option value="Dependency_Delay">Dependency Delay (Days)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#465D75] mb-1">KNN Neighbor Count (K)</label>
              <select
                value={form.knnK ?? 5}
                onChange={(e) => setForm({ ...form, knnK: Number(e.target.value) })}
                className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 bg-white"
              >
                {[3, 5, 7, 9, 11].map((k) => (
                  <option key={k} value={k}>
                    K = {k} neighbors
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#465D75] mb-1">SVM Kernel</label>
              <select
                value={form.svmKernel ?? 'RBF'}
                onChange={(e) =>
                  setForm({ ...form, svmKernel: e.target.value as 'Linear' | 'RBF' })
                }
                className="w-full text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 bg-white"
              >
                <option value="RBF">RBF (Radial Basis Function)</option>
                <option value="Linear">Linear Margin</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={running}
              onClick={handlePredict}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg inline-flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {running ? 'Training & Predicting...' : 'Generate Project Analysis Report'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Prediction Report */}
      {step === 5 && (
        <div className="space-y-6">
          {!report ? (
            <div className="bg-white border border-[#D2DFEC] rounded-xl p-12 text-center">
              <p className="text-base font-semibold text-[#082441]">
                No prediction generated yet for this session
              </p>
              <p className="text-sm text-[#647B92] mt-1 mb-4">
                Configure your project details and click Run Prediction Analysis to generate duration forecasts and delay probabilities.
              </p>
              <button
                type="button"
                onClick={handlePredict}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#082441] rounded-lg cursor-pointer"
              >
                Run Prediction Now
              </button>
            </div>
          ) : (
            <>
              {/* Report Export Bar */}
              <div className="bg-white border border-[#D2DFEC] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-[#647B92]">
                    Analysis #{report.id} · {new Date(report.createdAt).toLocaleString()}
                  </div>
                  <h2 className="text-lg font-bold text-[#082441] font-display">
                    {report.input.Project_Name}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => exportPredictionCsv(report)}
                    className="px-3.5 py-2 text-xs font-medium text-[#082441] bg-white border border-[#C2D2E3] hover:border-[#082441] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPredictionPdf(report, snapshot)}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF Report
                  </button>
                </div>
              </div>

              {/* Primary KPI Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
                  <div className="text-xs text-[#647B92]">Predicted Status</div>
                  <div
                    className={`text-2xl font-bold mt-1 ${
                      report.primaryPrediction.predictedStatus === 'Delayed'
                        ? 'text-[#C85656]'
                        : 'text-[#4C7DAE]'
                    }`}
                  >
                    {report.primaryPrediction.predictedStatus}
                  </div>
                  <div className="text-xs text-[#465D75] mt-1">
                    {report.primaryPrediction.bestClassifierName}
                  </div>
                </div>

                <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
                  <div className="text-xs text-[#647B92]">Delay Probability</div>
                  <div className="text-2xl font-bold text-[#082441] font-mono-tabular mt-1">
                    {report.primaryPrediction.delayProbability}%
                  </div>
                  <div className="text-xs text-[#465D75] mt-1 font-mono-tabular">
                    On-time: {report.primaryPrediction.onTimeProbability}%
                  </div>
                </div>

                <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
                  <div className="text-xs text-[#647B92]">Estimated Completion</div>
                  <div className="text-2xl font-bold text-[#082441] font-mono-tabular mt-1">
                    {report.primaryPrediction.estimatedDurationDays} days
                  </div>
                  <div className="text-xs text-[#465D75] mt-1 font-mono-tabular">
                    vs {report.primaryPrediction.plannedDurationDays}d planned (
                    {report.primaryPrediction.expectedDelayDays >= 0 ? '+' : ''}
                    {report.primaryPrediction.expectedDelayDays}d)
                  </div>
                </div>

                <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
                  <div className="text-xs text-[#647B92]">Delay Risk Tier</div>
                  <div
                    className={`inline-block text-sm font-semibold px-2.5 py-0.5 rounded border mt-1.5 ${riskBadgeColor(
                      report.primaryPrediction.riskCategory
                    )}`}
                  >
                    {report.primaryPrediction.riskCategory} Risk
                  </div>
                  <div className="text-xs text-[#465D75] mt-1.5 truncate">
                    {report.input.Domain.split(' ')[0]} · {report.input.Software_Development_Methodology}
                  </div>
                </div>
              </div>

              {/* Gauge + Consensus Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 bg-white border border-[#D2DFEC] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-[#082441] mb-1">
                    Delay Probability Gauge
                  </h3>
                  <p className="text-xs text-[#647B92]">
                    Calibrated output from top-ranked classifier
                  </p>
                  <PlotlyChart
                    height={250}
                    data={[
                      {
                        type: 'indicator',
                        mode: 'gauge+number',
                        value: report.primaryPrediction.delayProbability,
                        number: { suffix: '%', font: { size: 28, color: '#082441' } },
                        gauge: {
                          axis: { range: [0, 100] },
                          bar: {
                            color:
                              report.primaryPrediction.delayProbability >= 55
                                ? '#C85656'
                                : report.primaryPrediction.delayProbability >= 30
                                  ? '#D48A45'
                                  : '#4C7DAE',
                          },
                          steps: [
                            { range: [0, 30], color: '#EAF1F8' },
                            { range: [30, 55], color: '#FDF5EC' },
                            { range: [55, 78], color: '#FFF3E8' },
                            { range: [78, 100], color: '#FDF2F2' },
                          ],
                        },
                      },
                    ]}
                    layout={{ margin: { t: 24, r: 24, b: 12, l: 24 } }}
                  />
                </div>

                <div className="lg:col-span-8 bg-white border border-[#D2DFEC] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-[#082441] mb-1">
                    Multi-Model Classification Consensus
                  </h3>
                  <p className="text-xs text-[#647B92] mb-2">
                    Delay probability (%) predicted by each selected classifier on your project
                  </p>
                  <PlotlyChart
                    height={250}
                    data={[
                      {
                        type: 'bar',
                        x: report.classificationPredictions.map((c) =>
                          c.modelName.replace(' Classifier', '')
                        ),
                        y: report.classificationPredictions.map((c) => c.delayProbability),
                        marker: {
                          color: report.classificationPredictions.map((c) =>
                            c.delayProbability >= 50 ? '#C85656' : '#4C7DAE'
                          ),
                        },
                      },
                    ]}
                    layout={{
                      margin: { t: 16, r: 16, b: 64, l: 48 },
                      yaxis: { title: 'Delay Probability (%)', range: [0, 105] },
                      xaxis: { tickangle: -20 },
                      shapes: [
                        {
                          type: 'line',
                          x0: -0.5,
                          x1: report.classificationPredictions.length - 0.5,
                          y0: 50,
                          y1: 50,
                          line: { color: '#8DA2B8', dash: 'dash', width: 1.5 },
                        },
                      ],
                    }}
                  />
                </div>
              </div>

              {/* Regression + Classification Detail Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-[#D2DFEC] rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#D2DFEC]">
                    <h3 className="text-sm font-semibold text-[#082441]">
                      Regression Duration Forecasts
                    </h3>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-[#E3EBF3] text-[#465D75] border-b border-[#D2DFEC]">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Model</th>
                        <th className="text-right px-4 py-2 font-medium">Est. Duration</th>
                        <th className="text-right px-4 py-2 font-medium">Exp. Delay</th>
                        <th className="text-right px-4 py-2 font-medium">Test R²</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3EBF3]">
                      {report.regressionPredictions.map((r) => (
                        <tr key={r.modelId}>
                          <td className="px-4 py-2.5 font-medium text-[#082441]">{r.modelName}</td>
                          <td className="px-4 py-2.5 text-right font-mono-tabular">
                            {r.predictedDurationDays}d
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono-tabular font-medium ${
                              r.expectedDelayDays > 0 ? 'text-[#C85656]' : 'text-[#4C7DAE]'
                            }`}
                          >
                            {r.expectedDelayDays > 0
                              ? `+${r.expectedDelayDays}d`
                              : `${r.expectedDelayDays}d`}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono-tabular">{r.r2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white border border-[#D2DFEC] rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#D2DFEC]">
                    <h3 className="text-sm font-semibold text-[#082441]">
                      CART Decision Tree Trace &amp; Top Risk Drivers
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="text-xs text-[#465D75] space-y-1">
                      <div className="font-semibold text-[#082441] mb-1">
                        Decision Tree Evaluation Path:
                      </div>
                      {report.decisionTreePath.map((stepStr, idx) => (
                        <div key={idx} className="font-mono-tabular text-[11px] text-[#1B4268]">
                          {idx + 1}. {stepStr}
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-[#D2DFEC]">
                      <div className="text-xs font-semibold text-[#082441] mb-1.5">
                        Primary Input Risk Contributions
                      </div>
                      <div className="space-y-1.5">
                        {report.topRiskFactors.slice(0, 4).map((rf) => (
                          <div
                            key={rf.factor}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-[#1B324B]">
                              {rf.factor} ({rf.observedValue})
                            </span>
                            <span
                              className={`font-medium ${
                                rf.direction === 'Increases Risk'
                                  ? 'text-[#C85656]'
                                  : 'text-[#4C7DAE]'
                              }`}
                            >
                              {rf.direction}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
