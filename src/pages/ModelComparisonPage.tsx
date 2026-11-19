import { Award, Download } from 'lucide-react';
import { PlotlyChart } from '../components/PlotlyChart.tsx';
import { exportModelMetricsCsv } from '../services/reportExport.ts';
import type { ModelLabSnapshot } from '../types/project.ts';

interface ModelComparisonPageProps {
  snapshot: ModelLabSnapshot;
}

const MODEL_SUITABILITY_STUDY = [
  {
    model: 'Simple Linear Regression',
    task: 'Regression',
    suitedInputs: 'Single dominant scale feature (e.g., Planned Duration Days)',
    mechanism: 'Fits a univariate OLS line y = β₀ + β₁x minimizing squared duration error.',
    whyVaried:
      'Ignores multi-factor defect & dependency delays, under-predicting duration when complex projects stall.',
  },
  {
    model: 'Multiple Linear Regression (Ridge)',
    task: 'Regression',
    suitedInputs: 'Full standardized numeric + one-hot Domain & Methodology feature matrix',
    mechanism: 'Simultaneously weights all predictors with L2 stabilization against collinearity.',
    whyVaried:
      'Captures additive delay contributions from critical bugs, dependency lag, and testing gaps, far outperforming Simple LR.',
  },
  {
    model: 'Logistic Regression',
    task: 'Classification',
    suitedInputs: 'Linearly separable standardized telemetry with monotonic delay log-odds',
    mechanism: 'Global linear hyperplane passed through a sigmoid probability link.',
    whyVaried:
      'Smoothly calibrates borderline risk, but cannot capture sharp non-linear thresholds or methodology-specific interactions.',
  },
  {
    model: 'Gaussian Naive Bayes',
    task: 'Classification',
    suitedInputs: 'Small/fast benchmarks with roughly normal independent predictors',
    mechanism: 'Applies Bayes rule assuming conditional independence across features per class.',
    whyVaried:
      'Correlated project inputs (e.g., Bugs Reported & Rework Hours) double-count evidence, pushing probabilities closer to 0 or 1.',
  },
  {
    model: 'Decision Tree Classifier (CART)',
    task: 'Classification',
    suitedInputs: 'Rule-driven projects with crisp operational cutoffs & categorical flags',
    mechanism: 'Recursive binary splits minimizing Gini impurity.',
    whyVaried:
      'Models non-linear interactions directly, but single-tree step boundaries shift sharply if training samples near thresholds change.',
  },
  {
    model: 'Support Vector Machine (Linear / RBF)',
    task: 'Classification',
    suitedInputs: 'Continuous scaled dimensions with curved separation margins',
    mechanism: 'Maximizes margin around support vectors using an RBF kernel + Platt scaling.',
    whyVaried:
      'Produces smooth curved boundaries in scaled space rather than axis-aligned cuts, causing different predictions on borderline cases.',
  },
  {
    model: 'K-Nearest Neighbors (KNN)',
    task: 'Classification',
    suitedInputs: 'Dense clusters of projects sharing comparable scale, team & defect profiles',
    mechanism: 'Distance-weighted vote among the K closest projects in Euclidean feature space.',
    whyVaried:
      'Sensitive to local neighborhood sparsity and high-dimensional distance dilution across 30+ features.',
  },
  {
    model: 'Random Forest Classifier',
    task: 'Classification',
    suitedInputs: 'Noisy heterogeneous tabular telemetry combining counts, rates & categories',
    mechanism: 'Bagged ensemble of 25 trees with random √p feature subsampling.',
    whyVaried:
      'Averaging decorrelated trees lowers variance and resists noisy outliers that destabilize single trees or KNN.',
  },
  {
    model: 'Gradient Boosting Classifier',
    task: 'Classification',
    suitedInputs: 'Complex non-linear interactions & subtle borderline delay risk patterns',
    mechanism: 'Sequential stage-wise trees trained to correct prior log-loss residuals.',
    whyVaried:
      'Iteratively sharpens focus on hard-to-classify projects, yielding strong F1 & ROC-AUC separation even on overlapping cohorts.',
  },
];

