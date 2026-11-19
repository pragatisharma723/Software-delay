import type {
  DataQualitySummary,
  DomainName,
  MethodologyName,
  ProjectPredictionInput,
  ProjectRecord,
} from '../../src/types/project.ts';
import { createRng, mean, median, quantile, stdDev } from './mathUtils.ts';

export const DOMAINS_LIST: DomainName[] = [
  'Healthcare and Medical Software',
  'Banking and FinTech',
  'E-commerce and Retail',
  'Enterprise and Business Software',
];

export const METHODOLOGIES_LIST: MethodologyName[] = [
  'Waterfall',
  'Agile (Scrum)',
  'Spiral',
  'V-Model',
  'Iterative and Incremental',
];

export const NUMERIC_MODEL_FEATURES = [
  'Planned_Duration_Days',
  'Team_Size',
  'Number_of_Modules',
  'Number_of_Tasks',
  'Tasks_Completed',
  'Tasks_Pending',
  'Completion_Percentage',
  'Number_of_Dependencies',
  'External_Dependencies',
  'Dependency_Delay',
  'Bugs_Reported',
  'Critical_Bugs',
  'Bugs_Resolved',
  'Defect_Density',
  'Code_Complexity',
  'Rework_Hours',
  'Testing_Completion_Percentage',
  'Integration_Issues',
  'Developer_Experience',
  'Team_Productivity',
  'Team_Turnover',
  'Communication_Efficiency',
  'Resource_Availability',
  'Requirement_Changes',
  'Scope_Creep',
  'Sprint_Completion_Rate',
  'Sprint_Spillover',
  'Phase_Completion',
  'Risk_Mitigation_Status',
  'Test_Case_Completion',
  'Project_Complexity_Num',
  'Project_Priority_Num',
] as const;

export const CLUSTERING_FEATURES = [
  'Completion_Percentage',
  'Bugs_Reported',
  'Number_of_Dependencies',
  'Team_Productivity',
  'Project_Complexity_Num',
  'Testing_Completion_Percentage',
  'Requirement_Changes',
  'Rework_Hours',
] as const;

export interface FittedScaler {
  featureNames: string[];
  means: number[];
  stds: number[];
  medians: number[];
}

export interface PreparedDataset {
  featureNames: string[];
  scaler: FittedScaler;
  trainIndices: number[];
  testIndices: number[];
  XTrainRaw: number[][];
  XTestRaw: number[][];
  XTrainScaled: number[][];
  XTestScaled: number[][];
  yTrainClass: number[];
  yTestClass: number[];
  yTrainReg: number[];
  yTestReg: number[];
  trainRecords: ProjectRecord[];
  testRecords: ProjectRecord[];
  allRecords: ProjectRecord[];
  dataQuality: DataQualitySummary;
}

function complexityToNum(c: string): number {
  if (c === 'Low') return 1;
  if (c === 'Medium') return 2;
  if (c === 'High') return 3;
  return 4;
}

function priorityToNum(p: string): number {
  if (p === 'Low') return 1;
  if (p === 'Medium') return 2;
  if (p === 'High') return 3;
  return 4;
}

export function extractRawFeatureRow(r: ProjectRecord): number[] {
  const numericVals: number[] = [
    r.Planned_Duration_Days,
    r.Team_Size,
    r.Number_of_Modules,
    r.Number_of_Tasks,
    r.Tasks_Completed,
    r.Tasks_Pending,
    r.Completion_Percentage,
    r.Number_of_Dependencies,
    r.External_Dependencies,
    r.Dependency_Delay,
    r.Bugs_Reported,
    r.Critical_Bugs,
    r.Bugs_Resolved,
    r.Defect_Density,
    r.Code_Complexity,
    r.Rework_Hours,
    r.Testing_Completion_Percentage,
    r.Integration_Issues,
    r.Developer_Experience,
    r.Team_Productivity,
    r.Team_Turnover,
    r.Communication_Efficiency,
    r.Resource_Availability,
    r.Requirement_Changes,
    r.Scope_Creep,
    r.Sprint_Completion_Rate,
    r.Sprint_Spillover,
    r.Phase_Completion,
    r.Risk_Mitigation_Status,
    r.Test_Case_Completion,
    complexityToNum(r.Project_Complexity),
    priorityToNum(r.Project_Priority),
  ];

  // One-hot encode Domain & Methodology cleanly (drop first category to avoid collinearity)
  const domainOneHot = DOMAINS_LIST.slice(1).map((d) => (r.Domain === d ? 1 : 0));
  const methOneHot = METHODOLOGIES_LIST.slice(1).map((m) =>
    r.Software_Development_Methodology === m ? 1 : 0
  );

  return [...numericVals, ...domainOneHot, ...methOneHot];
}

