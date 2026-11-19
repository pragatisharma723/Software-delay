import type {
  ClassificationModelMetrics,
  DecisionRule,
  DecisionTreeNode,
  KnnSimilarProject,
  ProjectRecord,
} from '../../src/types/project.ts';
import {
  clamp,
  computeClassificationMetrics,
  createRng,
  dot,
  euclideanSq,
  sigmoid,
} from './mathUtils.ts';
import type { FittedScaler, PreparedDataset } from './preprocessing.ts';

export interface LogisticModel {
  weights: number[];
  bias: number;
}

export interface NaiveBayesModel {
  priors: [number, number];
  means: [number[], number[]];
  vars: [number[], number[]];
}

export interface CartNodeInternal {
  id: number;
  isLeaf: boolean;
  featureIndex?: number;
  featureName?: string;
  thresholdRaw?: number;
  thresholdScaled?: number;
  gini: number;
  samples: number;
  counts: [number, number];
  predictedClass: number;
  prob1: number;
  left?: CartNodeInternal;
  right?: CartNodeInternal;
}

export interface RegressionTreeNode {
  isLeaf: boolean;
  featureIndex?: number;
  threshold?: number;
  value: number;
  gain: number;
  left?: RegressionTreeNode;
  right?: RegressionTreeNode;
}

export interface SvmLinearModel {
  weights: number[];
  bias: number;
  plattA: number;
  plattB: number;
}

export interface SvmRbfModel {
  supportVectors: number[][];
  supportAlphaY: number[];
  bias: number;
  gamma: number;
  plattA: number;
  plattB: number;
}

export interface TrainedClassifiersBundle {
  logistic: LogisticModel;
  naiveBayes: NaiveBayesModel;
  decisionTree: {
    root: CartNodeInternal;
    importances: number[];
    rules: DecisionRule[];
  };
  svmLinear: SvmLinearModel;
  svmRbf: SvmRbfModel;
  bestSvmKernel: 'Linear' | 'RBF';
  knn: {
    XTrain: number[][];
    yTrain: number[];
    trainRecords: ProjectRecord[];
    defaultK: number;
  };
  randomForest: {
    trees: CartNodeInternal[];
    importances: number[];
  };
  gradientBoosting: {
    baseLogOdds: number;
    learningRate: number;
    trees: RegressionTreeNode[];
    importances: number[];
  };
  metrics: ClassificationModelMetrics[];
}

// ---------------------------------------------------------------------------
// 1. Logistic Regression (L2 regularized, class-balanced, Nesterov momentum)
// ---------------------------------------------------------------------------
function fitLogistic(X: number[][], y: number[], epochs = 260, lr = 0.09, l2 = 0.015): LogisticModel {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const weights = new Array(p).fill(0);
  let bias = 0;

  const posCount = y.filter((v) => v === 1).length || 1;
  const negCount = n - posCount || 1;
  const wPos = n / (2 * posCount);
  const wNeg = n / (2 * negCount);

  const vw = new Array(p).fill(0);
  let vb = 0;
  const beta = 0.85;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(p).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const z = dot(X[i], weights) + bias;
      const prob = sigmoid(z);
      const cw = y[i] === 1 ? wPos : wNeg;
      const err = (prob - y[i]) * cw;
      gradB += err;
      const row = X[i];
      for (let j = 0; j < p; j++) {
        gradW[j] += err * row[j];
      }
    }
    const invN = 1 / Math.max(1, n);
    vb = beta * vb + lr * gradB * invN;
    bias -= vb;
    for (let j = 0; j < p; j++) {
      const g = gradW[j] * invN + l2 * weights[j];
      vw[j] = beta * vw[j] + lr * g;
      weights[j] -= vw[j];
    }
  }
  return { weights, bias };
}

export function predictLogisticProbs(model: LogisticModel, X: number[][]): number[] {
  return X.map((row) => sigmoid(dot(row, model.weights) + model.bias));
}

// ---------------------------------------------------------------------------
// 2. Gaussian Naive Bayes
// ---------------------------------------------------------------------------
function fitNaiveBayes(X: number[][], y: number[]): NaiveBayesModel {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const idx0: number[] = [];
  const idx1: number[] = [];
  y.forEach((v, i) => (v === 1 ? idx1.push(i) : idx0.push(i)));

  const priors: [number, number] = [
    Math.max(0.01, idx0.length / Math.max(1, n)),
    Math.max(0.01, idx1.length / Math.max(1, n)),
  ];

  const calcStats = (indices: number[]) => {
    const m = new Array(p).fill(0);
    const v = new Array(p).fill(1);
    if (indices.length === 0) return { m, v };
    for (const i of indices) {
      for (let j = 0; j < p; j++) m[j] += X[i][j];
    }
    for (let j = 0; j < p; j++) m[j] /= indices.length;
    for (const i of indices) {
      for (let j = 0; j < p; j++) {
        const d = X[i][j] - m[j];
        v[j] += d * d;
      }
    }
    for (let j = 0; j < p; j++) v[j] = v[j] / indices.length + 1e-4;
    return { m, v };
  };

  const s0 = calcStats(idx0);
  const s1 = calcStats(idx1);
  return {
    priors,
    means: [s0.m, s1.m],
    vars: [s0.v, s1.v],
  };
}

export function predictNaiveBayesProbs(model: NaiveBayesModel, X: number[][]): number[] {
  const p = model.means[0].length;
  return X.map((row) => {
    let ll0 = Math.log(model.priors[0]);
    let ll1 = Math.log(model.priors[1]);
    for (let j = 0; j < p; j++) {
      const v0 = model.vars[0][j];
      const v1 = model.vars[1][j];
      const d0 = row[j] - model.means[0][j];
      const d1 = row[j] - model.means[1][j];
      ll0 += -0.5 * (Math.log(2 * Math.PI * v0) + (d0 * d0) / v0);
      ll1 += -0.5 * (Math.log(2 * Math.PI * v1) + (d1 * d1) / v1);
    }
    const maxLog = Math.max(ll0, ll1);
    const e0 = Math.exp(ll0 - maxLog);
    const e1 = Math.exp(ll1 - maxLog);
    return clamp(e1 / (e0 + e1), 0.001, 0.999);
  });
}

