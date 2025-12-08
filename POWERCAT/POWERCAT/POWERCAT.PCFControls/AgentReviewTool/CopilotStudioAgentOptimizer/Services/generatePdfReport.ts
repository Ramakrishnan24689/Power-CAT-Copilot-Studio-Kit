/**
 * Programmatic PDF Report Generation
 * Generates professional PDF reports for agent reviews with charts and tables
 */

import { jsPDF } from 'jspdf';
import type { Pattern, InstructionEvaluation } from '../types';

/**
 * Clean text for PDF generation by properly handling UTF-8 characters
 * Preserves international characters while removing problematic symbols
 */
function cleanTextForPdf(text: string): string {
    if (!text) return '';
    
    return text
        // Normalize Unicode characters
        .normalize('NFD')
        // Replace common problematic characters with safer equivalents
        .replace(/[\u2018\u2019]/g, "'") // Smart quotes
        .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
        .replace(/[\u2013\u2014]/g, '-') // En/em dashes
        .replace(/[\u2026]/g, '...') // Ellipsis
        .replace(/[\u00A0]/g, ' ') // Non-breaking space
        .replace(/[\u00AD]/g, '') // Soft hyphen
        // Remove control characters but keep most Unicode
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Control characters
        .replace(/[\uFEFF]/g, '') // Byte order mark
        .replace(/[\uFFF0-\uFFFF]/g, '') // Specials block
        // Clean up multiple spaces and whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

export interface PdfReportInput {
    botName: string;
    reviewDate: Date;
    overallScore: number;
    patternScore: number;
    instructionScore: number;
    patterns: Pattern[];
    instructionEval?: InstructionEvaluation;
    agentInstructions?: string; // Original agent instructions
    sarifUrl?: string;
}

/**
 * Generate PDF report programmatically using jsPDF
 * Returns base64-encoded PDF data suitable for Dataverse storage
 */
export async function generatePdfReport(input: PdfReportInput): Promise<string> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    let yPosition = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // ===== Page 1: Title & Overview =====
    
    // Header with gradient effect simulation
    doc.setFillColor(7, 127, 171); // Microsoft blue
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('Copilot Studio', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(20);
    doc.text('Agent Review Report', pageWidth / 2, 25, { align: 'center' });
    
    yPosition = 50;

    // Agent Information Box
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(margin, yPosition, contentWidth, 30, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Agent Name:', margin + 5, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(input.botName, margin + 40, yPosition + 8);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Review Date:', margin + 5, yPosition + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(input.reviewDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    }), margin + 40, yPosition + 16);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Review Time:', margin + 5, yPosition + 24);
    doc.setFont('helvetica', 'normal');
    doc.text(input.reviewDate.toLocaleTimeString('en-US'), margin + 40, yPosition + 24);
    
    yPosition += 40;

    // Overall Score Section
    doc.setFontSize(16);
    doc.setTextColor(7, 127, 171);
    doc.setFont('helvetica', 'bold');
    doc.text('Overall Quality Score', margin, yPosition);
    yPosition += 10;

    // Score circle with color coding
    const scoreX = pageWidth / 2;
    const scoreY = yPosition + 20;
    const scoreRadius = 25;
    
    const scoreColor = input.overallScore >= 80 ? [34, 139, 34] : // Green
                      input.overallScore >= 60 ? [255, 165, 0] : // Orange
                      [220, 20, 60]; // Red
    
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.circle(scoreX, scoreY, scoreRadius, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.text(`${input.overallScore}%`, scoreX, scoreY + 5, { align: 'center' });
    
    yPosition += 55;

    // Score Breakdown
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    
    const breakdownY = yPosition;
    doc.text('Score Breakdown:', margin, breakdownY);
    yPosition += 8;
    
    // Pattern Score
    doc.setFont('helvetica', 'bold');
    doc.text('• Pattern Quality:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`${input.patternScore}%`, margin + 50, yPosition);
    yPosition += 7;
    
    // Instruction Score
    doc.setFont('helvetica', 'bold');
    doc.text('• Instruction Quality:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`${input.instructionScore}%`, margin + 50, yPosition);
    yPosition += 10;

    // Add score chart
    try {
        const chartImage = await generateScoreChart(input.patternScore, input.instructionScore, input.overallScore);
        if (chartImage) {
            doc.addImage(chartImage, 'PNG', margin, yPosition, contentWidth, 60);
            yPosition += 65;
        }
    } catch (err) {
        console.warn('[PDF] Failed to generate chart:', err);
    }

    // Summary Statistics
    const totalPatterns = input.patterns.length;
    const failedPatterns = input.patterns.filter(p => !p.Status).length;
    const passedPatterns = totalPatterns - failedPatterns;
    
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, yPosition, contentWidth, 25, 3, 3, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Quick Summary', margin + 5, yPosition + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Patterns: ${totalPatterns}`, margin + 5, yPosition + 14);
    doc.setTextColor(34, 139, 34);
    doc.text(`Passed: ${passedPatterns}`, margin + 60, yPosition + 14);
    doc.setTextColor(220, 20, 60);
    doc.text(`Failed: ${failedPatterns}`, margin + 100, yPosition + 14);
    doc.setTextColor(0, 0, 0);
    
    if (input.instructionEval) {
        doc.text(`Instruction Issues: ${input.instructionEval.issues.length}`, margin + 5, yPosition + 21);
    }

    // ===== Page 2: Agent Instructions =====
    if (input.agentInstructions) {
        doc.addPage();
        yPosition = 20;

        doc.setFontSize(18);
        doc.setTextColor(7, 127, 171);
        doc.setFont('helvetica', 'bold');
        doc.text('Agent Instructions', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'italic');
        doc.text('Original instructions provided for this agent', margin, yPosition);
        yPosition += 8;

        // Instructions box with border
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, yPosition, contentWidth, pageHeight - yPosition - 30, 3, 3, 'S');

        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        
        const cleanedInstructions = cleanTextForPdf(input.agentInstructions);
        const instructionLines = doc.splitTextToSize(cleanedInstructions, contentWidth - 10);
        let instructionY = yPosition + 7;
        
        instructionLines.forEach((line: string) => {
            if (instructionY > pageHeight - 35) {
                doc.addPage();
                instructionY = 20;
                doc.setDrawColor(200, 200, 200);
                doc.roundedRect(margin, 15, contentWidth, pageHeight - 45, 3, 3, 'S');
            }
            doc.text(line, margin + 5, instructionY);
            instructionY += 5;
        });
    }

    // ===== Page 3: Pattern Analysis =====
    doc.addPage();
    yPosition = 20;
    
    doc.setFontSize(18);
    doc.setTextColor(7, 127, 171);
    doc.setFont('helvetica', 'bold');
    doc.text('Pattern Analysis', margin, yPosition);
    yPosition += 12;

    // Patterns Table
    addPatternsTable(doc, input.patterns, yPosition, margin, contentWidth);

    // ===== Page N: Instruction Evaluation =====
    if (input.instructionEval && input.instructionEval.issues.length > 0) {
        doc.addPage();
        yPosition = 20;
        
        doc.setFontSize(18);
        doc.setTextColor(7, 127, 171);
        doc.setFont('helvetica', 'bold');
        doc.text('Instruction Quality Evaluation', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text(`Compliance: ${input.instructionEval.compliance ? 'Yes' : 'No'}`, margin, yPosition);
        yPosition += 7;
        doc.text(`Compliance Score: ${input.instructionEval.compliancePercentage}%`, margin, yPosition);
        yPosition += 10;

        doc.setFont('helvetica', 'bold');
        doc.text('Issues Identified:', margin, yPosition);
        yPosition += 8;

        addInstructionIssues(doc, input.instructionEval, yPosition, margin, contentWidth);
    }

    // Add footer to all pages
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
        doc.text(
            'Generated by Copilot Studio Kit - Agent Review Tool',
            pageWidth / 2,
            pageHeight - 5,
            { align: 'center' }
        );
    }

    // Convert to base64 for Dataverse storage
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    return pdfBase64;
}

/**
 * Generate score chart as PNG image
 */
async function generateScoreChart(
    patternScore: number,
    instructionScore: number,
    overallScore: number
): Promise<string | null> {
    try {
        // Create off-screen canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return null;

        // Import Chart.js
        const { Chart, registerables } = await import('chart.js');
        Chart.register(...registerables);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Pattern Quality', 'Instruction Quality', 'Overall Score'],
                datasets: [{
                    label: 'Score (%)',
                    data: [patternScore, instructionScore, overallScore],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Quality Scores Breakdown',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        });

        // Wait for chart to render
        await new Promise(resolve => setTimeout(resolve, 500));

        return canvas.toDataURL('image/png');
    } catch (err) {
        console.error('[PDF Chart] Failed to generate chart:', err);
        return null;
    }
}

/**
 * Add patterns table to PDF
 */
function addPatternsTable(
    doc: jsPDF,
    patterns: Pattern[],
    startY: number,
    margin: number,
    contentWidth: number
): void {
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = startY;
    const lineHeight = 9;
    const rowPadding = 2;

    if (patterns.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('No patterns to display.', margin, yPos);
        return;
    }

    // Table header
    doc.setFillColor(7, 127, 171);
    doc.rect(margin, yPos, contentWidth, lineHeight + 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('Pattern', margin + 2, yPos + 5);
    doc.text('Status', margin + 100, yPos + 5);
    doc.text('Issues', margin + 130, yPos + 5);
    yPos += lineHeight + 2;

    // Table rows
    doc.setFont('helvetica', 'normal');
    patterns.forEach((pattern, index) => {
        // Check if need new page
        if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 20;
            // Repeat header
            doc.setFillColor(7, 127, 171);
            doc.rect(margin, yPos, contentWidth, lineHeight + 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('Pattern', margin + 2, yPos + 5);
            doc.text('Status', margin + 100, yPos + 5);
            doc.text('Issues', margin + 130, yPos + 5);
            yPos += lineHeight + 2;
            doc.setFont('helvetica', 'normal');
        }

        // Alternating row colors
        if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, yPos, contentWidth, lineHeight + 1, 'F');
        }

        const status = pattern.Status ? 'Pass' : 'Fail';
        const statusColor = pattern.Status ? [34, 139, 34] : [220, 20, 60];
        const issueCount = pattern.Topics?.length || 0;

        // Pattern description (truncate if too long)
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const patternDesc = cleanTextForPdf(String(pattern.PatternDescription || ''));
        const patternText = patternDesc.length > 50 
            ? patternDesc.substring(0, 47) + '...'
            : patternDesc;
        doc.text(patternText, margin + 2, yPos + 5);

        // Status
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.text(status, margin + 100, yPos + 5);

        // Issue count
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(issueCount.toString(), margin + 135, yPos + 5);

        yPos += lineHeight;

        // Add topics/issues if failed (show all topics)
        if (!pattern.Status && pattern.Topics && pattern.Topics.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(80, 80, 80);
            
            pattern.Topics.forEach(topic => {
                if (yPos > pageHeight - 40) {
                    doc.addPage();
                    yPos = 20;
                }
                const topicItem = cleanTextForPdf(String(topic.item ?? ''));
                const topicVariable = cleanTextForPdf(String(topic.variable ?? ''));
                const topicCurrent = cleanTextForPdf(String(topic.current ?? 'unclear'));
                const topicSuggested = cleanTextForPdf(String(topic.suggested ?? 'N/A'));
                
                const topicLine = topic.variable 
                    ? `  • ${topicItem} - ${topicVariable}: ${topicCurrent} → ${topicSuggested}`
                    : `  • ${topicItem}: ${topicCurrent} → ${topicSuggested}`;
                
                const cleanedTopicLine = cleanTextForPdf(topicLine);
                const wrappedLines = doc.splitTextToSize(cleanedTopicLine, contentWidth - 10);
                wrappedLines.forEach((line: string) => {
                    doc.text(line, margin + 4, yPos + 4);
                    yPos += 4;
                });
            });
            
            yPos += 2;
            doc.setFontSize(9);
        }
    });
}

/**
 * Add instruction issues to PDF
 */
function addInstructionIssues(
    doc: jsPDF,
    instructionEval: InstructionEvaluation,
    startY: number,
    margin: number,
    contentWidth: number
): void {
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = startY;

    doc.setFontSize(9);
    
    instructionEval.issues.forEach((issue, index) => {
        if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 20;
        }

        // Issue header with severity badge
        const severityColor = issue.severity === 'high' ? [220, 20, 60] :
                             issue.severity === 'medium' ? [255, 165, 0] : 
                             [128, 128, 128];

        doc.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
        doc.roundedRect(margin, yPos, 20, 5, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(issue.severity.toUpperCase(), margin + 10, yPos + 3.5, { align: 'center' });
        
        // Issue description
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(`${index + 1}. ${issue.id}`, margin + 22, yPos + 4);
        yPos += 7;

        // Description
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(issue.description, contentWidth - 10);
        descLines.forEach((line: string) => {
            if (yPos > pageHeight - 40) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, margin + 5, yPos);
            yPos += 4;
        });
        yPos += 2;

        // Recommendation
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(50, 50, 150);
        doc.text('Recommendation:', margin + 5, yPos);
        yPos += 4;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        const recLines = doc.splitTextToSize(issue.recommendation, contentWidth - 15);
        recLines.forEach((line: string) => {
            if (yPos > pageHeight - 40) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, margin + 10, yPos);
            yPos += 4;
        });
        
        yPos += 5;

        // Separator line
        if (index < instructionEval.issues.length - 1) {
            doc.setDrawColor(220, 220, 220);
            doc.line(margin, yPos, margin + contentWidth, yPos);
            yPos += 5;
        }
    });
}

/**
 * Download PDF report as file (client-side download)
 */
export function downloadPdfReport(base64Data: string, botName: string): void {
    const blob = base64ToBlob(base64Data, 'application/pdf');
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${botName.replace(/[^a-z0-9]/gi, '_')}_Review_${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Convert base64 to Blob
 */
function base64ToBlob(base64: string, contentType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}
