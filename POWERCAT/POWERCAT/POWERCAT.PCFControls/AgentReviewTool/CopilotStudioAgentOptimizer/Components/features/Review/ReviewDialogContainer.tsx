import * as React from "react";
import {
	Dialog,
	DialogSurface,
	DialogBody,
	DialogTitle,
	DialogContent,
	DialogActions,
} from "@fluentui/react-dialog";
import { Button } from "@fluentui/react-button";
import { SplitButton, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Badge, tokens, Text } from "@fluentui/react-components";
import {
	Tab,
	TabList,
	TabValue,
} from "@fluentui/react-tabs";
import { Spinner } from "@fluentui/react-spinner";
import { Tooltip } from "@fluentui/react-tooltip";
import { Dismiss24Regular, ArrowDownload20Regular, DocumentPdf20Regular, Code20Regular, Sparkle32Filled, CheckmarkCircle16Regular, Warning16Regular, FullScreenMaximize24Regular, FullScreenMinimize24Regular } from "@fluentui/react-icons";
import { RadialGauge } from "../../shared/Charts";
import { PatternsDataGrid, ComplianceDataGrid } from "../../shared/DataGrid";
import { ErrorBoundary } from "../../utils";
import type { ReviewResult, PatternDisplayRow, ComplianceDisplayRow } from "../../../types";
import {
	calculateOverallScore,
	transformPatternsForDisplay,
	transformComplianceForDisplay,
} from "../../utils/scoreCalculator";
import { generateSarifReport } from "../../../Services/generateSarifReport";

// Simple text cleaner for better readability
const cleanText = (text: string): string => {
    return text
        .replace(/[^\u0020-\u007E]/g, '') // Keep only printable ASCII characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
};

export interface ReviewDialogProps {
	open: boolean;
	onClose: () => void;
	reviewResult: ReviewResult;
	onDownloadPdf?: () => void;
	onDownloadSarif?: () => void;
}

/**
 * Main dialog displaying agent review results with gauge chart and tabbed pattern/compliance grids
 */
