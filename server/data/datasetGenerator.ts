import type {
  ComplexityLevel,
  DomainName,
  MethodologyName,
  PriorityLevel,
  ProjectRecord,
} from '../../src/types/project.ts';
import { clamp, createRng, randNormal } from '../ml/mathUtils.ts';

export const DOMAINS: DomainName[] = [
  'Healthcare and Medical Software',
  'Banking and FinTech',
  'E-commerce and Retail',
  'Enterprise and Business Software',
];

const METHODOLOGIES: MethodologyName[] = [
  'Waterfall',
  'Agile (Scrum)',
  'Spiral',
  'V-Model',
  'Iterative and Incremental',
];

const COMPLEXITIES: ComplexityLevel[] = ['Low', 'Medium', 'High', 'Critical'];
const PRIORITIES: PriorityLevel[] = ['Low', 'Medium', 'High', 'Urgent'];

const DOMAIN_PROJECT_PREFIXES: Record<DomainName, string[]> = {
  'Healthcare and Medical Software': [
    'EHR Interop Bridge',
    'MedTriage Portal',
    'Clinical Lab Sync',
    'TeleHealth CareHub',
    'Patient Intake Engine',
  ],
  'Banking and FinTech': [
    'Instant Settlement Rail',
    'Ledger Audit Engine',
    'Fraud Shield Gateway',
    'OpenBank API Vault',
    'Treasury FX Suite',
  ],
  'E-commerce and Retail': [
    'OmniCart Checkout',
    'Warehouse Inventory Sync',
    'Order Fulfillment Core',
    'Catalog Search Engine',
    'Promo Pricing Service',
  ],
  'Enterprise and Business Software': [
    'MultiTenant RBAC Core',
    'Procurement Workflow',
    'HRIS Payroll Sync',
    'Executive BI Warehouse',
    'Contract Approval Suite',
  ],
};

