import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { ProjectPredictionInput, ProjectRecord } from './src/types/project.ts';
import {
  generateSyntheticDataset,
  parseUploadedCsv,
  recordsToCsv,
} from './server/data/datasetGenerator.ts';
import {
  activateDatasetById,
  ensureInitialDataset,
  listDatasets,
  listPredictionHistory,
  saveDataset,
  saveModelRun,
  savePredictionReport,
  updateDatasetOutlierCount,
} from './server/database/db.ts';
import { runHierarchicalClustering, runKMeansClustering } from './server/ml/clustering.ts';
import {
  generateProjectPredictionReport,
  recomputeSimpleRegression,
  trainWorkspaceModels,
  type ActiveMLWorkspace,
} from './server/ml/engine.ts';

const PORT = Number(process.env.PORT) || 3000;

let workspace: ActiveMLWorkspace;

function bootstrapML() {
  const { dataset, records } = ensureInitialDataset();
  workspace = trainWorkspaceModels({
    datasetId: dataset.id,
    datasetName: dataset.name,
    sourceType: dataset.source_type,
    records,
    missingCount: dataset.missing_count,
    duplicatesRemoved: dataset.duplicate_count,
  });
  updateDatasetOutlierCount(dataset.id, workspace.snapshot.dataQuality.outliersDetectedIQR);
  saveModelRun(workspace.snapshot);
}

bootstrapML();

