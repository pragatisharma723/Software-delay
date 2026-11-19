import {
  generateSyntheticDataset,
  parseUploadedCsv,
} from '../../server/data/datasetGenerator.ts';
import {
  runHierarchicalClustering,
  runKMeansClustering,
} from '../../server/ml/clustering.ts';
import {
  generateProjectPredictionReport,
  recomputeSimpleRegression,
  trainWorkspaceModels,
  type ActiveMLWorkspace,
} from '../../server/ml/engine.ts';
import type {
  DatasetMeta,
  HierarchicalResult,
  KMeansResult,
  ModelLabSnapshot,
  PredictionReport,
  ProjectPredictionInput,
  ProjectRecord,
} from '../types/project.ts';

interface StoredDatasetEntry {
  meta: DatasetMeta;
  records: ProjectRecord[];
}

const STORAGE_DATASETS_KEY = 'projectpulse_datasets_v1';
const STORAGE_PREDICTIONS_KEY = 'projectpulse_predictions_v1';

let cachedDatasets: StoredDatasetEntry[] | null = null;
let cachedWorkspace: ActiveMLWorkspace | null = null;
let cachedPredictions: PredictionReport[] | null = null;

function readStorage<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

function validatePredictionInput(body: Partial<ProjectPredictionInput>): string | null {
  if (!body.Project_Name || !body.Project_Name.trim()) {
    return 'Project Name is required.';
  }
  if ((body.Planned_Duration_Days ?? 0) < 10) {
    return 'Planned Duration must be at least 10 days.';
  }
  if ((body.Team_Size ?? 0) < 1) {
    return 'Team Size must be at least 1 developer.';
  }
  if ((body.Number_of_Tasks ?? 0) < 1) {
    return 'Number of Tasks must be at least 1.';
  }
  if ((body.Tasks_Completed ?? 0) > (body.Number_of_Tasks ?? 0)) {
    return 'Tasks Completed cannot exceed Total Number of Tasks.';
  }
  if ((body.Critical_Bugs ?? 0) > (body.Bugs_Reported ?? 0)) {
    return 'Critical Bugs cannot exceed Bugs Reported.';
  }
  if ((body.Bugs_Resolved ?? 0) > (body.Bugs_Reported ?? 0)) {
    return 'Bugs Resolved cannot exceed Bugs Reported.';
  }
  if ((body.External_Dependencies ?? 0) > (body.Number_of_Dependencies ?? 0)) {
    return 'External Dependencies cannot exceed Total Number of Dependencies.';
  }
  return null;
}

function ensureBootstrapped(): ActiveMLWorkspace {
  if (cachedWorkspace && cachedDatasets) {
    return cachedWorkspace;
  }

  const savedDatasets = readStorage<StoredDatasetEntry[]>(STORAGE_DATASETS_KEY);
  const savedPredictions = readStorage<PredictionReport[]>(STORAGE_PREDICTIONS_KEY);
  cachedPredictions = Array.isArray(savedPredictions) ? savedPredictions : [];

  if (Array.isArray(savedDatasets) && savedDatasets.length > 0) {
    cachedDatasets = savedDatasets;
    const active = savedDatasets.find((d) => d.meta.is_active) ?? savedDatasets[0];
    active.meta.is_active = true;
    cachedWorkspace = trainWorkspaceModels({
      datasetId: active.meta.id,
      datasetName: active.meta.name,
      sourceType: active.meta.source_type,
      records: active.records,
      missingCount: active.meta.missing_count,
      duplicatesRemoved: active.meta.duplicate_count,
    });
    active.meta.outlier_count = cachedWorkspace.snapshot.dataQuality.outliersDetectedIQR;
    return cachedWorkspace;
  }

  const records = generateSyntheticDataset(420, 42);
  const delayedCount = records.filter((r) => r.Is_Delayed === 1).length;
  const meta: DatasetMeta = {
    id: 1,
    name: 'ProjectPulse Synthetic Benchmark (n=420)',
    source_type: 'synthetic',
    description:
      'Configurable 4-domain, 5-methodology synthetic benchmark dataset generated with deterministic seed=42 for transparent ML evaluation.',
    row_count: records.length,
    feature_count: Object.keys(records[0] ?? {}).length,
    missing_count: 0,
    duplicate_count: 0,
    outlier_count: 0,
    on_time_count: records.length - delayedCount,
    delayed_count: delayedCount,
    uploaded_at: new Date().toISOString(),
    is_active: true,
  };

  cachedWorkspace = trainWorkspaceModels({
    datasetId: meta.id,
    datasetName: meta.name,
    sourceType: meta.source_type,
    records,
  });
  meta.outlier_count = cachedWorkspace.snapshot.dataQuality.outliersDetectedIQR;
  cachedDatasets = [{ meta, records }];
  writeStorage(STORAGE_DATASETS_KEY, cachedDatasets);
  return cachedWorkspace;
}

function getDatasetsMeta(): DatasetMeta[] {
  ensureBootstrapped();
  return [...(cachedDatasets ?? [])].map((d) => d.meta).sort((a, b) => b.id - a.id);
}

