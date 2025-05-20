import { makeStyles } from "@fluentui/react-components";

export const useStyles = makeStyles({
    root: {
        height: '100%',
        width: '100%',
    },
    sizingContainer: {
        bottom: 0,
        left: 0,
        right: 0,
        top: 0,
        position: 'absolute',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
    }
});