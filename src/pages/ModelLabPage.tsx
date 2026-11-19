import { useState } from 'react';
import { DecisionTreeViewer } from '../components/DecisionTreeViewer.tsx';
import { PlotlyChart } from '../components/PlotlyChart.tsx';
import { TooltipTerm } from '../components/TooltipTerm.tsx';
import type { ClassificationModelMetrics, ModelLabSnapshot } from '../types/project.ts';

interface ModelLabPageProps {
  snapshot: ModelLabSnapshot;
  onChangeSimpleFeature: (feature: string) => Promise<void>;
}

const SIMPLE_FEATURES = [
  'Planned_Duration_Days',
  'Completion_Percentage',
  'Team_Productivity',
  'Tasks_Pending',
  'Testing_Completion_Percentage',
  'Dependency_Delay',
];

const CLASSIFIER_SUITABILITY_NOTES: Record<
  ClassificationModelMetrics['id'],
  {
    suitedInputs: string;
    whyResultsDiffer: string;
    selectionRole: string;
  }
> = {
  logistic_regression: {
    suitedInputs:
      'Continuous standardized predictors with monotonic linear relationships to log-odds of delay (e.g., Planned Duration, Dependency Delay, Testing Completion %, Completion %).',
    whyResultsDiffer:
      'Fits a single global linear separating hyperplane using L2-regularized gradient descent. It produces well-calibrated probabilities but cannot natively separate non-linear threshold cliffs or domain-methodology interactions without explicit interaction terms.',
    selectionRole:
      'Serves as the transparent parametric linear baseline. Preferred when interpretability of per-feature odds weights matters, though outperformed when multi-feature interactions drive delays.',
  },
  naive_bayes: {
    suitedInputs:
      'High-dimensional tabular inputs with roughly Gaussian per-class distributions and minimal feature collinearity, or small datasets requiring ultra-fast probabilistic baselines.',
    whyResultsDiffer:
      'Assumes conditional independence across all input variables given the class label. Because project features naturally correlate (e.g., Bugs Reported correlates with Rework Hours and Critical Bugs), double-counting correlated evidence pushes predicted probabilities toward 0 or 1 extremes.',
    selectionRole:
      'Provides near-zero training latency and solid recall, yet slightly lower calibration precision when correlated software telemetry violates independence.',
  },
  decision_tree: {
    suitedInputs:
      'Mixed numeric and one-hot categorical inputs governed by crisp operational thresholds (e.g., Dependency Delay > 10d AND Testing Completion < 60%).',
    whyResultsDiffer:
      'Partitions feature space with axis-aligned Gini splits. Captures non-linear rules and methodology interactions effortlessly, but a single tree exhibits higher variance on borderline projects near split cutoffs.',
    selectionRole:
      'Ideal for white-box auditability (every prediction traces a concrete IF-THEN path), while ensemble extensions reduce its single-split variance.',
  },
  svm: {
    suitedInputs:
      'Standardized continuous feature spaces (especially 30+ encoded dimensions) where maximizing the decision margin between On-Time and Delayed cohorts improves generalization.',
    whyResultsDiffer:
      'With an RBF kernel, SVM projects inputs into a smooth non-linear similarity space around key support vectors, then maps margins to probabilities via Platt calibration. This yields smooth curved boundaries that differ noticeably from rectangular tree splits.',
    selectionRole:
      'Strong geometric separator on medium-sized datasets; depends on careful Platt calibration and kernel choice (Linear vs. RBF).',
  },
  knn: {
    suitedInputs:
      'Dense, well-scaled feature vectors where projects sharing similar size, bug load, and schedule ratios behave similarly in local neighborhoods.',
    whyResultsDiffer:
      'Makes zero global assumptions about equations or trees — predictions come strictly from distance-weighted votes of the K closest training projects in standardized Euclidean space. Sensitive to irrelevant dimensions and local sparsity.',
    selectionRole:
      'Useful non-parametric instance check; however, high dimensionality dilutes Euclidean distances compared to tree-based feature selection.',
  },
  random_forest: {
    suitedInputs:
      'Heterogeneous tabular project data combining continuous metrics, counts, percentages, and one-hot Domain/Methodology flags with complex non-linear interactions.',
    whyResultsDiffer:
      'Averages 25 bootstrap trees trained on random √p feature subsets. Averaging decorrelated trees smooths out single-tree step boundaries, stabilizing predictions when noisy inputs fluctuate.',
    selectionRole:
      'Consistently resists overfitting and handles mixed-scale features + correlated defect metrics robustly without manual interaction engineering.',
  },
  gradient_boosting: {
    suitedInputs:
      'Structured tabular datasets with subtle residual error patterns, asymmetric interactions (e.g., Waterfall + high Requirement Changes), and continuous target boundaries.',
    whyResultsDiffer:
      'Trains shallow trees sequentially, where each new tree corrects the log-loss residuals left by prior stages. This sharpens focus on hard borderline projects that single-pass or bagged models misclassify.',
    selectionRole:
      'Often achieves top F1 and ROC-AUC on tabular software telemetry; slightly higher sensitivity to hyperparameters than bagging.',
  },
};

