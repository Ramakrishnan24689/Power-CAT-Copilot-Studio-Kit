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
import { Info16Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import type { ComplianceDisplayRow } from "../../../types";

interface ComplianceDataGridProps {
	issues: ComplianceDisplayRow[];
	onIssueDetails?: (issue: ComplianceDisplayRow) => void;
}

/**
 * DataGrid displaying agent instruction compliance criteria (12 evaluation criteria)
 * Shows Pass/Fail status for each criteria similar to Pattern grid
 */
export const ComplianceDataGrid: React.FC<ComplianceDataGridProps> = ({ issues, onIssueDetails }) => {
	const columns: TableColumnDefinition<ComplianceDisplayRow>[] = [
		createTableColumn<ComplianceDisplayRow>({
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
		createTableColumn<ComplianceDisplayRow>({
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
							: item.severity === "Low"
							? "informative"
							: "subtle"
					}
					size="small"
				>
					{item.severity}
				</Badge>
			),
		}),
		createTableColumn<ComplianceDisplayRow>({
			columnId: "category",
			renderHeaderCell: () => "Category",
			renderCell: (item) => item.category as string,
		}),
		createTableColumn<ComplianceDisplayRow>({
			columnId: "name",
			renderHeaderCell: () => "Criteria",
			renderCell: (item) => (
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<span>{item.name}</span>
					<Tooltip content={item.description} relationship="description">
						<Info16Regular
							style={{
								color: "#605e5c",
								cursor: "help",
								flexShrink: 0
							}}
						/>
					</Tooltip>
				</div>
			),
		}),
		createTableColumn<ComplianceDisplayRow>({
			columnId: "issueCount",
			renderHeaderCell: () => "Issues",
			renderCell: (item) => (
				<span style={{ fontWeight: item.issueCount > 0 ? 600 : 400 }}>
					{item.issueCount}
				</span>
			),
		}),
		createTableColumn<ComplianceDisplayRow>({
			columnId: "actions",
			renderHeaderCell: () => "Actions",
			renderCell: (item) => (
				<Button
					size="small"
					appearance="subtle"
					icon={<ChevronRight20Regular />}
					disabled={item.issueCount === 0}
					onClick={() => onIssueDetails?.(item)}
				>
					Details
				</Button>
			),
		}),
	];

	const columnSizingOptions: TableColumnSizingOptions = {
		status: {
			minWidth: 80,
			defaultWidth: 100,
		},
		severity: {
			minWidth: 80,
			defaultWidth: 100,
		},
		category: {
			minWidth: 100,
			defaultWidth: 120,
		},
		name: {
			minWidth: 120,
			defaultWidth: 200,
		},
		issueCount: {
			minWidth: 70,
			defaultWidth: 80,
		},
		actions: {
			minWidth: 90,
			defaultWidth: 100,
		},
	};

	if (issues.length === 0) {
		return (
			<div
				style={{
					padding: "24px",
					textAlign: "center",
					color: "#605e5c",
					fontStyle: "italic",
				}}
			>
				No instruction evaluation data available
			</div>
		);
	}

		return (
		<DataGrid
			items={issues}
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
			<DataGridBody<ComplianceDisplayRow>>
				{({ item, rowId }) => (
					<DataGridRow<ComplianceDisplayRow> key={rowId}>
						{({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
					</DataGridRow>
				)}
			</DataGridBody>
		</DataGrid>
	);
};
