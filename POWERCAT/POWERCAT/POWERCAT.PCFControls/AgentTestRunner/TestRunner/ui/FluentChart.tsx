/**
 * FluentChart.tsx
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides FluentUI test execution chart with DonutChart visualization.
 * Displays test result data with interactive legend, hover effects, and mobile responsiveness.
 * Integrates with test execution summary data for comprehensive result visualization.
 *
 * Exports:
 *   - FluentChart: React component for rendering test execution donut charts with legends.
 *
 * Usage:
 *   const chart = <FluentChart summary={testExecutionSummary} />;
 */

import React, { useMemo, useState, useCallback } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { DonutChart, IChartDataPoint } from "@fluentui/react-charting";
import type { TestExecutionSummary } from "../shared/models/DataModels";

const FLUENT_CHART_CONSTANTS = {
  CHART_COLORS: {
    SUCCESS: "#13A10E",
    FAILED: "#E3008C",
    PENDING: "#00BCF2",
    ERROR: "#CA5010",
    UNKNOWN: "#AE8C00",
  },
  CHART_LABELS: {
    SUCCESS_LABEL: "Success",
    FAILED_LABEL: "Failed",
    PENDING_LABEL: "Pending",
    UNKNOWN_LABEL: "Unknown",
    ERROR_LABEL: "Error",
  },
} as const;

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    gap: tokens.spacingVerticalXS,
    border: "none",
    width: "100%",
    maxWidth: "450px",
    margin: "0 auto",
  },

  chartWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "240px",
    height: "200px",
    overflow: "visible",
  },

  centerLabel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    textAlign: "center",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    backgroundColor: "transparent",
  },

  totalNumber: {
    fontSize: "36px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    lineHeight: "1",
    textAlign: "center",
  },

  totalLabel: {
    fontSize: "16px",
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightMedium,
    textAlign: "center",
    lineHeight: "1.2",
  },

  legendContainer: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "center",
    gap: tokens.spacingHorizontalL,
    width: "100%",
    minWidth: "400px",
    marginTop: "1px",
    marginBottom: tokens.spacingVerticalXS,
    paddingHorizontal: tokens.spacingHorizontalS,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusSmall,
    cursor: "pointer",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap",
    minWidth: "fit-content",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },

  legendItemHighlighted: {
    backgroundColor: tokens.colorBrandBackground2,
  },

  colorIndicator: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    flexShrink: 0,
    transition: "all 0.2s ease-in-out",
    boxShadow: `0 2px 4px ${tokens.colorNeutralShadowAmbient}`,
  },

  colorIndicatorHighlighted: {
    transform: "scale(1.3)",
    boxShadow: `0 4px 8px ${tokens.colorNeutralShadowKey}`,
  },

  legendLabel: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightMedium,
    transition: "color 0.2s ease-in-out",
    whiteSpace: "nowrap",
    display: "inline",
  },

  legendLabelHighlighted: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
});

