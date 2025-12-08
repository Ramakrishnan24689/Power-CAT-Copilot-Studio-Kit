/**
 * OData Query Configuration
 * Centralized OData query operators, limits, and helper functions
 */

/**
 * OData query operators
 */
export const ODataOperators = {
    Select: '$select',
    Filter: '$filter',
    OrderBy: '$orderby',
    Top: '$top',
    Skip: '$skip',
    Count: '$count',
    Expand: '$expand',
} as const;

/**
 * OData filter operators
 */
export const FilterOperators = {
    Equal: 'eq',
    NotEqual: 'ne',
    GreaterThan: 'gt',
    GreaterThanOrEqual: 'ge',
    LessThan: 'lt',
    LessThanOrEqual: 'le',
    And: 'and',
    Or: 'or',
    Not: 'not',
    Contains: 'contains',
    StartsWith: 'startswith',
    EndsWith: 'endswith',
} as const;

/**
 * OData query limits and defaults
 */
export const QueryLimits = {
    /** Maximum records to retrieve in a single request */
    MaxPageSize: 5000,
    /** Default page size for pagination */
    DefaultPageSize: 100,
    /** Maximum number of pages to retrieve (safety limit) */
    MaxPages: 100,
    /** Minimum page size */
    MinPageSize: 1,
} as const;

/**
 * Order directions
 */
export const OrderDirection = {
    Ascending: 'asc',
    Descending: 'desc',
} as const;

/**
 * Helper function to build OData select clause
 */
export function buildSelect(fields: string[]): string {
    return `?${ODataOperators.Select}=${fields.join(',')}`;
}

/**
 * Helper function to build OData filter clause
 */
export function buildFilter(field: string, operator: string, value: string | number): string {
    const formattedValue = typeof value === 'string' ? `'${value}'` : value;
    return `${field} ${operator} ${formattedValue}`;
}

/**
 * Helper function to build OData orderby clause
 */
export function buildOrderBy(field: string, direction: 'asc' | 'desc' = 'asc'): string {
    return `${ODataOperators.OrderBy}=${field} ${direction}`;
}

/**
 * Helper function to build complete query string
 */
export function buildQuery(options: {
    select?: string[];
    filter?: string;
    orderBy?: { field: string; direction?: 'asc' | 'desc' };
    top?: number;
    count?: boolean;
}): string {
    const parts: string[] = [];

    if (options.select && options.select.length > 0) {
        parts.push(`${ODataOperators.Select}=${options.select.join(',')}`);
    }

    if (options.filter) {
        parts.push(`${ODataOperators.Filter}=${options.filter}`);
    }

    if (options.orderBy) {
        const direction = options.orderBy.direction ?? OrderDirection.Ascending;
        parts.push(`${ODataOperators.OrderBy}=${options.orderBy.field} ${direction}`);
    }

    if (options.top) {
        parts.push(`${ODataOperators.Top}=${options.top}`);
    }

    if (options.count) {
        parts.push(`${ODataOperators.Count}=true`);
    }

    return parts.length > 0 ? `?${parts.join('&')}` : '';
}
