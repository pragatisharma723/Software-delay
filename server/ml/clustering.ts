import type {
  DendrogramMerge,
  HierarchicalResult,
  KMeansClusterSummary,
  KMeansResult,
  ProjectRecord,
} from '../../src/types/project.ts';
import { computePCA2D, createRng, euclideanSq, mean } from './mathUtils.ts';
import { extractClusteringMatrix, type FittedScaler } from './preprocessing.ts';

function computeSilhouetteScore(X: number[][], labels: number[], k: number): number {
  const n = X.length;
  if (n < 3 || k < 2) return 0;
  const clusterMembers: number[][] = Array.from({ length: k }, () => []);
  labels.forEach((c, idx) => clusterMembers[c]?.push(idx));

  let silSum = 0;
  let validCount = 0;
  // Subsample cleanly if large so computation remains instantaneous
  const step = Math.max(1, Math.floor(n / 180));
  for (let i = 0; i < n; i += step) {
    const ci = labels[i];
    const own = clusterMembers[ci] ?? [];
    if (own.length <= 1) continue;

    let a = 0;
    for (const j of own) {
      if (j !== i) a += Math.sqrt(euclideanSq(X[i], X[j]));
    }
    a /= own.length - 1;

    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === ci) continue;
      const other = clusterMembers[c] ?? [];
      if (other.length === 0) continue;
      let dist = 0;
      for (const j of other) dist += Math.sqrt(euclideanSq(X[i], X[j]));
      dist /= other.length;
      if (dist < b) b = dist;
    }

    if (b < Infinity) {
      const s = (b - a) / Math.max(a, b, 1e-8);
      silSum += s;
      validCount++;
    }
  }
  return validCount > 0 ? Number((silSum / validCount).toFixed(4)) : 0;
}

function runKMeansCore(
  X: number[][],
  k: number,
  seed = 42
): { labels: number[]; centroids: number[][]; inertia: number } {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  const rng = createRng(seed + k * 7);

  // K-Means++ initialization
  const centroids: number[][] = [];
  centroids.push([...X[Math.floor(rng() * n)]]);
  while (centroids.length < k) {
    const distSq = X.map((row) => {
      let minD = Infinity;
      for (const c of centroids) {
        const d = euclideanSq(row, c);
        if (d < minD) minD = d;
      }
      return minD;
    });
    const sumD = distSq.reduce((a, b) => a + b, 0) || 1;
    let target = rng() * sumD;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      target -= distSq[i];
      if (target <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push([...X[chosen]]);
  }

  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < 45; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestC = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = euclideanSq(X[i], centroids[c]);
        if (d < bestD) {
          bestD = d;
          bestC = c;
        }
      }
      if (labels[i] !== bestC) {
        labels[i] = bestC;
        changed = true;
      }
    }

    const sums: number[][] = Array.from({ length: k }, () => new Array(p).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      counts[c]++;
      for (let j = 0; j < p; j++) sums[c][j] += X[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < p; j++) centroids[c][j] = sums[c][j] / counts[c];
      }
    }
    if (!changed) break;
  }

  let inertia = 0;
  for (let i = 0; i < n; i++) {
    inertia += euclideanSq(X[i], centroids[labels[i]]);
  }
  return { labels, centroids, inertia: Number(inertia.toFixed(2)) };
}