export function extractInputFeatureRow(input: ProjectPredictionInput): number[] {
  const numTasks = Math.max(1, input.Number_of_Tasks);
  const completionPct = Number(((input.Tasks_Completed / numTasks) * 100).toFixed(2));
  const modules = Math.max(1, input.Number_of_Modules);
  const defectDensity = Number(((input.Bugs_Reported / modules) * 1.1).toFixed(2));

  const numericVals: number[] = [
    input.Planned_Duration_Days,
    input.Team_Size,
    input.Number_of_Modules,
    input.Number_of_Tasks,
    input.Tasks_Completed,
    input.Tasks_Pending,
    completionPct,
    input.Number_of_Dependencies,
    input.External_Dependencies,
    input.Dependency_Delay,
    input.Bugs_Reported,
    input.Critical_Bugs,
    input.Bugs_Resolved,
    defectDensity,
    input.Code_Complexity,
    input.Rework_Hours,
    input.Testing_Completion_Percentage,
    input.Integration_Issues,
    input.Developer_Experience,
    input.Team_Productivity,
    input.Team_Turnover,
    input.Communication_Efficiency,
    input.Resource_Availability,
    input.Requirement_Changes,
    input.Scope_Creep,
    input.Sprint_Completion_Rate,
    input.Sprint_Spillover,
    input.Phase_Completion,
    input.Risk_Mitigation_Status,
    input.Test_Case_Completion,
    complexityToNum(input.Project_Complexity),
    priorityToNum(input.Project_Priority),
  ];

  const domainOneHot = DOMAINS_LIST.slice(1).map((d) => (input.Domain === d ? 1 : 0));
  const methOneHot = METHODOLOGIES_LIST.slice(1).map((m) =>
    input.Software_Development_Methodology === m ? 1 : 0
  );

  return [...numericVals, ...domainOneHot, ...methOneHot];
}

export function getModelFeatureNames(): string[] {
  const domainNames = DOMAINS_LIST.slice(1).map((d) => `Domain_${d.split(' ')[0]}`);
  const methNames = METHODOLOGIES_LIST.slice(1).map((m) => `Method_${m.split(' ')[0]}`);
  return [...NUMERIC_MODEL_FEATURES, ...domainNames, ...methNames];
}

export function fitScaler(XTrain: number[][], featureNames: string[]): FittedScaler {
  const n = XTrain.length;
  const p = featureNames.length;
  const means = new Array(p).fill(0);
  const stds = new Array(p).fill(1);
  const medians = new Array(p).fill(0);

  for (let j = 0; j < p; j++) {
    const col: number[] = [];
    for (let i = 0; i < n; i++) {
      const val = XTrain[i][j];
      if (Number.isFinite(val)) col.push(val);
    }
    const med = median(col);
    const m = mean(col);
    const s = stdDev(col, m);
    medians[j] = med;
    means[j] = m;
    stds[j] = s < 1e-6 ? 1 : s;
  }

  return { featureNames, means, stds, medians };
}

export function transformWithScaler(X: number[][], scaler: FittedScaler): number[][] {
  return X.map((row) =>
    row.map((val, j) => {
      const clean = Number.isFinite(val) ? val : scaler.medians[j];
      return (clean - scaler.means[j]) / scaler.stds[j];
    })
  );
}

