import type { ScoreInput, PatternDisplayRow, ComplianceDisplayRow } from "../../types";

/**
 * Calculate overall score from Stage B and C evaluations
 * @param input - Pattern and instruction evaluation results
 * @returns Score from 0-100
 */
export function calculateOverallScore(input: ScoreInput): number {
	const { patternEvaluation, instructionEvaluation } = input;

	// Handle missing data
	if (!patternEvaluation && !instructionEvaluation) {
		return 0;
	}

	let patternScore = 0;
	let instructionScore = 0;

	// Calculate pattern score (Stage B)
	if (patternEvaluation?.Patterns) {
		const patterns = patternEvaluation.Patterns;
		const total = patterns.length;
		if (total > 0) {
			const passing = patterns.filter((p) => p.Status === true).length;
			patternScore = (passing / total) * 100;
		}
	}

	// Use instruction score directly (Stage C already provides 0-100)
	if (instructionEvaluation?.compliancePercentage !== undefined) {
		instructionScore = instructionEvaluation.compliancePercentage;
	}

	// Weighted average: 50% patterns, 50% instructions
	// Adjust weights if only one is available
	if (patternEvaluation && instructionEvaluation) {
		return Math.round((patternScore * 0.5 + instructionScore * 0.5));
	} else if (patternEvaluation) {
		return Math.round(patternScore);
	} else if (instructionEvaluation) {
		return Math.round(instructionScore);
	}

	return 0;
}

/**
 * Map pattern name to category for display
 */
export function categorizePattern(patternName: string): "Model Naming" | "Model Description" | "Input Variables" | "Output Variables" | "Architecture" | "Evaluation" | "Unknown" {
	const lowerName = patternName.toLowerCase();

	// Model naming patterns
	if (lowerName.includes("model name")) {
		return "Model Naming";
	}

	// Model description patterns  
	if (lowerName.includes("model description")) {
		return "Model Description";
	}

	// Input variable patterns
	if (lowerName.includes("input variable")) {
		return "Input Variables";
	}

	// Output variable patterns
	if (lowerName.includes("output variable")) {
		return "Output Variables";
	}

	// Architecture patterns (tools, complexity)
	if (lowerName.includes("tool") || lowerName.includes("excess")) {
		return "Architecture";
	}

	// Evaluation patterns (test cases, testing, coverage)
	if (lowerName.includes("test")) {
		return "Evaluation";
	}

	return "Unknown";
}

/**
 * Determine severity based on pattern failure impact
 */
export function getPatternSeverity(pattern: { PatternName: string; Topics: { item: string }[] }): "High" | "Medium" | "Low" {
	const lowerName = pattern.PatternName.toLowerCase();
	const topicCount = pattern.Topics.length;

	// High severity: affects many topics or critical naming issues
	if (topicCount >= 5 || lowerName.includes("model name") || lowerName.includes("model description")) {
		return "High";
	}

	// Medium severity: affects 2-4 topics or variable issues
	if (topicCount >= 2 || lowerName.includes("variable")) {
		return "Medium";
	}

	// Low severity: affects 1 topic or architecture patterns
	return "Low";
}

/**
 * Transform Stage B pattern data for DataGrid display
 */
