# End-to-End Testing Guide

This guide covers testing **as the publisher** (you building the action) and validates the full pipeline before consumers adopt it.

---

## Pre-requisites Setup

### 1a. Create Entra ID App Registration

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: `Agent Review Pipeline SPN` (or similar)
3. Supported account types: **Single tenant**
4. Redirect URI: Leave blank (no redirect needed for client credentials)
5. Click **Register**
6. Note down:
   - **Application (client) ID** → this becomes `CLIENT_ID`
   - **Directory (tenant) ID** → this becomes `TENANT_ID`

### 1b. Generate Client Secret

1. In the app registration → **Certificates & secrets** → **Client secrets** → **New client secret**
2. Description: `Agent Review Pipeline`
3. Expires: 24 months (or your org policy)
4. Click **Add**
5. **Copy the secret value immediately** (shown only once) → this becomes `CLIENT_SECRET`

### 1c. Add as Application User in Pipeline Host Environment

1. Go to **Power Platform Admin Center** → **Environments** → select your **pipeline host environment**
2. Click **Settings** → **Users + permissions** → **Application users**
3. Click **+ New app user**
4. Select the app registration you created (`Agent Review Pipeline SPN`)
5. Select **Business unit**: root business unit
6. Click **Create**

### 1d. Assign Security Role

1. On the same Application users page, click on the newly created app user
2. Click **Edit security roles**
3. Assign **System Customizer** role (needed for PredictV2/AI Builder calls) — or create a custom role with:
   - Read on `deploymentartifact` table (for ZIP download)
   - Execute on `Predict` unbound action (for Stage B/C AI evaluation)
4. Click **Save**

**Note**: The SPN now calls both the artifact download API and PredictV2 (AI Builder) on Dataverse, so it needs broader permissions than just "Service Reader".

### 1e. Add GitHub Repository Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:
   - Name: `CLIENT_ID` → Value: Application (client) ID from step 1a
   - Name: `TENANT_ID` → Value: Directory (tenant) ID from step 1a
   - Name: `CLIENT_SECRET` → Value: Secret value from step 1b

### 1f. Create GitHub PAT (for Power Automate → GitHub dispatch)

1. Go to **GitHub** → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Click **Generate new token**
3. Token name: `Agent Review Pipeline - Power Automate`
4. Expiration: 90 days (or your policy)
5. Repository access: **Only select repositories** → select your repo
6. Permissions:
   - **Actions**: Read and write (needed for `workflow_dispatch`)
   - **Contents**: Read (needed to reference workflow file)
7. Click **Generate token**
8. **Copy the token** → you'll use this in the Power Automate flow's HTTP action

### 1g. Verify AI Builder Prompts are Deployed

1. Go to **make.powerapps.com** → select the pipeline host environment
2. Go to **AI models** (or **Solutions** → open Copilot Studio Kit solution)
3. Confirm these custom prompts exist and are published:
   - Stage B evaluation prompt (pattern evaluation)
   - Stage C evaluation prompt (instruction compliance)
4. The **model IDs are fixed** across all environments (shipped with the managed solution):
   - Stage B (Pattern Evaluation): `62476684-f62f-4359-911b-c2b5d5256595`
   - Stage C (Instruction Compliance): `42b1b48f-6718-4d86-b71c-bf551ad9acaf`
   - Stage D (PDF Report): `23c0ffb9-139c-4f07-afe8-4d3c7c847f95`
5. No lookup needed — use these IDs directly in the Power Automate unbound action calls

### 1h. Configure Solution Environment Variables

The Power Automate flow shipped with Copilot Studio Kit references these **Environment Variables** — consumers must set values after importing the solution.

| Variable Schema Name | Type | Purpose | Example Value |
|---------------------|------|---------|---------------|
| `cat_GitHubPAT` | Text | GitHub PAT with `repo` + `workflow` scopes. Used by the orchestrator flow to trigger the agent review GitHub Action via workflow_dispatch. | `ghp_xxxxxxxxxxxx` |
| `cat_GitHubRepoOwner` | Text | The GitHub user or organization that owns the agent-review-pipeline repository. | `Ramakrishnan24689` |
| `cat_GitHubRepoName` | Text | The name of the GitHub repository containing the agent review pipeline action. | `agent-review-pipeline` |
| `cat_PipelineName` | Text | The exact name of the Power Platform pipeline that should trigger agent reviews. Only deployments through this pipeline will invoke the review flow. Case-sensitive. | `Agent Review Test Pipeline` |

