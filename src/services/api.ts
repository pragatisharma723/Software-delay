import type {
  DatasetMeta,
  HierarchicalResult,
  KMeansResult,
  ModelLabSnapshot,
  PredictionReport,
  ProjectPredictionInput,
  ProjectRecord,
} from '../types/project.ts';
import {
  localActivateDataset,
  localFetchProjects,
  localFetchWorkspace,
  localGenerateSyntheticDataset,
  localRetrainModels,
  localRunProjectPrediction,
  localUpdateClustering,
  localUploadDatasetCsv,
} from './localWorkspace.ts';

class ApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiUnavailableError';
  }
}

let backendAvailable: boolean | null = null;

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  if (backendAvailable === false) {
    throw new ApiUnavailableError('Using client-side ML runtime.');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (err) {
    backendAvailable = false;
    throw new ApiUnavailableError(
      err instanceof Error ? err.message : 'Backend endpoint unreachable.'
    );
  }

  const contentType = res.headers.get('content-type') ?? '';
  const rawText = await res.text();

  if (!contentType.includes('application/json')) {
    backendAvailable = false;
    throw new ApiUnavailableError(
      `Non-JSON response (${res.status}) from ${url}; switching to client-side ML runtime.`
    );
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    backendAvailable = false;
    throw new ApiUnavailableError(`Malformed JSON response from ${url}.`);
  }

  if (!res.ok) {
    const errMsg =
      typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }

  backendAvailable = true;
  return data as unknown as T;
}

async function withLocalFallback<T>(
  remoteCall: () => Promise<T>,
  localCall: () => T
): Promise<T> {
  if (backendAvailable === false) {
    return localCall();
  }
  try {
    return await remoteCall();
  } catch (err) {
    if (err instanceof ApiUnavailableError) {
      return localCall();
    }
    throw err;
  }
}

export interface WorkspaceResponse {
  datasets: DatasetMeta[];
  snapshot: ModelLabSnapshot;
  predictions: PredictionReport[];
}

export function fetchWorkspace(): Promise<WorkspaceResponse> {
  return withLocalFallback(
    () => requestJson<WorkspaceResponse>('/api/workspace'),
    () => localFetchWorkspace()
  );
}

export function fetchProjects(params?: {
  domain?: string;
  methodology?: string;
  complexity?: string;
  riskLevel?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; records: ProjectRecord[] }> {
  const qs = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
  }
  return withLocalFallback(
    () => requestJson<{ total: number; records: ProjectRecord[] }>(`/api/projects?${qs.toString()}`),
    () => localFetchProjects(params)
  );
}

export function uploadDatasetCsv(
  name: string,
  csvText: string
): Promise<{ datasets: DatasetMeta[]; snapshot: ModelLabSnapshot; warnings: string[] }> {
  return withLocalFallback(
    () =>
      requestJson('/api/dataset/upload', {
        method: 'POST',
        body: JSON.stringify({ name, csvText }),
      }),
    () => localUploadDatasetCsv(name, csvText)
  );
}

export function generateSyntheticDatasetApi(
  rowCount: number,
  seed: number
): Promise<{ datasets: DatasetMeta[]; snapshot: ModelLabSnapshot }> {
  return withLocalFallback(
    () =>
      requestJson('/api/dataset/generate', {
        method: 'POST',
        body: JSON.stringify({ rowCount, seed }),
      }),
    () => localGenerateSyntheticDataset(rowCount, seed)
  );
}

export function activateDatasetApi(
  datasetId: number
): Promise<{ datasets: DatasetMeta[]; snapshot: ModelLabSnapshot }> {
  return withLocalFallback(
    () =>
      requestJson('/api/dataset/activate', {
        method: 'POST',
        body: JSON.stringify({ datasetId }),
      }),
    () => localActivateDataset(datasetId)
  );
}

export function retrainModelsApi(params: {
  simpleFeature?: string;
  onlySimple?: boolean;
  kmeansK?: number;
  hierarchicalLinkage?: 'ward' | 'complete' | 'average';
}): Promise<{ snapshot: ModelLabSnapshot }> {
  return withLocalFallback(
    () =>
      requestJson('/api/models/retrain', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    () => localRetrainModels(params)
  );
}

export function updateClusteringApi(params: {
  k: number;
  linkage: 'ward' | 'complete' | 'average';
}): Promise<{ kmeans: KMeansResult; hierarchical: HierarchicalResult }> {
  return withLocalFallback(
    () =>
      requestJson('/api/clustering/update', {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    () => localUpdateClustering(params)
  );
}

export function runProjectPredictionApi(
  input: ProjectPredictionInput
): Promise<{ report: PredictionReport; predictions: PredictionReport[] }> {
  return withLocalFallback(
    () =>
      requestJson('/api/predict', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    () => localRunProjectPrediction(input)
  );
}
