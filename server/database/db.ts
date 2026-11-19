import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  DatasetMeta,
  ModelLabSnapshot,
  PredictionReport,
  ProjectRecord,
} from '../../src/types/project.ts';
import { generateSyntheticDataset } from '../data/datasetGenerator.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'projectpulse.db');
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    description TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    feature_count INTEGER NOT NULL,
    missing_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    outlier_count INTEGER NOT NULL DEFAULT 0,
    on_time_count INTEGER NOT NULL DEFAULT 0,
    delayed_count INTEGER NOT NULL DEFAULT 0,
    uploaded_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    record_json TEXT NOT NULL,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS model_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    trained_at TEXT NOT NULL,
    best_classifier TEXT NOT NULL,
    best_regressor TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    project_name TEXT NOT NULL,
    domain TEXT NOT NULL,
    methodology TEXT NOT NULL,
    report_json TEXT NOT NULL
  );
`);

const VALID_FOUR_DOMAINS = new Set([
  'Healthcare and Medical Software',
  'Banking and FinTech',
  'E-commerce and Retail',
  'Enterprise and Business Software',
]);

export function ensureInitialDataset(): {
  dataset: DatasetMeta;
  records: ProjectRecord[];
} {
  const existing = db
    .prepare('SELECT * FROM datasets WHERE is_active = 1 ORDER BY id DESC LIMIT 1')
    .get() as Record<string, unknown> | undefined;

  if (existing) {
    const rows = db
      .prepare('SELECT record_json FROM projects WHERE dataset_id = ? ORDER BY id ASC')
      .all(Number(existing.id)) as Array<{ record_json: string }>;
    if (rows.length > 0) {
      const parsed = rows.map((r) => JSON.parse(r.record_json) as ProjectRecord);
      const isUploaded = existing.source_type === 'uploaded';
      const hasLegacyFields =
        !isUploaded &&
        parsed.some(
          (r) =>
            !VALID_FOUR_DOMAINS.has(r.Domain) ||
            'DevOps_Enabled' in (r as unknown as Record<string, unknown>)
        );

      if (!hasLegacyFields) {
        return {
          dataset: mapDatasetRow(existing),
          records: parsed,
        };
      }
    }
  }

  // Generate clean 4-domain configurable synthetic benchmark dataset (420 records)
  const records = generateSyntheticDataset(420, 42);
  const dataset = saveDataset(
    'ProjectPulse Synthetic Benchmark (n=420)',
    'synthetic',
    'Configurable 4-domain, 5-methodology synthetic benchmark dataset generated with deterministic seed=42 for transparent ML evaluation.',
    records,
    0,
    0,
    0
  );
  return { dataset, records };
}

function mapDatasetRow(row: Record<string, unknown>): DatasetMeta {
  return {
    id: Number(row.id),
    name: String(row.name),
    source_type: row.source_type === 'uploaded' ? 'uploaded' : 'synthetic',
    description: String(row.description),
    row_count: Number(row.row_count),
    feature_count: Number(row.feature_count),
    missing_count: Number(row.missing_count),
    duplicate_count: Number(row.duplicate_count),
    outlier_count: Number(row.outlier_count),
    on_time_count: Number(row.on_time_count),
    delayed_count: Number(row.delayed_count),
    uploaded_at: String(row.uploaded_at),
    is_active: Number(row.is_active) === 1,
  };
}

export function saveDataset(
  name: string,
  sourceType: 'synthetic' | 'uploaded',
  description: string,
  records: ProjectRecord[],
  missingCount: number,
  duplicateCount: number,
  outlierCount: number
): DatasetMeta {
  db.exec('UPDATE datasets SET is_active = 0');
  const delayedCount = records.filter((r) => r.Is_Delayed === 1).length;
  const onTimeCount = records.length - delayedCount;
  const featureCount = Object.keys(records[0] ?? {}).length;
  const now = new Date().toISOString();

  const res = db
    .prepare(
      `INSERT INTO datasets (name, source_type, description, row_count, feature_count, missing_count, duplicate_count, outlier_count, on_time_count, delayed_count, uploaded_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      name,
      sourceType,
      description,
      records.length,
      featureCount,
      missingCount,
      duplicateCount,
      outlierCount,
      onTimeCount,
      delayedCount,
      now
    );

  const datasetId = Number(res.lastInsertRowid);
  const insertProj = db.prepare('INSERT INTO projects (dataset_id, record_json) VALUES (?, ?)');

  db.exec('BEGIN TRANSACTION');
  try {
    for (const rec of records) {
      insertProj.run(datasetId, JSON.stringify(rec));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const row = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId) as Record<
    string,
    unknown
  >;
  return mapDatasetRow(row);
}

export function listDatasets(): DatasetMeta[] {
  const rows = db.prepare('SELECT * FROM datasets ORDER BY id DESC').all() as Array<
    Record<string, unknown>
  >;
  return rows.map(mapDatasetRow);
}

export function activateDatasetById(datasetId: number): {
  dataset: DatasetMeta;
  records: ProjectRecord[];
} {
  const row = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId) as
    | Record<string, unknown>
    | undefined;
  if (!row) throw new Error(`Dataset ${datasetId} not found.`);
  db.exec('UPDATE datasets SET is_active = 0');
  db.prepare('UPDATE datasets SET is_active = 1 WHERE id = ?').run(datasetId);
  const rows = db
    .prepare('SELECT record_json FROM projects WHERE dataset_id = ? ORDER BY id ASC')
    .all(datasetId) as Array<{ record_json: string }>;
  const updated = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId) as Record<
    string,
    unknown
  >;
  return {
    dataset: mapDatasetRow(updated),
    records: rows.map((r) => JSON.parse(r.record_json) as ProjectRecord),
  };
}

export function updateDatasetOutlierCount(datasetId: number, outlierCount: number): void {
  db.prepare('UPDATE datasets SET outlier_count = ? WHERE id = ?').run(outlierCount, datasetId);
}

export function saveModelRun(snapshot: ModelLabSnapshot): void {
  db.prepare(
    'INSERT INTO model_runs (dataset_id, trained_at, best_classifier, best_regressor, snapshot_json) VALUES (?, ?, ?, ?, ?)'
  ).run(
    snapshot.datasetId,
    snapshot.trainedAt,
    snapshot.bestClassifierId,
    snapshot.bestRegressorId,
    JSON.stringify(snapshot)
  );
}

export function savePredictionReport(datasetId: number, report: Omit<PredictionReport, 'id'>): PredictionReport {
  const res = db
    .prepare(
      'INSERT INTO predictions (dataset_id, created_at, project_name, domain, methodology, report_json) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      datasetId,
      report.createdAt,
      report.input.Project_Name,
      report.input.Domain,
      report.input.Software_Development_Methodology,
      JSON.stringify(report)
    );
  const id = Number(res.lastInsertRowid);
  const fullReport: PredictionReport = { ...report, id };
  db.prepare('UPDATE predictions SET report_json = ? WHERE id = ?').run(
    JSON.stringify(fullReport),
    id
  );
  return fullReport;
}

export function listPredictionHistory(limit = 25): PredictionReport[] {
  const rows = db
    .prepare('SELECT id, report_json FROM predictions ORDER BY id DESC LIMIT ?')
    .all(limit) as Array<{ id: number; report_json: string }>;
  const valid: PredictionReport[] = [];
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.report_json) as PredictionReport;
      if (parsed?.input && VALID_FOUR_DOMAINS.has(parsed.input.Domain)) {
        valid.push({ ...parsed, id: r.id });
      }
    } catch {
      // Ignore malformed rows
    }
  }
  return valid;
}
