import * as React from "react";
import { makeStyles } from "@fluentui/react-components";
import { getScoreColor, getScoreLabel } from "../../utils/scoreCalculator";

export interface RadialGaugeProps {
	score: number; // 0-100
	size?: number; // diameter in pixels
	strokeWidth?: number;
}

const useStyles = makeStyles({
	container: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: "8px",
	},
});

/**
 * Lightweight SVG radial gauge for displaying compliance score
 */
export const RadialGauge: React.FC<RadialGaugeProps> = ({
	score,
	size = 200,
	strokeWidth = 16,
}) => {
	const styles = useStyles();
	const normalizedScore = Math.max(0, Math.min(100, score));
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (normalizedScore / 100) * circumference;
	const color = getScoreColor(normalizedScore);
	const label = getScoreLabel(normalizedScore);

	const svgTransform = "rotate(-90deg)";
	const textTransform = "rotate(90deg)";
	const fontSize = `${size * 0.25}px`;
	const transition = "stroke-dashoffset 0.5s ease-in-out, stroke 0.3s ease";

	return (
		<div className={styles.container}>
			<svg width={size} height={size} style={{ transform: svgTransform }}>
				{/* Background circle */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="#edebe9"
					strokeWidth={strokeWidth}
				/>
				{/* Progress arc */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth={strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					style={{ transition }}
				/>
				{/* Center score text */}
				<text
					x="50%"
					y="50%"
					textAnchor="middle"
					dy="0.35em"
					style={{
						fontSize,
						fontWeight: 600,
						fill: color,
						transform: textTransform,
						transformOrigin: "center",
					}}
				>
					{normalizedScore}%
				</text>
			</svg>
			{/* Label below gauge */}
			<div style={{ fontSize: "14px", fontWeight: 600, color }}>
				{label}
			</div>
		</div>
	);
};
