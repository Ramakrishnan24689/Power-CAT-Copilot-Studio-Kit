# Copilot Studio Agent Optimizer - User Guide

## How to Use the Tool

### Prerequisites
- Access to Power Platform environment with the PCF control installed
- Appropriate permissions to view Copilot Studio agents (bots table)
- AI models configured for review stages (Stage A, B, C, D)

---

### Step-by-Step Usage

#### 1. **Open the Control**
- Navigate to your Power Apps portal or model-driven app where the control is embedded
- The control will automatically load and display the agent optimizer dashboard

#### 2. **View Dashboard Statistics**
The hero section displays:
- **Total Agents**: Count of all Copilot Studio agents in your environment
- **Reviewed Agents**: Number of agents with completed reviews
- **Pending Reviews**: Agents awaiting review
- **Average Score**: Overall quality score across all reviewed agents

#### 3. **Browse Available Agents**
- The data grid shows all agents with columns:
  - **Name**: Agent display name
  - **Status**: Review status (Not Reviewed / Reviewed / Reviewing)
  - **Last Review**: Date of most recent review (if available)
  - **Score**: Overall quality score (0-100, if reviewed)
  - **Actions**: Review, View Review, Download Report buttons

#### 4. **Filter and Search**
- **Search Bar**: Type agent name to filter the list
- **Status Filter**: Select "All", "Reviewed", or "Not Reviewed"
- **Sort**: Click column headers to sort (name, status, date, score)
- **Pagination**: Use page size dropdown (10/20/50/100) and Previous/Next buttons

#### 5. **Run a New Review**
1. Click **"Review"** button for an agent
2. The control executes a 4-stage AI analysis:
   - **Stage A**: Parses agent YAML configuration (local or AI-based)
   - **Stage B**: Evaluates patterns and best practices
   - **Stage C**: Analyzes agent instructions and compliance
   - **Stage D**: Generates comprehensive PDF report
3. Progress indicator shows current stage (can take 30-60 seconds)
4. Review automatically saves to Dataverse upon completion
5. Review dialog opens automatically

#### 6. **View Review Results**
Click **"View Review"** to open the dialog with three tabs:

**Patterns Tab:**
- List of evaluated patterns (e.g., missing model names, descriptions, variables)
- Status indicator (✅ Pass / ❌ Fail)
- Severity level (High/Medium/Low)
- Detailed description and recommendations
- Radial gauge showing pattern compliance score

**Compliance Tab:**
- Agent instruction quality evaluation
- Compliance percentage and grade (A/B/C/D/F)
- Issue count by severity
- Specific compliance findings with categories
- Radial gauge showing instruction quality score

**Summary Tab:**
- Overall quality score (combined pattern + instruction)
- Total patterns evaluated
- Passed vs Failed patterns breakdown
- Total issues and high-severity issue count
- Review metadata (date, bot name, component ID)

#### 7. **Download PDF Report**
1. Click **"Download Report"** button for a reviewed agent
2. PDF contains complete review findings with:
   - Executive summary
   - Pattern evaluation details
   - Instruction compliance analysis
   - Recommendations for improvement
3. File downloads automatically to your browser's download folder

#### 8. **Update Existing Review**
- Click **"Review"** again on a previously reviewed agent
- The system updates the existing review record (doesn't create duplicates)
- Uses `componentidunique` to match and update records
- Previous review data is overwritten with new results

---

### Tips for Best Results

**Performance:**
- Reviews take 30-60 seconds depending on agent complexity
- Larger agents (10+ topics) use local YAML parsing (faster)
- Smaller agents use AI Stage A (slower but more detailed)

**Accuracy:**
- Ensure agents have well-structured YAML configuration
- Review results depend on AI model quality (configure latest GPT models)
- Pattern analysis includes both local deterministic checks and AI evaluation

**Data Management:**
- Reviews are stored in `cat_agentreviewses` table
- Latest review for each agent is displayed in the grid
- Historical reviews are preserved (future: version tracking)
- PDF reports are stored as file columns in Dataverse

**Troubleshooting:**
- If "Next" button is disabled, check filter/search settings
- If review fails, check AI model availability and configuration
- If PDF download fails, verify file column permissions
- Missing scores indicate incomplete review (re-run review)

---

### Common Workflows

**Bulk Review:**
1. Set page size to 100
2. Sort by "Not Reviewed" status
3. Review agents one by one (no batch review yet)

**Quality Improvement:**
1. View review for low-scoring agent
2. Open Patterns tab → identify failures
3. Open Copilot Studio → fix issues
4. Re-run review → verify improvement

**Executive Reporting:**
1. Export dashboard statistics
2. Download PDF reports for all agents
3. Share compliance trends with stakeholders