export function localFetchWorkspace(): {
  datasets: DatasetMeta[];
  snapshot: ModelLabSnapshot;
  predictions: PredictionReport[];
} {
  const ws = ensureBootstrapped();
  return {
    datasets: getDatasetsMeta(),
    snapshot: ws.snapshot,
    predictions: (cachedPredictions ?? []).slice(0, 20),
  };
}

export function localFetchProjects(params?: {
  domain?: string;
  methodology?: string;
  complexity?: string;
  riskLevel?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): { total: number; records: ProjectRecord[] } {
  const ws = ensureBootstrapped();
  const domain = params?.domain ?? '';
  const methodology = params?.methodology ?? '';
  const complexity = params?.complexity ?? '';
  const status = params?.status ?? '';
  const riskLevel = params?.riskLevel ?? '';
  const search = (params?.search ?? '').trim().toLowerCase();

  const filtered = ws.prep.allRecords.filter((r) => {
    if (domain && domain !== 'All' && r.Domain !== domain) return false;
    if (methodology && methodology !== 'All' && r.Software_Development_Methodology !== methodology)
      return false;
    if (complexity && complexity !== 'All' && r.Project_Complexity !== complexity) return false;
    if (status && status !== 'All' && r.Project_Status !== status) return false;
    if (riskLevel && riskLevel !== 'All') {
      const s = r.Project_Risk_Score;
      const lvl = s < 30 ? 'Low' : s < 55 ? 'Moderate' : s < 78 ? 'High' : 'Critical';
      if (lvl !== riskLevel) return false;
    }
    if (search) {
      const hay =
        `${r.Project_ID} ${r.Project_Name} ${r.Domain} ${r.Software_Development_Methodology}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const limit = Math.min(500, Math.max(1, Number(params?.limit ?? 500)));
  const offset = Math.max(0, Number(params?.offset ?? 0));
  return {
    total: filtered.length,
    records: filtered.slice(offset, offset + limit),
  };
}

export function localUploadDatasetCsv(
  name: string,
  csvText: string
): { datasets: DatasetMeta[]; snapshot: ModelLabSnapshot; warnings: string[] } {
  ensureBootstrapped();
  const parsed = parseUploadedCsv(csvText);
  if (parsed.records.length < 15) {
    throw new Error(
      `Dataset contains only ${parsed.records.length} valid rows. At least 15 records are required to perform stratified train/test splitting and cross-validation.`
    );
  }

  const list = cachedDatasets ?? [];
  list.forEach((d) => {
    d.meta.is_active = false;
  });
  const nextId = list.reduce((max, d) => Math.max(max, d.meta.id), 0) + 1;
  const delayedCount = parsed.records.filter((r) => r.Is_Delayed === 1).length;

  const meta: DatasetMeta = {
    id: nextId,
    name: (name && name.trim()) || `Uploaded Dataset (${new Date().toLocaleDateString()})`,
    source_type: 'uploaded',
    description: 'User-uploaded CSV historical software project dataset.',
    row_count: parsed.records.length,
    feature_count: Object.keys(parsed.records[0] ?? {}).length,
    missing_count: parsed.missingCellsCount,
    duplicate_count: parsed.duplicatesRemoved,
    outlier_count: 0,
    on_time_count: parsed.records.length - delayedCount,
    delayed_count: delayedCount,
    uploaded_at: new Date().toISOString(),
    is_active: true,
  };

  cachedWorkspace = trainWorkspaceModels({
    datasetId: meta.id,
    datasetName: meta.name,
    sourceType: 'uploaded',
    records: parsed.records,
    missingCount: parsed.missingCellsCount,
    duplicatesRemoved: parsed.duplicatesRemoved,
  });
  meta.outlier_count = cachedWorkspace.snapshot.dataQuality.outliersDetectedIQR;
  cachedDatasets = [{ meta, records: parsed.records }, ...list.slice(0, 5)];
  writeStorage(STORAGE_DATASETS_KEY, cachedDatasets);

  return {
    datasets: getDatasetsMeta(),
    snapshot: cachedWorkspace.snapshot,
    warnings: parsed.warnings,
  };
}

export function localGenerateSyntheticDataset(
  rowCount: number,
  seed: number
): { datasets: DatasetMeta[]; snapshot: ModelLabSnapshot } {
  ensureBootstrapped();
  const cleanCount = Math.min(1000, Math.max(80, Number(rowCount || 420)));
  const cleanSeed = Math.max(1, Number(seed || 42));
  const records = generateSyntheticDataset(cleanCount, cleanSeed);

  const list = cachedDatasets ?? [];
  list.forEach((d) => {
    d.meta.is_active = false;
  });
  const nextId = list.reduce((max, d) => Math.max(max, d.meta.id), 0) + 1;
  const delayedCount = records.filter((r) => r.Is_Delayed === 1).length;

  const meta: DatasetMeta = {
    id: nextId,
    name: `Synthetic Benchmark (n=${cleanCount}, seed=${cleanSeed})`,
    source_type: 'synthetic',
    description: `Configurable synthetic dataset generated with ${cleanCount} multi-domain software projects (seed=${cleanSeed}).`,
    row_count: records.length,
    feature_count: Object.keys(records[0] ?? {}).length,
    missing_count: 0,
    duplicate_count: 0,
    outlier_count: 0,
    on_time_count: records.length - delayedCount,
    delayed_count: delayedCount,
    uploaded_at: new Date().toISOString(),
    is_active: true,
  };

  cachedWorkspace = trainWorkspaceModels({
    datasetId: meta.id,
    datasetName: meta.name,
    sourceType: 'synthetic',
    records,
  });
  meta.outlier_count = cachedWorkspace.snapshot.dataQuality.outliersDetectedIQR;
  cachedDatasets = [{ meta, records }, ...list.slice(0, 5)];
  writeStorage(STORAGE_DATASETS_KEY, cachedDatasets);

  return {
    datasets: getDatasetsMeta(),
    snapshot: cachedWorkspace.snapshot,
  };
}

export function localActivateDataset(datasetId: number): {
  datasets: DatasetMeta[];
  snapshot: ModelLabSnapshot;
} {
  ensureBootstrapped();
  const list = cachedDatasets ?? [];
  const target = list.find((d) => d.meta.id === datasetId);
  if (!target) throw new Error(`Dataset ${datasetId} not found.`);
  list.forEach((d) => {
    d.meta.is_active = d.meta.id === datasetId;
  });

  cachedWorkspace = trainWorkspaceModels({
    datasetId: target.meta.id,
    datasetName: target.meta.name,
    sourceType: target.meta.source_type,
    records: target.records,
    missingCount: target.meta.missing_count,
    duplicatesRemoved: target.meta.duplicate_count,
  });
  target.meta.outlier_count = cachedWorkspace.snapshot.dataQuality.outliersDetectedIQR;
  writeStorage(STORAGE_DATASETS_KEY, cachedDatasets);

  return {
    datasets: getDatasetsMeta(),
    snapshot: cachedWorkspace.snapshot,
  };
}

export function localRetrainModels(params: {
  simpleFeature?: string;
  onlySimple?: boolean;
  kmeansK?: number;
  hierarchicalLinkage?: 'ward' | 'complete' | 'average';
}): { snapshot: ModelLabSnapshot } {
  const ws = ensureBootstrapped();
  const simpleFeature = params.simpleFeature ?? 'Planned_Duration_Days';
  if (params.onlySimple) {
    cachedWorkspace = recomputeSimpleRegression(ws, simpleFeature);
  } else {
    cachedWorkspace = trainWorkspaceModels({
      datasetId: ws.datasetId,
      datasetName: ws.datasetName,
      sourceType: ws.sourceType,
      records: ws.prep.allRecords,
      missingCount: ws.snapshot.dataQuality.missingValuesDetected,
      duplicatesRemoved: ws.snapshot.dataQuality.duplicatesRemoved,
      simpleFeature,
      kmeansK: params.kmeansK ?? ws.snapshot.kmeans.k,
      hierarchicalLinkage: params.hierarchicalLinkage ?? ws.snapshot.hierarchical.linkage,
    });
  }
  return { snapshot: cachedWorkspace.snapshot };
}

export function localUpdateClustering(params: {
  k: number;
  linkage: 'ward' | 'complete' | 'average';
}): { kmeans: KMeansResult; hierarchical: HierarchicalResult } {
  const ws = ensureBootstrapped();
  const k = Math.min(8, Math.max(2, Number(params.k ?? ws.snapshot.kmeans.k)));
  const linkage =
    params.linkage === 'complete' || params.linkage === 'average' ? params.linkage : 'ward';
  ws.kmeans = runKMeansClustering(ws.prep.allRecords, k);
  ws.snapshot.kmeans = ws.kmeans.result;
  ws.snapshot.hierarchical = runHierarchicalClustering(ws.prep.allRecords, linkage, k);
  return {
    kmeans: ws.snapshot.kmeans,
    hierarchical: ws.snapshot.hierarchical,
  };
}

export function localRunProjectPrediction(
  input: ProjectPredictionInput
): { report: PredictionReport; predictions: PredictionReport[] } {
  let ws = ensureBootstrapped();
  const errMsg = validatePredictionInput(input);
  if (errMsg) {
    throw new Error(errMsg);
  }

  if (
    input.simpleRegressionFeature &&
    input.simpleRegressionFeature !== ws.regressors.simpleLinear.featureName
  ) {
    ws = recomputeSimpleRegression(ws, input.simpleRegressionFeature);
    cachedWorkspace = ws;
  }

  const nextId = (cachedPredictions?.[0]?.id ?? 0) + 1;
  const report = generateProjectPredictionReport(ws, input, nextId);
  cachedPredictions = [report, ...(cachedPredictions ?? [])].slice(0, 20);
  writeStorage(STORAGE_PREDICTIONS_KEY, cachedPredictions);

  return {
    report,
    predictions: cachedPredictions,
  };
}
