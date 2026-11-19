import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

const GLOSSARY: Record<string, string> = {
  'R²': 'Coefficient of Determination (0 to 1): proportion of variance in actual project duration explained by the regression model.',
  RMSE: 'Root Mean Squared Error: standard deviation of prediction residuals in days, penalizing larger errors.',
  MAE: 'Mean Absolute Error: average absolute difference between predicted and actual project duration in days.',
  'ROC-AUC': 'Area Under the Receiver Operating Characteristic Curve: probability that the classifier ranks a delayed project higher than an on-time project.',
  'F1-Score': 'Harmonic mean of Precision and Recall, balancing false alarms against missed project delays.',
  'Silhouette Score': 'Clustering separation quality from -1 to +1; higher values indicate dense, well-separated project risk clusters.',
  'Gini Impurity': 'Decision tree node split criterion measuring class mixture (0 = pure delayed or on-time node).',
  PCA: 'Principal Component Analysis: orthogonal projection reducing 8 clustering dimensions into PC1 & PC2 while preserving maximum variance.',
};

export function TooltipTerm({ term }: { term: keyof typeof GLOSSARY | string }) {
  const [open, setOpen] = useState(false);
  const definition = GLOSSARY[term];
  if (!definition) return <span>{term}</span>;

  return (
    <span className="relative inline-flex items-center gap-1">
      <span>{term}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={`Explain ${term}`}
        className="text-[#647B92] hover:text-[#082441] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C7DAE] rounded"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-40 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg bg-[#082441] text-white text-xs leading-relaxed font-normal shadow-lg pointer-events-none"
        >
          {definition}
        </span>
      )}
    </span>
  );
}
