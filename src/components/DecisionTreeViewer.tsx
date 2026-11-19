import type { DecisionTreeNode } from '../types/project.ts';

function TreeBranch({ node, depth = 0 }: { node: DecisionTreeNode; depth?: number }) {
  const delayPct = (node.delayProbability * 100).toFixed(0);
  const isDelayed = node.predictedClass === 1;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`px-3 py-2 rounded-lg border text-center min-w-[164px] max-w-[210px] ${
          node.isLeaf
            ? isDelayed
              ? 'bg-[#FDF2F2] border-[#C85656]/40'
              : 'bg-[#EAF1F8] border-[#4C7DAE]/45'
            : 'bg-white border-[#C2D2E3]'
        }`}
      >
        {node.isLeaf ? (
          <>
            <div
              className={`text-xs font-semibold ${
                isDelayed ? 'text-[#A33939]' : 'text-[#2A5786]'
              }`}
            >
              {isDelayed ? 'Predict: Delayed' : 'Predict: On Time'}
            </div>
            <div className="text-[11px] text-[#647B92] font-mono-tabular mt-0.5">
              P(delay)={delayPct}% · n={node.samples}
            </div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold text-[#082441] truncate" title={node.feature}>
              {node.feature}
            </div>
            <div className="text-[11px] text-[#1B4268] font-mono-tabular">
              ≤ {node.threshold}
            </div>
            <div className="text-[10px] text-[#647B92] font-mono-tabular mt-0.5">
              Gini {node.gini.toFixed(3)} · n={node.samples} [{node.valueCounts[0]}/{node.valueCounts[1]}]
            </div>
          </>
        )}
      </div>

      {!node.isLeaf && (node.left || node.right) && depth < 3 && (
        <div className="flex items-start gap-4 mt-3 pt-3 border-t border-[#D2DFEC] relative">
          {node.left && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono-tabular text-[#4C7DAE] mb-1">True (≤)</span>
              <TreeBranch node={node.left} depth={depth + 1} />
            </div>
          )}
          {node.right && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono-tabular text-[#C85656] mb-1">False (&gt;)</span>
              <TreeBranch node={node.right} depth={depth + 1} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DecisionTreeViewer({ root }: { root?: DecisionTreeNode }) {
  if (!root) {
    return (
      <div className="text-sm text-[#647B92] py-8 text-center">
        Decision tree structure unavailable for this model run.
      </div>
    );
  }
  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[780px] flex justify-center py-2">
        <TreeBranch node={root} />
      </div>
    </div>
  );
}