export const ReviewDialogContainer: React.FC<ReviewDialogProps> = ({
	open,
	onClose,
	reviewResult,
	onDownloadPdf,
	onDownloadSarif,
}) => {
	const [selectedTab, setSelectedTab] = React.useState<TabValue>("patterns");
	const [selectedPattern, setSelectedPattern] = React.useState<PatternDisplayRow | null>(null);
	const [selectedIssue, setSelectedIssue] = React.useState<ComplianceDisplayRow | null>(null);
	const [isExpanded, setIsExpanded] = React.useState<boolean>(false);

	// Calculate overall score
	const overallScore = React.useMemo(
		() =>
			calculateOverallScore({
				patternEvaluation: reviewResult.patternEvaluation,
				instructionEvaluation: reviewResult.instructionEvaluation,
			}),
		[reviewResult]
	);

	// Handle SARIF download
	const handleDownloadSarif = React.useCallback(() => {
		if (onDownloadSarif) {
			onDownloadSarif();
		} else {
			// Fallback: generate and download SARIF directly
			try {
				const sarifContent = generateSarifReport(reviewResult);
				const blob = new Blob([sarifContent], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${reviewResult.botName?.replace(/[^a-zA-Z0-9]/g, '_') || 'agent'}_review.sarif`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			} catch (error) {
				console.error('Failed to generate SARIF report:', error);
			}
		}
	}, [reviewResult, onDownloadSarif]);

	// Transform pattern data
	const patternRows = React.useMemo(() => {
		if (!reviewResult.patternEvaluation?.Patterns) return [];
		return transformPatternsForDisplay(reviewResult.patternEvaluation.Patterns);
	}, [reviewResult.patternEvaluation]);

	// Transform compliance data to criteria-based view
	const complianceRows = React.useMemo(() => {
		return transformComplianceForDisplay(reviewResult.instructionEvaluation);
	}, [reviewResult.instructionEvaluation]);

	const handlePatternDetails = (pattern: PatternDisplayRow) => {
		setSelectedPattern(pattern);
	};

	const handleClosePatternDetails = () => {
		setSelectedPattern(null);
	};

	const handleIssueDetails = (issue: ComplianceDisplayRow) => {
		setSelectedIssue(issue);
	};

	const handleCloseIssueDetails = () => {
		setSelectedIssue(null);
	};

	return (
		<>
			<style>
				{`
					@keyframes borderShimmer {
						0% { 
							border-color: #e0e0e0;
						}
						25% {
							border-color: #077FAB;
						}
						50% {
							border-color: #B25ABF;
						}
						75% {
							border-color: #F59F57;
						}
						100% { 
							border-color: #e0e0e0;
						}
					}
					
					.shimmer-border-dialog {
						border: 3px solid #e0e0e0;
						animation: borderShimmer 3s ease-in-out infinite;
					}
				`}
			</style>
			<Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
				<DialogSurface 
					className="shimmer-border-dialog"
					style={{ 
						width: isExpanded ? "100vw" : "900px",
						height: isExpanded ? "100vh" : "auto",
						maxWidth: isExpanded ? "100vw" : "900px",
						minHeight: isExpanded ? "100vh" : "600px",
						borderRadius: isExpanded ? "0" : "8px",
						margin: isExpanded ? "0" : "auto"
					}}
				>
					<DialogBody>
						<DialogTitle
							action={
							<div style={{ display: 'flex', gap: '4px' }}>
								<Tooltip content={isExpanded ? "Exit fullscreen" : "Enter fullscreen"} relationship="label">
									<Button
										appearance="subtle"
										aria-label={isExpanded ? "Exit fullscreen" : "Enter fullscreen"}
										icon={isExpanded ? <FullScreenMinimize24Regular /> : <FullScreenMaximize24Regular />}
										onClick={() => setIsExpanded(!isExpanded)}
									/>
								</Tooltip>
								<Tooltip content="Close" relationship="label">
									<Button
										appearance="subtle"
										aria-label="close"
										icon={<Dismiss24Regular />}
										onClick={onClose}
									/>
								</Tooltip>
								</div>
							}
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<Sparkle32Filled style={{ color: tokens.colorBrandForeground1 }} />
								Agent Review Report: {reviewResult.botName}
							</div>
						</DialogTitle>
						<DialogContent>
							<ErrorBoundary>
								<div style={{ 
									display: "flex", 
									flexDirection: isExpanded ? "row" : "column",
									gap: isExpanded ? "24px" : "0"
								}}>
									{/* Overall Score Section */}
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											padding: isExpanded ? "0" : "24px 0",
											borderBottom: isExpanded ? "none" : "1px solid #edebe9",
											borderRight: isExpanded ? "1px solid #edebe9" : "none",
											minWidth: isExpanded ? "250px" : "auto",
											paddingRight: isExpanded ? "24px" : "0"
										}}
									>
										<h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>
											Overall Score
										</h3>
										<RadialGauge score={overallScore} size={180} />
									</div>

									{/* Tabs Section */}
									<div style={{ marginTop: isExpanded ? "0" : "24px", flex: isExpanded ? "1" : "auto" }}>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
							<TabList selectedValue={selectedTab} onTabSelect={(_, data) => setSelectedTab(data.value)}>
								<Tab value="patterns">
									Pattern Analysis ({patternRows.filter(p => p.status === "Fail").length} issues)
								</Tab>
								<Tab value="compliance">
									Agent Instructions ({complianceRows.filter(c => c.status === "Fail").length} issues)
								</Tab>
							</TabList>
							<Badge appearance="tint" color="informative" size="small">
								AI-generated content may be incorrect
							</Badge>
						</div>

							{/* Tab Content */}
							<div style={{ marginTop: "16px" }}>
									{selectedTab === "patterns" && (
										<PatternsDataGrid
											patterns={patternRows}
											onPatternDetails={handlePatternDetails}
										/>
									)}
									{selectedTab === "compliance" && (
										<>
											{reviewResult.instructionEvaluation?.summary && (
												<div style={{ 
													marginBottom: "16px",
													padding: "16px", 
													backgroundColor: "#fafafa", 
													borderRadius: "4px",
													border: "1px solid #e1e4e6"
												}}>
													<Text size={200} style={{ 
														color: '#605e5c',
														lineHeight: '1.6',
														whiteSpace: 'pre-wrap',
														wordBreak: 'break-word'
													}}>
														{cleanText(reviewResult.instructionEvaluation.summary)
															.replace(/\. /g, '.\n\n') // Add line breaks after sentences
															.replace(/: /g, ':\n') // Add line breaks after colons
															.replace(/\(/g, '\n\n(') // Add line breaks before parentheses
															.replace(/\) /g, ')\n\n') // Add line breaks after parentheses
														}
													</Text>
												</div>
											)}
											<ComplianceDataGrid 
												issues={complianceRows}
												onIssueDetails={handleIssueDetails}
											/>
										</>
									)}
								</div>
									</div>
								</div>
							</ErrorBoundary>
					</DialogContent>
				<DialogActions>
					<Menu>
						<MenuTrigger disableButtonEnhancement>
							<SplitButton
								appearance="secondary"
								icon={<ArrowDownload20Regular />}
								primaryActionButton={onDownloadPdf ? { onClick: onDownloadPdf } : undefined}
								disabled={!onDownloadPdf}
							>
								Download PDF
							</SplitButton>
						</MenuTrigger>
						<MenuPopover>
							<MenuList>
								<MenuItem
									icon={<DocumentPdf20Regular />}
									onClick={onDownloadPdf}
									disabled={!onDownloadPdf}
								>
									Download as PDF
								</MenuItem>
								<MenuItem
									icon={<Code20Regular />}
									onClick={handleDownloadSarif}
								>
									Download as SARIF
								</MenuItem>
							</MenuList>
						</MenuPopover>
					</Menu>
					<Button appearance="secondary" onClick={onClose}>
						Close
						</Button>
					</DialogActions>
				</DialogBody>
				</DialogSurface>
			</Dialog>

			{/* Pattern Details Nested Dialog */}
			{selectedPattern && (
				<Dialog open={true} onOpenChange={handleClosePatternDetails}>
					<DialogSurface style={{ maxWidth: "700px" }}>
						<DialogBody>
							<DialogTitle
								action={
									<Button
										appearance="subtle"
										aria-label="close"
										icon={<Dismiss24Regular />}
										onClick={handleClosePatternDetails}
									/>
								}
							>
								{selectedPattern.patternName}
							</DialogTitle>
							<DialogContent>
								<div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
									{/* Category and Severity Row */}
									<div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
										<div>
											<strong>Category:</strong> {selectedPattern.category}
										</div>
										<div>
											<strong>Severity:</strong>{" "}
											<Badge
												appearance="outline"
												color={
													selectedPattern.severity === "High"
														? "danger"
														: selectedPattern.severity === "Medium"
														? "warning"
														: "success"
												}
											>
												{selectedPattern.severity}
											</Badge>
										</div>
									</div>

									{/* Description Section */}
									<div>
										<strong style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", display: "block" }}>
											Issue Description
										</strong>
										<div
											style={{
												padding: "12px 16px",
												backgroundColor: "#faf9f8",
												border: "1px solid #e1dfdd",
												borderRadius: "6px",
												fontSize: "13px",
												lineHeight: "1.5",
												color: "#323130",
											}}
										>
											{selectedPattern.description}
										</div>
									</div>

									{/* Recommendation Section */}
									<div>
										<strong style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", display: "block" }}>
											Recommended Action
										</strong>
										<div
											style={{
												padding: "12px 16px",
												backgroundColor: "#f3f9ff",
												border: "1px solid #deecf9",
												borderRadius: "6px",
												fontSize: "13px",
												lineHeight: "1.5",
												color: "#323130",
											}}
										>
											{selectedPattern.recommendation}
										</div>
									</div>

									{/* Affected Topics Section */}
									{selectedPattern.topics.length > 0 && (
										<div>
											<strong style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", display: "block" }}>
												Affected Topics ({selectedPattern.topics.length})
											</strong>
											<div
												style={{
													maxHeight: "300px",
													overflowY: "auto",
													border: "1px solid #e1dfdd",
													borderRadius: "6px",
													backgroundColor: "#ffffff",
												}}
											>
												{selectedPattern.topics.map((topic, idx) => (
													<div
														key={idx}
														style={{
															padding: "12px 16px",
															borderBottom: idx < selectedPattern.topics.length - 1 ? "1px solid #f3f2f1" : "none",
														}}
													>
														<div style={{ fontWeight: 600, fontSize: "13px", color: "#323130", marginBottom: "6px" }}>
															{topic.item}
														</div>
														{topic.variable && (
															<div style={{ 
																marginBottom: "4px", 
																fontSize: "12px", 
																color: "#605e5c",
																display: "flex",
																alignItems: "center",
																gap: "6px"
															}}>
																<span>•</span>
																<span>Variable:</span>
																<code style={{ 
																	backgroundColor: "#f3f2f1", 
																	padding: "2px 6px", 
																	borderRadius: "3px",
																	fontSize: "11px",
																	fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"
																}}>
																	{topic.variable}
																</code>
															</div>
														)}
														{topic.current && (
															<div style={{ 
																marginBottom: "4px", 
																fontSize: "12px", 
																color: "#605e5c",
																display: "flex",
																alignItems: "flex-start",
																gap: "6px"
															}}>
																<span>•</span>
																<span>Current:</span>
																<span style={{ fontStyle: "italic" }}>{topic.current}</span>
															</div>
														)}
														<div style={{ 
															fontSize: "12px", 
															color: "#0078d4",
															display: "flex",
															alignItems: "flex-start",
															gap: "6px"
														}}>
															<span style={{ fontWeight: 600 }}>→</span>
															<span><strong>Suggested:</strong> {topic.suggested}</span>
														</div>
													</div>
												))}
											</div>
										</div>
									)}

									{/* No Topics Message */}
									{selectedPattern.topics.length === 0 && (
										<div
											style={{
												padding: "16px",
												textAlign: "center",
												backgroundColor: "#f0f9ff",
												border: "1px solid #b8e6b8",
												borderRadius: "6px",
												color: "#0e5814",
												fontSize: "13px",
											}}
										>
											✅ <strong>No Issues Found</strong> - This pattern passed all checks
										</div>
									)}
								</div>
							</DialogContent>
							<DialogActions>
								<Button appearance="secondary" onClick={handleClosePatternDetails}>
									Close
								</Button>
							</DialogActions>
						</DialogBody>
					</DialogSurface>
				</Dialog>
			)}

			{/* Compliance Issue Details Nested Dialog */}
			{selectedIssue && (
				<Dialog open={true} onOpenChange={handleCloseIssueDetails}>
					<DialogSurface style={{ maxWidth: "700px" }}>
						<DialogBody>
							<DialogTitle
								action={
									<Button
										appearance="subtle"
										aria-label="close"
										icon={<Dismiss24Regular />}
										onClick={handleCloseIssueDetails}
									/>
								}
							>
								{selectedIssue.name}
							</DialogTitle>
							<DialogContent>
								<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
									<div>
										<strong>Category:</strong> {selectedIssue.category}
									</div>
									<div>
										<strong>Severity:</strong>{" "}
										<Badge
											appearance="outline"
											color={
												selectedIssue.severity === "High"
													? "danger"
													: selectedIssue.severity === "Medium"
													? "warning"
													: "informative"
											}
											size="small"
										>
											{selectedIssue.severity}
										</Badge>
									</div>
									<div>
										<strong>Description:</strong>
										<p style={{ marginTop: "4px", color: "#605e5c", lineHeight: "1.6" }}>
											{selectedIssue.description}
										</p>
									</div>
									{selectedIssue.issueCount > 0 && (
										<div>
											<strong>Issues Found ({selectedIssue.issueCount}):</strong>
											<div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "16px" }}>
												{selectedIssue.issues.map((issue, idx) => (
													<div 
														key={idx} 
														style={{ 
															padding: "16px",
															backgroundColor: "#fef6f6",
															borderLeft: "4px solid #d13438",
															borderRadius: "4px",
															boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
														}}
													>
														<div style={{ 
															color: "#a4262c", 
															fontWeight: 600, 
															marginBottom: "12px",
															fontSize: "14px"
														}}>
															⚠️ {issue}
														</div>
														{selectedIssue.recommendations[idx] && (
															<div style={{ 
																marginTop: "12px",
																paddingTop: "12px",
																borderTop: "1px solid #edebe9"
															}}>
																<div style={{ 
																	color: "#0078d4", 
																	fontWeight: 600,
																	fontSize: "13px",
																	marginBottom: "6px"
																}}>
																	💡 Recommended Action
																</div>
																<div style={{ 
																	color: "#323130",
																	fontSize: "13px",
																	lineHeight: "1.6",
																	paddingLeft: "24px"
																}}>
																	{selectedIssue.recommendations[idx]}
																</div>
															</div>
														)}
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							</DialogContent>
							<DialogActions>
								<Button appearance="secondary" onClick={handleCloseIssueDetails}>
									Close
								</Button>
							</DialogActions>
						</DialogBody>
					</DialogSurface>
				</Dialog>
			)}
		</>
	);
};