**Display names in solution**:
- `Agent Review Tool | GitHub Personal Access Token` → `cat_GitHubPAT`
- `Agent Review Tool | GitHub Repository Name` → `cat_GitHubRepoName`
- `Agent Review Tool | GitHub Repository Owner` → `cat_GitHubRepoOwner`
- `Agent Review Tool | Pipeline Name Filter` → `cat_PipelineName`

**How to set values**:
1. Go to **make.powerapps.com** → select the pipeline host environment
2. Go to **Solutions** → open **Agent Review Pipeline** solution (or the solution containing the env variables)
3. Find **Environment variables** in the left nav (or filter by type)
4. Click each variable → **Edit** → set the **Current Value** for this environment
5. All variables are plain text — no Azure Key Vault required

**⚠️ Important**: These must be set before the flow can run successfully. Without them, the HTTP dispatch action will fail.

---

## Step 1: Verify the GitHub Action Locally

The action source code is already built and committed to `https://github.com/Ramakrishnan24689/agent-review-pipeline`. This step verifies it works against a real solution ZIP.

### 1a. Clone the reference repo (or use the existing folder)

```bash
# If starting fresh:
git clone https://github.com/Ramakrishnan24689/agent-review-pipeline.git
cd agent-review-pipeline

# Or if already in the Code App repo:
cd agent-review-pipeline
```

### 1b. Install and build

```bash
npm install
npm run build
```

**Expected**: TypeScript compiles with no errors. `dist/` folder is created with compiled JS.

### 1c. Export a test solution ZIP

Export a solution from your dev environment that contains at least one Copilot Studio agent:

```bash
pac solution export --name "YourSolutionName" --path ./test-solution.zip
```

Or download a solution ZIP manually from **make.powerapps.com** → **Solutions** → select solution → **Export** → **Unmanaged**.

### 1d. Run Stage A analysis locally

```bash
node dist/index.js --zip ./test-solution.zip
```

**Expected output**: JSON containing `LocalStageAOutput` with pattern results for each generative-AI-enabled bot in the solution.

Example output structure:
```json
{
  "botName": "My Agent",
  "patterns": [
    {
      "id": "missing-instructions",
      "name": "Missing Instructions",
      "detected": false,
      "severity": "High"
    }
  ],
  "componentSummary": { ... }
}
```

**If no bots in solution**: Output will be empty array `[]` — use a solution that contains at least one Copilot Studio agent with Generative AI enabled.

**If parse errors**: Ensure the ZIP is a valid Power Platform solution (not a managed solution export from prod without bot source).

---

## Step 2: Test the GitHub Action in Isolation

### 2a. Create the consumer workflow template

Create `.github/workflows/agent-review.yml`:

```yaml
name: Agent Review Pipeline

on:
  workflow_dispatch:
    inputs:
      artifact_url:
        description: 'Dataverse artifact download URL'
        required: true
        type: string
      solution_name:
        description: 'Solution name being deployed'
        required: true
        type: string
      user_name:
        description: 'User who submitted the deployment'
        required: false
        type: string
      callback_url:
        description: 'Power Automate webhook URL for results'
        required: true
        type: string

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Agent Review
        uses: ./agent-review-pipeline
        env:
          CLIENT_ID: ${{ secrets.CLIENT_ID }}
          TENANT_ID: ${{ secrets.TENANT_ID }}
          CLIENT_SECRET: ${{ secrets.CLIENT_SECRET }}
        with:
          artifact_url: ${{ inputs.artifact_url }}
          callback_url: ${{ inputs.callback_url }}
```

### 2b. Test with a real artifact URL

First, get a real artifact URL from a prior pipeline deployment:
1. Go to **Power Platform Admin Center** → **Pipelines** → **Run history**
2. Find a completed run and note the solution artifact details
3. Alternatively, construct one: `https://{org}.crm.dynamics.com/api/data/v9.2/deploymentartifacts({id})/artifactfile`

Or for initial testing, **use a local ZIP and skip the download step**:
```bash
# Quick local test (bypasses auth)
cd agent-review-pipeline
node dist/index.js --zip ./test-solution.zip
```

### 2c. Test the full workflow via GitHub CLI

