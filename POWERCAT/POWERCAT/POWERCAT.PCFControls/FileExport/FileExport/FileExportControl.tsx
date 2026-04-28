import * as React from 'react';
import { Button } from '@fluentui/react-components';
import { ArrowDownloadRegular } from "@fluentui/react-icons";

export interface FileExportControlProps {
  content: string;
  fileName: string;
  buttonLabel: string;
  buttonAppearance: string;
  fontSize?: number;
  onExportResult: (status: "success" | "error", message: string) => void;
}

const validAppearances = ["primary", "secondary", "subtle", "transparent", "outline"] as const;
type ButtonAppearance = typeof validAppearances[number];

export const FileExportControl: React.FC<FileExportControlProps> = ({
  content, fileName, buttonLabel, buttonAppearance, fontSize, onExportResult,
}) => {
  const handleExport = React.useCallback(() => {
    if (!content) {
      onExportResult("error", "No data available to export.");
      return;
    }
    try {
      const bom = "\uFEFF";
      const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const name = fileName.trim() || "export";
      link.download = name.endsWith(".csv") ? name : `${name}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onExportResult("success", "Export completed successfully.");
    } catch {
      onExportResult("error", "Export failed. Please try again.");
    }
  }, [content, fileName, onExportResult]);

  const IconComponent = ArrowDownloadRegular;
  const appearance: ButtonAppearance = validAppearances.includes(buttonAppearance as ButtonAppearance)
    ? (buttonAppearance as ButtonAppearance)
    : "primary";
  const style: React.CSSProperties | undefined = fontSize && fontSize > 0
    ? { fontSize: `${fontSize}px` }
    : undefined;

  return (
    <Button
      appearance={appearance}
      icon={<IconComponent />}
      onClick={handleExport}
      style={style}
    >
      {buttonLabel || "Export"}
    </Button>
  );
};