# CI/CD Agent Evaluation via Power Platform Pipelines

## Overview
Extend Power Platform Pipelines to automatically evaluate Copilot Studio agents during deployment using the same review patterns from the Agent Review Tool.

---

## Distribution Model

This project is a **reference implementation** — organizations copy the code into their own repo and adapt it to their needs. Each org owns their runtime, secrets, and customizations.

### What Ships with Copilot Studio Kit Solution (already imported by consumers)
- ✅ AI Builder custom prompts (Stage B/C evaluation)
- ✅ Dataverse tables (`cat_agentreviews`, config tables)
- ✅ Power Automate orchestrator flow (`Agent Review - Pre-Deployment Gate`)
- ✅ Connection references (GitHub HTTP, Dataverse)
- ✅ Scoring criteria / rubrics
- ✅ Environment Variables (all plain text):
  | Variable | Type | Purpose |
  |----------|------|---------|
  | `cat_GitHubPAT` | Text | GitHub PAT with `repo` + `workflow` scopes for workflow_dispatch |
  | `cat_GitHubRepoOwner` | Text | Repo owner/org name |
  | `cat_GitHubRepoName` | Text | Repo name |
  | `cat_PipelineName` | Text | Pipeline name for trigger filtering |

### What Consumers Copy into Their Repo
- The `agent-review-pipeline/` folder (Node.js source + `action.yml`) — copied or forked as a starting point
- The workflow template (`.github/workflows/agent-review.yml`)
- Consumers own and can customize: scoring thresholds, additional patterns, custom rubrics
- 3 GitHub secrets: `CLIENT_ID`, `TENANT_ID`, `CLIENT_SECRET`

### Manual Admin Setup (documented, one-time)
- Pipeline creation + "Pre-deployment Step Required" enabled on target stage
- SPN App Registration + Application User in pipeline host environment
- GitHub PAT (for Power Automate → GitHub dispatch)
- Pipeline stage ↔ flow binding

### Consumer Experience
1. **Import** Copilot Studio Kit solution → gets flow + prompts + tables
2. **Copy** the `agent-review-pipeline/` folder + workflow template into their repo
3. **Configure** 3 secrets in GitHub: `CLIENT_ID`, `TENANT_ID`, `CLIENT_SECRET`
4. **Create** pipeline + enable pre-deployment step (admin, one-time)
5. **Bind** the shipped flow to their pipeline
6. **Customize** (optional) — adjust thresholds, add patterns, modify prompts
7. **Done** — deployments now auto-evaluate

---

## Phase 1: Extract & Parse (GitHub Action — Reference Implementation) ✅ COMPLETE

### Step 1.1 — Standalone Node.js package ✅
- **Repo**: https://github.com/Ramakrishnan24689/agent-review-pipeline
- **Ported from**: Agent Review Tool (`csZipParser.ts`, `StageAService.ts`, `YamlParsingService.ts`, `yamlUtils.ts`, `patternUtils.ts`)
- **CLI**: `node dist/index.js --zip <path-to-solution.zip>` → outputs `LocalStageAOutput` JSON
- **Structure**:
  ```
  src/
  ├── index.ts              # CLI entry point
  ├── parser/
  │   ├── csZipParser.ts    # Solution ZIP parsing (Buffer-based)
  │   └── yamlUtils.ts      # YAML preprocessing + variable extraction
  ├── analysis/
  │   ├── StageAService.ts  # 10 deterministic pattern checks
  │   └── patternUtils.ts   # Severity/category constants
  └── models/
      └── types.ts          # All TypeScript interfaces
  ```

### Step 1.2 — GitHub Action (`action.yml`) ✅
- **Type**: Composite action — lives in the consumer's repo (copied from this reference)
- **Usage by consumers** (in their `.github/workflows/agent-review.yml`):
  ```yaml
  - uses: ./agent-review-pipeline
    with:
      artifact_url: ${{ inputs.artifact_url }}
      callback_url: ${{ inputs.callback_url }}
    env:
      CLIENT_ID: ${{ secrets.CLIENT_ID }}
      TENANT_ID: ${{ secrets.TENANT_ID }}
      CLIENT_SECRET: ${{ secrets.CLIENT_SECRET }}
  ```
- **Action inputs**: `artifact_url`, `callback_url`, `callback_secret` (optional)
- **Action outputs**: `stage_a_json` (also POSTed to callback_url)
- **Internal steps** (inside `action.yml`):
  1. Setup Node.js 20
  2. Install dependencies (`npm ci`)
  3. Build TypeScript (`npm run build`)
  4. Authenticate to Dataverse (OAuth client_credentials)
  5. Download solution artifact ZIP
  6. Run StageA parsing on the ZIP
  7. POST `LocalStageAOutput` JSON to `callback_url`

### Step 1.3 — Workflow template (to be added)
- **File**: `.github/workflows/agent-review.yml` (consumers copy this into their repo)
- **Trigger**: `workflow_dispatch` (called by Power Automate)
- **Inputs**: `artifact_url`, `solution_name`, `user_name`, `callback_url`
- **Body**: Calls the local action (`uses: ./agent-review-pipeline`) with secrets
- **Customizable**: Consumers can add steps (e.g., notifications, additional checks)

