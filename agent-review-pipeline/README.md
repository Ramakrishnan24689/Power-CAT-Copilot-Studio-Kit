# Agent Review Pipeline

Automated quality gate for Copilot Studio agents deployed via Power Platform Pipelines. Evaluates agents using pattern detection + AI analysis and blocks substandard deployments.

**📖 [CI/CD Setup Guide](docs/CI-CD-SETUP-GUIDE.md)** — full setup instructions for your organization.

## Local CLI

```bash
npm install
npm run build
node dist/index.js --zip path\to\solution.zip
```

Optional file output:

```bash
node dist/index.js --zip path\to\solution.zip --output result.json
```

## GitHub Action inputs

- `artifact_url`: Dataverse artifact download URL
- `callback_url`: Power Automate webhook URL
- `callback_secret`: Optional callback validation secret

## Example workflow step

```yaml
- uses: ./agent-review-pipeline
  with:
    artifact_url: ${{ inputs.artifact_url }}
    callback_url: ${{ inputs.callback_url }}
    callback_secret: ${{ secrets.CALLBACK_SECRET }}
  env:
    CLIENT_ID: ${{ secrets.CLIENT_ID }}
    TENANT_ID: ${{ secrets.TENANT_ID }}
    CLIENT_SECRET: ${{ secrets.CLIENT_SECRET }}
```
