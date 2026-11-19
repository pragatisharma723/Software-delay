export function createRng(seed = 42): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randNormal(rng: () => number, mean = 0, std = 1): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + std * z;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

export function stdDev(arr: number[], avg?: number): number {
  if (arr.length === 0) return 1;
  const m = avg ?? mean(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / arr.length) || 1e-8;
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function sigmoid(z: number): number {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function euclideanSq(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

/**
 * Solves (X^T X + lambda * I) w = X^T y via Gauss-Jordan elimination with partial pivoting.
 */
export function solveRidgeLinearSystem(X: number[][], y: number[], lambda = 1e-3): number[] {
  const n = X.length;
  if (n === 0) return [];
  const p = X[0].length;
  const A: number[][] = Array.from({ length: p }, () => new Array(p + 1).fill(0));

  for (let i = 0; i < n; i++) {
    const row = X[i];
    const yi = y[i];
    for (let j = 0; j < p; j++) {
      const xij = row[j];
      A[j][p] += xij * yi;
      for (let k = j; k < p; k++) {
        A[j][k] += xij * row[k];
      }
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) {
      A[j][k] = A[k][j];
    }
    A[j][j] += lambda;
  }

  for (let col = 0; col < p; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let r = col + 1; r < p; r++) {
      const v = Math.abs(A[r][col]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = r;
      }
    }
    if (pivotRow !== col) {
      const tmp = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmp;
    }
    const diag = Math.abs(A[col][col]) < 1e-12 ? 1e-12 : A[col][col];
    for (let k = col; k <= p; k++) {
      A[col][k] /= diag;
    }
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      if (factor === 0) continue;
      for (let k = col; k <= p; k++) {
        A[r][k] -= factor * A[col][k];
      }
    }
  }

  return A.map((row) => row[p]);
}

/**
 * Computes top 2 principal components via Jacobi eigendecomposition of the covariance matrix.
 */
export function computePCA2D(X: number[][]): {
  projected: Array<[number, number]>;
  explainedVarianceRatio: [number, number];
} {
  const n = X.length;
  if (n === 0) return { projected: [], explainedVarianceRatio: [0, 0] };
  const p = X[0].length;

  const colMeans = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) colMeans[j] += X[i][j];
  }
  for (let j = 0; j < p; j++) colMeans[j] /= n;

  const centered = X.map((row) => row.map((v, j) => v - colMeans[j]));
  const cov: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const denom = Math.max(1, n - 1);
  for (let i = 0; i < n; i++) {
    const r = centered[i];
    for (let j = 0; j < p; j++) {
      for (let k = j; k < p; k++) {
        cov[j][k] += r[j] * r[k];
      }
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = j; k < p; k++) {
      cov[j][k] /= denom;
      cov[k][j] = cov[j][k];
    }
  }

  // Jacobi rotation for symmetric matrix
  const V: number[][] = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (__, j) => (i === j ? 1 : 0))
  );
  const A = cov.map((r) => [...r]);

  for (let iter = 0; iter < 80; iter++) {
    let maxOff = 0;
    let pIdx = 0;
    let qIdx = 1;
    for (let i = 0; i < p; i++) {
      for (let j = i + 1; j < p; j++) {
        const val = Math.abs(A[i][j]);
        if (val > maxOff) {
          maxOff = val;
          pIdx = i;
          qIdx = j;
        }
      }
    }
    if (maxOff < 1e-10) break;

    const app = A[pIdx][pIdx];
    const aqq = A[qIdx][qIdx];
    const apq = A[pIdx][qIdx];
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    for (let i = 0; i < p; i++) {
      if (i !== pIdx && i !== qIdx) {
        const aip = A[i][pIdx];
        const aiq = A[i][qIdx];
        A[i][pIdx] = c * aip - s * aiq;
        A[pIdx][i] = A[i][pIdx];
        A[i][qIdx] = s * aip + c * aiq;
        A[qIdx][i] = A[i][qIdx];
      }
    }
    A[pIdx][pIdx] = c * c * app - 2 * c * s * apq + s * s * aqq;
    A[qIdx][qIdx] = s * s * app + 2 * c * s * apq + c * c * aqq;
    A[pIdx][qIdx] = 0;
    A[qIdx][pIdx] = 0;

    for (let i = 0; i < p; i++) {
      const vip = V[i][pIdx];
      const viq = V[i][qIdx];
      V[i][pIdx] = c * vip - s * viq;
      V[i][qIdx] = s * vip + c * viq;
    }
  }

  const eigenPairs = Array.from({ length: p }, (_, i) => ({
    eigenvalue: Math.max(0, A[i][i]),
    vector: V.map((row) => row[i]),
  })).sort((a, b) => b.eigenvalue - a.eigenvalue);

  const totalVar = eigenPairs.reduce((acc, item) => acc + item.eigenvalue, 0) || 1;
  const v1 = eigenPairs[0]?.vector ?? new Array(p).fill(0);
  const v2 = eigenPairs[1]?.vector ?? new Array(p).fill(0);

  const projected: Array<[number, number]> = centered.map((row) => [dot(row, v1), dot(row, v2)]);
  return {
    projected,
    explainedVarianceRatio: [
      (eigenPairs[0]?.eigenvalue ?? 0) / totalVar,
      (eigenPairs[1]?.eigenvalue ?? 0) / totalVar,
    ],
  };
}

export function computeRocAuc(yTrue: number[], yProb: number[]): number {
  const pairs = yTrue.map((y, i) => ({ y, p: yProb[i] })).sort((a, b) => b.p - a.p);
  const posTotal = pairs.filter((item) => item.y === 1).length;
  const negTotal = pairs.length - posTotal;
  if (posTotal === 0 || negTotal === 0) return 0.5;

  let tp = 0;
  let fp = 0;
  let prevFpr = 0;
  let prevTpr = 0;
  let auc = 0;

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].y === 1) tp++;
    else fp++;
    if (i === pairs.length - 1 || pairs[i].p !== pairs[i + 1].p) {
      const tpr = tp / posTotal;
      const fpr = fp / negTotal;
      auc += (fpr - prevFpr) * (tpr + prevTpr) * 0.5;
      prevFpr = fpr;
      prevTpr = tpr;
    }
  }
  return clamp(auc, 0, 1);
}

export function computeClassificationMetrics(
  yTrue: number[],
  yPred: number[],
  yProb: number[]
): {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
} {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] === 1 && yPred[i] === 1) tp++;
    else if (yTrue[i] === 0 && yPred[i] === 1) fp++;
    else if (yTrue[i] === 0 && yPred[i] === 0) tn++;
    else fn++;
  }
  const total = yTrue.length || 1;
  const accuracy = (tp + tn) / total;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const rocAuc = computeRocAuc(yTrue, yProb);
  return { tp, fp, tn, fn, accuracy, precision, recall, f1, rocAuc };
}

export function computeRegressionMetrics(
  yTrue: number[],
  yPred: number[]
): { r2: number; mae: number; mse: number; rmse: number } {
  const n = yTrue.length || 1;
  const yMean = mean(yTrue);
  let ssRes = 0;
  let ssTot = 0;
  let absErr = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const err = yTrue[i] - yPred[i];
    ssRes += err * err;
    absErr += Math.abs(err);
    const tot = yTrue[i] - yMean;
    ssTot += tot * tot;
  }
  const mse = ssRes / n;
  const rmse = Math.sqrt(mse);
  const mae = absErr / n;
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { r2, mae, mse, rmse };
}