export function computeDataQualitySummary(
  records: ProjectRecord[],
  missingCount = 0,
  duplicatesRemoved = 0
): DataQualitySummary {
  const inspectFeatures: Array<keyof ProjectRecord> = [
    'Planned_Duration_Days',
    'Team_Size',
    'Completion_Percentage',
    'Bugs_Reported',
    'Critical_Bugs',
    'Number_of_Dependencies',
    'Dependency_Delay',
    'Testing_Completion_Percentage',
    'Team_Productivity',
    'Rework_Hours',
    'Requirement_Changes',
    'Actual_Duration_Days',
    'Delay_Days',
  ];

  let outliersDetectedIQR = 0;
  const numericSummary = inspectFeatures.map((feat) => {
    const vals = records.map((r) => Number(r[feat])).filter((v) => Number.isFinite(v));
    const sorted = [...vals].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;
    for (const v of vals) {
      if (v < low || v > high) outliersDetectedIQR++;
    }
    const m = mean(vals);
    return {
      feature: String(feat),
      mean: Number(m.toFixed(2)),
      std: Number(stdDev(vals, m).toFixed(2)),
      min: Number((sorted[0] ?? 0).toFixed(2)),
      max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
      median: Number(median(vals).toFixed(2)),
    };
  });

  const delayed = records.filter((r) => r.Is_Delayed === 1).length;
  const onTime = records.length - delayed;

  return {
    totalRows: records.length,
    featureCount: Object.keys(records[0] ?? {}).length,
    missingValuesDetected: missingCount,
    missingValuesImputed: missingCount,
    duplicatesRemoved,
    outliersDetectedIQR,
    classBalance: {
      onTime,
      delayed,
      delayedRatio: records.length > 0 ? Number((delayed / records.length).toFixed(4)) : 0,
    },
    numericSummary,
  };
}

/**
 * Stratified 80/20 split with fixed random seed (42), fitting imputation and StandardScaler strictly on X_train.
 */
export function prepareDatasetPipeline(
  records: ProjectRecord[],
  seed = 42,
  missingCount = 0,
  duplicatesRemoved = 0
): PreparedDataset {
  const rng = createRng(seed);
  const posIdx: number[] = [];
  const negIdx: number[] = [];

  records.forEach((r, idx) => {
    if (r.Is_Delayed === 1) posIdx.push(idx);
    else negIdx.push(idx);
  });

  const shuffle = (arr: number[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };

  const posShuffled = shuffle(posIdx);
  const negShuffled = shuffle(negIdx);

  const posTrainCount = Math.max(1, Math.floor(posShuffled.length * 0.8));
  const negTrainCount = Math.max(1, Math.floor(negShuffled.length * 0.8));

  const trainIndices = shuffle([
    ...posShuffled.slice(0, posTrainCount),
    ...negShuffled.slice(0, negTrainCount),
  ]);
  const testIndices = shuffle([
    ...posShuffled.slice(posTrainCount),
    ...negShuffled.slice(negTrainCount),
  ]);

  const featureNames = getModelFeatureNames();
  const trainRecords = trainIndices.map((i) => records[i]);
  const testRecords = testIndices.map((i) => records[i]);

  const XTrainRaw = trainRecords.map(extractRawFeatureRow);
  const XTestRaw = testRecords.map(extractRawFeatureRow);

  const scaler = fitScaler(XTrainRaw, featureNames);
  const XTrainScaled = transformWithScaler(XTrainRaw, scaler);
  const XTestScaled = transformWithScaler(XTestRaw, scaler);

  const yTrainClass = trainRecords.map((r) => r.Is_Delayed);
  const yTestClass = testRecords.map((r) => r.Is_Delayed);
  const yTrainReg = trainRecords.map((r) => r.Actual_Duration_Days);
  const yTestReg = testRecords.map((r) => r.Actual_Duration_Days);

  const dataQuality = computeDataQualitySummary(records, missingCount, duplicatesRemoved);

  return {
    featureNames,
    scaler,
    trainIndices,
    testIndices,
    XTrainRaw,
    XTestRaw,
    XTrainScaled,
    XTestScaled,
    yTrainClass,
    yTestClass,
    yTrainReg,
    yTestReg,
    trainRecords,
    testRecords,
    allRecords: records,
    dataQuality,
  };
}

export function extractClusteringMatrix(records: ProjectRecord[]): {
  featureNames: string[];
  rawMatrix: number[][];
  scaledMatrix: number[][];
  scaler: FittedScaler;
} {
  const featureNames = [...CLUSTERING_FEATURES];
  const rawMatrix = records.map((r) => [
    r.Completion_Percentage,
    r.Bugs_Reported,
    r.Number_of_Dependencies,
    r.Team_Productivity,
    complexityToNum(r.Project_Complexity),
    r.Testing_Completion_Percentage,
    r.Requirement_Changes,
    r.Rework_Hours,
  ]);
  const scaler = fitScaler(rawMatrix, featureNames);
  const scaledMatrix = transformWithScaler(rawMatrix, scaler);
  return { featureNames, rawMatrix, scaledMatrix, scaler };
}
