# ProjectPulse AI — Software Project Delay Prediction & Risk Intelligence Platform

## 1. Project Overview
**ProjectPulse AI** is an end-to-end machine learning and software engineering analytics platform built to forecast software project completion durations, predict schedule delay risks, uncover latent project archetypes, and evaluate competing ML algorithms on a unified, zero-leakage pipeline.

## 2. Objectives
- Predict whether an in-flight software project will finish **On Time** or be **Delayed** (`Is_Delayed`) along with calibrated delay probabilities.
- Forecast **Estimated Completion Duration (days)** and **Expected Delay Days** via regression modeling.
- Quantify the impact of **9 industry domains** and **5 software development methodologies** (plus optional DevOps CI/CD practices).
- Compare **10 supervised ML models** (2 Regression, 8 Classification/Ensemble) and **2 unsupervised clustering algorithms** using consistent evaluation protocols.
- Provide transparent, explainable predictions (CART decision rules, Random Forest feature importances, KNN nearest historical projects, and 6-dimension Risk Intelligence) with downloadable PDF and CSV reports.

## 3. Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Plotly (`plotly.js-dist-min`), Three.js (`ProjectConstellation3D`), Lucide React, jsPDF.
- **Backend**: Node.js (v22+) & Express (`server.ts`) exposing typed REST endpoints for data ingestion, preprocessing, model training/retraining, clustering, and prediction.
- **Persistence**: Built-in SQLite (`node:sqlite`) persisting datasets, historical project records, model evaluation runs, and prediction reports in `data/projectpulse.db`.
- **Machine Learning Engine**: Custom, mathematically rigorous TypeScript ML suite (`server/ml/`) implementing exact OLS/Ridge regression, L2-regularized Logistic Regression, Gaussian Naive Bayes, CART Decision Trees, Linear & RBF Kernel SVM with Platt scaling, KNN with K-sweep, Random Forest, Soft Voting, Gradient Boosting, K-Means++ with Jacobi PCA, and Agglomerative Hierarchical Clustering.

## 4. Dataset Description & Provenance
- **Default Benchmark Dataset**: A deterministic (`seed=42`), configurable synthetic software project dataset (`n=420` by default, configurable 80–1000) spanning all 9 domains and 5 SDLC methodologies. Clearly labeled as synthetic benchmark data.
- **Custom CSV Support**: Users can upload any CSV following the schema (missing cells are imputed using training-split medians; duplicate `Project_ID`s are removed; IQR outliers are audited).
- **Target Consistency**:
  - `Delay_Days = Actual_Duration_Days - Planned_Duration_Days`
  - `Is_Delayed = 1` when `Delay_Days > 0`, else `0`
  - Target columns (`Actual_Duration_Days`, `Delay_Days`, `Project_Status`, `Is_Delayed`) are strictly excluded from input features `X`.

## 5. Feature Descriptions
- **Identification & Planning**: `Project_ID`, `Project_Name`, `Domain`, `Software_Development_Methodology`, `DevOps_Enabled`, `Project_Complexity`, `Project_Priority`, `Planned_Duration_Days`, `Team_Size`, `Budget`, `Number_of_Modules`, `Number_of_Tasks`.
- **Progress & Execution**: `Tasks_Completed`, `Tasks_Pending`, `Completion_Percentage`, `Sprint_Completion_Rate`, `Milestone_Completion_Rate`.
- **Quality & Dependencies**: `Bugs_Reported`, `Critical_Bugs`, `Bugs_Resolved`, `Defect_Density`, `Code_Complexity`, `Rework_Hours`, `Testing_Completion_Percentage`, `Integration_Issues`, `Number_of_Dependencies`, `External_Dependencies`, `Dependency_Delay`.
- **Team & Scope**: `Developer_Experience`, `Team_Productivity`, `Team_Turnover`, `Communication_Efficiency`, `Resource_Availability`, `Requirement_Changes`, `Scope_Creep`.
- **Methodology & DevOps Telemetry**: `Sprint_Duration`, `Sprint_Velocity`, `Sprint_Spillover`, `Iteration_Count`, `Phase_Completion`, `Risk_Mitigation_Status`, `Test_Case_Completion`, `Feedback_Cycles`, `Deployment_Frequency`, `Build_Failure_Rate`, `Pipeline_Health`.