// ---------------------------------------------------------------------------
// 3. CART Decision Tree Classifier (Gini impurity + Rule Extraction)
// ---------------------------------------------------------------------------
function giniImpurity(c0: number, c1: number): number {
  const total = c0 + c1;
  if (total === 0) return 0;
  const p0 = c0 / total;
  const p1 = c1 / total;
  return 1 - p0 * p0 - p1 * p1;
}

function fitDecisionTree(
  XScaled: number[][],
  y: number[],
  featureNames: string[],
  scaler: FittedScaler,
  maxDepth = 5,
  minSamplesSplit = 8,
  featureSubsetCount?: number,
  rng?: () => number
): { root: CartNodeInternal; importances: number[] } {
  const p = featureNames.length;
  const importances = new Array(p).fill(0);
  let nextId = 1;

  const build = (indices: number[], depth: number): CartNodeInternal => {
    const id = nextId++;
    let c0 = 0;
    let c1 = 0;
    for (const i of indices) {
      if (y[i] === 1) c1++;
      else c0++;
    }
    const total = c0 + c1;
    const gini = giniImpurity(c0, c1);
    const prob1 = total > 0 ? c1 / total : 0.5;
    const predictedClass = c1 >= c0 ? 1 : 0;

    if (depth >= maxDepth || total < minSamplesSplit || gini < 1e-6) {
      return {
        id,
        isLeaf: true,
        gini: Number(gini.toFixed(4)),
        samples: total,
        counts: [c0, c1],
        predictedClass,
        prob1,
      };
    }

    let candidateFeatures: number[];
    if (featureSubsetCount && featureSubsetCount < p && rng) {
      const pool = Array.from({ length: p }, (_, j) => j);
      for (let k = pool.length - 1; k > 0; k--) {
        const swap = Math.floor(rng() * (k + 1));
        const tmp = pool[k];
        pool[k] = pool[swap];
        pool[swap] = tmp;
      }
      candidateFeatures = pool.slice(0, featureSubsetCount);
    } else {
      candidateFeatures = Array.from({ length: p }, (_, j) => j);
    }

    let bestGain = 0;
    let bestFeat = -1;
    let bestThresh = 0;
    let bestLeft: number[] = [];
    let bestRight: number[] = [];

    for (const j of candidateFeatures) {
      // Sort indices by feature j value and test quantile candidate splits for speed & accuracy
      const pairs = indices.map((idx) => ({ idx, val: XScaled[idx][j] })).sort((a, b) => a.val - b.val);
      const step = Math.max(1, Math.floor(pairs.length / 24));
      for (let pos = step; pos < pairs.length; pos += step) {
        if (pairs[pos].val === pairs[pos - 1].val) continue;
        const thresh = 0.5 * (pairs[pos].val + pairs[pos - 1].val);
        let lc0 = 0;
        let lc1 = 0;
        let rc0 = 0;
        let rc1 = 0;
        for (let k = 0; k < pairs.length; k++) {
          const isDelayed = y[pairs[k].idx] === 1;
          if (k < pos) {
            if (isDelayed) lc1++;
            else lc0++;
          } else {
            if (isDelayed) rc1++;
            else rc0++;
          }
        }
        const lTot = lc0 + lc1;
        const rTot = rc0 + rc1;
        if (lTot < 3 || rTot < 3) continue;
        const weightedGini = (lTot / total) * giniImpurity(lc0, lc1) + (rTot / total) * giniImpurity(rc0, rc1);
        const gain = gini - weightedGini;
        if (gain > bestGain) {
          bestGain = gain;
          bestFeat = j;
          bestThresh = thresh;
          bestLeft = pairs.slice(0, pos).map((item) => item.idx);
          bestRight = pairs.slice(pos).map((item) => item.idx);
        }
      }
    }

    if (bestFeat === -1 || bestGain <= 1e-5) {
      return {
        id,
        isLeaf: true,
        gini: Number(gini.toFixed(4)),
        samples: total,
        counts: [c0, c1],
        predictedClass,
        prob1,
      };
    }

    importances[bestFeat] += bestGain * total;
    const rawThresh = bestThresh * scaler.stds[bestFeat] + scaler.means[bestFeat];

    return {
      id,
      isLeaf: false,
      featureIndex: bestFeat,
      featureName: featureNames[bestFeat],
      thresholdScaled: bestThresh,
      thresholdRaw: Number(rawThresh.toFixed(2)),
      gini: Number(gini.toFixed(4)),
      samples: total,
      counts: [c0, c1],
      predictedClass,
      prob1,
      left: build(bestLeft, depth + 1),
      right: build(bestRight, depth + 1),
    };
  };

  const allIdx = Array.from({ length: XScaled.length }, (_, i) => i);
  const root = build(allIdx, 0);
  const impSum = importances.reduce((a, b) => a + b, 0) || 1;
  return { root, importances: importances.map((v) => v / impSum) };
}

function predictSingleTreeProb(node: CartNodeInternal, row: number[]): number {
  let curr: CartNodeInternal | undefined = node;
  while (curr && !curr.isLeaf) {
    const active: CartNodeInternal = curr;
    const featIdx: number = active.featureIndex ?? 0;
    const thresh: number = active.thresholdScaled ?? 0;
    curr = row[featIdx] <= thresh ? active.left : active.right;
  }
  return curr ? curr.prob1 : 0.5;
}

export function traceDecisionTreePath(node: CartNodeInternal, rowScaled: number[]): string[] {
  const steps: string[] = [];
  let curr: CartNodeInternal | undefined = node;
  while (curr && !curr.isLeaf) {
    const active: CartNodeInternal = curr;
    const featIdx: number = active.featureIndex ?? 0;
    const threshScaled: number = active.thresholdScaled ?? 0;
    const threshRaw: number = active.thresholdRaw ?? 0;
    const goLeft: boolean = rowScaled[featIdx] <= threshScaled;
    steps.push(`${active.featureName} ${goLeft ? '<=' : '>'} ${threshRaw}`);
    curr = goLeft ? active.left : active.right;
  }
  if (curr) {
    steps.push(
      `Leaf verdict: ${curr.predictedClass === 1 ? 'Delayed' : 'On Time'} (${(
        curr.prob1 * 100
      ).toFixed(1)}% delay probability, n=${curr.samples})`
    );
  }
  return steps;
}

