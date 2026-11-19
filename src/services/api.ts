import type {
  DatasetMeta,
  HierarchicalResult,
  KMeansResult,
  ModelLabSnapshot,
  PredictionReport,
  ProjectPredictionInput,
  ProjectRecord,
} from '../types/project.ts';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface WorkspaceResponse {
  datasets: DatasetMeta[];
  snapshot: ModelLabSnapshot;
  predictions: PredictionReport[];
}

export function fetchWorkspace(): Promise<WorkspaceResponse> {
  return requestJson<WorkspaceResponse>('/api/workspace');
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
  return requestJson<{ total: number; records: ProjectRecord[] }>(`/api/projects?${qs.toString()}`);
}

export function uploadDatasetCsv(
  name: string,
  csvText: string
): Promise<{ datasets: DatasetMeta[]; snapshot: ModelLabSnapshot; warnings: string[] }> {
  return requestJson('/api/dataset/upload', {
    method: 'POST',
    body: JSON.stringify({ name, csvText }),
  });
}

export function generateSyntheticDatasetApi(
  rowCount: number,
  seed: number
): Promise<{ datasets: DatasetMeta[]; snapshot: ModelLabSnapshot }> {
  return requestJson('/api/dataset/generate', {
    method: 'POST',
    body: JSON.stringify({ rowCount, seed }),
  });
}

export function activateDatasetApi(
  datasetId: number
): Promise<{ datasets: DatasetMeta[]; snapshot: ModelLabSnapshot }> {
  return requestJson('/api/dataset/activate', {
    method: 'POST',
    body: JSON.stringify({ datasetId }),
  });
}

export function retrainModelsApi(params: {
  simpleFeature?: string;
  onlySimple?: boolean;
  kmeansK?: number;
  hierarchicalLinkage?: 'ward' | 'complete' | 'average';
}): Promise<{ snapshot: ModelLabSnapshot }> {
  return requestJson('/api/models/retrain', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateClusteringApi(params: {
  k: number;
  linkage: 'ward' | 'complete' | 'average';
}): Promise<{ kmeans: KMeansResult; hierarchical: HierarchicalResult }> {
  return requestJson('/api/clustering/update', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function runProjectPredictionApi(
  input: ProjectPredictionInput
): Promise<{ report: PredictionReport; predictions: PredictionReport[] }> {
  return requestJson('/api/predict', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
