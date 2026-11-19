import { jsPDF } from 'jspdf';
import type { ModelLabSnapshot, PredictionReport } from '../types/project.ts';

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportModelMetricsCsv(snapshot: ModelLabSnapshot) {
  const lines: string[] = [
    'Task,Model,Family,Accuracy,Precision,Recall,F1_Score,ROC_AUC,CV_Accuracy,R2,MAE,MSE,RMSE,Train_Time_Ms,Predict_Time_Ms',
  ];

  for (const r of snapshot.regressions) {
    lines.push(
      `Regression,"${r.name}",Linear,,,,,,,${r.r2},${r.mae},${r.mse},${r.rmse},${r.trainTimeMs},${r.predictTimeMs}`
    );
  }
  for (const c of snapshot.classifiers) {
    lines.push(
      `Classification,"${c.name}",${c.family},${c.accuracy},${c.precision},${c.recall},${c.f1},${c.rocAuc},${c.cvAccuracyMean},,,,,${c.trainTimeMs},${c.predictTimeMs}`
    );
  }

  triggerDownload(
    `projectpulse_model_metrics_${new Date().toISOString().slice(0, 10)}.csv`,
    lines.join('\n'),
    'text/csv;charset=utf-8;'
  );
}

export function exportPredictionCsv(report: PredictionReport) {
  const lines: string[] = [
    'Section,Key,Value',
    `Project,Project Name,"${report.input.Project_Name}"`,
    `Project,Domain,"${report.input.Domain}"`,
    `Project,Methodology,"${report.input.Software_Development_Methodology}"`,
    `Project,Planned Duration Days,${report.input.Planned_Duration_Days}`,
    `Primary Prediction,Best Classifier,"${report.primaryPrediction.bestClassifierName}"`,
    `Primary Prediction,Best Regressor,"${report.primaryPrediction.bestRegressorName}"`,
    `Primary Prediction,Estimated Duration Days,${report.primaryPrediction.estimatedDurationDays}`,
    `Primary Prediction,Expected Delay Days,${report.primaryPrediction.expectedDelayDays}`,
    `Primary Prediction,Predicted Status,${report.primaryPrediction.predictedStatus}`,
    `Primary Prediction,Delay Probability %,${report.primaryPrediction.delayProbability}`,
    `Primary Prediction,Risk Category,${report.primaryPrediction.riskCategory}`,
  ];

  report.classificationPredictions.forEach((c) => {
    lines.push(
      `Classifier Result,"${c.modelName}","Status=${c.predictedStatus} | DelayProb=${c.delayProbability}% | F1=${c.f1}"`
    );
  });
  report.regressionPredictions.forEach((r) => {
    lines.push(
      `Regression Result,"${r.modelName}","Duration=${r.predictedDurationDays}d | Delay=${r.expectedDelayDays}d | R2=${r.r2}"`
    );
  });

  const safeName = report.input.Project_Name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  triggerDownload(`projectpulse_report_${safeName}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
}

export function exportPredictionPdf(report: PredictionReport, snapshot: ModelLabSnapshot) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 44;
  let y = 48;
  const pageHeight = doc.internal.pageSize.getHeight();

  const checkPage = (needed = 40) => {
    if (y + needed > pageHeight - 44) {
      doc.addPage();
      y = 48;
    }
  };

  doc.setFillColor(8, 36, 65);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 74, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('ProjectPulse AI — Software Project Delay Analysis Report', margin, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(210, 223, 236);
  doc.text(
    `Generated: ${new Date(report.createdAt).toLocaleString()}   |   Dataset: ${snapshot.datasetName} (${snapshot.sourceType})`,
    margin,
    54
  );

  y = 98;
  doc.setTextColor(32, 44, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`1. Project Profile: ${report.input.Project_Name}`, margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const profileLines = [
    `Domain: ${report.input.Domain}   |   Methodology: ${report.input.Software_Development_Methodology}`,
    `Complexity: ${report.input.Project_Complexity}   |   Team Size: ${report.input.Team_Size}   |   Planned Duration: ${report.input.Planned_Duration_Days} days`,
    `Tasks: ${report.input.Tasks_Completed}/${report.input.Number_of_Tasks} completed   |   Testing: ${report.input.Testing_Completion_Percentage}%   |   Bugs: ${report.input.Bugs_Reported} (${report.input.Critical_Bugs} critical)   |   Dependency Lag: ${report.input.Dependency_Delay} days`,
  ];
  profileLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 15;
  });

  y += 8;
  checkPage(90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('2. Executive ML Prediction Summary', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const p = report.primaryPrediction;
  doc.text(
    `Predicted Status: ${p.predictedStatus}   |   Delay Probability: ${p.delayProbability}%   |   On-Time Probability: ${p.onTimeProbability}%   |   Risk Tier: ${p.riskCategory}`,
    margin,
    y
  );
  y += 15;
  doc.text(
    `Estimated Completion Duration: ${p.estimatedDurationDays} days (vs ${p.plannedDurationDays} planned)   |   Expected Delay: ${p.expectedDelayDays >= 0 ? '+' : ''}${p.expectedDelayDays} days`,
    margin,
    y
  );
  y += 15;
  doc.text(
    `Selected Primary Models: ${p.bestClassifierName} & ${p.bestRegressorName}`,
    margin,
    y
  );
  y += 22;

  checkPage(120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('3. Multi-Model Prediction Consensus', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  report.regressionPredictions.forEach((r) => {
    checkPage(16);
    doc.text(
      `[Regression] ${r.modelName}: ${r.predictedDurationDays} days (${r.expectedDelayDays >= 0 ? '+' : ''}${r.expectedDelayDays}d delay)  |  R²=${r.r2}, RMSE=${r.rmse}`,
      margin,
      y
    );
    y += 14;
  });
  report.classificationPredictions.forEach((c) => {
    checkPage(16);
    doc.text(
      `[Classifier] ${c.modelName}: ${c.predictedStatus} (${c.delayProbability}% delay prob)  |  F1=${c.f1}, ROC-AUC=${c.rocAuc}`,
      margin,
      y
    );
    y += 14;
  });

  y += 10;
  checkPage(90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('4. Decision Tree Trace & Primary Drivers', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  report.decisionTreePath.forEach((step) => {
    checkPage(16);
    doc.text(`- ${step}`, margin, y);
    y += 14;
  });

  const safeName = report.input.Project_Name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  doc.save(`projectpulse_analysis_${safeName}.pdf`);
}
