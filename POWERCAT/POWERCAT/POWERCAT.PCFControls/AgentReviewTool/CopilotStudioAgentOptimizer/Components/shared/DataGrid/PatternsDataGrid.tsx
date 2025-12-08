import * as React from "react";
import {
	DataGrid,
	DataGridBody,
	DataGridRow,
	DataGridCell,
	DataGridHeader,
	DataGridHeaderCell,
	TableColumnDefinition,
	TableColumnSizingOptions,
	createTableColumn,
} from "@fluentui/react-table";
import { Badge } from "@fluentui/react-badge";
import { Button } from "@fluentui/react-button";
import { Tooltip } from "@fluentui/react-tooltip";
import { ChevronRight20Regular, Info20Regular } from "@fluentui/react-icons";
import type { PatternDisplayRow } from "../../../types";

interface PatternsDataGridProps {
	patterns: PatternDisplayRow[];
	onPatternDetails?: (pattern: PatternDisplayRow) => void;
}

/**
 * DataGrid displaying pattern evaluation results with badges and drill-down
 */
export const PatternsDataGrid: React.FC<PatternsDataGridProps> = ({
	patterns,
	onPatternDetails,
}) => {
	const columns: TableColumnDefinition<PatternDisplayRow>[] = [
		createTableColumn<PatternDisplayRow>({
			columnId: "status",
			renderHeaderCell: () => "Status",
			renderCell: (item) => (
				<Badge
					appearance="filled"
					color={item.status === "Pass" ? "success" : "danger"}
					size="small"
				>
					{item.status}
				</Badge>
			),
		}),
		createTableColumn<PatternDisplayRow>({
			columnId: "severity",
			renderHeaderCell: () => "Severity",
			renderCell: (item) => (
				<Badge
					appearance="outline"
					color={
						item.severity === "High"
							? "danger"
							: item.severity === "Medium"
							? "warning"
							: "informative"
					}
					size="small"
				>
					{item.severity}
				</Badge>
			),
		}),
		createTableColumn<PatternDisplayRow>({
			columnId: "category",
			renderHeaderCell: () => "Category",
			renderCell: (item) => item.category as string,
		}),
		createTableColumn<PatternDisplayRow>({
			columnId: "patternName",
			renderHeaderCell: () => "Pattern",
			renderCell: (item) => (
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<span>{item.patternName}</span>
					<Tooltip content={item.description} relationship="description">
						<Info20Regular 
							style={{ 
								color: "#605e5c", 
								cursor: "help",
								fontSize: "16px",
								width: "16px",
								height: "16px",
								flexShrink: 0
							}} 
						/>
					</Tooltip>
				</div>
			),
		}),
		createTableColumn<PatternDisplayRow>({
			columnId: "topicCount",
			renderHeaderCell: () => "Topics",
			renderCell: (item) => (
				<span style={{ fontWeight: item.topicCount > 0 ? 600 : 400 }}>
					{item.topicCount}
				</span>
			),
		}),
		createTableColumn<PatternDisplayRow>({
			columnId: "actions",
			renderHeaderCell: () => "Actions",
			renderCell: (item) => (
				<Button
					size="small"
					appearance="subtle"
					icon={<ChevronRight20Regular />}
					disabled={item.topicCount === 0}
					onClick={() => onPatternDetails?.(item)}
				>
					Details
				</Button>
			),
		}),
	];

	const columnSizingOptions: TableColumnSizingOptions = {
		status: {
			minWidth: 60,
			defaultWidth: 70,
		},
		severity: {
			minWidth: 60,
			defaultWidth: 80,
		},
		category: {
			minWidth: 110,
			defaultWidth: 130,
		},
		patternName: {
			minWidth: 280,
			defaultWidth: 420,
		},
		topicCount: {
			minWidth: 60,
			defaultWidth: 85,
		},
		actions: {
			minWidth: 70,
			defaultWidth: 95,
		},
	};

	if (patterns.length === 0) {
		return (
			<div
				style={{
					padding: "24px",
					textAlign: "center",
					color: "#605e5c",
					fontStyle: "italic",
				}}
			>
				No pattern evaluation data available
			</div>
		);
	}

		return (
		<DataGrid
			items={patterns}
			columns={columns}
			sortable
			resizableColumns
			columnSizingOptions={columnSizingOptions}
			size="small"
			style={{ minWidth: "100%" }}
		>
			<DataGridHeader>
				<DataGridRow>
					{({ renderHeaderCell }) => (
						<DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
					)}
				</DataGridRow>
			</DataGridHeader>
			<DataGridBody<PatternDisplayRow>>
				{({ item, rowId }) => (
					<DataGridRow<PatternDisplayRow> key={rowId}>
						{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
					</DataGridRow>
				)}
			</DataGridBody>
		</DataGrid>
	);
};
