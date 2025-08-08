/**
 * FluentUI Test Execution Chart with DonutChart - Enhanced with legend and percentages
 */

import React, { useMemo, useState, useCallback } from "react";
import { makeStyles, tokens, Text, Badge } from "@fluentui/react-components";
import { DonutChart, IChartDataPoint } from "@fluentui/react-charting";
import type { TestExecutionSummary } from "../shared/models/DataModels";

// Constants for FluentChart component
const FLUENT_CHART_CONSTANTS = {
  CHART_COLORS: {
    SUCCESS: tokens.colorPaletteGreenForeground1,
    FAILED: tokens.colorPaletteRedForeground1,
    PENDING: tokens.colorBrandForeground1,
    ERROR: tokens.colorPaletteMarigoldForeground1,
    UNKNOWN: tokens.colorNeutralForeground2,
  },

  CHART_LABELS: {
    SUCCESS_LABEL: "Success",
    FAILED_LABEL: "Failed",
    PENDING_LABEL: "Pending",
    UNKNOWN_LABEL: "Unknown",
    ERROR_LABEL: "Error",
    CHART_TITLE: "Test Execution History",
  },
} as const;

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacingVerticalL,
    gap: tokens.spacingHorizontalXXL,
    border: "none",
    width: "100%",
    // Mobile responsiveness
    "@media (max-width: 768px)": {
      flexDirection: "column",
      gap: tokens.spacingVerticalL,
      padding: tokens.spacingVerticalM,
    },
  },

  chartWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    // Mobile responsiveness
    "@media (max-width: 768px)": {
      transform: "scale(0.8)",
    },
  },

  centerLabel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    textAlign: "center",
    pointerEvents: "none",
  },

  totalNumber: {
    fontSize: "36px",
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    lineHeight: "1",
    // Mobile responsiveness
    "@media (max-width: 768px)": {
      fontSize: "28px",
    },
  },

  totalLabel: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    marginTop: "6px",
    // Mobile responsiveness
    "@media (max-width: 768px)": {
      fontSize: tokens.fontSizeBase200,
    },
  },

  legendContainer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    minWidth: "220px",
    // Mobile responsiveness
    "@media (max-width: 768px)": {
      minWidth: "100%",
      gap: tokens.spacingVerticalS,
    },
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2,
      transform: "translateX(4px) scale(1.02)",
      boxShadow: `0 4px 12px ${tokens.colorNeutralShadowAmbient}`,
    },
    ":active": {
      transform: "translateX(2px) scale(1.01)",
    },
  },

  legendItemHighlighted: {
    backgroundColor: tokens.colorBrandBackground2,
    transform: "translateX(4px) scale(1.02)",
    boxShadow: `0 6px 16px ${tokens.colorBrandShadowAmbient}`,
    "::before": {
      content: '""',
      position: "absolute",
      left: "0",
      top: "0",
      bottom: "0",
      width: "3px",
      backgroundColor: tokens.colorBrandForeground1,
      borderRadius: "0 2px 2px 0",
    },
  },

  legendLeft: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
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
  },

  legendLabelHighlighted: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },

  legendValue: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    transition: "all 0.2s ease-in-out",
  },

  legendValueHighlighted: {
    color: tokens.colorBrandForeground1,
    fontSize: tokens.fontSizeBase500,
  },

  legendCount: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground3,
    marginLeft: tokens.spacingHorizontalS,
    transition: "color 0.2s ease-in-out",
  },

  legendCountHighlighted: {
    color: tokens.colorBrandForeground2,
  },

  // Chart segment hover effects (applied via CSS custom properties)
  chartHighlighted: {
    filter: "brightness(1.15) saturate(1.1)",
    transform: "scale(1.05)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
});