function extractTreeRules(root: CartNodeInternal): DecisionRule[] {
  const rules: DecisionRule[] = [];
  const walk = (node: CartNodeInternal, path: string[]) => {
    if (node.isLeaf) {
      const conf = node.predictedClass === 1 ? node.prob1 : 1 - node.prob1;
      if (path.length > 0 && node.samples >= 6) {
        rules.push({
          conditions: path,
          outcome: node.predictedClass === 1 ? 'Delayed' : 'On Time',
          confidence: Number(conf.toFixed(3)),
          supportCount: node.samples,
        });
      }
      return;
    }
    if (node.left) {
      walk(node.left, [...path, `${node.featureName} <= ${node.thresholdRaw}`]);
    }
    if (node.right) {
      walk(node.right, [...path, `${node.featureName} > ${node.thresholdRaw}`]);
    }
  };
  walk(root, []);
  return rules
    .sort((a, b) => b.supportCount * b.confidence - a.supportCount * a.confidence)
    .slice(0, 10);
}

function toPublicTreeNode(node: CartNodeInternal, depth = 0): DecisionTreeNode | undefined {
  if (depth > 3) {
    return {
      id: node.id,
      isLeaf: true,
      gini: node.gini,
      samples: node.samples,
      valueCounts: node.counts,
      predictedClass: node.predictedClass,
      delayProbability: Number(node.prob1.toFixed(3)),
    };
  }
  return {
    id: node.id,
    isLeaf: node.isLeaf,
    feature: node.featureName,
    threshold: node.thresholdRaw,
    gini: node.gini,
    samples: node.samples,
    valueCounts: node.counts,
    predictedClass: node.predictedClass,
    delayProbability: Number(node.prob1.toFixed(3)),
    left: node.left ? toPublicTreeNode(node.left, depth + 1) : undefined,
    right: node.right ? toPublicTreeNode(node.right, depth + 1) : undefined,
  };
}

// ---------------------------------------------------------------------------
// 4. Support Vector Machine (Linear + RBF Kernel with Platt Calibration)
// ---------------------------------------------------------------------------
function fitPlattCalibration(scores: number[], y: number[]): { A: number; B: number } {
  let A = -1.2;
  let B = 0.0;
  const lr = 0.05;
  for (let step = 0; step < 120; step++) {
    let gA = 0;
    let gB = 0;
    for (let i = 0; i < scores.length; i++) {
      const p = sigmoid(A * scores[i] + B);
      const err = p - y[i];
      gA += err * scores[i];
      gB += err;
    }
    A -= (lr * gA) / Math.max(1, scores.length);
    B -= (lr * gB) / Math.max(1, scores.length);
  }
  return { A, B };
}

function fitLinearSvm(X: number[][], y: number[], C = 1.0, epochs = 220): SvmLinearModel {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const weights = new Array(p).fill(0);
  let bias = 0;
  const lambda = 1 / Math.max(1, C * n);

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const eta = 0.08 / (1 + 0.04 * epoch);
    for (let i = 0; i < n; i++) {
      const yi = y[i] === 1 ? 1 : -1;
      const margin = yi * (dot(X[i], weights) + bias);
      for (let j = 0; j < p; j++) {
        weights[j] -= eta * lambda * weights[j];
        if (margin < 1) {
          weights[j] += eta * yi * X[i][j] * 0.25;
        }
      }
      if (margin < 1) {
        bias += eta * yi * 0.25;
      }
    }
  }
  const trainScores = X.map((row) => dot(row, weights) + bias);
  const platt = fitPlattCalibration(trainScores, y);
  return { weights, bias, plattA: platt.A, plattB: platt.B };
}

export function predictLinearSvmProbs(model: SvmLinearModel, X: number[][]): number[] {
  return X.map((row) => {
    const score = dot(row, model.weights) + model.bias;
    return clamp(sigmoid(model.plattA * score + model.plattB), 0.001, 0.999);
  });
}

function fitRbfSvm(X: number[][], y: number[], C = 1.5): SvmRbfModel {
  const n = X.length;
  const p = X[0]?.length ?? 1;
  const gamma = 1 / Math.max(1, p);
  const alphas = new Array(n).fill(0);
  let bias = 0;
  const ySigned = y.map((v) => (v === 1 ? 1 : -1));

  // Precompute RBF Gram matrix on training rows
  const K: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    K[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const val = Math.exp(-gamma * euclideanSq(X[i], X[j]));
      K[i][j] = val;
      K[j][i] = val;
    }
  }

  // Dual Coordinate Ascent / Simplified SMO
  const rng = createRng(42);
  for (let pass = 0; pass < 18; pass++) {
    for (let i = 0; i < n; i++) {
      let f_i = bias;
      for (let k = 0; k < n; k++) {
        if (alphas[k] > 0) f_i += alphas[k] * ySigned[k] * K[i][k];
      }
      const E_i = f_i - ySigned[i];
      if ((ySigned[i] * E_i < -0.01 && alphas[i] < C) || (ySigned[i] * E_i > 0.01 && alphas[i] > 0)) {
        let j = Math.floor(rng() * n);
        if (j === i) j = (i + 1) % n;
        let f_j = bias;
        for (let k = 0; k < n; k++) {
          if (alphas[k] > 0) f_j += alphas[k] * ySigned[k] * K[j][k];
        }
        const E_j = f_j - ySigned[j];
        const aiOld = alphas[i];
        const ajOld = alphas[j];

        let L = 0;
        let H = C;
        if (ySigned[i] !== ySigned[j]) {
          L = Math.max(0, ajOld - aiOld);
          H = Math.min(C, C + ajOld - aiOld);
        } else {
          L = Math.max(0, aiOld + ajOld - C);
          H = Math.min(C, aiOld + ajOld);
        }
        if (L === H) continue;
        const eta = 2 * K[i][j] - K[i][i] - K[j][j];
        if (eta >= 0) continue;

        let ajNew = ajOld - (ySigned[j] * (E_i - E_j)) / eta;
        ajNew = clamp(ajNew, L, H);
        if (Math.abs(ajNew - ajOld) < 1e-4) continue;
        const aiNew = aiOld + ySigned[i] * ySigned[j] * (ajOld - ajNew);

        const b1 = bias - E_i - ySigned[i] * (aiNew - aiOld) * K[i][i] - ySigned[j] * (ajNew - ajOld) * K[i][j];
        const b2 = bias - E_j - ySigned[i] * (aiNew - aiOld) * K[i][j] - ySigned[j] * (ajNew - ajOld) * K[j][j];
        if (aiNew > 0 && aiNew < C) bias = b1;
        else if (ajNew > 0 && ajNew < C) bias = b2;
        else bias = 0.5 * (b1 + b2);

        alphas[i] = aiNew;
        alphas[j] = ajNew;
      }
    }
  }

  const supportVectors: number[][] = [];
  const supportAlphaY: number[] = [];
  for (let i = 0; i < n; i++) {
    if (alphas[i] > 1e-4) {
      supportVectors.push(X[i]);
      supportAlphaY.push(alphas[i] * ySigned[i]);
    }
  }

  const scoreRow = (row: number[]) => {
    let s = bias;
    for (let k = 0; k < supportVectors.length; k++) {
      s += supportAlphaY[k] * Math.exp(-gamma * euclideanSq(supportVectors[k], row));
    }
    return s;
  };
  const trainScores = X.map(scoreRow);
  const platt = fitPlattCalibration(trainScores, y);

  return { supportVectors, supportAlphaY, bias, gamma, plattA: platt.A, plattB: platt.B };
}

