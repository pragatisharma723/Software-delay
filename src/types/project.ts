export type DomainName =
  | 'Healthcare and Medical Software'
  | 'Banking and FinTech'
  | 'E-commerce and Retail'
  | 'Enterprise and Business Software';

export type MethodologyName =
  | 'Waterfall'
  | 'Agile (Scrum)'
  | 'Spiral'
  | 'V-Model'
  | 'Iterative and Incremental';

export type ComplexityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent';
export type ProjectStatusType = 'On Time' | 'Delayed';
export type RiskCategory = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface ProjectRecord {
  Project_ID: string;
  Project_Name: string;
  Domain: DomainName;
  Software_Development_Methodology: MethodologyName;
  Project_Complexity: ComplexityLevel;
  Project_Priority: PriorityLevel;
  Planned_Duration_Days: number;
  Planned_Start_Date: string;
  Planned_Completion_Date: string;
  Team_Size: number;
  Budget: number;
  Number_of_Modules: number;
  Number_of_Tasks: number;
  Tasks_Completed: number;
  Tasks_Pending: number;
  Completion_Percentage: number;
  Actual_Progress: number;
  Sprint_Completion_Rate: number;
  Milestone_Completion_Rate: number;
  Number_of_Dependencies: number;
  External_Dependencies: number;
  Dependency_Delay: number;
  Bugs_Reported: number;
  Critical_Bugs: number;
  Bugs_Resolved: number;
  Defect_Density: number;
  Code_Complexity: number;
  Rework_Hours: number;
  Testing_Completion_Percentage: number;
  Integration_Issues: number;
  Developer_Experience: number;
  Team_Experience: number;
  Team_Productivity: number;
  Team_Turnover: number;
  Communication_Efficiency: number;
  Resource_Availability: number;
  Requirement_Changes: number;
  Scope_Creep: number;
  Technical_Risk_Score: number;
  Project_Risk_Score: number;
  Sprint_Duration: number;
  Sprint_Velocity: number;
  Sprint_Spillover: number;
  Iteration_Count: number;
  Phase_Completion: number;
  Risk_Mitigation_Status: number;
  Test_Case_Completion: number;
  Feedback_Cycles: number;
  Actual_Duration_Days: number;
  Delay_Days: number;
  Project_Status: ProjectStatusType;
  Is_Delayed: number; // 0 or 1
}

export interface DatasetMeta {
  id: number;
  name: string;
  source_type: 'synthetic' | 'uploaded';
  description: string;
  row_count: number;
  feature_count: number;
  missing_count: number;
  duplicate_count: number;
  outlier_count: number;
  on_time_count: number;
  delayed_count: number;
  uploaded_at: string;
  is_active: boolean;
}

export interface DataQualitySummary {
  totalRows: number;
  featureCount: number;
  missingValuesDetected: number;
  missingValuesImputed: number;
  duplicatesRemoved: number;
  outliersDetectedIQR: number;
  classBalance: {
    onTime: number;
    delayed: number;
    delayedRatio: number;
  };
  numericSummary: Array<{
    feature: string;
    mean: number;
    std: number;
    min: number;
    max: number;
    median: number;
  }>;
}

export interface RegressionModelMetrics {
  id: 'simple_linear' | 'multiple_linear';
  name: string;
  featureUsed: string;
  features: string[];
  r2: number;
  mae: number;
  mse: number;
  rmse: number;
  trainTimeMs: number;
  predictTimeMs: number;
  intercept: number;
  coefficients: Array<{ feature: string; weight: number; standardizedWeight: number }>;
  equationText: string;
  actualVsPredicted: Array<{
    projectId: string;
    projectName: string;
    actual: number;
    predicted: number;
    planned: number;
  }>;
}