```bash
gh workflow run agent-review.yml \
  -f artifact_url="https://yourorg.crm.dynamics.com/api/data/v9.2/deploymentartifacts(GUID)/artifactfile" \
  -f solution_name="TestSolution" \
  -f user_name="testuser" \
  -f callback_url="https://webhook.site/your-unique-id"
```

### 2d. Verify callback

1. Go to **https://webhook.site** → create a free endpoint (gives you a unique URL)
2. Use that URL as `callback_url` in the workflow dispatch
3. After the action runs, check webhook.site for the incoming POST
4. Verify the JSON body contains the `LocalStageAOutput` structure

---

## Step 3: Configure the Pipeline

### 3a. Create a test pipeline

1. Go to **Power Platform Admin Center** → **Environments** → select your host environment
2. Go to **Pipelines** → **+ New pipeline**
3. Name: `Agent Review Test Pipeline`
4. Add stages:
   - Stage 1: **Dev** (source environment)
   - Stage 2: **Test** (target environment)
5. Link the appropriate environments to each stage
6. Click **Save**

### 3b. Enable Pre-deployment Step

1. In the pipeline, click on **Stage 2 (Test)** settings
2. Find **"Pre-deployment step required"** → toggle **ON**
3. Save

**Important**: This is what enables the `OnPreDeploymentStarted` trigger. Without this, the flow will never fire.

### 3c. Note the exact pipeline name

The trigger condition in the flow uses an exact string match:
```
@equals(triggerOutputs()?['body/OutputParameters/DeploymentPipelineName'], 'Agent Review Test Pipeline')
```
Ensure this matches exactly (case-sensitive).

---

## Step 4: Create the Power Automate Flow

### 4a. Navigate to the pipeline host environment

1. Go to **make.powerautomate.com**
2. Switch to the **pipeline host environment** (top-right environment picker)
3. Click **+ Create** → **Automated cloud flow**

### 4b. Set up the trigger

1. Search for trigger: **"When an action is performed"**
2. Configure:
   - **Catalog**: Microsoft Dataverse Common
   - **Category**: Power Platform Pipelines
   - **Table name**: (none)
   - **Action name**: `OnPreDeploymentStarted`
3. Click **Create**

### 4c. Add trigger condition (IMPORTANT)

Without this condition, the flow fires on **every** pipeline deployment in the environment — not just yours. The trigger condition filters it to a specific pipeline by name.

1. Click the trigger's **"..."** menu → **Settings**
2. Under **Trigger conditions**, add:
   ```
   @equals(triggerOutputs()?['body/OutputParameters/DeploymentPipelineName'], 'Agent Review Test Pipeline')
   ```
3. Click **Done**

**⚠️ The pipeline name must match exactly** (case-sensitive). In the shipped flow, use the `cat_PipelineName` environment variable:
   ```
   @equals(triggerOutputs()?['body/OutputParameters/DeploymentPipelineName'], parameters('cat_PipelineName'))
   ```
   For testing, you can hardcode the name directly.

**Test checkpoint**: Save the flow, trigger a pipeline deployment, and confirm the flow fires (add a Compose action with `triggerOutputs()` to inspect the payload).

### 4d. Dispatch GitHub Action + Wait for callback (HTTP Webhook)

The **HTTP Webhook** action combines the GitHub dispatch and callback wait in a single step. Power Automate generates a unique callback URL via `listCallbackUrl()`, passes it to the GitHub Action, and **pauses** until the action POSTs results back.

1. Add an **HTTP Webhook** action
2. Configure:
   - **Subscribe - Method**: POST
   - **Subscribe - URI**: `https://api.github.com/repos/@{parameters('cat_GitHubRepoOwner')}/@{parameters('cat_GitHubRepoName')}/actions/workflows/agent-review.yml/dispatches`
   - **Subscribe - Headers**:
     ```json
     {
       "Authorization": "Bearer @{parameters('cat_GitHubPAT')}",
       "Accept": "application/vnd.github.v3+json",
       "Content-Type": "application/json"
     }
     ```
   - **Subscribe - Body**:
     ```json
     {
       "ref": "main",
       "inputs": {
         "artifact_url": "@{triggerOutputs()?['body/OutputParameters/ArtifactFileDownloadLink']}",
         "callback_url": "@{listCallbackUrl()}"
       }
     }
     ```
   - **Unsubscribe**: Leave empty (no unsubscribe needed)
   - **Timeout**: Set to `PT10M` (10 minutes) in case the action fails silently