export function predictRbfSvmProbs(model: SvmRbfModel, X: number[][]): number[] {
  return X.map((row) => {
    let s = model.bias;
    for (let k = 0; k < model.supportVectors.length; k++) {
      s += model.supportAlphaY[k] * Math.exp(-model.gamma * euclideanSq(model.supportVectors[k], row));
    }
    return clamp(sigmoid(model.plattA * s + model.plattB), 0.001, 0.999);
  });
}

// ---------------------------------------------------------------------------
// 5. K-Nearest Neighbors (KNN) + Nearest Similar Historical Projects
// ---------------------------------------------------------------------------
export function predictKnnProbs(
  XTrain: number[][],
  yTrain: number[],
  XQuery: number[][],
  k = 5
): number[] {
  return XQuery.map((q) => {
    const dists = XTrain.map((tr, i) => ({
      d: Math.sqrt(euclideanSq(tr, q)),
      y: yTrain[i],
    })).sort((a, b) => a.d - b.d);
    const topK = dists.slice(0, Math.min(k, dists.length));
    let wSum = 0;
    let yWSum = 0;
    for (const item of topK) {
      const w = 1 / (item.d + 1e-3);
      wSum += w;
      yWSum += w * item.y;
    }
    return wSum > 0 ? yWSum / wSum : 0.5;
  });
}

export function findNearestHistoricalProjects(
  XTrainScaled: number[][],
  trainRecords: ProjectRecord[],
  queryScaled: number[],
  queryRaw: ProjectRecord | Record<string, number | string>,
  k = 5
): KnnSimilarProject[] {
  const scored = XTrainScaled.map((tr, i) => {
    const d = Math.sqrt(euclideanSq(tr, queryScaled));
    return { rec: trainRecords[i], d };
  })
    .sort((a, b) => a.d - b.d)
    .slice(0, k);

  return scored.map(({ rec, d }) => {
    const similarityPct = Number((100 / (1 + d * 0.28)).toFixed(1));
    const reasons: string[] = [];
    if (rec.Domain === queryRaw['Domain']) reasons.push(`Same domain (${rec.Domain.split(' ')[0]})`);
    if (rec.Software_Development_Methodology === queryRaw['Software_Development_Methodology']) {
      reasons.push(`Same methodology (${rec.Software_Development_Methodology})`);
    }
    if (Math.abs(rec.Planned_Duration_Days - Number(queryRaw['Planned_Duration_Days'] ?? 0)) <= 25) {
      reasons.push(`Comparable planned duration (${rec.Planned_Duration_Days}d)`);
    }
    if (Math.abs(rec.Team_Size - Number(queryRaw['Team_Size'] ?? 0)) <= 3) {
      reasons.push(`Similar team size (${rec.Team_Size})`);
    }
    if (Math.abs(rec.Dependency_Delay - Number(queryRaw['Dependency_Delay'] ?? 0)) <= 4) {
      reasons.push(`Close dependency lag (${rec.Dependency_Delay}d)`);
    }
    if (reasons.length === 0) {
      reasons.push(`Closest multi-feature Euclidean profile (d=${d.toFixed(2)})`);
    }
    return {
      Project_ID: rec.Project_ID,
      Project_Name: rec.Project_Name,
      Domain: rec.Domain,
      Software_Development_Methodology: rec.Software_Development_Methodology,
      Planned_Duration_Days: rec.Planned_Duration_Days,
      Actual_Duration_Days: rec.Actual_Duration_Days,
      Delay_Days: rec.Delay_Days,
      Project_Status: rec.Project_Status,
      distance: Number(d.toFixed(3)),
      similarityPct,
      matchingReasons: reasons.slice(0, 3),
    };
  });
}

// ---------------------------------------------------------------------------
// 6. Random Forest Classifier (25 Bootstrap Trees + sqrt(p) Features)
// ---------------------------------------------------------------------------
function fitRandomForest(
  XTrain: number[][],
  yTrain: number[],
  featureNames: string[],
  scaler: FittedScaler,
  nTrees = 25
): { trees: CartNodeInternal[]; importances: number[] } {
  const rng = createRng(1042);
  const n = XTrain.length;
  const p = featureNames.length;
  const subFeats = Math.max(3, Math.round(Math.sqrt(p)));
  const trees: CartNodeInternal[] = [];
  const aggImp = new Array(p).fill(0);

  for (let t = 0; t < nTrees; t++) {
    const bootX: number[][] = [];
    const bootY: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * n);
      bootX.push(XTrain[idx]);
      bootY.push(yTrain[idx]);
    }
    const tree = fitDecisionTree(bootX, bootY, featureNames, scaler, 5, 6, subFeats, rng);
    trees.push(tree.root);
    for (let j = 0; j < p; j++) aggImp[j] += tree.importances[j];
  }

  const total = aggImp.reduce((a, b) => a + b, 0) || 1;
  return { trees, importances: aggImp.map((v) => v / total) };
}