function filterRecords(
  records: ProjectRecord[],
  query: Record<string, unknown>
): ProjectRecord[] {
  const domain = typeof query.domain === 'string' ? query.domain : '';
  const methodology = typeof query.methodology === 'string' ? query.methodology : '';
  const complexity = typeof query.complexity === 'string' ? query.complexity : '';
  const status = typeof query.status === 'string' ? query.status : '';
  const riskLevel = typeof query.riskLevel === 'string' ? query.riskLevel : '';
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';

  return records.filter((r) => {
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
      const hay = `${r.Project_ID} ${r.Project_Name} ${r.Domain} ${r.Software_Development_Methodology}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, dataset: workspace.datasetName, rows: workspace.prep.allRecords.length });
  });

  app.get('/api/workspace', (_req, res) => {
    res.json({
      datasets: listDatasets(),
      snapshot: workspace.snapshot,
      predictions: listPredictionHistory(20),
    });
  });

  app.get('/api/projects', (req, res) => {
    const filtered = filterRecords(workspace.prep.allRecords, req.query as Record<string, unknown>);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 500)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));
    res.json({
      total: filtered.length,
      records: filtered.slice(offset, offset + limit),
    });
  });

  app.get('/api/dataset/download', (_req, res) => {
    const csv = recordsToCsv(workspace.prep.allRecords);
    const safeName = workspace.datasetName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
    res.send(csv);
  });

  app.post('/api/dataset/upload', (req, res) => {
    try {
      const { name, csvText } = req.body as { name?: string; csvText?: string };
      if (!csvText || typeof csvText !== 'string') {
        res.status(400).json({ error: 'CSV content is required.' });
        return;
      }
      const parsed = parseUploadedCsv(csvText);
      if (parsed.records.length < 15) {
        res.status(400).json({
          error: `Dataset contains only ${parsed.records.length} valid rows. At least 15 records are required to perform stratified train/test splitting and cross-validation.`,
        });
        return;
      }

      const dataset = saveDataset(
        (name && name.trim()) || `Uploaded Dataset (${new Date().toLocaleDateString()})`,
        'uploaded',
        'User-uploaded CSV historical software project dataset.',
        parsed.records,
        parsed.missingCellsCount,
        parsed.duplicatesRemoved,
        0
      );

      workspace = trainWorkspaceModels({
        datasetId: dataset.id,
        datasetName: dataset.name,
        sourceType: 'uploaded',
        records: parsed.records,
        missingCount: parsed.missingCellsCount,
        duplicatesRemoved: parsed.duplicatesRemoved,
      });
      updateDatasetOutlierCount(dataset.id, workspace.snapshot.dataQuality.outliersDetectedIQR);
      saveModelRun(workspace.snapshot);

      res.json({
        datasets: listDatasets(),
        snapshot: workspace.snapshot,
        warnings: parsed.warnings,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to parse uploaded CSV.',
      });
    }
  });

  app.post('/api/dataset/generate', (req, res) => {
    try {
      const rowCount = Math.min(1000, Math.max(80, Number(req.body?.rowCount ?? 420)));
      const seed = Math.max(1, Number(req.body?.seed ?? 42));
      const records = generateSyntheticDataset(rowCount, seed);
      const dataset = saveDataset(
        `Synthetic Benchmark (n=${rowCount}, seed=${seed})`,
        'synthetic',
        `Configurable synthetic dataset generated with ${rowCount} multi-domain software projects (seed=${seed}).`,
        records,
        0,
        0,
        0
      );

      workspace = trainWorkspaceModels({
        datasetId: dataset.id,
        datasetName: dataset.name,
        sourceType: 'synthetic',
        records,
      });
      updateDatasetOutlierCount(dataset.id, workspace.snapshot.dataQuality.outliersDetectedIQR);
      saveModelRun(workspace.snapshot);

      res.json({
        datasets: listDatasets(),
        snapshot: workspace.snapshot,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate synthetic dataset.',
      });
    }
  });

  app.post('/api/dataset/activate', (req, res) => {
    try {
      const datasetId = Number(req.body?.datasetId);
      const { dataset, records } = activateDatasetById(datasetId);
      workspace = trainWorkspaceModels({
        datasetId: dataset.id,
        datasetName: dataset.name,
        sourceType: dataset.source_type,
        records,
        missingCount: dataset.missing_count,
        duplicatesRemoved: dataset.duplicate_count,
      });
      updateDatasetOutlierCount(dataset.id, workspace.snapshot.dataQuality.outliersDetectedIQR);
      saveModelRun(workspace.snapshot);

      res.json({
        datasets: listDatasets(),
        snapshot: workspace.snapshot,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Failed to activate dataset.',
      });
    }
  });

  app.post('/api/models/retrain', (req, res) => {
    try {
      const simpleFeature =
        typeof req.body?.simpleFeature === 'string'
          ? req.body.simpleFeature
          : 'Planned_Duration_Days';
      const onlySimple = Boolean(req.body?.onlySimple);

      if (onlySimple) {
        workspace = recomputeSimpleRegression(workspace, simpleFeature);
      } else {
        workspace = trainWorkspaceModels({
          datasetId: workspace.datasetId,
          datasetName: workspace.datasetName,
          sourceType: workspace.sourceType,
          records: workspace.prep.allRecords,
          missingCount: workspace.snapshot.dataQuality.missingValuesDetected,
          duplicatesRemoved: workspace.snapshot.dataQuality.duplicatesRemoved,
          simpleFeature,
          kmeansK: Number(req.body?.kmeansK ?? workspace.snapshot.kmeans.k),
          hierarchicalLinkage: req.body?.hierarchicalLinkage ?? workspace.snapshot.hierarchical.linkage,
        });
        saveModelRun(workspace.snapshot);
      }
      res.json({ snapshot: workspace.snapshot });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Retraining failed.' });
    }
  });

  app.post('/api/clustering/update', (req, res) => {
    try {
      const k = Math.min(8, Math.max(2, Number(req.body?.k ?? workspace.snapshot.kmeans.k)));
      const linkage =
        req.body?.linkage === 'complete' || req.body?.linkage === 'average'
          ? req.body.linkage
          : 'ward';
      workspace.kmeans = runKMeansClustering(workspace.prep.allRecords, k);
      workspace.snapshot.kmeans = workspace.kmeans.result;
      workspace.snapshot.hierarchical = runHierarchicalClustering(
        workspace.prep.allRecords,
        linkage,
        k
      );
      res.json({
        kmeans: workspace.snapshot.kmeans,
        hierarchical: workspace.snapshot.hierarchical,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Clustering update failed.' });
    }
  });

  app.post('/api/predict', (req, res) => {
    try {
      const input = req.body as ProjectPredictionInput;
      const errMsg = validatePredictionInput(input);
      if (errMsg) {
        res.status(400).json({ error: errMsg });
        return;
      }

      if (
        input.simpleRegressionFeature &&
        input.simpleRegressionFeature !== workspace.regressors.simpleLinear.featureName
      ) {
        workspace = recomputeSimpleRegression(workspace, input.simpleRegressionFeature);
      }

      const draftReport = generateProjectPredictionReport(workspace, input, 0);
      const saved = savePredictionReport(workspace.datasetId, draftReport);
      res.json({
        report: saved,
        predictions: listPredictionHistory(20),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Prediction execution failed.',
      });
    }
  });

  app.get('/api/predictions', (_req, res) => {
    res.json({ predictions: listPredictionHistory(25) });
  });

  // Vite dev middleware or production static serving
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distPath)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProjectPulse AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