### Step 1.4 — Auth & Security
- **Secrets** (configured in consumer's GitHub repo settings):
  - `CLIENT_ID` — Entra ID app registration client ID
  - `TENANT_ID` — Entra ID tenant
  - `CLIENT_SECRET` — App registration secret
- **Auth flow for artifact download**:
  1. Extract Dataverse host from `artifact_url` (e.g., `https://org.crm.dynamics.com/...`)
  2. Request OAuth token: `POST https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token` with `scope=https://{dataverseHost}/.default` and `grant_type=client_credentials`
  3. Download artifact ZIP: `GET {artifact_url}` with `Authorization: Bearer {token}`
  4. Base64-decode response → write ZIP file
- **SPN requirements**:
  - App registration must be added as an **Application User** in the pipeline host Dataverse environment
  - Security role: minimum **Service Reader** or a custom role with read on `deploymentartifact` table
  - The SPN does NOT need access to target environments — it only reads from the pipeline host
- **Callback auth**:
  - Power Automate HTTP webhook URLs are unguessable (contain a unique SAS token)
  - For additional security: pass a `callback_secret` input and include it as a header in the POST back

### Step 1.3 — Alternative: Parse ZIP directly (skip unpack) ✅
- The CLI uses JSZip to read the raw ZIP without unpacking first
- Simpler workflow (no `pac solution unpack` step needed)
- Already proven — ported from `csZipParser.ts`

---

## Phase 2: AI Evaluation (GitHub Action — runs after Stage A)

### Step 2.1 — Create Power Automate flow (solution-aware, ships with Copilot Studio Kit)
- **Trigger**: Dataverse `OnPreDeploymentStarted` action (requires "Pre-deployment Step Required" extension enabled on pipeline stage)
- **Solution component**: Cloud flow included in Copilot Studio Kit managed solution
- **Connection references**: Dataverse (for gating action only)
- **Gating action**: `UpdatePreDeploymentStepStatus` (20 = complete, 30 = reject with comments)
- **Flow actions** (simplified — evaluation moved to GitHub Action):
  1. Extract `ArtifactFileDownloadLink`, `ArtifactName`, `DeployAsUser` from trigger outputs
  2. Dispatch GitHub Action via HTTP Webhook (passes artifact URL + callback URL)
  3. Wait for callback (receives full evaluation result including scores)
  4. Read `scores.passed` → call `UpdatePreDeploymentStepStatus` with status 20 (pass) or 30 (reject + reason)

### Step 2.2 — Stage B: Pattern Evaluation (in GitHub Action)
- Called by the GitHub Action after Stage A completes
- Uses SPN OAuth token (same credentials as artifact download) to call PredictV2 on Dataverse
- AI Builder model: `Stage B GenAI - Copilot Pattern Evaluation` (ID: `62476684-f62f-4359-911b-c2b5d5256595`)
- Input: `botcomponents` — filtered topicComponents from Stage A output
- Output: `PatternEvaluation` with Patterns array (Status: true/false per pattern)

### Step 2.3 — Stage C: Instruction Compliance (in GitHub Action)
- Called by the GitHub Action after Stage B
- Uses same SPN OAuth token to call PredictV2 on Dataverse
- AI Builder model: `Evaluate Agent Instructions` (ID: `42b1b48f-6718-4d86-b71c-bf551ad9acaf`)
- Input: `Instruction_20Input` — agent instructions text from Stage A output
- Output: `InstructionEvaluation` with issues array

### Step 2.4 — Score Calculation & Quality Gate (in GitHub Action)
- **Scoring runs in the GitHub Action** — deterministic, severity-weighted:
  - `patternScore = (passing / total) × 100`
  - `instructionScore` = severity-weighted (High=3, Medium=2, Low=1; 15 criteria = 35 max pts)
  - `overallScore = (patternScore × 0.5) + (instructionScore × 0.5)`
- **Threshold**: Configurable via action input (default: 60)
- **Callback payload** includes: `stageA`, `stageB`, `stageC`, `scores` (with `passed` boolean)
- Power Automate flow just reads `scores.passed` and gates accordingly

---

## Phase 3: Deployment Gating & Reporting

### Step 3.1 — Gate the pipeline deployment
- If score passes threshold → `UpdatePreDeploymentStepStatus` with status **20** (complete)
- If score fails → `UpdatePreDeploymentStepStatus` with status **30** (reject) + maker-facing comments explaining issues found
- Use `ApprovalComments` field to surface review summary to the requesting maker

### Step 3.2 — Write results back
- Save full review JSON to Dataverse (`cat_reviewresultjson` field)
- Update deployment stage run with review summary in `deploymentnotes`
- Optionally generate PDF report (Stage D) and attach

### Step 3.3 — Notify stakeholders
- Send Teams/email notification with review summary
- Include link to full review in Copilot Studio Kit app

---

## Phase 4: Configuration & Customization

### Step 4.1 — Configurable review rules
- Store threshold settings in Dataverse config table (`copilotconfiguration`)
- Allow per-environment or per-solution thresholds
- Custom prompts: Allow admins to override Stage B/C prompts

### Step 4.2 — Custom rubrics support
- Reuse the rubrics feature from Agent Review Tool
- Pass selected rubric criteria into Stage B/C prompts
- Store rubric association per pipeline stage

---

## Architecture Diagram

```
Power Platform Pipeline
       │
       │ Pre-deployment Step Required (enabled)
       │ OnPreDeploymentStarted
       ▼
┌──────────────────────┐
│   Power Automate     │
│   (Orchestrator)     │
│                      │
│  1. Get artifact URL │
│  2. Dispatch GH      │─────────┐
│     workflow via      │         │ workflow_dispatch
│     HTTP Webhook      │         │ (passes artifact_url + callback_url)
│  3. Wait for         │         │
│     callback...      │         │
└──────────┬───────────┘         │
           │                     ▼
           │         ┌───────────────────────────┐
           │         │   GitHub Action            │
           │         │                            │
           │         │  1. Download ZIP (SPN)     │
           │         │  2. Stage A: Parse +       │
           │         │     10 pattern checks      │
           │         │  3. Stage B: PredictV2     │
           │         │     (Pattern Evaluation)   │
           │         │  4. Stage C: PredictV2     │
           │         │     (Instruction Compliance)│
           │         │  5. Score calculation      │
           │         │  6. POST full result back  │
           │         └───────────┬────────────────┘
           │                     │ HTTP callback
           │◀────────────────────┘ (scores + full evaluation)
           │
           │  Read scores.passed
           ▼
┌──────────────────────┐
│   Power Automate     │
│   (Gating only)      │
│                      │
│  4. If passed:       │
│     Status = 20      │
│  5. If failed:       │
│     Status = 30      │
│     + comments       │
│  6. (Optional) Save  │
│     to Dataverse     │
└──────────────────────┘
```

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Parse ZIP in GH Action vs Power Automate? | GH Action (more compute, Node.js native) |
| 2 | ZIP vs unpacked folder parsing? | ZIP directly (`csZipParser.ts` already works) |
| 3 | Callback mechanism? | HTTP webhook (Power Automate trigger) |
| 4 | Where to run AI evaluation (Stage B/C)? | **GitHub Action** — SPN calls PredictV2 directly on Dataverse |
| 5 | Gating: hard block vs advisory? | Configurable per pipeline stage |
| 6 | Distribution model? | **Reference implementation** — consumers copy into their repo, own and customize |
| 7 | Flow distribution? | **Ships in Copilot Studio Kit solution** as managed cloud flow |
| 8 | Where does scoring happen? | **GitHub Action** — deterministic, severity-weighted, included in callback |
| 9 | Environment variable types? | All **plain text** — no Key Vault dependency |

---

## Reusable Code from Agent Review Tool

| Source File | What It Does | CI/CD Reuse |
|-------------|-------------|-------------|
| `csZipParser.ts` | Parses solution ZIP → bots + BotComponent[] | Core of GH Action |
| `StageAService.ts` | 10 deterministic pattern checks | Core of GH Action |
| `YamlParsingService.ts` | YAML preprocessing + parsing | Dependency of StageA |
| `yamlUtils.ts` | extractVariables, preprocessYaml, extractAgentInstructions | Dependency of StageA |
| `patternUtils.ts` | Pattern severity mappings | Scoring logic |
| `scoreCalculator.ts` | Overall/pattern/instruction score math | Quality gate |
| `Constants.ts` (AI_MODEL_IDS) | PredictV2 model references | Fixed IDs, hardcoded in flow unbound action calls |
| Stage B/C prompts | AI evaluation criteria | Power Automate AI calls |

---

## Estimated Effort

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 1 (GitHub Action — Reference) | ✅ Complete | Repo: Ramakrishnan24689/agent-review-pipeline |
| Phase 2 (Power Automate flow in solution) | 3-4 hours | Flow + PredictV2 unbound action + connection references |
| Phase 3 (Gating & Reporting) | 1 hour | Pipeline config + UpdatePreDeploymentStepStatus |
| Phase 4 (Configuration) | Optional / future | Config tables + custom rubrics |
| **Total** | **~1 day** | Assumes AI Builder models already deployed and pipeline host environment exists |

---

## Prerequisites

1. **AI Builder models** deployed in pipeline host environment (Stage B/C/D)
2. **GitHub PAT** for Power Automate → GitHub workflow_dispatch calls
3. **App registration** (SPN) for GitHub → Dataverse artifact download
4. **"Pre-deployment Step Required" extension** enabled on the target pipeline stage
5. **Pipeline manually created by admin** — pipelines are not solution-shippable; admins create the managed pipeline and bind it to the shipped flow
6. **Personal pipelines (make.powerapps.com) cannot be extended** — this only works with admin-managed pipelines
7. **Dataverse table** (`cat_agentreviews`) available in pipeline host environment