function addDaysISO(startDate: Date, days: number): string {
  const d = new Date(startDate.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

export function generateSyntheticDataset(count = 420, seed = 42): ProjectRecord[] {
  const rng = createRng(seed);
  const records: ProjectRecord[] = [];
  const baseDate = new Date('2024-01-10T00:00:00Z');

  for (let i = 0; i < count; i++) {
    const domain = DOMAINS[i % DOMAINS.length];
    let methodology: MethodologyName;
    const mPick = rng();
    if (domain === 'Healthcare and Medical Software') {
      methodology = mPick < 0.38 ? 'V-Model' : mPick < 0.62 ? 'Spiral' : METHODOLOGIES[Math.floor(rng() * 5)];
    } else if (domain === 'Banking and FinTech') {
      methodology = mPick < 0.34 ? 'Spiral' : mPick < 0.60 ? 'V-Model' : METHODOLOGIES[Math.floor(rng() * 5)];
    } else if (domain === 'E-commerce and Retail') {
      methodology = mPick < 0.56 ? 'Agile (Scrum)' : METHODOLOGIES[Math.floor(rng() * 5)];
    } else {
      methodology = mPick < 0.35 ? 'Agile (Scrum)' : mPick < 0.60 ? 'Iterative and Incremental' : METHODOLOGIES[Math.floor(rng() * 5)];
    }

    const compRoll = rng();
    const complexity: ComplexityLevel =
      compRoll < 0.18 ? 'Low' : compRoll < 0.52 ? 'Medium' : compRoll < 0.84 ? 'High' : 'Critical';
    const compNum = complexity === 'Low' ? 1 : complexity === 'Medium' ? 2 : complexity === 'High' ? 3 : 4;

    const prioRoll = rng();
    const priority: PriorityLevel =
      prioRoll < 0.16 ? 'Low' : prioRoll < 0.50 ? 'Medium' : prioRoll < 0.82 ? 'High' : 'Urgent';

    const plannedDuration = Math.round(
      clamp(55 + compNum * 32 + randNormal(rng, 0, 22), 35, 320)
    );
    const startOffset = Math.floor(rng() * 620);
    const startDate = new Date(baseDate.getTime() + startOffset * 86400000);
    const plannedStartStr = startDate.toISOString().slice(0, 10);
    const plannedEndStr = addDaysISO(startDate, plannedDuration);

    const teamSize = Math.round(clamp(4 + compNum * 3 + randNormal(rng, 0, 2.8), 3, 30));
    const modules = Math.round(clamp(4 + compNum * 3.2 + randNormal(rng, 0, 2.1), 3, 24));
    const numTasks = Math.round(clamp(55 + modules * 14 + randNormal(rng, 0, 25), 40, 420));

    // Underlying latent execution discipline creates realistic feature correlations
    const discipline = clamp(0.64 + randNormal(rng, 0, 0.24), 0.1, 1.0);

    const completionPct = Number(clamp(32 + discipline * 60 + randNormal(rng, 0, 11), 18, 99).toFixed(1));
    const tasksCompleted = Math.round((numTasks * completionPct) / 100);
    const tasksPending = Math.max(0, numTasks - tasksCompleted);
    const actualProgress = Number(clamp(completionPct + randNormal(rng, -2.5, 4.5), 10, 100).toFixed(1));

    const numDeps = Math.round(clamp(2 + compNum * 3.6 + randNormal(rng, 0, 2.5), 1, 28));
    const externalDeps = Math.round(clamp(numDeps * (0.25 + rng() * 0.25), 0, numDeps));
    const depDelay = Math.round(clamp((1 - discipline) * 18 + externalDeps * 1.1 + randNormal(rng, 0, 3.5), 0, 45));

    const devExp = Number(clamp(2.2 + discipline * 5.6 + randNormal(rng, 0, 1.3), 1.0, 12.0).toFixed(1));
    const teamExp = Number(clamp(devExp + randNormal(rng, 0.2, 0.7), 1.0, 12.0).toFixed(1));
    const teamProductivity = Number(clamp(42 + discipline * 48 + randNormal(rng, 0, 7.5), 25, 98).toFixed(1));
    const teamTurnover = Number(clamp((1 - discipline) * 20 + randNormal(rng, 2, 3.5), 0, 35).toFixed(1));
    const commEfficiency = Number(clamp(45 + discipline * 45 + randNormal(rng, 0, 7), 30, 99).toFixed(1));
    const resourceAvail = Number(clamp(48 + discipline * 44 + randNormal(rng, 0, 8), 35, 100).toFixed(1));

    const codeComplexity = Number(clamp(2.5 + compNum * 1.6 + randNormal(rng, 0, 0.9), 1.5, 10.0).toFixed(1));
    const bugsReported = Math.round(
      clamp(8 + compNum * 9 + (1 - discipline) * 28 + randNormal(rng, 0, 7), 2, 95)
    );
    const criticalBugs = Math.round(
      clamp(bugsReported * (0.06 + (1 - discipline) * 0.18) + randNormal(rng, 0, 1.2), 0, Math.max(1, Math.floor(bugsReported * 0.45)))
    );
    const bugsResolved = Math.round(clamp(bugsReported * clamp(0.45 + discipline * 0.48, 0.25, 0.98), 0, bugsReported));
    const defectDensity = Number(((bugsReported / Math.max(1, modules)) * 1.1).toFixed(2));
    const reworkHours = Math.round(clamp(20 + bugsReported * 2.1 + (1 - discipline) * 110 + randNormal(rng, 0, 22), 8, 420));
    const testingCompletion = Number(clamp(28 + discipline * 64 + randNormal(rng, 0, 10), 15, 100).toFixed(1));
    const integrationIssues = Math.round(clamp((1 - discipline) * 10 + externalDeps * 0.5 + randNormal(rng, 0, 2), 0, 24));

    const reqChanges = Math.round(
      clamp(
        (methodology === 'Waterfall' ? 2 : 0) +
          (1 - discipline) * 14 +
          randNormal(rng, 2, 2.8),
        0,
        28
      )
    );
    const scopeCreep = Number(clamp(reqChanges * 1.5 + (1 - discipline) * 12 + randNormal(rng, 0, 3.5), 0, 48).toFixed(1));

    // Methodology metrics
    const sprintDuration = methodology === 'Agile (Scrum)' ? (rng() < 0.7 ? 14 : 21) : 14;
    const sprintVelocity = Math.round(clamp(18 + teamSize * 1.9 + discipline * 16 + randNormal(rng, 0, 4), 10, 85));
    const sprintCompletionRate = Number(clamp(46 + discipline * 48 + randNormal(rng, 0, 7), 25, 100).toFixed(1));
    const sprintSpillover = Number(clamp(100 - sprintCompletionRate + randNormal(rng, 0, 3), 0, 65).toFixed(1));
    const milestoneCompletionRate = Number(clamp(completionPct * 0.7 + testingCompletion * 0.3, 15, 100).toFixed(1));
    const iterationCount = Math.round(clamp(plannedDuration / (methodology === 'Waterfall' ? 45 : 18), 2, 18));
    const phaseCompletion = Number(clamp(completionPct * 0.65 + testingCompletion * 0.35, 15, 100).toFixed(1));
    const riskMitigationStatus = Number(clamp(35 + discipline * 58 + randNormal(rng, 0, 8), 15, 100).toFixed(1));
    const testCaseCompletion = Number(clamp(testingCompletion * 0.85 + discipline * 12 + randNormal(rng, 0, 5), 15, 100).toFixed(1));
    const feedbackCycles = Math.round(clamp(2 + iterationCount * 0.7 + randNormal(rng, 0, 1.5), 1, 16));

    const budget = Math.round(plannedDuration * teamSize * 210 * (0.9 + compNum * 0.08));

    let domainFriction = 0;
    if (domain === 'Healthcare and Medical Software') domainFriction += 4;
    if (domain === 'Banking and FinTech') domainFriction += 3;
    if (domain === 'Enterprise and Business Software') domainFriction += 1.5;

    let methInteraction = 0;
    if (methodology === 'Waterfall' && reqChanges > 9) methInteraction += (reqChanges - 7) * 2.1;
    if (methodology === 'Agile (Scrum)' && sprintSpillover > 24) methInteraction += (sprintSpillover - 20) * 0.75;
    if (methodology === 'Spiral' && riskMitigationStatus < 60) methInteraction += (60 - riskMitigationStatus) * 0.35;
    if (methodology === 'V-Model' && testCaseCompletion < 60) methInteraction += (60 - testCaseCompletion) * 0.4;
    if (methodology === 'Iterative and Incremental' && integrationIssues > 6) methInteraction += (integrationIssues - 5) * 2.4;

    const rawDelay =
      -28.5 +
      depDelay * 1.15 +
      criticalBugs * 1.95 +
      reqChanges * 1.2 +
      (100 - completionPct) * 0.32 +
      (100 - testingCompletion) * 0.28 +
      reworkHours * 0.055 +
      (100 - teamProductivity) * 0.25 +
      (100 - resourceAvail) * 0.22 +
      teamTurnover * 0.45 +
      compNum * 2.4 -
      devExp * 1.15 +
      domainFriction +
      methInteraction +
      randNormal(rng, 0, 4.2);

    const delayDays = Math.round(clamp(rawDelay, -18, Math.round(plannedDuration * 0.85)));
    const actualDuration = Math.max(20, plannedDuration + delayDays);
    const isDelayed = delayDays > 0 ? 1 : 0;
    const projectStatus = isDelayed === 1 ? 'Delayed' : 'On Time';

    const techRisk = Number(
      clamp(
        codeComplexity * 5.2 +
          criticalBugs * 3.1 +
          integrationIssues * 2.4 +
          (100 - testingCompletion) * 0.24,
        5,
        98
      ).toFixed(1)
    );
    const projRisk = Number(
      clamp(
        techRisk * 0.42 +
          depDelay * 1.45 +
          scopeCreep * 0.85 +
          (100 - resourceAvail) * 0.32,
        5,
        99
      ).toFixed(1)
    );

    const prefixes = DOMAIN_PROJECT_PREFIXES[domain];
    const projectName = `${prefixes[i % prefixes.length]} #${String(i + 1).padStart(3, '0')}`;

    records.push({
      Project_ID: `PRJ-${String(1001 + i)}`,
      Project_Name: projectName,
      Domain: domain,
      Software_Development_Methodology: methodology,
      Project_Complexity: complexity,
      Project_Priority: priority,
      Planned_Duration_Days: plannedDuration,
      Planned_Start_Date: plannedStartStr,
      Planned_Completion_Date: plannedEndStr,
      Team_Size: teamSize,
      Budget: budget,
      Number_of_Modules: modules,
      Number_of_Tasks: numTasks,
      Tasks_Completed: tasksCompleted,
      Tasks_Pending: tasksPending,
      Completion_Percentage: completionPct,
      Actual_Progress: actualProgress,
      Sprint_Completion_Rate: sprintCompletionRate,
      Milestone_Completion_Rate: milestoneCompletionRate,
      Number_of_Dependencies: numDeps,
      External_Dependencies: externalDeps,
      Dependency_Delay: depDelay,
      Bugs_Reported: bugsReported,
      Critical_Bugs: criticalBugs,
      Bugs_Resolved: bugsResolved,
      Defect_Density: defectDensity,
      Code_Complexity: codeComplexity,
      Rework_Hours: reworkHours,
      Testing_Completion_Percentage: testingCompletion,
      Integration_Issues: integrationIssues,
      Developer_Experience: devExp,
      Team_Experience: teamExp,
      Team_Productivity: teamProductivity,
      Team_Turnover: teamTurnover,
      Communication_Efficiency: commEfficiency,
      Resource_Availability: resourceAvail,
      Requirement_Changes: reqChanges,
      Scope_Creep: scopeCreep,
      Technical_Risk_Score: techRisk,
      Project_Risk_Score: projRisk,
      Sprint_Duration: sprintDuration,
      Sprint_Velocity: sprintVelocity,
      Sprint_Spillover: sprintSpillover,
      Iteration_Count: iterationCount,
      Phase_Completion: phaseCompletion,
      Risk_Mitigation_Status: riskMitigationStatus,
      Test_Case_Completion: testCaseCompletion,
      Feedback_Cycles: feedbackCycles,
      Actual_Duration_Days: actualDuration,
      Delay_Days: delayDays,
      Project_Status: projectStatus,
      Is_Delayed: isDelayed,
    });
  }

  return records;
}

export function recordsToCsv(records: ProjectRecord[]): string {
  if (records.length === 0) return '';
  const headers = Object.keys(records[0]) as Array<keyof ProjectRecord>;
  const escape = (val: unknown) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(',')];
  for (const r of records) {
    lines.push(headers.map((h) => escape(r[h])).join(','));
  }
  return lines.join('\n');
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseUploadedCsv(csvText: string): {
  records: ProjectRecord[];
  missingCellsCount: number;
  duplicatesRemoved: number;
  warnings: string[];
} {
  const rawLines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (rawLines.length < 2) {
    throw new Error('CSV must contain a header row and at least 1 data row.');
  }
  const headers = parseCsvLine(rawLines[0]);
  const warnings: string[] = [];
  let missingCellsCount = 0;
  let duplicatesRemoved = 0;
  const seenIds = new Set<string>();
  const parsed: ProjectRecord[] = [];

  const toNum = (val: string | undefined, fallback: number): number => {
    if (val === undefined || val === '' || val.toLowerCase() === 'na' || val.toLowerCase() === 'null') {
      missingCellsCount++;
      return fallback;
    }
    const n = Number(val);
    if (Number.isNaN(n)) {
      missingCellsCount++;
      return fallback;
    }
    return n;
  };

  for (let idx = 1; idx < rawLines.length; idx++) {
    const cols = parseCsvLine(rawLines[idx]);
    const rowObj: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      rowObj[h] = cols[colIdx] ?? '';
    });

    const projectId = rowObj['Project_ID'] || `UPL-${1000 + idx}`;
    if (seenIds.has(projectId)) {
      duplicatesRemoved++;
      continue;
    }
    seenIds.add(projectId);

    const plannedDuration = Math.max(10, toNum(rowObj['Planned_Duration_Days'], 120));
    const actualDurationRaw = rowObj['Actual_Duration_Days'];
    const delayRaw = rowObj['Delay_Days'];
    let actualDuration = plannedDuration;
    let delayDays = 0;

    if (actualDurationRaw !== undefined && actualDurationRaw !== '' && !Number.isNaN(Number(actualDurationRaw))) {
      actualDuration = Math.max(5, Number(actualDurationRaw));
      delayDays = actualDuration - plannedDuration;
    } else if (delayRaw !== undefined && delayRaw !== '' && !Number.isNaN(Number(delayRaw))) {
      delayDays = Number(delayRaw);
      actualDuration = Math.max(5, plannedDuration + delayDays);
    } else {
      missingCellsCount++;
    }

    const isDelayed = delayDays > 0 ? 1 : 0;
    const domain = DOMAINS.includes(rowObj['Domain'] as DomainName)
      ? (rowObj['Domain'] as DomainName)
      : 'Enterprise and Business Software';
    const methodology = METHODOLOGIES.includes(rowObj['Software_Development_Methodology'] as MethodologyName)
      ? (rowObj['Software_Development_Methodology'] as MethodologyName)
      : 'Agile (Scrum)';
    const complexity = COMPLEXITIES.includes(rowObj['Project_Complexity'] as ComplexityLevel)
      ? (rowObj['Project_Complexity'] as ComplexityLevel)
      : 'Medium';
    const priority = PRIORITIES.includes(rowObj['Project_Priority'] as PriorityLevel)
      ? (rowObj['Project_Priority'] as PriorityLevel)
      : 'Medium';

    const numTasks = Math.max(1, toNum(rowObj['Number_of_Tasks'], 120));
    const completionPct = clamp(toNum(rowObj['Completion_Percentage'], 70), 0, 100);
    const tasksCompleted = toNum(rowObj['Tasks_Completed'], Math.round((numTasks * completionPct) / 100));
    const tasksPending = toNum(rowObj['Tasks_Pending'], Math.max(0, numTasks - tasksCompleted));
    const bugsReported = toNum(rowObj['Bugs_Reported'], 20);
    const modules = Math.max(1, toNum(rowObj['Number_of_Modules'], 8));
    const testingPct = clamp(toNum(rowObj['Testing_Completion_Percentage'], 65), 0, 100);
    const codeComp = clamp(toNum(rowObj['Code_Complexity'], 6.0), 1, 10);
    const criticalBugs = toNum(rowObj['Critical_Bugs'], 2);
    const integrationIssues = toNum(rowObj['Integration_Issues'], 3);
    const depDelay = toNum(rowObj['Dependency_Delay'], 5);
    const scopeCreep = toNum(rowObj['Scope_Creep'], 10);
    const resourceAvail = clamp(toNum(rowObj['Resource_Availability'], 80), 1, 100);

    const techRisk = toNum(
      rowObj['Technical_Risk_Score'],
      Number((codeComp * 5 + criticalBugs * 3 + integrationIssues * 2.5 + (100 - testingPct) * 0.22).toFixed(1))
    );
    const projRisk = toNum(
      rowObj['Project_Risk_Score'],
      Number((techRisk * 0.42 + depDelay * 1.4 + scopeCreep * 0.8 + (100 - resourceAvail) * 0.3).toFixed(1))
    );

    parsed.push({
      Project_ID: projectId,
      Project_Name: rowObj['Project_Name'] || `Uploaded Project ${idx}`,
      Domain: domain,
      Software_Development_Methodology: methodology,
      Project_Complexity: complexity,
      Project_Priority: priority,
      Planned_Duration_Days: plannedDuration,
      Planned_Start_Date: rowObj['Planned_Start_Date'] || '2025-01-01',
      Planned_Completion_Date: rowObj['Planned_Completion_Date'] || '2025-05-01',
      Team_Size: Math.max(1, toNum(rowObj['Team_Size'], 10)),
      Budget: toNum(rowObj['Budget'], 250000),
      Number_of_Modules: modules,
      Number_of_Tasks: numTasks,
      Tasks_Completed: tasksCompleted,
      Tasks_Pending: tasksPending,
      Completion_Percentage: completionPct,
      Actual_Progress: clamp(toNum(rowObj['Actual_Progress'], completionPct), 0, 100),
      Sprint_Completion_Rate: clamp(toNum(rowObj['Sprint_Completion_Rate'], 75), 0, 100),
      Milestone_Completion_Rate: clamp(toNum(rowObj['Milestone_Completion_Rate'], completionPct), 0, 100),
      Number_of_Dependencies: toNum(rowObj['Number_of_Dependencies'], 8),
      External_Dependencies: toNum(rowObj['External_Dependencies'], 3),
      Dependency_Delay: depDelay,
      Bugs_Reported: bugsReported,
      Critical_Bugs: criticalBugs,
      Bugs_Resolved: toNum(rowObj['Bugs_Resolved'], Math.round(bugsReported * 0.7)),
      Defect_Density: toNum(rowObj['Defect_Density'], Number((bugsReported / modules).toFixed(2))),
      Code_Complexity: codeComp,
      Rework_Hours: toNum(rowObj['Rework_Hours'], 80),
      Testing_Completion_Percentage: testingPct,
      Integration_Issues: integrationIssues,
      Developer_Experience: toNum(rowObj['Developer_Experience'], 5.5),
      Team_Experience: toNum(rowObj['Team_Experience'], 5.8),
      Team_Productivity: clamp(toNum(rowObj['Team_Productivity'], 75), 1, 100),
      Team_Turnover: clamp(toNum(rowObj['Team_Turnover'], 7), 0, 100),
      Communication_Efficiency: clamp(toNum(rowObj['Communication_Efficiency'], 78), 1, 100),
      Resource_Availability: resourceAvail,
      Requirement_Changes: toNum(rowObj['Requirement_Changes'], 6),
      Scope_Creep: scopeCreep,
      Technical_Risk_Score: techRisk,
      Project_Risk_Score: projRisk,
      Sprint_Duration: toNum(rowObj['Sprint_Duration'], 14),
      Sprint_Velocity: toNum(rowObj['Sprint_Velocity'], 35),
      Sprint_Spillover: toNum(rowObj['Sprint_Spillover'], 15),
      Iteration_Count: toNum(rowObj['Iteration_Count'], 6),
      Phase_Completion: clamp(toNum(rowObj['Phase_Completion'], completionPct), 0, 100),
      Risk_Mitigation_Status: clamp(toNum(rowObj['Risk_Mitigation_Status'], 70), 0, 100),
      Test_Case_Completion: clamp(toNum(rowObj['Test_Case_Completion'], testingPct), 0, 100),
      Feedback_Cycles: toNum(rowObj['Feedback_Cycles'], 5),
      Actual_Duration_Days: actualDuration,
      Delay_Days: delayDays,
      Project_Status: isDelayed ? 'Delayed' : 'On Time',
      Is_Delayed: isDelayed,
    });
  }

  if (parsed.length < 30) {
    warnings.push(
      `Uploaded dataset has only ${parsed.length} rows. Statistical stability and cross-validation accuracy improve with 60+ records.`
    );
  }
  if (missingCellsCount > 0) {
    warnings.push(`${missingCellsCount} missing cells were detected and marked for train-fitted imputation.`);
  }
  if (duplicatesRemoved > 0) {
    warnings.push(`${duplicatesRemoved} duplicate Project_ID rows were removed during ingestion.`);
  }

  return { records: parsed, missingCellsCount, duplicatesRemoved, warnings };
}