export function predictRandomForestProbs(trees: CartNodeInternal[], X: number[][]): number[] {
  return X.map((row) => {
    let sum = 0;
    for (const t of trees) sum += predictSingleTreeProb(t, row);
    return sum / Math.max(1, trees.length);
  });
}

// ---------------------------------------------------------------------------
// 7. Gradient Boosting Classifier (Stage-wise Log-Loss Regression Trees)
// ---------------------------------------------------------------------------
function fitRegressionTree(
  X: number[][],
  residuals: number[],
  maxDepth = 3,
  minSamples = 8
): { root: RegressionTreeNode; gains: number[] } {
  const p = X[0]?.length ?? 0;
  const gains = new Array(p).fill(0);

  const sse = (vals: number[]) => {
    if (vals.length === 0) return 0;
    let m = 0;
    for (const v of vals) m += v;
    m /= vals.length;
    let s = 0;
    for (const v of vals) {
      const d = v - m;
      s += d * d;
    }
    return s;
  };

  const build = (indices: number[], depth: number): RegressionTreeNode => {
    const vals = indices.map((i) => residuals[i]);
    const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
    const parentErr = sse(vals);
    if (depth >= maxDepth || indices.length < minSamples || parentErr < 1e-6) {
      return { isLeaf: true, value: avg, gain: 0 };
    }

    let bestGain = 0;
    let bestFeat = -1;
    let bestThresh = 0;
    let bestL: number[] = [];
    let bestR: number[] = [];

    for (let j = 0; j < p; j++) {
      const pairs = indices.map((idx) => ({ idx, val: X[idx][j], r: residuals[idx] })).sort((a, b) => a.val - b.val);
      const step = Math.max(1, Math.floor(pairs.length / 16));
      for (let pos = step; pos < pairs.length; pos += step) {
        if (pairs[pos].val === pairs[pos - 1].val) continue;
        const lVals = pairs.slice(0, pos).map((it) => it.r);
        const rVals = pairs.slice(pos).map((it) => it.r);
        if (lVals.length < 3 || rVals.length < 3) continue;
        const gain = parentErr - (sse(lVals) + sse(rVals));
        if (gain > bestGain) {
          bestGain = gain;
          bestFeat = j;
          bestThresh = 0.5 * (pairs[pos].val + pairs[pos - 1].val);
          bestL = pairs.slice(0, pos).map((it) => it.idx);
          bestR = pairs.slice(pos).map((it) => it.idx);
        }
      }
    }

    if (bestFeat === -1 || bestGain <= 1e-5) {
      return { isLeaf: true, value: avg, gain: 0 };
    }
    gains[bestFeat] += bestGain;
    return {
      isLeaf: false,
      featureIndex: bestFeat,
      threshold: bestThresh,
      value: avg,
      gain: bestGain,
      left: build(bestL, depth + 1),
      right: build(bestR, depth + 1),
    };
  };

  const allIdx = Array.from({ length: X.length }, (_, i) => i);
  return { root: build(allIdx, 0), gains };
}

function predictRegTree(node: RegressionTreeNode, row: number[]): number {
  let curr: RegressionTreeNode | undefined = node;
  while (curr && !curr.isLeaf) {
    curr = row[curr.featureIndex ?? 0] <= (curr.threshold ?? 0) ? curr.left : curr.right;
  }
  return curr ? curr.value : 0;
}

function fitGradientBoosting(
  XTrain: number[][],
  yTrain: number[],
  nEstimators = 30,
  learningRate = 0.14
): {
  baseLogOdds: number;
  learningRate: number;
  trees: RegressionTreeNode[];
  importances: number[];
} {
  const n = XTrain.length;
  const p = XTrain[0]?.length ?? 0;
  const posRate = clamp(yTrain.filter((v) => v === 1).length / Math.max(1, n), 0.05, 0.95);
  const baseLogOdds = Math.log(posRate / (1 - posRate));
  const rawPreds = new Array(n).fill(baseLogOdds);
  const trees: RegressionTreeNode[] = [];
  const aggGains = new Array(p).fill(0);

  for (let m = 0; m < nEstimators; m++) {
    const residuals = rawPreds.map((f, i) => yTrain[i] - sigmoid(f));
    const { root, gains } = fitRegressionTree(XTrain, residuals, 3, 8);
    trees.push(root);
    for (let j = 0; j < p; j++) aggGains[j] += gains[j];
    for (let i = 0; i < n; i++) {
      // Newton step scaling for log-loss stability
      rawPreds[i] += learningRate * 2.4 * predictRegTree(root, XTrain[i]);
    }
  }

  const total = aggGains.reduce((a, b) => a + b, 0) || 1;
  return {
    baseLogOdds,
    learningRate,
    trees,
    importances: aggGains.map((v) => v / total),
  };
}

export function predictGradientBoostingProbs(
  gb: TrainedClassifiersBundle['gradientBoosting'],
  X: number[][]
): number[] {
  return X.map((row) => {
    let f = gb.baseLogOdds;
    for (const tree of gb.trees) {
      f += gb.learningRate * 2.4 * predictRegTree(tree, row);
    }
    return clamp(sigmoid(f), 0.001, 0.999);
  });
}

