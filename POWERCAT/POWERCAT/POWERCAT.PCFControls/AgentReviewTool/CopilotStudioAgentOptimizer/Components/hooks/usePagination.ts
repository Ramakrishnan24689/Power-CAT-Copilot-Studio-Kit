import * as React from 'react';

/**
 * Custom hook for managing pagination state and handlers
 * Extracted from BotsDataGrid for better separation of concerns
 */
export function usePagination<T>(items: T[]) {
    const [currentPage, setCurrentPage] = React.useState<number>(1);
    const [pageSize, setPageSize] = React.useState<number>(5);

    // Calculate total pages dynamically
    const totalPages = React.useMemo(() => {
        const pages = Math.ceil(items.length / pageSize);
        const finalPages = Math.max(1, pages); // At least 1 page
        return finalPages;
    }, [items.length, pageSize]);

    // Calculate paginated items
    const paginatedItems = React.useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const sliced = items.slice(startIndex, endIndex);
        return sliced;
    }, [items, currentPage, pageSize]);

    // Reset to page 1 when items change (e.g., after filter or load)
    React.useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(items.length / pageSize));
        if (currentPage > maxPage) {
            setCurrentPage(1);
        }
    }, [items.length, pageSize, currentPage]);

    // Page size change handler
    const handlePageSizeChange = React.useCallback((_ev: unknown, data: { optionValue?: string }) => {
        const newSize = parseInt(data.optionValue ?? '10', 10);
        setPageSize(newSize);
        setCurrentPage(1); // Reset to first page
    }, []);

    // Previous page handler
    const handlePreviousPage = React.useCallback(() => {
        setCurrentPage(prev => {
            const prevPage = Math.max(1, prev - 1);
            return prevPage;
        });
    }, []);

    // Next page handler
    const handleNextPage = React.useCallback(() => {
        setCurrentPage(prev => {
            const nextPage = Math.min(totalPages, prev + 1);
            return nextPage;
        });
    }, [totalPages]);

    return {
        currentPage,
        pageSize,
        totalPages,
        paginatedItems,
        handlePageSizeChange,
        handlePreviousPage,
        handleNextPage,
        setCurrentPage, // Expose for external reset if needed
    };
}