3. The flow pauses here until the GitHub Action POSTs `LocalStageAOutput` JSON to the callback URL

**Key**: `@{listCallbackUrl()}` is auto-generated by the webhook action — the GitHub Action receives it as the `callback_url` input and POSTs results back to it when done.

### 4e. Gate the deployment

With all evaluation now happening in the GitHub Action, the callback body contains the full result including scores. The flow just needs to read the score and gate.

**Parse the callback body** — add a **Parse JSON** action on `body('HTTP_Webhook')` or access fields directly:
- Overall score: `@{body('HTTP_Webhook')?['scores']?['overallScore']}`
- Passed: `@{body('HTTP_Webhook')?['scores']?['passed']}`
- Pattern score: `@{body('HTTP_Webhook')?['scores']?['patternScore']}`
- Instruction score: `@{body('HTTP_Webhook')?['scores']?['instructionScore']}`

**Add a Condition**: `@equals(body('HTTP_Webhook')?['scores']?['passed'], true)`

**If Yes** — Add **Dataverse** → **Perform an unbound action**:
- **Action Name**: `UpdatePreDeploymentStepStatus`
- **StageRunId**: `@{triggerOutputs()?['body/OutputParameters/PreDeploymentStepRunId']}`
- **PreDeploymentStepStatus**: `20` (complete/approved)
- **Comments**: `Agent review passed. Overall score: @{body('HTTP_Webhook')?['scores']?['overallScore']}%`

**If No** — Add **Dataverse** → **Perform an unbound action**:
- **Action Name**: `UpdatePreDeploymentStepStatus`
- **StageRunId**: `@{triggerOutputs()?['body/OutputParameters/PreDeploymentStepRunId']}`
- **PreDeploymentStepStatus**: `30` (rejected)
- **Comments**: `Agent review FAILED. Score: @{body('HTTP_Webhook')?['scores']?['overallScore']}% (threshold: @{body('HTTP_Webhook')?['scores']?['threshold']}%). Pattern: @{body('HTTP_Webhook')?['scores']?['patternScore']}%, Instruction: @{body('HTTP_Webhook')?['scores']?['instructionScore']}%`

**Critical**: Add a **try-catch** (Configure run after → has failed) that always calls `UpdatePreDeploymentStepStatus` with status 30 if any step errors. Otherwise the pipeline will hang in "pending" forever.

**Note**: Stages B and C (AI Builder PredictV2 calls) now run inside the GitHub Action — the flow no longer needs Predict actions. This significantly simplifies the flow.

---

## Step 5: Run End-to-End Test

### 5a. Prepare a test agent

1. Go to **Copilot Studio** in your Dev environment
2. Open (or create) a Copilot Studio agent
3. Make sure it has:
   - GenerativeActionsEnabled (uses AI)
   - At least some topics/instructions defined
   - Ideally some known "bad patterns" to trigger StageA detections
4. Save/publish the agent

### 5b. Submit a pipeline deployment

1. In **make.powerapps.com** → select Dev environment
2. Go to **Solutions** → find the solution containing your agent
3. Click **Pipelines** (top menu or "..." → Deploy)
4. Select **Agent Review Test Pipeline**
5. Target stage: **Test**
6. Click **Deploy**

### 5c. Verify flow triggers

1. Go to **make.powerautomate.com** → pipeline host environment
2. Open your flow → **Run history**
3. You should see a new run started within 30 seconds
4. Click into the run to see the trigger payload:
   - `DeploymentPipelineName` should match your pipeline
   - `ArtifactFileDownloadLink` should be a valid URL
   - `PreDeploymentStepRunId` should be a GUID

### 5d. Verify GitHub Action starts

1. Go to your GitHub repo → **Actions** tab
2. You should see the `Agent Review Pipeline` workflow running
3. Triggered by: `workflow_dispatch` (from Power Automate HTTP call)

### 5e. Verify StageA execution

1. Click into the running workflow → click the job
2. Check the **"Run Stage A Analysis"** step:
   - Should show JSON output with pattern results
   - If ZIP is empty/no bots: will output minimal/empty results
   - If auth failed: will show error at the **"Authenticate & Download"** step

### 5f. Verify callback received

1. Back in Power Automate run history, the HTTP Webhook (or poll) action should now complete
2. The body should contain the `LocalStageAOutput` JSON
3. Parse it (add a Parse JSON action) to extract pattern counts