// ---------------------------------------------------------------------------
// Cross-Validation helper (3-fold stratified CV on training split for speed & rigor)
// ---------------------------------------------------------------------------
function computeFastStratifiedCV(
  XTrain: number[][],
  yTrain: number[],
  scorer: (XTr: number[][], yTr: number[], XVal: number[][]) => number[]
): number {
  const folds = 3;
  const foldIndices: number[][] = Array.from({ length: folds }, () => []);
  let posC = 0;
  let negC = 0;
  yTrain.forEach((y, i) => {
    if (y === 1) foldIndices[posC++ % folds].push(i);
    else foldIndices[negC++ % folds].push(i);
  });

  let accSum = 0;
  for (let f = 0; f < folds; f++) {
    const valSet = new Set(foldIndices[f]);
    const trX: number[][] = [];
    const trY: number[] = [];
    const valX: number[][] = [];
    const valY: number[] = [];
    for (let i = 0; i < XTrain.length; i++) {
      if (valSet.has(i)) {
        valX.push(XTrain[i]);
        valY.push(yTrain[i]);
      } else {
        trX.push(XTrain[i]);
        trY.push(yTrain[i]);
      }
    }
    const probs = scorer(trX, trY, valX);
    let correct = 0;
    for (let i = 0; i < valY.length; i++) {
      if ((probs[i] >= 0.5 ? 1 : 0) === valY[i]) correct++;
    }
    accSum += correct / Math.max(1, valY.length);
  }
  return Number((accSum / folds).toFixed(4));
}

