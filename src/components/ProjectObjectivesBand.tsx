import { ArrowRight } from 'lucide-react';
import type { DomainName } from '../types/project.ts';

export type ObjectivesNavTarget =
  | 'landing'
  | 'overview'
  | 'domains'
  | 'methodologies'
  | 'dataset'
  | 'predict'
  | 'lab'
  | 'comparison';

interface ProjectObjectivesBandProps {
  onNavigate: (section: ObjectivesNavTarget, selectedDomain?: DomainName) => void;
  selectedDomain?: DomainName;
  compact?: boolean;
}

const PILLARS: Array<{
  index: string;
  tag: string;
  title: string;
  description: string;
  actionLabel: string;
  target: ObjectivesNavTarget;
}> = [
  {
    index: '01',
    tag: 'Predictive Engine',
    title: 'Delay & Duration Prediction',
    description:
      'Predict on-time or delayed status, completion duration, delay days and delay probability.',
    actionLabel: 'Open Prediction',
    target: 'predict',
  },
  {
    index: '02',
    tag: 'Explainable AI',
    title: 'Risk Factor Intelligence',
    description: 'Identify risk factors and recommend corrective actions.',
    actionLabel: 'Inspect Risk Drivers',
    target: 'lab',
  },
  {
    index: '03',
    tag: 'Benchmarking',
    title: 'Model & Process Comparison',
    description: 'Compare methodologies and ML algorithms; cluster similar projects.',
    actionLabel: 'Compare Benchmarks',
    target: 'comparison',
  },
];

export function ProjectObjectivesBand({
  onNavigate,
  selectedDomain,
  compact = false,
}: ProjectObjectivesBandProps) {
  return (
    <section
      aria-labelledby="project-objectives-heading"
      className={`bg-white border border-[#D2DFEC] rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 ${
        compact ? '' : 'mt-12'
      }`}
    >
      {/* Left Anchor Column: Deep Midnight Navy Summary */}
      <div className="lg:col-span-4 bg-[#082441] text-white p-6 lg:p-8 flex flex-col justify-between gap-6">
        <div>
          <p className="text-xs font-semibold text-[#6495C6] mb-2">
            Core Platform Architecture
          </p>
          <h2
            id="project-objectives-heading"
            className="text-xl lg:text-2xl font-bold text-white font-display leading-snug"
            style={{ textWrap: 'balance' }}
          >
            Project Objectives and Core Features
          </h2>
          <p className="text-sm text-[#B8CCE0] leading-relaxed mt-3">
            Three integrated functional pillars powering continuous risk intelligence.
          </p>
        </div>

        <div className="pt-5 border-t border-[#163A5E] flex items-center justify-between gap-4 text-xs text-[#9EB7D0]">
          <span className="font-mono-tabular">2 Regressors · 7 Classifiers</span>
          <button
            type="button"
            onClick={() => onNavigate('methodologies')}
            className="text-[#DCE5EE] hover:text-white font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            5 SDLC Models
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Column: Three Integrated Functional Pillars separated by hairline dividers */}
      <div className="lg:col-span-8 divide-y divide-[#D2DFEC]">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.index}
            className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#EFF4F9]/60 transition-colors"
          >
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#4C7DAE]">
                <span className="font-mono-tabular text-[#082441]">{pillar.index}</span>
                <span aria-hidden="true">·</span>
                <span>{pillar.tag}</span>
              </div>
              <h3 className="text-base font-bold text-[#082441] font-display">
                {pillar.title}
              </h3>
              <p className="text-sm text-[#465D75] leading-relaxed">{pillar.description}</p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() =>
                  onNavigate(
                    pillar.target,
                    pillar.target === 'predict' ? selectedDomain : undefined
                  )
                }
                className="px-4 py-2 text-xs font-semibold text-[#082441] bg-[#EFF4F9] hover:bg-[#082441] hover:text-white border border-[#C2D2E3] hover:border-[#082441] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {pillar.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