function assignDataDrivenClusterLabels(
  clusters: Array<Omit<KMeansClusterSummary, 'label'>>
): KMeansClusterSummary[] {
  // Rank clusters objectively by observed delayRate + avgReworkHours + avgComplexity
  const ranked = clusters
    .map((c) => ({
      id: c.clusterId,
      riskComposite: c.delayRate * 100 + c.avgReworkHours * 0.15 + c.avgComplexity * 10 - c.avgCompletion * 0.4,
    }))
    .sort((a, b) => a.riskComposite - b.riskComposite);

  const labelMap = new Map<number, string>();
  const n = ranked.length;
  ranked.forEach((item, rankIdx) => {
    if (rankIdx === 0) {
      labelMap.set(item.id, 'Low-Risk, High-Progress Projects');
    } else if (rankIdx === n - 1) {
      labelMap.set(item.id, 'Critical Delay-Prone Projects');
    } else if (n >= 4 && rankIdx === n - 2) {
      labelMap.set(item.id, 'High-Complexity Escalation Projects');
    } else if (n >= 5 && rankIdx === 1) {
      labelMap.set(item.id, 'Stable Execution Projects');
    } else {
      labelMap.set(item.id, `Moderate-Risk Projects (Group ${rankIdx + 1})`);
    }
  });

  return clusters.map((c) => ({
    ...c,
    label: labelMap.get(c.clusterId) ?? `Cluster ${c.clusterId + 1}`,
  }));
}

export interface TrainedKMeansModel {
  scaler: FittedScaler;
  centroidsScaled: number[][];
  clusterLabels: string[];
  clusterDelayRates: number[];
  pcaMean: number[];
  result: KMeansResult;
}

export function runKMeansClustering(records: ProjectRecord[], requestedK = 4): TrainedKMeansModel {
  const k = Math.max(2, Math.min(8, requestedK));
  const { featureNames, rawMatrix, scaledMatrix, scaler } = extractClusteringMatrix(records);

  const elbowCurve: Array<{ k: number; inertia: number; silhouette: number }> = [];
  for (let candK = 2; candK <= 7; candK++) {
    const core = runKMeansCore(scaledMatrix, candK);
    const sil = computeSilhouetteScore(scaledMatrix, core.labels, candK);
    elbowCurve.push({ k: candK, inertia: core.inertia, silhouette: sil });
  }

  const chosen = runKMeansCore(scaledMatrix, k);
  const silhouetteScore = computeSilhouetteScore(scaledMatrix, chosen.labels, k);
  const pca = computePCA2D(scaledMatrix);

  const rawClusters: Array<Omit<KMeansClusterSummary, 'label'>> = [];
  for (let c = 0; c < k; c++) {
    const memberIndices: number[] = [];
    chosen.labels.forEach((lbl, idx) => {
      if (lbl === c) memberIndices.push(idx);
    });
    const members = memberIndices.map((i) => records[i]);
    const centroidObj: Record<string, number> = {};
    featureNames.forEach((f, j) => {
      centroidObj[f] = Number(
        mean(memberIndices.map((i) => rawMatrix[i][j])).toFixed(2)
      );
    });
    const delayRate = members.length
      ? Number((members.filter((m) => m.Is_Delayed === 1).length / members.length).toFixed(4))
      : 0;
    rawClusters.push({
      clusterId: c,
      size: members.length,
      delayRate,
      avgDelayDays: Number(mean(members.map((m) => m.Delay_Days)).toFixed(1)),
      avgCompletion: Number(mean(members.map((m) => m.Completion_Percentage)).toFixed(1)),
      avgBugs: Number(mean(members.map((m) => m.Bugs_Reported)).toFixed(1)),
      avgDependencies: Number(mean(members.map((m) => m.Number_of_Dependencies)).toFixed(1)),
      avgProductivity: Number(mean(members.map((m) => m.Team_Productivity)).toFixed(1)),
      avgComplexity: centroidObj['Project_Complexity_Num'] ?? 2,
      avgTesting: Number(mean(members.map((m) => m.Testing_Completion_Percentage)).toFixed(1)),
      avgRequirementChanges: Number(mean(members.map((m) => m.Requirement_Changes)).toFixed(1)),
      avgReworkHours: Number(mean(members.map((m) => m.Rework_Hours)).toFixed(1)),
      centroid: centroidObj,
    });
  }

  const clusters = assignDataDrivenClusterLabels(rawClusters);
  const labelByClusterId = new Map(clusters.map((c) => [c.clusterId, c.label]));

  const points2D = records.map((rec, i) => ({
    projectId: rec.Project_ID,
    projectName: rec.Project_Name,
    domain: rec.Domain,
    methodology: rec.Software_Development_Methodology,
    clusterId: chosen.labels[i],
    clusterLabel: labelByClusterId.get(chosen.labels[i]) ?? `Cluster ${chosen.labels[i] + 1}`,
    pc1: Number((pca.projected[i]?.[0] ?? 0).toFixed(3)),
    pc2: Number((pca.projected[i]?.[1] ?? 0).toFixed(3)),
    isDelayed: rec.Is_Delayed,
    delayDays: rec.Delay_Days,
  }));

  return {
    scaler,
    centroidsScaled: chosen.centroids,
    clusterLabels: clusters.map((c) => c.label),
    clusterDelayRates: clusters.map((c) => c.delayRate),
    pcaMean: scaler.means,
    result: {
      k,
      silhouetteScore,
      inertia: chosen.inertia,
      elbowCurve,
      explainedVarianceRatio: [
        Number(pca.explainedVarianceRatio[0].toFixed(4)),
        Number(pca.explainedVarianceRatio[1].toFixed(4)),
      ],
      clusters,
      points2D,
    },
  };
}

