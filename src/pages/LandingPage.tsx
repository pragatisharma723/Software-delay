import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { DomainIcon } from '../components/DomainIcon.tsx';
import { ProjectConstellation3D } from '../components/ProjectConstellation3D.tsx';
import { ProjectObjectivesBand } from '../components/ProjectObjectivesBand.tsx';
import { DOMAIN_PROFILES } from '../constants/domainKnowledge.ts';
import type { DomainName, ModelLabSnapshot } from '../types/project.ts';

export type NavSection =
  | 'landing'
  | 'overview'
  | 'domains'
  | 'methodologies'
  | 'dataset'
  | 'predict'
  | 'lab'
  | 'comparison';

interface LandingPageProps {
  snapshot: ModelLabSnapshot;
  onNavigate: (section: NavSection, selectedDomain?: DomainName) => void;
}

export function LandingPage({ snapshot, onNavigate }: LandingPageProps) {
  const [previewDomain, setPreviewDomain] = useState<DomainName>('Healthcare and Medical Software');
  const activeProfile =
    DOMAIN_PROFILES.find((d) => d.name === previewDomain) ?? DOMAIN_PROFILES[0];

  const bestClassifier =
    snapshot.classifiers.find((c) => c.id === snapshot.bestClassifierId) ?? snapshot.classifiers[0];
  const bestRegressor =
    snapshot.regressions.find((r) => r.id === snapshot.bestRegressorId) ?? snapshot.regressions[1];
  const delayedPct = snapshot.dataQuality.classBalance.delayedRatio * 100;

  return (
    <div className="min-h-screen bg-[#EFF4F9] text-[#1B324B]">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-[#D2DFEC]">
        <div className="max-w-[1380px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('landing');
            }}
            className="text-lg font-bold tracking-tight text-[#082441] whitespace-nowrap shrink-0 font-display"
          >
            ProjectPulse <span className="text-[#4C7DAE]">AI</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#465D75]">
            <button
              type="button"
              onClick={() => onNavigate('overview')}
              className="hover:text-[#082441] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => onNavigate('domains')}
              className="hover:text-[#082441] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Domains
            </button>
            <button
              type="button"
              onClick={() => onNavigate('methodologies')}
              className="hover:text-[#082441] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Methodologies
            </button>
            <button
              type="button"
              onClick={() => onNavigate('lab')}
              className="hover:text-[#082441] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Model Lab
            </button>
            <button
              type="button"
              onClick={() => onNavigate('comparison')}
              className="hover:text-[#082441] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Model Benchmarks
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('predict', previewDomain)}
              className="px-4 py-2 text-sm font-medium text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2"
            >
              Analyze Your Project
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <main id="top" className="max-w-[1380px] mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2">
            <div>
              <p className="text-xs font-semibold text-[#4C7DAE] tracking-wide mb-3">
                Software Engineering Analytics · Regression &amp; Classification ML Pipeline
              </p>
              <h1
                className="font-display font-bold text-[#082441] tracking-tight leading-[1.12] mb-5"
                style={{ fontSize: 'clamp(2.25rem, 3.6vw, 3.35rem)', textWrap: 'balance' }}
              >
                Predict software project delays before schedule slip compounds.
              </h1>
              <p className="text-base text-[#465D75] leading-relaxed max-w-xl mb-8">
                ProjectPulse AI unifies linear duration regression, seven-algorithm delay
                classification, model suitability analysis, and SDLC methodology benchmarks across
                four core software engineering sectors.
              </p>

              <div className="flex flex-wrap items-center gap-4 mb-10">
                <button
                  type="button"
                  onClick={() => onNavigate('predict', previewDomain)}
                  className="px-5 py-3 text-sm font-semibold text-white bg-[#082441] hover:bg-[#0E3154] rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  Start Project Prediction
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('overview')}
                  className="px-5 py-3 text-sm font-semibold text-[#082441] bg-white border border-[#C2D2E3] hover:border-[#4C7DAE] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Explore Live Dashboard
                </button>
              </div>
            </div>

            {/* Quiet domain selector preview */}
            <div className="pt-6 border-t border-[#D2DFEC]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#082441]">
                  Interactive Domain Context Preview
                </span>
                <span className="text-xs text-[#647B92]">
                  {activeProfile.regulatoryContext}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {DOMAIN_PROFILES.map((dom) => (
                  <button
                    key={dom.name}
                    type="button"
                    onClick={() => setPreviewDomain(dom.name)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      previewDomain === dom.name
                        ? 'bg-[#082441] text-white'
                        : 'bg-white border border-[#D2DFEC] text-[#465D75] hover:text-[#082441]'
                    }`}
                  >
                    {dom.shortName}
                  </button>
                ))}
              </div>
              <div className="flex items-start gap-3 text-sm text-[#465D75]">
                <DomainIcon
                  domain={activeProfile.name}
                  className="w-5 h-5 mt-0.5 shrink-0"
                  color={activeProfile.accentHex}
                />
                <p className="leading-relaxed">
                  <strong className="text-[#082441]">{activeProfile.name}:</strong>{' '}
                  {activeProfile.description}
                </p>
              </div>
            </div>
          </div>

          {/* 3D Interactive Project Management Schedule & Milestone Architecture */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="bg-[#07213B] rounded-xl border border-[#163A5E] overflow-hidden flex-1 flex flex-col shadow-sm">
              <div className="px-5 py-3.5 border-b border-[#163A5E] flex items-center justify-between text-xs text-[#9EB7D0]">
                <span>3D Project Schedule &amp; Milestone Architecture · {activeProfile.shortName}</span>
                <span className="font-mono-tabular text-[#DCE5EE]">
                  {snapshot.dataQuality.totalRows} Historical Records
                </span>
              </div>
              <div className="flex-1 min-h-[380px]">
                <ProjectConstellation3D
                  activeDomain={previewDomain}
                  accentHex={activeProfile.accentHex}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Live Benchmark Strip */}
        <section className="mt-12 bg-white border border-[#D2DFEC] rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#D2DFEC]">
          <div className="p-6">
            <div className="text-xs text-[#647B92] mb-1">Active Benchmark Dataset</div>
            <div className="text-2xl font-bold text-[#082441] font-mono-tabular">
              {snapshot.dataQuality.totalRows} Projects
            </div>
            <div className="text-xs text-[#465D75] mt-1.5">
              {delayedPct.toFixed(1)}% delayed · {snapshot.sourceType === 'synthetic' ? 'Synthetic benchmark' : 'Uploaded CSV'}
            </div>
          </div>

          <div className="p-6">
            <div className="text-xs text-[#647B92] mb-1">Top Classification Model</div>
            <div className="text-2xl font-bold text-[#082441] font-mono-tabular">
              {(bestClassifier.f1 * 100).toFixed(1)}% F1
            </div>
            <div className="text-xs text-[#465D75] mt-1.5">
              {bestClassifier.name} · ROC-AUC {bestClassifier.rocAuc.toFixed(3)}
            </div>
          </div>

          <div className="p-6">
            <div className="text-xs text-[#647B92] mb-1">Duration Regression Fit</div>
            <div className="text-2xl font-bold text-[#082441] font-mono-tabular">
              R² {bestRegressor.r2.toFixed(3)}
            </div>
            <div className="text-xs text-[#465D75] mt-1.5">
              {bestRegressor.name} · RMSE {bestRegressor.rmse} days
            </div>
          </div>

          <div className="p-6">
            <div className="text-xs text-[#647B92] mb-1">Coverage &amp; Model Suite</div>
            <div className="text-2xl font-bold text-[#082441] font-mono-tabular">
              4 Domains · 5 SDLC
            </div>
            <div className="text-xs text-[#465D75] mt-1.5">
              7 Classifiers + 2 Duration Regressors
            </div>
          </div>
        </section>

        {/* Project Objectives & Core Features (3 Functional Pillars) */}
        <ProjectObjectivesBand onNavigate={onNavigate} selectedDomain={previewDomain} />

        {/* Architecture & Capabilities Grid */}
        <section className="mt-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#082441] font-display">
                Unified Machine Learning &amp; Software Engineering Architecture
              </h2>
              <p className="text-sm text-[#647B92] mt-1">
                Every prediction pipeline is trained on a stratified 80/20 split with zero train-test data leakage.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('lab')}
              className="text-sm font-medium text-[#356594] hover:text-[#082441] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              Open ML Model Laboratory
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-[#4C7DAE] mb-2">01. Regression</div>
                <h3 className="text-base font-semibold text-[#082441] mb-2">
                  Duration &amp; Delay Forecasting
                </h3>
                <p className="text-sm text-[#465D75] leading-relaxed">
                  Simple and Multiple Linear Regression with Ridge stabilization predict completion duration and expected delay days with R², MAE, MSE, and RMSE telemetry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('lab')}
                className="mt-5 text-xs font-semibold text-[#356594] hover:text-[#082441] text-left cursor-pointer"
              >
                Inspect Regression Models →
              </button>
            </div>

            <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-[#4C7DAE] mb-2">02. Classification</div>
                <h3 className="text-base font-semibold text-[#082441] mb-2">
                  Seven-Algorithm Delay Benchmark
                </h3>
                <p className="text-sm text-[#465D75] leading-relaxed">
                  Logistic Regression, Gaussian Naive Bayes, CART Decision Tree, Linear/RBF SVM, KNN, Random Forest, and Gradient Boosting evaluated side by side.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('comparison')}
                className="mt-5 text-xs font-semibold text-[#356594] hover:text-[#082441] text-left cursor-pointer"
              >
                Compare All 7 Classifiers →
              </button>
            </div>

            <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-[#4C7DAE] mb-2">03. Model Suitability</div>
                <h3 className="text-base font-semibold text-[#082441] mb-2">
                  Input Fit &amp; Selection Rationale
                </h3>
                <p className="text-sm text-[#465D75] leading-relaxed">
                  Understand which project input structures suit each algorithm, why predictions vary across models, and why one primary classifier is selected via F1 + ROC-AUC.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('comparison')}
                className="mt-5 text-xs font-semibold text-[#356594] hover:text-[#082441] text-left cursor-pointer"
              >
                Study Model Selection Logic →
              </button>
            </div>

            <div className="bg-white border border-[#D2DFEC] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-[#4C7DAE] mb-2">04. Software Engineering</div>
                <h3 className="text-base font-semibold text-[#082441] mb-2">
                  4 Industry Domains &amp; 5 SDLC Models
                </h3>
                <p className="text-sm text-[#465D75] leading-relaxed">
                  Streamlined prediction workflow covering Healthcare, Banking &amp; FinTech, E-commerce, and Enterprise software across Waterfall, Agile, Spiral, V-Model, and Iterative lifecycles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('predict', previewDomain)}
                className="mt-5 text-xs font-semibold text-[#356594] hover:text-[#082441] text-left cursor-pointer"
              >
                Launch Prediction Workspace →
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#D2DFEC] bg-white mt-12">
        <div className="max-w-[1380px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#647B92]">
          <span>ProjectPulse AI · Software Project Delay Prediction Platform</span>
          <span>
            Active Dataset: {snapshot.datasetName} ({snapshot.sourceType === 'synthetic' ? 'Synthetic Benchmark' : 'User CSV'})
          </span>
        </div>
      </footer>
    </div>
  );
}