export function transformPatternsForDisplay(patterns: {
	PatternName: string;
	PatternDescription: string;
	Status: boolean;
	Topics: { item: string; variable?: string; current?: string; suggested?: string }[];
	Recommendation: string;
}[]): PatternDisplayRow[] {
	const transformedPatterns = patterns.map(pattern => ({
		patternName: pattern.PatternDescription, // Use description as display name instead of Pattern1/Pattern2
		category: categorizePattern(pattern.PatternDescription), // Categorize by description
		status: pattern.Status ? ("Pass" as const) : ("Fail" as const),
		severity: getPatternSeverity(pattern),
		topicCount: pattern.Topics.length,
		description: pattern.PatternDescription,
		recommendation: pattern.Recommendation,
		topics: pattern.Topics.map(t => ({
			item: t.item,
			variable: t.variable,
			current: t.current,
			suggested: t.suggested ?? t.item, // Fallback to item if no suggestion
		})),
	}));

	// Sort by category first, then by severity (High -> Medium -> Low), then by status (Fail first)
	const categoryOrder = ["Model Naming", "Model Description", "Input Variables", "Output Variables", "Architecture", "Evaluation", "Unknown"];
	const severityOrder = { "High": 0, "Medium": 1, "Low": 2 };
	const statusOrder: Record<"Pass" | "Fail", number> = { "Fail": 0, "Pass": 1 };

	return transformedPatterns.sort((a, b) => {
		// Primary sort: Category
		const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
		if (categoryDiff !== 0) return categoryDiff;

		// Secondary sort: Severity
		const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
		if (severityDiff !== 0) return severityDiff;

		// Tertiary sort: Status (Fail patterns first)
		const statusDiff = statusOrder[a.status] - statusOrder[b.status];
		if (statusDiff !== 0) return statusDiff;

		// Final sort: Pattern name alphabetically
		return a.patternName.localeCompare(b.patternName);
	});
}

/**
 * Transform Stage C compliance evaluation to criteria-based display
 * Shows all 12 evaluation criteria as individual rows (like Pattern grid)
 */
