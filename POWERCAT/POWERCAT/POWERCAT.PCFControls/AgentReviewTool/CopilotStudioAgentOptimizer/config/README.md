# Configuration Management

This directory contains centralized configuration constants for the Copilot Studio Agent Optimizer PCF control. All magic strings (table names, field names, status codes, etc.) have been extracted to typed configuration objects.

## Purpose

- **Single Source of Truth**: All Dataverse schema-related constants in one place
- **Type Safety**: IntelliSense support and compile-time validation
- **Easy Schema Updates**: Change schema mappings once, apply everywhere
- **Prevent Typos**: No more hardcoded strings scattered throughout the codebase
- **Better Maintainability**: Clear documentation of all schema dependencies

## Configuration Files

### 1. `dataverse.config.ts`
Dataverse entity names, field names, status codes, and API paths.

**Exports:**
- `DataverseEntities` - Table/entity logical names
  - `Bot`: 'bot'
  - `BotComponent`: 'botcomponent'
  - `AgentReviews`: 'cat_agentreviewses'
  - `AgentReviewFRE`: 'cat_agentreviewfre'

- `BotFields` - Bot entity field names (9 fields)
- `BotComponentFields` - BotComponent entity field names (10 fields)
- `AgentReviewFields` - AgentReviews entity field names (16 fields)
- `FREFields` - AgentReviewFRE entity field names (4 fields)

- `ReviewStatus` - Review status choice values
  - `Completed`: 33535000
  - `Draft`: 33535001
  - `Archived`: 33535002

- `BotStateCode` - Bot state codes
  - `Active`: 0
  - `Inactive`: 1

- `API_VERSION` - Dataverse API version ('v9.2')
- `BASE_API_PATH` - Base API path ('/api/data/v9.2')

**Usage Example:**
```typescript
import { DataverseEntities, AgentReviewFields, ReviewStatus } from '../../config';

// Instead of: 'cat_agentreviewses'
const entityName = DataverseEntities.AgentReviews;

// Instead of: 'cat_overallscore'
const scoreField = AgentReviewFields.OverallScore;

// Instead of: 33535000
const completedStatus = ReviewStatus.Completed;
```

### 2. `odata.config.ts`
OData query operators, pagination limits, and query builder helpers.

**Exports:**
- `ODataOperators` - OData query operators ($select, $filter, $orderby, $top, $skip, $count, $expand)
- `FilterOperators` - OData filter operators (eq, ne, gt, gte, lt, lte, and, or, not, contains, etc.)
- `QueryLimits` - Pagination limits and defaults
  - `MaxPageSize`: 5000 (Dataverse limit)
  - `DefaultPageSize`: 100
  - `MaxPages`: 100 (safety limit)
  - `MinPageSize`: 1
- `OrderDirection` - Sort directions (Ascending, Descending)

**Helper Functions:**
- `buildSelect(fields: string[]): string` - Build $select clause
- `buildFilter(field: string, operator: string, value: string | number): string` - Build filter expression
- `buildOrderBy(field: string, direction?: 'asc' | 'desc'): string` - Build $orderby clause
- `buildQuery(options): string` - Build complete OData query string

**Usage Example:**
```typescript
import { BotFields, buildQuery, OrderDirection } from '../../config';

// Instead of: '?$select=name,botid&$orderby=name asc'
const query = buildQuery({
    select: [BotFields.Name, BotFields.Id],
    orderBy: { field: BotFields.Name, direction: OrderDirection.Ascending }
});
// Returns: '?$select=name,botid&$orderby=name asc'
```

### 3. `app.config.ts`
Application-wide constants including storage keys, thresholds, UI constants, and SARIF configuration.

**Exports:**
- `StorageKeys` - Local storage keys
  - `FirstRunExperience`: 'copilot_agent_optimizer_fre'

- `ComponentThresholds` - Performance thresholds
  - `LocalParsingThreshold`: 10 (components)

- `ScoreThresholds` - Score ranges
  - `MinScore`: 0
  - `MaxScore`: 100
  - `ExcellentThreshold`: 90
  - `GoodThreshold`: 75
  - `FairThreshold`: 60
  - `PoorThreshold`: 60

- `SeverityLevels` - SARIF severity levels (none, note, warning, error)
- `SarifConfig` - SARIF reporting constants
- `UIConstants` - UI display defaults
- `DateFormats` - Date formatting patterns
- `ComponentTypes` - Bot component type codes