export interface ConfusionMatrixCounts {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface DecisionTreeNode {
  id: number;
  isLeaf: boolean;
  feature?: string;
  threshold?: number;
  gini: number;
  samples: number;
  valueCounts: [number, number];
  predictedClass: number;
  delayProbability: number;
  left?: DecisionTreeNode;
  right?: DecisionTreeNode;
}

export interface DecisionRule {
  conditions: string[];
  outcome: 'Delayed' | 'On Time';
  confidence: number;
  supportCount: number;
}

export interface ClassificationModelMetrics {
  id:
    | 'logistic_regression'
    | 'naive_bayes'
    | 'decision_tree'
    | 'svm'
    | 'knn'
    | 'random_forest'
    | 'gradient_boosting';
  name: string;
  family: 'Linear' | 'Probabilistic' | 'Tree' | 'Margin' | 'Instance' | 'Ensemble';
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  cvAccuracyMean: number;
  trainTimeMs: number;
  predictTimeMs: number;
  confusionMatrix: ConfusionMatrixCounts;
  featureImportance?: Array<{ feature: string; importance: number }>;
  extra?: {
    svmKernels?: Array<{
      kernel: 'Linear' | 'RBF';
      accuracy: number;
      precision: number;
      recall: number;
      f1: number;
      rocAuc: number;
      trainTimeMs: number;
    }>;
    knnKSweep?: Array<{
      k: number;
      accuracy: number;
      f1: number;
    }>;
    selectedK?: number;
    decisionTreeRoot?: DecisionTreeNode;
    decisionRules?: DecisionRule[];
  };
}

export interface KMeansClusterSummary {
  clusterId: number;
  label: string;
  size: number;
  delayRate: number;
  avgDelayDays: number;
  avgCompletion: number;
  avgBugs: number;
  avgDependencies: number;
  avgProductivity: number;
  avgComplexity: number;
  avgTesting: number;
  avgRequirementChanges: number;
  avgReworkHours: number;
  centroid: Record<string, number>;
}

export interface KMeansResult {
  k: number;
  silhouetteScore: number;
  inertia: number;
  elbowCurve: Array<{ k: number; inertia: number; silhouette: number }>;
  explainedVarianceRatio: [number, number];
  clusters: KMeansClusterSummary[];
  points2D: Array<{
    projectId: string;
    projectName: string;
    domain: DomainName;
    methodology: MethodologyName;
    clusterId: number;
    clusterLabel: string;
    pc1: number;
    pc2: number;
    isDelayed: number;
    delayDays: number;
  }>;
}

export interface DendrogramMerge {
  step: number;
  leftId: number;
  rightId: number;
  newClusterId: number;
  distance: number;
  size: number;
}

export interface HierarchicalResult {
  linkage: 'ward' | 'complete' | 'average';
  k: number;
  silhouetteScore: number;
  sampleSize: number;
  leafOrder: number[];
  leaves: Array<{
    leafIndex: number;
    projectId: string;
    projectName: string;
    domain: DomainName;
    methodology: MethodologyName;
    isDelayed: number;
    clusterId: number;
  }>;
  merges: DendrogramMerge[];
  clusters: Array<{
    clusterId: number;
    label: string;
    size: number;
    delayRate: number;
    avgDelayDays: number;
    dominantDomain: string;
    dominantMethodology: string;
  }>;
}

export interface ModelLabSnapshot {
  datasetId: number;
  datasetName: string;
  sourceType: 'synthetic' | 'uploaded';
  trainSize: number;
  testSize: number;
  trainedAt: string;
  dataQuality: DataQualitySummary;
  regressions: RegressionModelMetrics[];
  bestRegressorId: 'simple_linear' | 'multiple_linear';
  classifiers: ClassificationModelMetrics[];
  bestClassifierId: ClassificationModelMetrics['id'];
  bestSelectionReason: string;
  kmeans: KMeansResult;
  hierarchical: HierarchicalResult;
}

export interface ProjectPredictionInput {
  Project_Name: string;
  Domain: DomainName;
  Software_Development_Methodology: MethodologyName;
  Project_Complexity: ComplexityLevel;
  Project_Priority: PriorityLevel;
  Planned_Duration_Days: number;
  Team_Size: number;
  Budget: number;
  Number_of_Modules: number;
  Number_of_Tasks: number;
  Tasks_Completed: number;
  Tasks_Pending: number;
  Number_of_Dependencies: number;
  External_Dependencies: number;
  Dependency_Delay: number;
  Bugs_Reported: number;
  Critical_Bugs: number;
  Bugs_Resolved: number;
  Code_Complexity: number;
  Rework_Hours: number;
  Testing_Completion_Percentage: number;
  Integration_Issues: number;
  Developer_Experience: number;
  Team_Productivity: number;
  Team_Turnover: number;
  Communication_Efficiency: number;
  Resource_Availability: number;
  Requirement_Changes: number;
  Scope_Creep: number;
  // Methodology-specific
  Sprint_Duration: number;
  Sprint_Velocity: number;
  Sprint_Completion_Rate: number;
  Sprint_Spillover: number;
  Phase_Completion: number;
  Iteration_Count: number;
  Risk_Mitigation_Status: number;
  Test_Case_Completion: number;
  Feedback_Cycles: number;
  // Selected models & hyperparameters
  selectedModels: string[];
  simpleRegressionFeature?: string;
  knnK?: number;
  svmKernel?: 'Linear' | 'RBF';
}

export interface KnnSimilarProject {
  Project_ID: string;
  Project_Name: string;
  Domain: DomainName;
  Software_Development_Methodology: MethodologyName;
  Planned_Duration_Days: number;
  Actual_Duration_Days: number;
  Delay_Days: number;
  Project_Status: ProjectStatusType;
  distance: number;
  similarityPct: number;
  matchingReasons: string[];
}

export interface PredictionReport {
  id: number;
  createdAt: string;
  input: ProjectPredictionInput;
  regressionPredictions: Array<{
    modelId: string;
    modelName: string;
    predictedDurationDays: number;
    expectedDelayDays: number;
    r2: number;
    rmse: number;
  }>;
  classificationPredictions: Array<{
    modelId: string;
    modelName: string;
    predictedStatus: ProjectStatusType;
    delayProbability: number;
    onTimeProbability: number;
    f1: number;
    rocAuc: number;
  }>;
  primaryPrediction: {
    bestClassifierName: string;
    bestRegressorName: string;
    estimatedDurationDays: number;
    plannedDurationDays: number;
    expectedDelayDays: number;
    predictedStatus: ProjectStatusType;
    delayProbability: number;
    onTimeProbability: number;
    riskCategory: RiskCategory;
  };
  decisionTreePath: string[];
  topRiskFactors: Array<{
    factor: string;
    impactScore: number;
    observedValue: string;
    direction: 'Increases Risk' | 'Mitigates Risk';
  }>;
}