const FluentChart: React.FC<{ summary: TestExecutionSummary }> = ({
  summary,
}) => {
  const styles = useStyles();

  // State for managing bidirectional hover effects between chart and legend
  const [highlightedSegment, setHighlightedSegment] = useState<string | null>(
    null
  );

  /**
   * Handles legend item hover effects with DOM manipulation for chart highlighting
   */
  const handleLegendHover = useCallback((segmentLabel: string | null) => {
    setHighlightedSegment(segmentLabel);

    // Apply visual highlighting to corresponding chart segments
    const chartContainer = document.querySelector(
      ".ms-Chart, [class*='Chart'], [data-testid='chart']"
    );
    if (chartContainer) {
      const segments = chartContainer.querySelectorAll(
        "path[d*='A'], path[stroke], g path, svg path"
      );
      segments.forEach((segment: Element) => {
        const htmlSegment = segment as HTMLElement;
        if (segmentLabel) {
          // Match segment by aria-label, title, or parent group attributes
          const segmentAriaLabel = htmlSegment.getAttribute("aria-label") || "";
          const segmentTitle = htmlSegment.getAttribute("title") || "";
          const parentGroup = htmlSegment.closest("g");
          const groupTitle = parentGroup?.getAttribute("aria-label") || "";

          const isMatchingSegment =
            segmentAriaLabel.includes(segmentLabel) ||
            segmentTitle.includes(segmentLabel) ||
            groupTitle.includes(segmentLabel);

          if (isMatchingSegment) {
            // Highlight matching segment with enhanced brightness and shadow
            htmlSegment.style.filter =
              "brightness(1.2) saturate(1.2) drop-shadow(0 0 8px rgba(0,0,0,0.3))";
            htmlSegment.style.transform = "scale(1.05)";
            htmlSegment.style.transformOrigin = "center";
            htmlSegment.style.transition =
              "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
          } else {
            // Dim non-matching segments for focus
            htmlSegment.style.filter = "brightness(0.6) saturate(0.6)";
            htmlSegment.style.transition =
              "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
          }
        } else {
          // Reset all visual effects when no segment is highlighted
          htmlSegment.style.filter = "";
          htmlSegment.style.transform = "";
          htmlSegment.style.transition = "";
        }
      });
    }
  }, []);

  /**
   * Handles chart segment hover effects
   */
  const handleChartHover = useCallback((segmentLabel: string | null) => {
    setHighlightedSegment(segmentLabel);
  }, []);

  /**
   * Prepare chart data and legend items from test execution summary
   */
  const { chartData, legendData } = useMemo(() => {
    const total = summary.totalTests || 1;

    // Extract test result counts from summary
    const resultCodeBreakdown = {
      success: summary.successTests || 0,
      failed: summary.failedTests || 0,
      pending: summary.pendingTests || 0,
      unknown: summary.unknownTests || 0,
      error: summary.errorTests || 0,
    };

    // Build chart data points using constants for consistency
    const chartDataItems: IChartDataPoint[] = [
      {
        legend: FLUENT_CHART_CONSTANTS.CHART_LABELS.SUCCESS_LABEL,
        data: resultCodeBreakdown.success,
        color: FLUENT_CHART_CONSTANTS.CHART_COLORS.SUCCESS,
      },
      {
        legend: FLUENT_CHART_CONSTANTS.CHART_LABELS.FAILED_LABEL,
        data: resultCodeBreakdown.failed,
        color: FLUENT_CHART_CONSTANTS.CHART_COLORS.FAILED,
      },
      {
        legend: FLUENT_CHART_CONSTANTS.CHART_LABELS.ERROR_LABEL,
        data: resultCodeBreakdown.error,
        color: FLUENT_CHART_CONSTANTS.CHART_COLORS.ERROR,
      },
      {
        legend: FLUENT_CHART_CONSTANTS.CHART_LABELS.PENDING_LABEL,
        data: resultCodeBreakdown.pending,
        color: FLUENT_CHART_CONSTANTS.CHART_COLORS.PENDING,
      },
      {
        legend: FLUENT_CHART_CONSTANTS.CHART_LABELS.UNKNOWN_LABEL,
        data: resultCodeBreakdown.unknown,
        color: FLUENT_CHART_CONSTANTS.CHART_COLORS.UNKNOWN,
      },
    ];

    // Only include categories with test results
    const filteredChartData = chartDataItems.filter(
      (item) => (item.data || 0) > 0
    );

    // Generate legend items with percentage calculations for tooltips
    const legendItems = filteredChartData.map((item) => ({
      ...item,
      percentage:
        total > 0 ? (((item.data || 0) / total) * 100).toFixed(1) : "0",
    }));

    return {
      chartData: filteredChartData,
      legendData: legendItems,
    };
  }, [summary]);

  return (
    <div className={styles.container}>
      {/* Chart wrapper with hover detection for bidirectional highlighting */}
      <div
        className={styles.chartWrapper}
        onMouseMove={(e) => {
          // Detect which chart segment is being hovered for cross-highlighting
          const target = e.target as HTMLElement;
          if (target.tagName === "path" && target.getAttribute("aria-label")) {
            const ariaLabel = target.getAttribute("aria-label") || "";
            // Extract segment name from aria-label to match with legend
            const segmentMatch = legendData.find((item) =>
              ariaLabel.includes(item.legend || "")
            );
            if (segmentMatch && segmentMatch.legend) {
              handleChartHover(segmentMatch.legend);
            }
          }
        }}
        onMouseLeave={() => {
          // Clear all highlighting when mouse leaves chart area
          handleChartHover(null);
          handleLegendHover(null);
        }}
      >
        {/* FluentUI DonutChart with optimized configuration */}
        <DonutChart
          data={{
            chartTitle: "Test Execution Results",
            chartData: chartData,
          }}
          width={240}
          height={240}
          innerRadius={65}
          legendProps={{
            allowFocusOnLegends: true,
            shape: "circle",
          }}
          hideLegend={true}
          hideLabels={false}
          showLabelsInPercent={true}
          hideTooltip={false}
        />

        {/* Center label overlay showing total test count */}
        <div className={styles.centerLabel}>
          <div className={styles.totalNumber}>{summary.totalTests}</div>
          <div className={styles.totalLabel}>Total tests</div>
        </div>
      </div>

      {/* Custom interactive legend with hover effects */}
      <div className={styles.legendContainer}>
        {legendData.map((item, index) => {
          // Determine highlighting state for current legend item
          const isHighlighted = highlightedSegment === (item.legend || null);
          const isOthersHighlighted =
            highlightedSegment && highlightedSegment !== (item.legend || null);

          return (
            <div
              key={index}
              className={`${styles.legendItem} ${
                isHighlighted ? styles.legendItemHighlighted : ""
              }`}
              onMouseEnter={() => handleLegendHover(item.legend || null)}
              onMouseLeave={() => handleLegendHover(null)}
              style={{
                // Dim other legend items when one is highlighted
                opacity: isOthersHighlighted ? 0.5 : 1,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <div
                className={`${styles.colorIndicator} ${
                  isHighlighted ? styles.colorIndicatorHighlighted : ""
                }`}
                style={{ backgroundColor: item.color }}
              />
              <div
                className={`${styles.legendLabel} ${
                  isHighlighted ? styles.legendLabelHighlighted : ""
                }`}
              >
                {item.legend === "Success" ? "Succeeded" : item.legend} (
                {item.data})
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FluentChart;