export function ModelLabPage({ snapshot, onChangeSimpleFeature }: ModelLabPageProps) {
  const [section, setSection] = useState<'regression' | 'classification'>('regression');
  const [selectedClsId, setSelectedClsId] = useState<ClassificationModelMetrics['id']>(
    snapshot.bestClassifierId
  );
  const [updatingSimple, setUpdatingSimple] = useState(false);

  const simpleReg = snapshot.regressions.find((r) => r.id === 'simple_linear') ?? snapshot.regressions[0];
  const multiReg = snapshot.regressions.find((r) => r.id === 'multiple_linear') ?? snapshot.regressions[1];

  const activeCls =
    snapshot.classifiers.find((c) => c.id === selectedClsId) ?? snapshot.classifiers[0];
  const logisticCls = snapshot.classifiers.find((c) => c.id === 'logistic_regression');
  const suitability = CLASSIFIER_SUITABILITY_NOTES[activeCls.id];

  const handleSimpleFeatureChange = async (feat: string) => {
    setUpdatingSimple(true);
    try {
      await onChangeSimpleFeature(feat);
    } finally {
      setUpdatingSimple(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#082441] font-display">
            ML Model Laboratory
          </h1>
          <p className="text-sm text-[#647B92] mt-0.5">
            Inspect trained regression equations, decision tree rules, SVM kernels, KNN tuning curves, and model-input suitability.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white border border-[#D2DFEC] rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSection('regression')}
            className={`px-4 py-2 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
              section === 'regression' ? 'bg-[#082441] text-white' : 'text-[#465D75]'
            }`}
          >
            Regression Lab (Duration)
          </button>
          <button
            type="button"
            onClick={() => setSection('classification')}
            className={`px-4 py-2 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
              section === 'classification' ? 'bg-[#082441] text-white' : 'text-[#465D75]'
            }`}
          >
            Classification Lab (7 Models)
          </button>
        </div>
      </div>

      {section === 'regression' && (
        <div className="space-y-6">
          {/* Simple Linear Regression Interactive Card */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#D2DFEC]">
              <div>
                <h2 className="text-base font-bold text-[#082441]">
                  01. Simple Linear Regression (Single-Feature OLS)
                </h2>
                <p className="text-xs text-[#647B92] mt-0.5">
                  Select an individual predictor variable to refit the OLS duration model live on the training split.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#465D75]">Predictor Feature:</label>
                <select
                  disabled={updatingSimple}
                  value={simpleReg.featureUsed}
                  onChange={(e) => handleSimpleFeatureChange(e.target.value)}
                  className="text-xs border border-[#C2D2E3] rounded-lg px-3 py-2 bg-white"
                >
                  {SIMPLE_FEATURES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[#647B92]">
                  <TooltipTerm term="R²" />
                </div>
                <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
                  {simpleReg.r2}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#647B92]">
                  <TooltipTerm term="MAE" />
                </div>
                <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
                  {simpleReg.mae} d
                </div>
              </div>
              <div>
                <div className="text-xs text-[#647B92]">MSE</div>
                <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
                  {simpleReg.mse}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#647B92]">
                  <TooltipTerm term="RMSE" />
                </div>
                <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
                  {simpleReg.rmse} d
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#EFF4F9] border border-[#D2DFEC] rounded-lg text-xs font-mono-tabular text-[#1B4268]">
              Fitted Equation: {simpleReg.equationText}
            </div>

            <PlotlyChart
              height={310}
              data={[
                {
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Test Projects',
                  x: simpleReg.actualVsPredicted.map((p) => p.actual),
                  y: simpleReg.actualVsPredicted.map((p) => p.predicted),
                  text: simpleReg.actualVsPredicted.map((p) => p.projectName),
                  marker: { color: '#6495C6', size: 7, opacity: 0.85 },
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Ideal Fit (y = x)',
                  x: [40, 350],
                  y: [40, 350],
                  line: { color: '#082441', dash: 'dash', width: 1.5 },
                },
              ]}
              layout={{
                margin: { t: 16, r: 16, b: 48, l: 56 },
                xaxis: { title: 'Actual Duration (Days)' },
                yaxis: { title: 'Predicted Duration (Days)' },
                legend: { orientation: 'h', y: 1.12 },
              }}
            />
          </div>

          {/* Multiple Linear Regression Card */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-5">
            <div className="pb-4 border-b border-[#D2DFEC]">
              <h2 className="text-base font-bold text-[#082441]">
                02. Multiple Linear Regression ({multiReg.features.length} Encoded Features)
              </h2>
              <p className="text-xs text-[#647B92] mt-0.5">
                Ridge-stabilized OLS fitted on standardized numeric, domain, and methodology features.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[#647B92]">R² Score</div>
                <div className="text-xl font-bold text-[#4C7DAE] font-mono-tabular mt-1">
                  {multiReg.r2}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#647B92]">MAE</div>
                <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
                  {multiReg.mae} d
                </div>
              </div>
              <div>
                <div className="text-xs text-[#647B92]">MSE</div>
                <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
                  {multiReg.mse}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#647B92]">RMSE</div>
                <div className="text-xl font-bold text-[#082441] font-mono-tabular mt-1">
                  {multiReg.rmse} d
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <h3 className="text-xs font-semibold text-[#082441] mb-1">
                  Actual vs. Predicted Project Duration (Test Set)
                </h3>
                <PlotlyChart
                  height={300}
                  data={[
                    {
                      type: 'scatter',
                      mode: 'markers',
                      name: 'Multiple LR Predictions',
                      x: multiReg.actualVsPredicted.map((p) => p.actual),
                      y: multiReg.actualVsPredicted.map((p) => p.predicted),
                      text: multiReg.actualVsPredicted.map((p) => p.projectName),
                      marker: { color: '#4C7DAE', size: 7, opacity: 0.85 },
                    },
                    {
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Perfect Prediction (y = x)',
                      x: [40, 360],
                      y: [40, 360],
                      line: { color: '#082441', dash: 'dash', width: 1.5 },
                    },
                  ]}
                  layout={{
                    margin: { t: 16, r: 16, b: 48, l: 56 },
                    xaxis: { title: 'Actual Duration (Days)' },
                    yaxis: { title: 'Predicted Duration (Days)' },
                    legend: { orientation: 'h', y: 1.12 },
                  }}
                />
              </div>

              <div className="lg:col-span-5">
                <h3 className="text-xs font-semibold text-[#082441] mb-2">
                  Top Standardized Regression Coefficients (β)
                </h3>
                <div className="border border-[#D2DFEC] rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[#E3EBF3] text-[#465D75] border-b border-[#D2DFEC]">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Feature</th>
                        <th className="text-right px-3 py-2 font-medium">Std β</th>
                        <th className="text-right px-3 py-2 font-medium">Raw Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3EBF3]">
                      {multiReg.coefficients.slice(0, 8).map((c) => (
                        <tr key={c.feature}>
                          <td className="px-3 py-2 font-medium text-[#082441] truncate max-w-[160px]">
                            {c.feature}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono-tabular ${
                              c.standardizedWeight >= 0 ? 'text-[#C85656]' : 'text-[#4C7DAE]'
                            }`}
                          >
                            {c.standardizedWeight >= 0 ? '+' : ''}
                            {c.standardizedWeight}
                          </td>
                          <td className="px-3 py-2 text-right font-mono-tabular text-[#465D75]">
                            {c.weight}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Regression Model Suitability & Selection Explanation */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-[#082441]">
              Regression Suitability for Project Inputs &amp; Why Multiple LR Is Selected
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-[#465D75] leading-relaxed">
              <div className="p-4 rounded-lg bg-[#EFF4F9] border border-[#D2DFEC] space-y-1.5">
                <div className="font-semibold text-[#082441]">
                  Simple Linear Regression (R² = {simpleReg.r2} · RMSE = {simpleReg.rmse}d)
                </div>
                <p>
                  <strong className="text-[#1B324B]">Suitable inputs:</strong> Single dominant linear
                  scale drivers such as <span className="font-mono-tabular">Planned_Duration_Days</span>{' '}
                  where baseline schedule length accounts for broad completion scale.
                </p>
                <p>
                  <strong className="text-[#1B324B]">Why results differ:</strong> Ignores defect backlogs,
                  testing completion, and dependency lags, yielding wider error bands (higher MAE/RMSE)
                  whenever troubled projects slip beyond their planned schedule.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#EAF1F8] border border-[#4C7DAE]/40 space-y-1.5">
                <div className="font-semibold text-[#082441]">
                  Multiple Linear Regression — Primary Regressor (R² = {multiReg.r2} · RMSE = {multiReg.rmse}d)
                </div>
                <p>
                  <strong className="text-[#1B324B]">Suitable inputs:</strong> Combined quantitative
                  planning, quality, dependency, and one-hot Domain/Methodology vectors.
                </p>
                <p>
                  <strong className="text-[#1B324B]">Why chosen despite Simple LR:</strong> By jointly
                  fitting all {multiReg.features.length} features with Ridge regularization, Multiple LR
                  captures additive schedule slippage from critical bugs and dependency delays simultaneously,
                  delivering lower RMSE and higher explained variance (R²).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'classification' && (
        <div className="space-y-6">
          {/* 7-Classifier Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {snapshot.classifiers.map((cls) => {
              const active = cls.id === activeCls.id;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelectedClsId(cls.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    active
                      ? 'bg-white border-[#082441] ring-1 ring-[#082441]'
                      : 'bg-white border-[#D2DFEC] hover:border-[#4C7DAE]'
                  }`}
                >
                  <div className="text-[11px] text-[#647B92]">
                    {cls.family} · F1 {(cls.f1 * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs font-semibold text-[#082441] mt-0.5 truncate">
                    {cls.name}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Classifier Inspection */}
          <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#D2DFEC]">
              <div>
                <div className="text-xs text-[#4C7DAE] font-semibold">
                  {activeCls.family} Classification Model
                  {activeCls.id === snapshot.bestClassifierId ? ' · Top Test Benchmark' : ''}
                </div>
                <h2 className="text-xl font-bold text-[#082441] font-display mt-0.5">
                  {activeCls.name}
                </h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-[11px] text-[#647B92]">Accuracy</div>
                  <div className="text-base font-bold font-mono-tabular text-[#082441]">
                    {(activeCls.accuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#647B92]">Precision</div>
                  <div className="text-base font-bold font-mono-tabular text-[#082441]">
                    {(activeCls.precision * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#647B92]">Recall</div>
                  <div className="text-base font-bold font-mono-tabular text-[#082441]">
                    {(activeCls.recall * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#647B92]">
                    <TooltipTerm term="F1-Score" />
                  </div>
                  <div className="text-base font-bold font-mono-tabular text-[#4C7DAE]">
                    {(activeCls.f1 * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#647B92]">
                    <TooltipTerm term="ROC-AUC" />
                  </div>
                  <div className="text-base font-bold font-mono-tabular text-[#1B4268]">
                    {activeCls.rocAuc.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#647B92]">3-Fold CV</div>
                  <div className="text-base font-bold font-mono-tabular text-[#465D75]">
                    {(activeCls.cvAccuracyMean * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Model Suitability & Input Alignment Box */}
            <div className="p-4 rounded-xl bg-[#EFF4F9] border border-[#D2DFEC] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#465D75] leading-relaxed">
              <div>
                <div className="font-semibold text-[#082441] mb-1">
                  Suitable Input Characteristics
                </div>
                <p>{suitability.suitedInputs}</p>
              </div>
              <div>
                <div className="font-semibold text-[#082441] mb-1">
                  Why Predictions Differ From Other Models
                </div>
                <p>{suitability.whyResultsDiffer}</p>
              </div>
              <div>
                <div className="font-semibold text-[#082441] mb-1">
                  Role in Final Model Selection
                </div>
                <p>{suitability.selectionRole}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Confusion Matrix */}
              <div className="lg:col-span-5">
                <h3 className="text-xs font-semibold text-[#082441] mb-2">
                  Test Split Confusion Matrix (n={snapshot.testSize})
                </h3>
                <div className="grid grid-cols-2 gap-2.5 max-w-sm">
                  <div className="p-4 rounded-lg bg-[#EAF1F8] border border-[#4C7DAE]/40 text-center">
                    <div className="text-[11px] text-[#2A5786]">True Negative (On Time)</div>
                    <div className="text-2xl font-bold font-mono-tabular text-[#082441] mt-1">
                      {activeCls.confusionMatrix.tn}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-[#FDF5EC] border border-[#D48A45]/45 text-center">
                    <div className="text-[11px] text-[#8C5A1E]">False Positive (False Alarm)</div>
                    <div className="text-2xl font-bold font-mono-tabular text-[#082441] mt-1">
                      {activeCls.confusionMatrix.fp}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-[#FDF2F2] border border-[#C85656]/40 text-center">
                    <div className="text-[11px] text-[#A33939]">False Negative (Missed Delay)</div>
                    <div className="text-2xl font-bold font-mono-tabular text-[#082441] mt-1">
                      {activeCls.confusionMatrix.fn}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-[#E3EBF3] border border-[#1B4268]/35 text-center">
                    <div className="text-[11px] text-[#082441]">True Positive (Delayed)</div>
                    <div className="text-2xl font-bold font-mono-tabular text-[#082441] mt-1">
                      {activeCls.confusionMatrix.tp}
                    </div>
                  </div>
                </div>
              </div>

              {/* Algorithm-Specific Artifact */}
              <div className="lg:col-span-7">
                {activeCls.id === 'naive_bayes' && logisticCls && (
                  <div>
                    <h3 className="text-xs font-semibold text-[#082441] mb-2">
                      Direct Comparison: Gaussian Naive Bayes vs. Logistic Regression
                    </h3>
                    <PlotlyChart
                      height={240}
                      data={[
                        {
                          type: 'bar',
                          name: 'Gaussian Naive Bayes',
                          x: ['Accuracy', 'Precision', 'Recall', 'F1-Score', 'ROC-AUC'],
                          y: [
                            activeCls.accuracy,
                            activeCls.precision,
                            activeCls.recall,
                            activeCls.f1,
                            activeCls.rocAuc,
                          ].map((v) => Number((v * 100).toFixed(1))),
                          marker: { color: '#6495C6' },
                        },
                        {
                          type: 'bar',
                          name: 'Logistic Regression',
                          x: ['Accuracy', 'Precision', 'Recall', 'F1-Score', 'ROC-AUC'],
                          y: [
                            logisticCls.accuracy,
                            logisticCls.precision,
                            logisticCls.recall,
                            logisticCls.f1,
                            logisticCls.rocAuc,
                          ].map((v) => Number((v * 100).toFixed(1))),
                          marker: { color: '#082441' },
                        },
                      ]}
                      layout={{
                        barmode: 'group',
                        margin: { t: 16, r: 16, b: 36, l: 44 },
                        yaxis: { title: 'Score (%)', range: [0, 105] },
                        legend: { orientation: 'h', y: 1.16 },
                      }}
                    />
                  </div>
                )}

                {activeCls.id === 'svm' && activeCls.extra?.svmKernels && (
                  <div>
                    <h3 className="text-xs font-semibold text-[#082441] mb-2">
                      SVM Kernel Performance Comparison (Linear vs. RBF)
                    </h3>
                    <div className="border border-[#D2DFEC] rounded-lg overflow-hidden mb-3">
                      <table className="w-full text-xs">
                        <thead className="bg-[#E3EBF3] text-[#465D75] border-b border-[#D2DFEC]">
                          <tr>
                            <th className="text-left px-3 py-2">Kernel</th>
                            <th className="text-right px-3 py-2">Accuracy</th>
                            <th className="text-right px-3 py-2">Precision</th>
                            <th className="text-right px-3 py-2">Recall</th>
                            <th className="text-right px-3 py-2">F1</th>
                            <th className="text-right px-3 py-2">ROC-AUC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E3EBF3]">
                          {activeCls.extra.svmKernels.map((kRow) => (
                            <tr key={kRow.kernel}>
                              <td className="px-3 py-2 font-semibold text-[#082441]">
                                {kRow.kernel} Kernel
                              </td>
                              <td className="px-3 py-2 text-right font-mono-tabular">
                                {(kRow.accuracy * 100).toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-right font-mono-tabular">
                                {(kRow.precision * 100).toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-right font-mono-tabular">
                                {(kRow.recall * 100).toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-right font-mono-tabular font-semibold text-[#4C7DAE]">
                                {(kRow.f1 * 100).toFixed(1)}%
                              </td>
                              <td className="px-3 py-2 text-right font-mono-tabular">
                                {kRow.rocAuc.toFixed(3)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeCls.id === 'knn' && activeCls.extra?.knnKSweep && (
                  <div>
                    <h3 className="text-xs font-semibold text-[#082441] mb-2">
                      KNN Neighborhood Size (K) Selection Curve
                    </h3>
                    <PlotlyChart
                      height={220}
                      data={[
                        {
                          type: 'scatter',
                          mode: 'lines+markers',
                          name: 'F1-Score (%)',
                          x: activeCls.extra.knnKSweep.map((p) => p.k),
                          y: activeCls.extra.knnKSweep.map((p) => Number((p.f1 * 100).toFixed(1))),
                          line: { color: '#4C7DAE', width: 2 },
                        },
                        {
                          type: 'scatter',
                          mode: 'lines+markers',
                          name: 'Accuracy (%)',
                          x: activeCls.extra.knnKSweep.map((p) => p.k),
                          y: activeCls.extra.knnKSweep.map((p) =>
                            Number((p.accuracy * 100).toFixed(1))
                          ),
                          line: { color: '#082441', width: 2 },
                        },
                      ]}
                      layout={{
                        margin: { t: 16, r: 16, b: 40, l: 48 },
                        xaxis: { title: 'Number of Neighbors (K)', dtick: 2 },
                        yaxis: { title: 'Score (%)' },
                        legend: { orientation: 'h', y: 1.15 },
                      }}
                    />
                  </div>
                )}

                {activeCls.featureImportance && activeCls.featureImportance.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-[#082441] mb-2">
                      Model Feature Importance (Top Drivers)
                    </h3>
                    <PlotlyChart
                      height={230}
                      data={[
                        {
                          type: 'bar',
                          orientation: 'h',
                          y: [...activeCls.featureImportance].reverse().map((f) => f.feature),
                          x: [...activeCls.featureImportance]
                            .reverse()
                            .map((f) => Number((f.importance * 100).toFixed(1))),
                          marker: { color: '#082441' },
                        },
                      ]}
                      layout={{
                        margin: { t: 10, r: 16, b: 36, l: 170 },
                        xaxis: { title: 'Relative Importance (%)' },
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Decision Tree Visual Diagram & Extracted Rules */}
            {activeCls.id === 'decision_tree' && (
              <div className="pt-4 border-t border-[#D2DFEC] space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#082441] mb-1">
                    Trained CART Decision Tree Structure
                  </h3>
                  <p className="text-xs text-[#647B92] mb-3">
                    Nodes display actual Gini split thresholds, class counts [On Time / Delayed], and leaf probabilities.
                  </p>
                  <DecisionTreeViewer root={activeCls.extra?.decisionTreeRoot} />
                </div>

                {activeCls.extra?.decisionRules && (
                  <div>
                    <h3 className="text-sm font-semibold text-[#082441] mb-2">
                      Human-Readable Decision Rules Extracted from Trained Tree
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeCls.extra.decisionRules.slice(0, 6).map((rule, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-[#EFF4F9] border border-[#D2DFEC] text-xs space-y-1"
                        >
                          <div className="font-mono-tabular text-[#1B324B]">
                            IF {rule.conditions.join(' AND ')}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={`font-semibold ${
                                rule.outcome === 'Delayed' ? 'text-[#C85656]' : 'text-[#4C7DAE]'
                              }`}
                            >
                              THEN {rule.outcome}
                            </span>
                            <span className="text-[#647B92] font-mono-tabular">
                              Confidence {(rule.confidence * 100).toFixed(1)}% · Support n=
                              {rule.supportCount}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