## 6. Machine Learning Algorithms & Applications
1. **Simple Linear Regression**: Single-feature OLS predicting `Actual_Duration_Days`.
2. **Multiple Linear Regression**: Ridge-stabilized OLS across all encoded features predicting `Actual_Duration_Days`.
3. **Logistic Regression**: L2-regularized gradient descent with balanced class weights predicting `P(Is_Delayed = 1)`.
4. **Gaussian Naive Bayes**: Class priors and per-feature Gaussian likelihoods with variance smoothing.
5. **Decision Tree Classifier (CART)**: Gini-impurity binary tree extracting human-readable IF-THEN rules and decision paths.
6. **Support Vector Machine (SVM)**: Evaluates both **Linear** and **RBF** kernels with Platt sigmoid probability calibration.
7. **K-Nearest Neighbors (KNN)**: Standardized Euclidean distance with K-sweep (`3..11`) and retrieval of the closest historical projects.
8. **Random Forest Classifier**: 25 bootstrap CART trees with `sqrt(p)` feature subsampling.
9. **Voting Classifier**: Soft-voting ensemble combining Logistic Regression, Gaussian Naive Bayes, and Decision Tree.
10. **Gradient Boosting Classifier**: Stage-wise shallow regression trees fitting negative binary log-loss gradients.
11. **K-Means++ & PCA**: Unsupervised clustering with Elbow WCSS curve, Silhouette score, and 2D Jacobi PCA projection.
12. **Agglomerative Hierarchical Clustering**: Ward, Complete, and Average linkage producing an interactive Dendrogram.

## 7. Software Development Methodologies Supported
- **Waterfall** (sequential phase gates & requirement stability)
- **Agile (Scrum)** (sprint velocity, completion rate, sprint spillover)
- **Spiral** (cyclic risk assessment & mitigation progress)
- **V-Model** (paired verification & validation test coverage)
- **Iterative and Incremental** (increment count, feedback cycles, integration)
- **DevOps CI/CD Extension** (deployment frequency, build failure rate, pipeline health)

## 8. Model Evaluation Techniques
- **Zero-Leakage Pipeline**: Stratified 80/20 train/test split (`seed=42`); median imputation and `StandardScaler` fitted strictly on `X_train`.
- **Regression Metrics**: R², MAE, MSE, RMSE.
- **Classification Metrics**: Accuracy, Precision, Recall, F1-Score, ROC-AUC, 3-Fold Stratified CV Accuracy, Confusion Matrix, and Latency (ms).
- **Evidence-Based Selection**: Best classifier is selected dynamically via composite score `0.60 × F1 + 0.40 × ROC-AUC` on the held-out test set.
- **Clustering Metrics**: Silhouette Score & WCSS Inertia.

## 9. System Architecture
```
/
├── server.ts                  # Express server + Vite middleware (port 3000)
├── server/
│   ├── data/datasetGenerator.ts
│   ├── database/db.ts         # SQLite persistence (node:sqlite)
│   └── ml/                    # mathUtils, preprocessing, regression, classifiers, clustering, engine
├── src/
│   ├── components/            # PlotlyChart, ProjectConstellation3D, DecisionTreeViewer, DendrogramChart
│   ├── constants/             # Domain & methodology profiles + presets
│   ├── pages/                 # Landing + 10 analytical dashboard modules
│   ├── services/              # API client & jsPDF/CSV exporters
│   └── types/                 # Shared TypeScript schemas
```

## 10. Installation & Execution Instructions
```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server (Express + Vite on port 3000)
npm run dev

# 3. Type-check and build production bundle
npm run lint
npm run build

# 4. Run production server
npm start
```
