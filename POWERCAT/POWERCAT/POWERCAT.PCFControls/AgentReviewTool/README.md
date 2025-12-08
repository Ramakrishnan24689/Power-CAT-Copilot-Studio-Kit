# Copilot Studio Agent Optimizer - PCF Control

A Power Apps Component Framework (PCF) control that provides automated quality assessment and compliance review for Microsoft Copilot Studio agents.

## Features

- **Automated Agent Analysis**: Parse and evaluate Copilot Studio agent configurations
- **Multi-Stage Review Process**: 
  - Stage A: YAML configuration parsing
  - Stage B: Topic clarity evaluation (AI Prompt mode)
  - Stage C: Instruction quality assessment (AI Prompt mode)
  - Stage D: SARIF report generation (AI Prompt mode)
- **AI-Powered Evaluation**: Context-aware analysis using AI Prompt mode for dynamic, nuanced suggestions
- **SARIF Compliance**: Industry-standard Static Analysis Results Interchange Format
- **Dataverse Integration**: Store and track review history

## Quick Start

### Prerequisites

- Node.js LTS (≥ 18.x)
- Power Platform CLI (`pac`)
- Power Apps environment with Dataverse

### Installation

```powershell
# Clone repository
git clone <repository-url>
cd AgentReviewToolPCF

# Install dependencies
npm install

# Build the control
npm run build
```

### Development

```powershell
# Watch mode (auto-rebuild on changes)
npm run start

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check

# Code formatting
npm run format
```

### Deployment

```powershell
# Quick push to environment (development)
pac pcf push --publisher-prefix <prefix>

# Solution packaging (production)
pac solution init --publisher-name <PublisherName> --publisher-prefix <prefix>
pac solution add-reference --path .
msbuild /t:restore
msbuild /p:Configuration=Release
```

## Project Structure

```
AgentReviewToolPCF/
├── CopilotStudioAgentOptimizer/          # Main PCF control
│   ├── Components/                        # React components
│   │   ├── features/                      # Feature components (BotGrid, Dashboard, etc.)
│   │   ├── shared/                        # Shared UI components
│   │   └── hooks/                         # Custom React hooks
│   ├── Services/                          # Business logic & API calls
│   │   ├── retrievePromptResponse.ts      # AI model invocation (with runtime mode)
│   │   ├── parseYAML.ts                   # YAML parser
│   │   ├── extractStageAData.ts           # Stage A extraction
│   │   └── generateSarifReport.ts         # SARIF generation
│   ├── types/                             # TypeScript type definitions
│   ├── config/                            # Configuration files
│   ├── index.ts                           # PCF entry point
│   └── ControlManifest.Input.xml          # PCF manifest
├── __tests__/                             # Test files
├── TECHNICAL_DOCUMENTATION.md             # Detailed technical docs
├── BUILD_QUALITY_TOOLING.md               # Build & quality tooling guide
├── STAGE_B_PROMPT_UPDATED.md              # Stage B prompt (deprecated - Code Interpreter)
├── STAGE_C_AI_PROMPT.md                   # Stage C prompt (AI Prompt mode)
└── USER_GUIDE.md                          # End-user documentation
```

## Key Technologies

- **PCF Framework**: Power Apps Component Framework (Virtual React control)
- **React 16.14.0**: UI framework
- **Fluent UI v9**: Microsoft design system
- **TypeScript**: Type-safe development
- **Jest**: Testing framework
- **AI Prompt Mode**: Runtime mode for AI model invocation (`runtime: null`)

## AI Runtime Configuration

All AI stages (B, C, D) use **AI Prompt mode** for better context-aware analysis:

```typescript
// Stage B, C, D API calls
await retrievePromptResponse({
  baseUrl,
  modelId,
  requestInputs: { ... },
  runtime: null  // AI Prompt mode (not Code Interpreter)
});
```

**Benefits of AI Prompt Mode:**
- More dynamic, contextual suggestions
- Natural language reasoning
- Better pattern recognition
- Flexible evaluation adapting to different structures

## Documentation

- **[Technical Documentation](TECHNICAL_DOCUMENTATION.md)**: Architecture, review flow, stage details
- **[User Guide](USER_GUIDE.md)**: End-user instructions for running reviews
- **[Build & Quality Tooling](BUILD_QUALITY_TOOLING.md)**: Development workflow, testing, linting

## Testing

```powershell
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Coverage Requirements:**
- Statements: ≥ 20%
- Branches: ≥ 15%
- Functions: ≥ 20%
- Lines: ≥ 20%

## Contributing

1. Create feature branch
2. Make changes with tests
3. Run `npm run format` before commit
4. Ensure `npm run build` succeeds
5. Submit pull request

## License

[Specify your license]

## Support

For issues or questions, contact [specify contact method].