export function ModelComparisonPage({ snapshot }: ModelComparisonPageProps) {
  const rankedClassifiers = [...snapshot.classifiers].sort((a, b) => {
    const sa = 0.6 * a.f1 + 0.4 * a.rocAuc;
    const sb = 0.6 * b.f1 + 0.4 * b.rocAuc;
    return sb - sa;
  });

  const bestCls = rankedClassifiers[0];
  const bestReg =
    snapshot.regressions.find((r) => r.id === snapshot.bestRegressorId) ??
    snapshot.regressions[1];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082441] font-display">
            Unified Model Performance Comparison
          </h1>
          <p className="text-sm text-[#647B92] mt-0.5">
            Task-separated evaluation across Regression and Classification on identical stratified train/test splits (seed=42).
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportModelMetricsCsv(snapshot)}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Benchmark CSV
        </button>
      </div>

      {/* Evidence-Based Best Model Callout */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#EAF1F8] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-[#4C7DAE]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#4C7DAE]">
              Evidence-Based Model Selection (Criterion: 0.60 × F1 + 0.40 × ROC-AUC)
            </div>
            <h2 className="text-base font-bold text-[#082441] mt-0.5">
              Top Classifier: {bestCls.name} · Top Regressor: {bestReg.name}
            </h2>
            <p className="text-xs text-[#465D75] mt-1 leading-relaxed">
              {snapshot.bestSelectionReason}
            </p>
          </div>
        </div>
      </div>

      {/* 1. CLASSIFICATION LEADERBOARD */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D2DFEC] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#082441]">
              01. Classification Task Benchmark (Target: Is_Delayed · Test n={snapshot.testSize})
            </h3>
            <p className="text-xs text-[#647B92]">
              Ranked by composite F1-Score &amp; ROC-AUC across all 7 classifiers.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#E3EBF3] text-[#465D75] border-b border-[#D2DFEC]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Rank</th>
                <th className="text-left px-4 py-2.5 font-medium">Algorithm</th>
                <th className="text-left px-4 py-2.5 font-medium">Family</th>
                <th className="text-right px-4 py-2.5 font-medium">Accuracy</th>
                <th className="text-right px-4 py-2.5 font-medium">Precision</th>
                <th className="text-right px-4 py-2.5 font-medium">Recall</th>
                <th className="text-right px-4 py-2.5 font-medium">F1-Score</th>
                <th className="text-right px-4 py-2.5 font-medium">ROC-AUC</th>
                <th className="text-right px-4 py-2.5 font-medium">3-Fold CV</th>
                <th className="text-right px-4 py-2.5 font-medium">Train (ms)</th>
                <th className="text-right px-4 py-2.5 font-medium">Predict (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3EBF3]">
              {rankedClassifiers.map((c, idx) => (
                <tr
                  key={c.id}
                  className={idx === 0 ? 'bg-[#EAF1F8]/60' : 'hover:bg-[#EFF4F9]/70'}
                >
                  <td className="px-4 py-2.5 font-mono-tabular font-semibold text-[#1B4268]">
                    #{idx + 1}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-[#082441]">{c.name}</td>
                  <td className="px-4 py-2.5 text-[#465D75]">{c.family}</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">
                    {(c.accuracy * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">
                    {(c.precision * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">
                    {(c.recall * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-[#4C7DAE]">
                    {(c.f1 * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-[#082441]">
                    {c.rocAuc.toFixed(4)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">
                    {(c.cvAccuracyMean * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular text-[#465D75]">
                    {c.trainTimeMs.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular text-[#465D75]">
                    {c.predictTimeMs.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Metric Visual Comparison + Latency Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#082441] mb-1">
            Classification Metric Comparison (Accuracy, F1-Score, ROC-AUC)
          </h3>
          <p className="text-xs text-[#647B92] mb-2">
            Visual comparison across all 7 supervised classification models
          </p>
          <PlotlyChart
            height={320}
            data={[
              {
                type: 'bar',
                name: 'Accuracy',
                x: rankedClassifiers.map((c) => c.name.replace(' Classifier', '')),
                y: rankedClassifiers.map((c) => Number((c.accuracy * 100).toFixed(1))),
                marker: { color: '#6495C6' },
              },
              {
                type: 'bar',
                name: 'F1-Score',
                x: rankedClassifiers.map((c) => c.name.replace(' Classifier', '')),
                y: rankedClassifiers.map((c) => Number((c.f1 * 100).toFixed(1))),
                marker: { color: '#4C7DAE' },
              },
              {
                type: 'bar',
                name: 'ROC-AUC',
                x: rankedClassifiers.map((c) => c.name.replace(' Classifier', '')),
                y: rankedClassifiers.map((c) => Number((c.rocAuc * 100).toFixed(1))),
                marker: { color: '#082441' },
              },
            ]}
            layout={{
              barmode: 'group',
              margin: { t: 20, r: 16, b: 82, l: 48 },
              xaxis: { tickangle: -28 },
              yaxis: { title: 'Score (%)', range: [0, 105] },
              legend: { orientation: 'h', y: 1.13 },
            }}
          />
        </div>

        <div className="bg-white border border-[#D2DFEC] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#082441] mb-1">
            Training &amp; Inference Compute Latency (ms)
          </h3>
          <p className="text-xs text-[#647B92] mb-2">
            Algorithm runtime trade-offs measured during actual execution
          </p>
          <PlotlyChart
            height={320}
            data={[
              {
                type: 'bar',
                name: 'Train Time (ms)',
                x: rankedClassifiers.map((c) => c.name.replace(' Classifier', '')),
                y: rankedClassifiers.map((c) => c.trainTimeMs),
                marker: { color: '#082441' },
              },
              {
                type: 'bar',
                name: 'Test Predict Time (ms)',
                x: rankedClassifiers.map((c) => c.name.replace(' Classifier', '')),
                y: rankedClassifiers.map((c) => c.predictTimeMs),
                marker: { color: '#D48A45' },
              },
            ]}
            layout={{
              barmode: 'group',
              margin: { t: 20, r: 16, b: 82, l: 52 },
              xaxis: { tickangle: -28 },
              yaxis: { title: 'Milliseconds (ms)' },
              legend: { orientation: 'h', y: 1.13 },
            }}
          />
        </div>
      </div>

      {/* All 7 Confusion Matrices Grid */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#082441]">
            Confusion Matrix Grid Across All 7 Classifiers
          </h3>
          <p className="text-xs text-[#647B92]">
            [TN | FP] on top row (actual On Time), [FN | TP] on bottom row (actual Delayed)
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rankedClassifiers.map((c) => (
            <div key={c.id} className="border border-[#D2DFEC] rounded-lg p-3.5 bg-[#EFF4F9]">
              <div className="text-xs font-semibold text-[#082441] truncate mb-2">{c.name}</div>
              <div className="grid grid-cols-2 gap-1.5 text-center font-mono-tabular text-xs">
                <div className="bg-white border border-[#D2DFEC] rounded py-2">
                  <div className="text-[10px] text-[#647B92]">TN</div>
                  <div className="font-bold text-[#4C7DAE]">{c.confusionMatrix.tn}</div>
                </div>
                <div className="bg-white border border-[#D2DFEC] rounded py-2">
                  <div className="text-[10px] text-[#647B92]">FP</div>
                  <div className="font-bold text-[#D48A45]">{c.confusionMatrix.fp}</div>
                </div>
                <div className="bg-white border border-[#D2DFEC] rounded py-2">
                  <div className="text-[10px] text-[#647B92]">FN</div>
                  <div className="font-bold text-[#C85656]">{c.confusionMatrix.fn}</div>
                </div>
                <div className="bg-white border border-[#D2DFEC] rounded py-2">
                  <div className="text-[10px] text-[#647B92]">TP</div>
                  <div className="font-bold text-[#082441]">{c.confusionMatrix.tp}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. REGRESSION SUMMARY TABLE */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D2DFEC]">
          <h3 className="text-sm font-semibold text-[#082441]">
            02. Regression Task Benchmark (Target: Actual_Duration_Days)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#E3EBF3] text-[#465D75] border-b border-[#D2DFEC]">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Model</th>
                <th className="text-left px-4 py-2.5 font-medium">Input Scope</th>
                <th className="text-right px-4 py-2.5 font-medium">R²</th>
                <th className="text-right px-4 py-2.5 font-medium">MAE</th>
                <th className="text-right px-4 py-2.5 font-medium">MSE</th>
                <th className="text-right px-4 py-2.5 font-medium">RMSE</th>
                <th className="text-right px-4 py-2.5 font-medium">Train (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3EBF3]">
              {snapshot.regressions.map((r) => (
                <tr key={r.id} className={r.id === snapshot.bestRegressorId ? 'bg-[#EAF1F8]/60' : ''}>
                  <td className="px-4 py-2.5 font-semibold text-[#082441]">{r.name}</td>
                  <td className="px-4 py-2.5 text-[#465D75]">
                    {r.id === 'simple_linear'
                      ? `Single feature (${r.featureUsed})`
                      : `${r.features.length} standardized numeric + categorical features`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-[#4C7DAE]">
                    {r.r2}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">{r.mae} d</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">{r.mse}</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">{r.rmse} d</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular">{r.trainTimeMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. MODEL SUITABILITY MATRIX & PRIMARY SELECTION RATIONALE */}
      <div className="bg-white border border-[#D2DFEC] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#D2DFEC]">
          <h3 className="text-sm font-semibold text-[#082441]">
            03. Algorithm Suitability for Specific Inputs &amp; Primary Model Selection Rationale
          </h3>
          <p className="text-xs text-[#647B92] mt-0.5">
            Why every algorithm fits distinct project input characteristics, why predictions vary across models, and why one model is selected as primary.
          </p>
        </div>

        <div className="p-5 space-y-5">
          <div className="p-4 rounded-xl bg-[#EFF4F9] border border-[#D2DFEC] space-y-2 text-xs text-[#465D75] leading-relaxed">
            <div className="font-semibold text-[#082441] text-sm">
              Why We Adopt {bestCls.name} Despite Varied Results Across All 7 Classifiers
            </div>
            <p>
              Running identical project inputs through 7 classifiers naturally produces varied delay
              probabilities and metrics: linear models enforce additive hyperplanes, Naive Bayes treats
              correlated defect/rework variables as independent, KNN relies on local Euclidean density,
              and tree ensembles model sharp non-linear thresholds (such as high Dependency Delay paired
              with low Testing Completion).
            </p>
            <p>
              Rather than relying on raw Accuracy alone—which can mask missed delays (False Negatives) or
              excessive false alarms (False Positives)—ProjectPulse AI evaluates every classifier dynamically
              on the held-out stratified test split using{' '}
              <span className="font-mono-tabular font-semibold text-[#082441]">
                Composite Score = 0.60 × F1-Score + 0.40 × ROC-AUC
              </span>
              . F1 enforces a strict harmonic balance between Precision and Recall, while ROC-AUC verifies
              probability ranking across all risk thresholds. On the active dataset,{' '}
              <strong className="text-[#082441]">{bestCls.name}</strong> leads with F1={(bestCls.f1 * 100).toFixed(1)}%
              and ROC-AUC={bestCls.rocAuc.toFixed(4)}, making it the most reliable primary decision model
              while the remaining 6 algorithms provide transparent multi-perspective diagnostics.
            </p>
          </div>

          <div className="overflow-x-auto border border-[#D2DFEC] rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-[#E3EBF3] text-[#465D75] border-b border-[#D2DFEC]">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Algorithm</th>
                  <th className="text-left px-4 py-2.5 font-medium">Task</th>
                  <th className="text-left px-4 py-2.5 font-medium">Best-Suited Project Inputs</th>
                  <th className="text-left px-4 py-2.5 font-medium">Decision Mechanism</th>
                  <th className="text-left px-4 py-2.5 font-medium">Why Results Vary From Other Models</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3EBF3]">
                {MODEL_SUITABILITY_STUDY.map((row) => (
                  <tr key={row.model} className="hover:bg-[#EFF4F9]/70 align-top">
                    <td className="px-4 py-3 font-semibold text-[#082441] whitespace-nowrap">
                      {row.model}
                    </td>
                    <td className="px-4 py-3 text-[#4C7DAE] font-semibold whitespace-nowrap">
                      {row.task}
                    </td>
                    <td className="px-4 py-3 text-[#1B324B]">{row.suitedInputs}</td>
                    <td className="px-4 py-3 text-[#465D75]">{row.mechanism}</td>
                    <td className="px-4 py-3 text-[#465D75]">{row.whyVaried}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
