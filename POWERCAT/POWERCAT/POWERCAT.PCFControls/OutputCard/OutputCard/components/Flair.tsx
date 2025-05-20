import * as React from "react";
import { useFlair } from "@fluentui-copilot/react-flair";
import { makeStyles, mergeClasses, Text } from "@fluentui/react-components";
import { CopilotProvider, OutputCard, OutputCardProps } from "@fluentui-copilot/react-copilot";

export interface IOutputCardProps extends OutputCardProps {
    height: number;
    width: number;
    title?: string;
  }

const useLayoutStyles = makeStyles({
    root: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "200px",
        height: "200px",
    },
});

export const Flair = React.memo((props: IOutputCardProps): React.ReactElement => {
    const layoutStyles = useLayoutStyles();
    const { isLoading, height, width, title } = props;
    const { play, className, targetRef, style } = useFlair();

    React.useEffect(() => {
        !isLoading && play?.();
    }, [isLoading])

    return (
        <CopilotProvider mode="canvas">
            <OutputCard
                style={{ ...style, height: height, width: width, backgroundColor: 'transparent' }}
                ref={targetRef}
                className={mergeClasses(layoutStyles.root, className)}
                progress={{ value: undefined }} 
                isLoading={isLoading}
            >
                {isLoading &&  <Text truncate={true} wrap={true} weight={'semibold'}>{title}</Text>}
            </OutputCard>
        </CopilotProvider>
    );
});
Flair.displayName = 'Flair';