export function assignProjectToCluster(
  model: TrainedKMeansModel,
  rawFeatures: number[]
): { clusterId: number; clusterLabel: string; clusterDelayRate: number } {
  const scaled = rawFeatures.map((v, j) => (v - model.scaler.means[j]) / model.scaler.stds[j]);
  let bestC = 0;
  let bestD = Infinity;
  for (let c = 0; c < model.centroidsScaled.length; c++) {
    const d = euclideanSq(scaled, model.centroidsScaled[c]);
    if (d < bestD) {
      bestD = d;
      bestC = c;
    }
  }
  return {
    clusterId: bestC,
    clusterLabel: model.clusterLabels[bestC] ?? `Cluster ${bestC + 1}`,
    clusterDelayRate: model.clusterDelayRates[bestC] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Agglomerative Hierarchical Clustering (Ward, Complete, Average Linkage)
// ---------------------------------------------------------------------------
export function runHierarchicalClustering(
  records: ProjectRecord[],
  linkage: 'ward' | 'complete' | 'average' = 'ward',
  k = 4
): HierarchicalResult {
  // Use a stratified representative sample of up to 44 projects for crisp dendrogram rendering
  const maxSample = Math.min(44, records.length);
  const step = Math.max(1, Math.floor(records.length / maxSample));
  const sample: ProjectRecord[] = [];
  for (let i = 0; i < records.length && sample.length < maxSample; i += step) {
    sample.push(records[i]);
  }

  const { scaledMatrix } = extractClusteringMatrix(sample);
  const n = sample.length;

  interface ClusterNode {
    id: number;
    members: number[];
    centroid: number[];
    left?: ClusterNode;
    right?: ClusterNode;
  }

  let active: ClusterNode[] = scaledMatrix.map((vec, i) => ({
    id: i,
    members: [i],
    centroid: [...vec],
  }));

  // Precompute pairwise Euclidean distances
  const pairDist: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.sqrt(euclideanSq(scaledMatrix[i], scaledMatrix[j]));
      pairDist[i][j] = d;
      pairDist[j][i] = d;
    }
  }

  const clusterDistance = (a: ClusterNode, b: ClusterNode): number => {
    if (linkage === 'ward') {
      const na = a.members.length;
      const nb = b.members.length;
      const distSq = euclideanSq(a.centroid, b.centroid);
      return Math.sqrt(((2 * na * nb) / (na + nb)) * distSq);
    }
    if (linkage === 'complete') {
      let maxD = 0;
      for (const i of a.members) {
        for (const j of b.members) {
          if (pairDist[i][j] > maxD) maxD = pairDist[i][j];
        }
      }
      return maxD;
    }
    // average linkage
    let sumD = 0;
    for (const i of a.members) {
      for (const j of b.members) sumD += pairDist[i][j];
    }
    return sumD / (a.members.length * b.members.length);
  };

  const merges: DendrogramMerge[] = [];
  let nextClusterId = n;
  let snapshotAtK: ClusterNode[] = [];

  while (active.length > 1) {
    if (active.length === k) {
      snapshotAtK = [...active];
    }
    let bestI = 0;
    let bestJ = 1;
    let bestDist = Infinity;
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const d = clusterDistance(active[i], active[j]);
        if (d < bestDist) {
          bestDist = d;
          bestI = i;
          bestJ = j;
        }
      }
    }

    const nodeA = active[bestI];
    const nodeB = active[bestJ];
    const mergedMembers = [...nodeA.members, ...nodeB.members];
    const p = nodeA.centroid.length;
    const newCentroid = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      newCentroid[j] =
        (nodeA.centroid[j] * nodeA.members.length + nodeB.centroid[j] * nodeB.members.length) /
        mergedMembers.length;
    }

    const newNode: ClusterNode = {
      id: nextClusterId,
      members: mergedMembers,
      centroid: newCentroid,
      left: nodeA,
      right: nodeB,
    };

    merges.push({
      step: merges.length + 1,
      leftId: nodeA.id,
      rightId: nodeB.id,
      newClusterId: nextClusterId,
      distance: Number(bestDist.toFixed(3)),
      size: mergedMembers.length,
    });
    nextClusterId++;

    active = active.filter((_, idx) => idx !== bestI && idx !== bestJ);
    active.push(newNode);
  }

  if (snapshotAtK.length === 0) snapshotAtK = active;

  const root = active[0];
  const leafOrder: number[] = [];
  const collectLeaves = (node: ClusterNode) => {
    if (!node.left && !node.right) {
      leafOrder.push(node.id);
      return;
    }
    if (node.left) collectLeaves(node.left);
    if (node.right) collectLeaves(node.right);
  };
  if (root) collectLeaves(root);

  const clusterOfLeaf = new Array(n).fill(0);
  snapshotAtK.forEach((grp, cIdx) => {
    grp.members.forEach((mIdx) => {
      clusterOfLeaf[mIdx] = cIdx;
    });
  });

  const silhouetteScore = computeSilhouetteScore(scaledMatrix, clusterOfLeaf, snapshotAtK.length);

  const leaves = sample.map((rec, idx) => ({
    leafIndex: idx,
    projectId: rec.Project_ID,
    projectName: rec.Project_Name,
    domain: rec.Domain,
    methodology: rec.Software_Development_Methodology,
    isDelayed: rec.Is_Delayed,
    clusterId: clusterOfLeaf[idx],
  }));

  const clusters = snapshotAtK.map((grp, cIdx) => {
    const members = grp.members.map((m) => sample[m]);
    const delayRate = members.length
      ? Number((members.filter((m) => m.Is_Delayed === 1).length / members.length).toFixed(4))
      : 0;
    const avgDelayDays = Number(mean(members.map((m) => m.Delay_Days)).toFixed(1));
    const domainCounts = new Map<string, number>();
    const methCounts = new Map<string, number>();
    for (const m of members) {
      domainCounts.set(m.Domain, (domainCounts.get(m.Domain) ?? 0) + 1);
      methCounts.set(
        m.Software_Development_Methodology,
        (methCounts.get(m.Software_Development_Methodology) ?? 0) + 1
      );
    }
    const dominantDomain =
      [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Mixed';
    const dominantMethodology =
      [...methCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Mixed';

    const label =
      delayRate >= 0.65
        ? 'High-Delay Pattern Group'
        : delayRate <= 0.3
          ? 'Low-Risk Delivery Group'
          : `Balanced Risk Group ${cIdx + 1}`;

    return {
      clusterId: cIdx,
      label,
      size: members.length,
      delayRate,
      avgDelayDays,
      dominantDomain,
      dominantMethodology,
    };
  });

  return {
    linkage,
    k: snapshotAtK.length,
    silhouetteScore,
    sampleSize: n,
    leafOrder,
    leaves,
    merges,
    clusters,
  };
}