**Usage Example:**
```typescript
import { StorageKeys, ComponentThresholds } from '../../config';

// Instead of: 'copilot_agent_optimizer_fre'
const freKey = StorageKeys.FirstRunExperience;

// Instead of: 10
if (componentCount < ComponentThresholds.LocalParsingThreshold) {
    // Use local parsing
}
```

### 4. `index.ts`
Barrel export for convenient imports.

**Usage:**
```typescript
// Import everything from one location
import {
    DataverseEntities,
    AgentReviewFields,
    ReviewStatus,
    buildQuery,
    OrderDirection,
    StorageKeys
} from '../../config';
```

## Schema Update Workflow

When Dataverse schema changes (new fields, renamed entities, status code changes):

1. **Update Configuration**: Modify the appropriate config file
   - Entity name change → `dataverse.config.ts` > `DataverseEntities`
   - Field name change → `dataverse.config.ts` > `[Entity]Fields`
   - Status code change → `dataverse.config.ts` > `ReviewStatus` or appropriate enum

2. **TypeScript Checks**: Run `npm run build` - compiler will catch any missing updates

3. **No Code Changes Needed**: All consuming code automatically uses new values

### Example: Adding a New Field

```typescript
// 1. Add to dataverse.config.ts
export const AgentReviewFields = {
    // ... existing fields
    NewField: 'cat_newfield', // NEW
} as const;

// 2. Use immediately in any service or component
import { AgentReviewFields } from '../../config';
const newFieldValue = record[AgentReviewFields.NewField];
```

### Example: Changing Entity Name

```typescript
// 1. Update in dataverse.config.ts
export const DataverseEntities = {
    AgentReviews: 'cat_newagentreviews', // CHANGED from 'cat_agentreviewses'
} as const;

// 2. All 50+ references automatically updated - no code changes needed!
// ReviewService, BotService, hooks, components all use updated value
```

## Benefits Realized

### Before Configuration Management
- 100+ hardcoded strings scattered across 15+ files
- Schema changes required manual search-and-replace in 50+ locations
- High risk of typos in table/field names
- Difficult to find all usages of a specific field
- No IntelliSense for field names

### After Configuration Management
- ✅ Single source of truth for all constants
- ✅ Type-safe with IntelliSense support
- ✅ Schema changes in 1 location apply everywhere
- ✅ Compiler catches missing updates
- ✅ Clear documentation of all schema dependencies
- ✅ Reduced risk of typos

## Files Updated

**Services:**
- `Services/domain/ReviewService.ts` - Uses `DataverseEntities.AgentReviews`, `AgentReviewFields.*`, `ReviewStatus`, `buildQuery`
- `Services/domain/BotService.ts` - Uses `DataverseEntities.Bot/BotComponent`, `BotFields.*`, `BotComponentFields.*`
- `Services/domain/FREService.ts` - Uses `DataverseEntities.AgentReviewFRE`, `FREFields.*`, `StorageKeys.FirstRunExperience`

**Components & Hooks:**
- `Components/Grid/hooks/useExistingReviews.ts` - Uses `ReviewStatus.Completed`
- `Components/Grid/hooks/useBotData.ts` - Uses `BotFields.*`, `buildQuery`, `OrderDirection`
- `Components/Grid/BotsDataGrid.tsx` - Uses `ReviewStatus.Completed`

**Improvements:**
- Eliminated 100+ magic strings
- Centralized 39 field names + 4 entity names + 3 status codes
- Added type-safe query builder helpers
- Zero bundle size increase (10782.33 KB stable)

## Testing

Configuration constants are compile-time values and don't require separate unit tests. However:
- **Build validation**: `npm run build` ensures all config usage is valid
- **Type checking**: TypeScript compiler validates field name references
- **Runtime validation**: Existing service and component tests validate behavior

## Maintenance

When adding new features:
1. Check if new constants should be added to config files
2. Never hardcode table names, field names, or status codes
3. Always import from `config` directory
4. Update this README if adding new config categories

## References

- PCF Best Practices: https://learn.microsoft.com/power-apps/developer/component-framework/code-components-best-practices
- Dataverse Web API: https://learn.microsoft.com/power-apps/developer/data-platform/webapi/overview
- OData Query Options: https://learn.microsoft.com/power-apps/developer/data-platform/webapi/query-data-web-api