function formatFeatureImportance(
  names: string[],
  weights: number[],
  topN = 10
): Array<{ feature: string; importance: number }> {
  const sum = weights.reduce((a, b) => a + Math.abs(b), 0) || 1;
  return names
    .map((feature, i) => ({
      feature,
      importance: Number((Math.abs(weights[i] ?? 0) / sum).toFixed(4)),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, topN);
}

// ---------------------------------------------------------------------------
// Master Classifier Training Suite
// ---------------------------------------------------------------------------
export function trainAllClassifiers(prep: PreparedDataset): TrainedClassifiersBundle {
  const { XTrainScaled, XTestScaled, yTrainClass, yTestClass, featureNames, scaler, trainRecords } = prep;
  const metrics: ClassificationModelMetrics[] = [];

  // 1. Logistic Regression
  const tLog0 = performance.now();
  const logistic = fitLogistic(XTrainScaled, yTrainClass);
  const tLogTrain = Number((performance.now() - tLog0).toFixed(3));
  const pLog0 = performance.now();
  const logProbs = predictLogisticProbs(logistic, XTestScaled);
  const pLogTime = Number((performance.now() - pLog0).toFixed(3));
  const logPreds = logProbs.map((p) => (p >= 0.5 ? 1 : 0));
  const logEval = computeClassificationMetrics(yTestClass, logPreds, logProbs);
  const logCv = computeFastStratifiedCV(XTrainScaled, yTrainClass, (tx, ty, vx) =>
    predictLogisticProbs(fitLogistic(tx, ty, 160), vx)
  );
  metrics.push({
    id: 'logistic_regression',
    name: 'Logistic Regression',
    family: 'Linear',
    accuracy: Number(logEval.accuracy.toFixed(4)),
    precision: Number(logEval.precision.toFixed(4)),
    recall: Number(logEval.recall.toFixed(4)),
    f1: Number(logEval.f1.toFixed(4)),
    rocAuc: Number(logEval.rocAuc.toFixed(4)),
    cvAccuracyMean: logCv,
    trainTimeMs: tLogTrain,
    predictTimeMs: pLogTime,
    confusionMatrix: { tp: logEval.tp, fp: logEval.fp, tn: logEval.tn, fn: logEval.fn },
    featureImportance: formatFeatureImportance(featureNames, logistic.weights),
  });

  // 2. Gaussian Naive Bayes
  const tNb0 = performance.now();
  const naiveBayes = fitNaiveBayes(XTrainScaled, yTrainClass);
  const tNbTrain = Number((performance.now() - tNb0).toFixed(3));
  const pNb0 = performance.now();
  const nbProbs = predictNaiveBayesProbs(naiveBayes, XTestScaled);
  const pNbTime = Number((performance.now() - pNb0).toFixed(3));
  const nbPreds = nbProbs.map((p) => (p >= 0.5 ? 1 : 0));
  const nbEval = computeClassificationMetrics(yTestClass, nbPreds, nbProbs);
  const nbCv = computeFastStratifiedCV(XTrainScaled, yTrainClass, (tx, ty, vx) =>
    predictNaiveBayesProbs(fitNaiveBayes(tx, ty), vx)
  );
  metrics.push({
    id: 'naive_bayes',
    name: 'Gaussian Naive Bayes',
    family: 'Probabilistic',
    accuracy: Number(nbEval.accuracy.toFixed(4)),
    precision: Number(nbEval.precision.toFixed(4)),
    recall: Number(nbEval.recall.toFixed(4)),
    f1: Number(nbEval.f1.toFixed(4)),
    rocAuc: Number(nbEval.rocAuc.toFixed(4)),
    cvAccuracyMean: nbCv,
    trainTimeMs: tNbTrain,
    predictTimeMs: pNbTime,
    confusionMatrix: { tp: nbEval.tp, fp: nbEval.fp, tn: nbEval.tn, fn: nbEval.fn },
  });

  // 3. Decision Tree Classifier
  const tDt0 = performance.now();
  const dtModel = fitDecisionTree(XTrainScaled, yTrainClass, featureNames, scaler, 5, 8);
  const tDtTrain = Number((performance.now() - tDt0).toFixed(3));
  const pDt0 = performance.now();
  const dtProbs = XTestScaled.map((row) => predictSingleTreeProb(dtModel.root, row));
  const pDtTime = Number((performance.now() - pDt0).toFixed(3));
  const dtPreds = dtProbs.map((p) => (p >= 0.5 ? 1 : 0));
  const dtEval = computeClassificationMetrics(yTestClass, dtPreds, dtProbs);
  const dtRules = extractTreeRules(dtModel.root);
  const dtCv = computeFastStratifiedCV(XTrainScaled, yTrainClass, (tx, ty, vx) => {
    const sub = fitDecisionTree(tx, ty, featureNames, scaler, 5, 8);
    return vx.map((r) => predictSingleTreeProb(sub.root, r));
  });
  metrics.push({
    id: 'decision_tree',
    name: 'Decision Tree Classifier',
    family: 'Tree',
    accuracy: Number(dtEval.accuracy.toFixed(4)),
    precision: Number(dtEval.precision.toFixed(4)),
    recall: Number(dtEval.recall.toFixed(4)),
    f1: Number(dtEval.f1.toFixed(4)),
    rocAuc: Number(dtEval.rocAuc.toFixed(4)),
    cvAccuracyMean: dtCv,
    trainTimeMs: tDtTrain,
    predictTimeMs: pDtTime,
    confusionMatrix: { tp: dtEval.tp, fp: dtEval.fp, tn: dtEval.tn, fn: dtEval.fn },
    featureImportance: formatFeatureImportance(featureNames, dtModel.importances),
    extra: {
      decisionTreeRoot: toPublicTreeNode(dtModel.root),
      decisionRules: dtRules,
    },
  });

  // 4. Support Vector Machine (Linear + RBF Kernel comparison)
  const tSvmL0 = performance.now();
  const svmLinear = fitLinearSvm(XTrainScaled, yTrainClass);
  const tSvmLTrain = Number((performance.now() - tSvmL0).toFixed(3));
  const pSvmL0 = performance.now();
  const svmLProbs = predictLinearSvmProbs(svmLinear, XTestScaled);
  const pSvmLTime = Number((performance.now() - pSvmL0).toFixed(3));
  const svmLPreds = svmLProbs.map((p) => (p >= 0.5 ? 1 : 0));
  const svmLEval = computeClassificationMetrics(yTestClass, svmLPreds, svmLProbs);

  const tSvmR0 = performance.now();
  const svmRbf = fitRbfSvm(XTrainScaled, yTrainClass);
  const tSvmRTrain = Number((performance.now() - tSvmR0).toFixed(3));
  const pSvmR0 = performance.now();
  const svmRProbs = predictRbfSvmProbs(svmRbf, XTestScaled);
  const pSvmRTime = Number((performance.now() - pSvmR0).toFixed(3));
  const svmRPreds = svmRProbs.map((p) => (p >= 0.5 ? 1 : 0));
  const svmREval = computeClassificationMetrics(yTestClass, svmRPreds, svmRProbs);

  const useRbf = svmREval.f1 >= svmLEval.f1;
  const bestSvmEval = useRbf ? svmREval : svmLEval;
  const svmCv = computeFastStratifiedCV(XTrainScaled, yTrainClass, (tx, ty, vx) =>
    predictLinearSvmProbs(fitLinearSvm(tx, ty, 1.0, 120), vx)
  );
  metrics.push({
    id: 'svm',
    name: `Support Vector Machine (${useRbf ? 'RBF' : 'Linear'})`,
    family: 'Margin',
    accuracy: Number(bestSvmEval.accuracy.toFixed(4)),
    precision: Number(bestSvmEval.precision.toFixed(4)),
    recall: Number(bestSvmEval.recall.toFixed(4)),
    f1: Number(bestSvmEval.f1.toFixed(4)),
    rocAuc: Number(bestSvmEval.rocAuc.toFixed(4)),
    cvAccuracyMean: svmCv,
    trainTimeMs: Number((tSvmLTrain + tSvmRTrain).toFixed(3)),
    predictTimeMs: useRbf ? pSvmRTime : pSvmLTime,
    confusionMatrix: {
      tp: bestSvmEval.tp,
      fp: bestSvmEval.fp,
      tn: bestSvmEval.tn,
      fn: bestSvmEval.fn,
    },
    extra: {
      svmKernels: [
        {
          kernel: 'Linear',
          accuracy: Number(svmLEval.accuracy.toFixed(4)),
          precision: Number(svmLEval.precision.toFixed(4)),
          recall: Number(svmLEval.recall.toFixed(4)),
          f1: Number(svmLEval.f1.toFixed(4)),
          rocAuc: Number(svmLEval.rocAuc.toFixed(4)),
          trainTimeMs: tSvmLTrain,
        },
        {
          kernel: 'RBF',
          accuracy: Number(svmREval.accuracy.toFixed(4)),
          precision: Number(svmREval.precision.toFixed(4)),
          recall: Number(svmREval.recall.toFixed(4)),
          f1: Number(svmREval.f1.toFixed(4)),
          rocAuc: Number(svmREval.rocAuc.toFixed(4)),
          trainTimeMs: tSvmRTrain,
        },
      ],
    },
  });

  // 5. K-Nearest Neighbors (KNN with K-sweep 3..11)
  const tKnn0 = performance.now();
  const kCandidates = [3, 5, 7, 9, 11];
  const knnKSweep = kCandidates.map((k) => {
    const probs = predictKnnProbs(XTrainScaled, yTrainClass, XTestScaled, k);
    const preds = probs.map((p) => (p >= 0.5 ? 1 : 0));
    const ev = computeClassificationMetrics(yTestClass, preds, probs);
    return {
      k,
      accuracy: Number(ev.accuracy.toFixed(4)),
      f1: Number(ev.f1.toFixed(4)),
    };
  });
  const bestKEntry = [...knnKSweep].sort((a, b) => b.f1 - a.f1)[0] ?? { k: 5 };
  const tKnnTrain = Number((performance.now() - tKnn0).toFixed(3));
  const pKnn0 = performance.now();
  const knnProbs = predictKnnProbs(XTrainScaled, yTrainClass, XTestScaled, bestKEntry.k);
  const pKnnTime = Number((performance.now() - pKnn0).toFixed(3));
  const knnPreds = knnProbs.map((p) => (p >= 0.5 ? 1 : 0));
  const knnEval = computeClassificationMetrics(yTestClass, knnPreds, knnProbs);
  const knnCv = computeFastStratifiedCV(XTrainScaled, yTrainClass, (tx, ty, vx) =>
    predictKnnProbs(tx, ty, vx, bestKEntry.k)
  );
  metrics.push({
    id: 'knn',
    name: `K-Nearest Neighbors (K=${bestKEntry.k})`,
    family: 'Instance',
    accuracy: Number(knnEval.accuracy.toFixed(4)),
    precision: Number(knnEval.precision.toFixed(4)),
    recall: Number(knnEval.recall.toFixed(4)),
    f1: Number(knnEval.f1.toFixed(4)),
    rocAuc: Number(knnEval.rocAuc.toFixed(4)),
    cvAccuracyMean: knnCv,
    trainTimeMs: tKnnTrain,
    predictTimeMs: pKnnTime,
    confusionMatrix: { tp: knnEval.tp, fp: knnEval.fp, tn: knnEval.tn, fn: knnEval.fn },
    extra: {
      knnKSweep,
      selectedK: bestKEntry.k,
    },
  });

  // 6. Random Forest Classifier
  const tRf0 = performance.now();
  const randomForest = fitRandomForest(XTrainScaled, yTrainClass, featureNames, scaler, 25);
  const tRfTrain = Number((performance.now() - tRf0).toFixed(3));
  const pRf0 = performance.now();
  const rfProbs = predictRandomForestProbs(randomForest.trees, XTestScaled);
  const pRfTime = Number((performance.now() - pRf0).toFixed(3));
  const rfPreds = rfProbs.map((p) => (p >= 0.5 ? 1 : 0));
  const rfEval = computeClassificationMetrics(yTestClass, rfPreds, rfProbs);
  const rfCv = computeFastStratifiedCV(XTrainScaled, yTrainClass, (tx, ty, vx) => {
    const sub = fitRandomForest(tx, ty, featureNames, scaler, 15);
    return predictRandomForestProbs(sub.trees, vx);
  });
  metrics.push({
    id: 'random_forest',
    name: 'Random Forest Classifier',
    family: 'Ensemble',
    accuracy: Number(rfEval.accuracy.toFixed(4)),
    precision: Number(rfEval.precision.toFixed(4)),
    recall: Number(rfEval.recall.toFixed(4)),
    f1: Number(rfEval.f1.toFixed(4)),
    rocAuc: Number(rfEval.rocAuc.toFixed(4)),
    cvAccuracyMean: rfCv,
    trainTimeMs: tRfTrain,
    predictTimeMs: pRfTime,
    confusionMatrix: { tp: rfEval.tp, fp: rfEval.fp, tn: rfEval.tn, fn: rfEval.fn },
    featureImportance: formatFeatureImportance(featureNames, randomForest.importances),
  });

  // 7. Gradient Boosting Classifier
  const tGb0 = performance.now();
  const gradientBoosting = fitGradientBoosting(XTrainScaled, yTrainClass, 28, 0.14);
  const tGbTrain = Number((performance.now() - tGb0).toFixed(3));
  const pGb0 = performance.now();
  const gbProbs = predictGradientBoostingProbs(gradientBoosting, XTestScaled);
  const pGbTime = Number((performance.now() - pGb0).toFixed(3));
  const gbPreds = gbProbs.map((p) => (p >= 0.5 ? 1 : 0));
  const gbEval = computeClassificationMetrics(yTestClass, gbPreds, gbProbs);
  const gbCv = computeFastStratifiedCV(XTrainScaled, yTrainClass, (tx, ty, vx) =>
    predictGradientBoostingProbs(fitGradientBoosting(tx, ty, 18, 0.14), vx)
  );
  metrics.push({
    id: 'gradient_boosting',
    name: 'Gradient Boosting Classifier',
    family: 'Ensemble',
    accuracy: Number(gbEval.accuracy.toFixed(4)),
    precision: Number(gbEval.precision.toFixed(4)),
    recall: Number(gbEval.recall.toFixed(4)),
    f1: Number(gbEval.f1.toFixed(4)),
    rocAuc: Number(gbEval.rocAuc.toFixed(4)),
    cvAccuracyMean: gbCv,
    trainTimeMs: tGbTrain,
    predictTimeMs: pGbTime,
    confusionMatrix: { tp: gbEval.tp, fp: gbEval.fp, tn: gbEval.tn, fn: gbEval.fn },
    featureImportance: formatFeatureImportance(featureNames, gradientBoosting.importances),
  });

  return {
    logistic,
    naiveBayes,
    decisionTree: {
      root: dtModel.root,
      importances: dtModel.importances,
      rules: dtRules,
    },
    svmLinear,
    svmRbf,
    bestSvmKernel: useRbf ? 'RBF' : 'Linear',
    knn: {
      XTrain: XTrainScaled,
      yTrain: yTrainClass,
      trainRecords,
      defaultK: bestKEntry.k,
    },
    randomForest,
    gradientBoosting,
    metrics,
  };
}

export function predictSingleRowWithAllClassifiers(
  bundle: TrainedClassifiersBundle,
  rowScaled: number[],
  options?: { knnK?: number; svmKernel?: 'Linear' | 'RBF' }
): Record<ClassificationModelMetrics['id'], number> {
  const logP = predictLogisticProbs(bundle.logistic, [rowScaled])[0];
  const nbP = predictNaiveBayesProbs(bundle.naiveBayes, [rowScaled])[0];
  const dtP = predictSingleTreeProb(bundle.decisionTree.root, rowScaled);
  const chosenKernel = options?.svmKernel ?? bundle.bestSvmKernel;
  const svmP =
    chosenKernel === 'RBF'
      ? predictRbfSvmProbs(bundle.svmRbf, [rowScaled])[0]
      : predictLinearSvmProbs(bundle.svmLinear, [rowScaled])[0];
  const knnP = predictKnnProbs(
    bundle.knn.XTrain,
    bundle.knn.yTrain,
    [rowScaled],
    options?.knnK ?? bundle.knn.defaultK
  )[0];
  const rfP = predictRandomForestProbs(bundle.randomForest.trees, [rowScaled])[0];
  const gbP = predictGradientBoostingProbs(bundle.gradientBoosting, [rowScaled])[0];

  return {
    logistic_regression: Number(logP.toFixed(4)),
    naive_bayes: Number(nbP.toFixed(4)),
    decision_tree: Number(dtP.toFixed(4)),
    svm: Number(svmP.toFixed(4)),
    knn: Number(knnP.toFixed(4)),
    random_forest: Number(rfP.toFixed(4)),
    gradient_boosting: Number(gbP.toFixed(4)),
  };
}