### 5g. Verify PredictV2 calls

1. In the flow run, check the **"Perform an unbound action"** steps for Stage B and C
2. Both should show status 200
3. Response body should contain the AI evaluation text
4. If error: check model ID is correct, AI Builder is active in the environment

### 5h. Verify scoring and gating

1. Check the **Compose** actions show reasonable scores (0-100)
2. Check the final **UpdatePreDeploymentStepStatus** action:
   - Status code 204 = success
   - If status 20 was sent → pipeline should advance to the next stage
   - If status 30 was sent → pipeline should show "Rejected" with your comments

### 5i. Verify Dataverse record

1. Go to **make.powerapps.com** → pipeline host environment
2. **Advanced Find** (or Dataverse API): query `cat_agentreviews` table
3. Confirm a new record was created with:
   - Agent name, score, review date
   - Full JSON result stored in the result field

---

## Step 6: Validate Consumer Experience

This simulates what an end consumer (another organization) would do using this reference implementation.

### 6a. Import solution into clean environment

1. Choose a **separate test environment** (not your dev environment)
2. Import the Copilot Studio Kit solution:
   - Go to **Solutions** → **Import** → upload the managed solution ZIP
3. Configure connection references during import:
   - **Dataverse**: Select/create connection
   - **GitHub HTTP**: May need a custom connector or HTTP with auth header
4. Verify:
   - AI prompts are published (`AI models` section)
   - `cat_agentreviews` table exists
   - Cloud flow appears in **Solutions** → open solution → **Cloud flows**

### 6b. Consumer copies reference implementation into their repo

Copy the following into the consumer's repo:
- `agent-review-pipeline/` folder (entire Node.js project + `action.yml`)
- `.github/workflows/agent-review.yml` (workflow template)

Their repo structure:
```
their-repo/
├── agent-review-pipeline/    ← copied from reference
│   ├── src/
│   ├── action.yml
│   ├── package.json
│   └── tsconfig.json
├── .github/
│   └── workflows/
│       └── agent-review.yml  ← copied from reference
└── ... (their other code)
```

The workflow file already references `uses: ./agent-review-pipeline` — no changes needed if copied as-is.

### 6c. Consumer configures secrets

In the consumer's GitHub repo → **Settings** → **Secrets**:
- `CLIENT_ID`: Their SPN's application ID
- `TENANT_ID`: Their tenant ID
- `CLIENT_SECRET`: Their SPN's secret

### 6d. Consumer creates pipeline

Same as Step 3 — admin creates pipeline, enables "Pre-deployment Step Required".

### 6e. Consumer binds the shipped flow

1. Open the imported flow in the consumer's environment
2. Verify trigger is configured for their pipeline name
3. Update the GitHub dispatch URL to point to their repo
4. Update the GitHub PAT in the HTTP action
5. Turn on the flow

### 6f. Consumer triggers deployment

Same as Step 5 — deploy an agent via pipeline and confirm the full cycle works in their environment.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Flow never triggers | "Pre-deployment Step Required" not enabled on the stage, or trigger condition doesn't match pipeline name exactly (case-sensitive) |
| GH Action auth fails (401/403 on token) | SPN not added as Application User in pipeline host env, or wrong `TENANT_ID`/`CLIENT_ID` |
| Artifact download returns 403 | SPN missing Service Reader role, or `deploymentartifact` record not accessible |
| Artifact download returns 404 | Artifact URL expired (they have a TTL), or wrong URL format |
| Artifact > 16MB | Dataverse Web API limit — need chunked download or relay via blob storage |
| PredictV2 returns 400 | Wrong payload format — ensure `@odata.type: #Microsoft.Dynamics.CRM.expando` is present |
| PredictV2 returns 404 | AI model not deployed/published in pipeline host environment |
| Pipeline stuck in "pending" forever | Flow errored before `UpdatePreDeploymentStepStatus` — check flow run history, add error handler that always calls status 30 |
| Callback never arrives | GitHub Action failed (check Actions tab), or callback URL wrong, or network issue |
| Consumer can't find the flow | Solution not imported, or flow is in draft state — needs to be turned on |
| Action version mismatch | Consumer's copy is outdated — they should pull latest from reference repo |
| Score is always 0 | StageA found no bots — verify solution contains Copilot Studio agent components |
| Score is always 100 | Agent has no detectable patterns — expected for well-built agents |