export function transformComplianceForDisplay(
	instructionEvaluation: {
		compliance: boolean;
		issues: {
			id: string;
			severity: "high" | "medium" | "low";
			description: string;
			guidelineReference: string;
			recommendation: string;
		}[];
	} | undefined
): ComplianceDisplayRow[] {
	if (!instructionEvaluation) return [];

	// Define the 12 criteria with inherent severity (importance/priority)
	// IDs match the prefixes used by Stage C issue IDs for proper grouping
	const allCriteria = [
		{ id: "scope-definition", name: "Scope Definition", category: "Scope" as const, severity: "High" as const, description: "Clearly defines what topics the agent should respond to" },
		{ id: "out-of-scope-handling", name: "Out-of-Scope Handling", category: "Scope" as const, severity: "Medium" as const, description: "Specifies how to handle requests outside defined scope" },
		{ id: "persona-and-tone", name: "Persona & Tone", category: "UX" as const, severity: "Low" as const, description: "Defines agent's communication style and personality" },
		{ id: "privacy-and-sensitive-data", name: "Privacy & Sensitive Data", category: "Safety" as const, severity: "High" as const, description: "Provides guidelines for handling personal/sensitive information" },
		{ id: "fallback-when-uncertain", name: "Fallback When Uncertain", category: "Quality" as const, severity: "High" as const, description: "Specifies what to do when agent lacks information" },
		{ id: "citations-and-sources", name: "Citations & Sources", category: "Quality" as const, severity: "Medium" as const, description: "Requires citing sources and providing references" },
		{ id: "formatting-guidelines", name: "Formatting Guidelines", category: "UX" as const, severity: "Low" as const, description: "Provides response formatting and structure rules" },
		{ id: "clarifying-questions", name: "Clarifying Questions", category: "UX" as const, severity: "Medium" as const, description: "Handles ambiguous queries with clarification requests" },
		{ id: "prompt-injection-resilience", name: "Prompt Injection Protection", category: "Safety" as const, severity: "High" as const, description: "Safeguards against manipulation attempts" },
		{ id: "link-safety", name: "Link Safety", category: "Safety" as const, severity: "Medium" as const, description: "Ensures only safe/verified links are shared" },
		{ id: "advice-disclaimers", name: "Advice Disclaimers", category: "Safety" as const, severity: "High" as const, description: "Provides disclaimers for sensitive advice domains" },
		{ id: "accuracy-quality", name: "Accuracy & Quality", category: "Quality" as const, severity: "High" as const, description: "Emphasizes factual accuracy and response quality" },
	];

	// Check if instructions are missing/empty (special case)
	const hasMissingInstructionInput = instructionEvaluation.issues.some(issue => 
		issue.id === "missing-instruction-input"
	);

	// Group issues by criteria (infer from issue ID pattern)
	// Handle AI variations in issue ID naming (e.g., "formatting-accessibility-missing" should match "formatting-guidelines")
	const issuesByCriteria = new Map<string, typeof instructionEvaluation.issues>();
	instructionEvaluation.issues.forEach(issue => {
		const issueIdLower = issue.id.toLowerCase();
		
		// Try exact prefix match first (e.g., "scope-definition-missing" → "scope-definition")
		let criteriaId = allCriteria.find(c => issueIdLower.startsWith(c.id))?.id;
		
		// If no exact match, try fuzzy matching for known AI variations
		if (!criteriaId) {
			// Map common AI variations to correct criteria IDs
			const variations: Record<string, string> = {
				'formatting-accessibility': 'formatting-guidelines',
				'formatting-': 'formatting-guidelines',
				'citations-format': 'citations-and-sources',
				'citations-': 'citations-and-sources',
				'privacy-': 'privacy-and-sensitive-data',
				'accuracy-': 'accuracy-quality',
				'link-': 'link-safety',
				'advice-': 'advice-disclaimers',
			};
			
			for (const [variation, criteria] of Object.entries(variations)) {
				if (issueIdLower.includes(variation)) {
					criteriaId = criteria;
					console.warn(`[scoreCalculator] Matched AI variation "${issue.id}" to criteria "${criteria}"`);
					break;
				}
			}
		}
		
		if (criteriaId) {
			if (!issuesByCriteria.has(criteriaId)) {
				issuesByCriteria.set(criteriaId, []);
			}
			issuesByCriteria.get(criteriaId)!.push(issue);
		} else {
			console.warn(`[scoreCalculator] Could not match issue ID "${issue.id}" to any criteria`);
		}
	});

	// Transform each criteria to display row
	return allCriteria.map(criteria => {
		const relatedIssues = issuesByCriteria.get(criteria.id) ?? [];
		const hasFailed = relatedIssues.length > 0;

		// If agent instructions are missing/empty, mark ALL criteria as failed
		const statusOverride = hasMissingInstructionInput ? "Fail" : (hasFailed ? "Fail" : "Pass");
		const descriptionOverride = hasMissingInstructionInput ? 
			"Cannot evaluate - agent instructions are missing or empty" : 
			criteria.description;
		const recommendationOverride = hasMissingInstructionInput ? 
			["Add agent instructions to enable compliance evaluation"] : 
			relatedIssues.map(i => i.recommendation);

		// Determine severity: use actual issue severity if failed, otherwise use criteria importance
		const displaySeverity = hasFailed && relatedIssues.length > 0
			? relatedIssues[0].severity.charAt(0).toUpperCase() + relatedIssues[0].severity.slice(1) as "High" | "Medium" | "Low"
			: criteria.severity;

		return {
			id: criteria.id,
			name: criteria.name,
			category: criteria.category,
			status: statusOverride,
			issueCount: hasMissingInstructionInput ? 1 : relatedIssues.length,
			severity: displaySeverity, // Use actual issue severity when failed, criteria importance when passed
			description: descriptionOverride,
			issues: hasMissingInstructionInput ? [descriptionOverride] : relatedIssues.map(i => i.description),
			recommendations: recommendationOverride,
		};
	});
}

/**
 * Get color for score gauge (0-100)
 */
export function getScoreColor(score: number): string {
	if (score >= 80) return "#107c10"; // Green (success)
	if (score >= 60) return "#ffaa44"; // Amber (warning)
	return "#d13438"; // Red (error)
}

/**
 * Get status label for score
 */
export function getScoreLabel(score: number): string {
	if (score >= 80) return "Excellent";
	if (score >= 60) return "Good";
	if (score >= 40) return "Fair";
	return "Needs Improvement";
}