const FluentChart: React.FC<{ summary: TestExecutionSummary }> = ({
  summary,
}) => {
  const styles = useStyles();

  // State for bidirectional hover effects
  const [highlightedSegment, setHighlightedSegment] = useState<string | null>(
    null
  );

  // Hover handlers for bidirectional effects
  const handleLegendHover = useCallback((segmentLabel: string | null) => {
    setHighlightedSegment(segmentLabel);

    // Apply chart segment highlighting via DOM manipulation
    // Target FluentUI chart paths more reliably
    const chartContainer = document.querySelector(
      ".ms-Chart, [class*='Chart'], [data-testid='chart']"
    );
    if (chartContainer) {
      // Try multiple selectors for chart segments
      const segments = chartContainer.querySelectorAll(
        "path[d*='A'], path[stroke], g path, svg path"
      );
      segments.forEach((segment: Element) => {
        const htmlSegment = segment as HTMLElement;
        if (segmentLabel) {
          // Try to match by aria-label, title, or data attributes
          const segmentAriaLabel = htmlSegment.getAttribute("aria-label") || "";
          const segmentTitle = htmlSegment.getAttribute("title") || "";
          const parentGroup = htmlSegment.closest("g");
          const groupTitle = parentGroup?.getAttribute("aria-label") || "";

          const isMatchingSegment =
            segmentAriaLabel.includes(segmentLabel) ||
            segmentTitle.includes(segmentLabel) ||
            groupTitle.includes(segmentLabel);

          if (isMatchingSegment) {
            htmlSegment.style.filter =
              "brightness(1.2) saturate(1.2) drop-shadow(0 0 8px rgba(0,0,0,0.3))";
            htmlSegment.style.transform = "scale(1.05)";
            htmlSegment.style.transformOrigin = "center";
            htmlSegment.style.transition =
              "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
          } else {
            htmlSegment.style.filter = "brightness(0.6) saturate(0.6)";
            htmlSegment.style.transition =
              "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
          }
        } else {
          // Reset all segments
          htmlSegment.style.filter = "";
          htmlSegment.style.transform = "";
          htmlSegment.style.transition = "";
        }
      });
    }
  }, []);

  const handleChartHover = useCallback((segmentLabel: string | null) => {
    setHighlightedSegment(segmentLabel);
  }, []);

  // Prepare data for FluentUI DonutChart
  const { chartData, legendData } = useMemo(() => {
    const total = summary.totalTests || 1;

    const resultCodeBreakdown = {
      success: summary.successTests || 0,
      failed: summary.failedTests || 0,
      pending: summary.pendingTests || 0,
      unknown: summary.unknownTests || 0,
      error: summary.errorTests || 0,
    };

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
    ].filter((item) => (item.data || 0) > 0); // Only show segments with data

    // Create legend data with percentages
    const legendItems = chartDataItems.map((item) => ({
      ...item,
      percentage:
        total > 0 ? (((item.data || 0) / total) * 100).toFixed(1) : "0",
    }));

    return {
      chartData: chartDataItems,
      legendData: legendItems,
    };
  }, [summary]);

  return (
    <div className={styles.container}>
      <div
        className={styles.chartWrapper}
        onMouseMove={(e) => {
          // Detect which chart segment is being hovered
          const target = e.target as HTMLElement;
          if (target.tagName === "path" && target.getAttribute("aria-label")) {
            const ariaLabel = target.getAttribute("aria-label") || "";
            // Extract segment name from aria-label
            const segmentMatch = legendData.find((item) =>
              ariaLabel.includes(item.legend || "")
            );
            if (segmentMatch && segmentMatch.legend) {
              handleChartHover(segmentMatch.legend);
            }
          }
        }}
        onMouseLeave={() => {
          handleChartHover(null);
          handleLegendHover(null);
        }}
      >
        <DonutChart
          data={{
            chartTitle: "",
            chartData: chartData,
          }}
          hideLegend={true} // We'll create our own legend
          //height={220}
          //width={220}
          innerRadius={55}
          hideTooltip={false}
          showLabelsInPercent={false}
        />
        <div className={styles.centerLabel}>
          <div className={styles.totalNumber}>{summary.totalTests}</div>
          <div className={styles.totalLabel}>Total Tests</div>
        </div>
      </div>

      <div className={styles.legendContainer}>
        {legendData.map((item, index) => {
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
                opacity: isOthersHighlighted ? 0.5 : 1,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <div className={styles.legendLeft}>
                <div
                  className={`${styles.colorIndicator} ${
                    isHighlighted ? styles.colorIndicatorHighlighted : ""
                  }`}
                  style={{ backgroundColor: item.color }}
                />
                <Text
                  className={`${styles.legendLabel} ${
                    isHighlighted ? styles.legendLabelHighlighted : ""
                  }`}
                >
                  {item.legend}
                </Text>
                <Text
                  className={`${styles.legendCount} ${
                    isHighlighted ? styles.legendCountHighlighted : ""
                  }`}
                >
                  {item.data} tests
                </Text>
              </div>
              <Text
                className={`${styles.legendValue} ${
                  isHighlighted ? styles.legendValueHighlighted : ""
                }`}
              >
                {item.percentage}%
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FluentChart;
