# Error Handling & Logging Utilities

This directory contains simple, easy-to-understand utilities for error handling and logging throughout the application.

## Overview

- **logger.ts** - Structured logging with levels (Debug, Info, Warn, Error)
- **ErrorBoundary.tsx** - React error boundary component with recovery options
- **index.ts** - Barrel export for convenient imports

## Logger Usage

### Basic Logging

```typescript
import { logger } from '../../Components/utils';

// Different log levels
logger.debug('Detailed debug information', { data: 'values' });
logger.info('General information', { count: 5 });
logger.warn('Something unexpected happened', { reason: 'timeout' });
logger.error('An error occurred', error);
```

### Creating Contextual Loggers

Create loggers with context that appears in all log messages:

```typescript
import { createLogger } from '../../Components/utils';

// Logger for a specific component
const componentLogger = createLogger({ component: 'BotsDataGrid' });

componentLogger.info('Loading bots'); 
// Output: 2025-11-29T... Info [{"component":"BotsDataGrid"}] Loading bots

// Add more context for specific operations
const operationLogger = componentLogger.withContext({ action: 'review' });
operationLogger.info('Starting review');
// Output: 2025-11-29T... Info [{"component":"BotsDataGrid","action":"review"}] Starting review
```

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| **Debug** | Detailed diagnostic information for development | Variable values, execution flow |
| **Info** | General informational messages | "Data loaded", "Operation started" |
| **Warn** | Unexpected situations that don't prevent operation | Deprecation warnings, fallback behavior |
| **Error** | Errors and exceptions | API failures, validation errors |

### Configuration

Control logger behavior globally:

```typescript
import { loggerConfig, LogLevel } from '../../Components/utils';

// Set minimum log level (default: Info)
loggerConfig.setMinLevel(LogLevel.Debug); // Show all logs including debug
loggerConfig.setMinLevel(LogLevel.Error); // Only show errors

// Disable console output entirely
loggerConfig.setConsoleEnabled(false);
```

## Error Boundary Usage

### Basic Error Boundary

Wrap components to catch and handle errors gracefully:

```typescript
import { ErrorBoundary } from '../../Components/utils';

// Wrap your component
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

When an error occurs:
- Error is automatically logged with stack trace
- User sees a friendly error message
- Two recovery options available:
  - **Try Again** - Resets the error boundary and re-renders
  - **Reload Page** - Performs full page reload
  - **Show/Hide Details** - Toggle technical error details

### Custom Error Handling

Provide custom callback for error handling:

```typescript
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Custom error handling
    console.log('Component crashed:', error);
    // Could send to telemetry service, etc.
  }}
>
  <MyComponent />
</ErrorBoundary>
```

### Custom Fallback UI

Provide your own error UI:

```typescript
const CustomErrorFallback = (
  <div>
    <h2>Oops! Something went wrong.</h2>
    <button onClick={() => window.location.reload()}>Reload</button>
  </div>
);

<ErrorBoundary fallback={CustomErrorFallback}>
  <MyComponent />
</ErrorBoundary>
```

### Where to Place Error Boundaries

**Recommended Locations:**

1. **Top-Level** - Around the entire app (done in `index.ts`)
   ```typescript
   <ErrorBoundary>
     <MainContainer {...props} />
   </ErrorBoundary>
   ```

2. **Critical Features** - Around complex features
   ```typescript
   <ErrorBoundary>
     <ReviewDialog {...props} />
   </ErrorBoundary>
   ```

3. **Independent Sections** - Around self-contained UI sections
   ```typescript
   <ErrorBoundary>
     <BotsDataGrid {...props} />
   </ErrorBoundary>
   ```

**Best Practice:** Multiple smaller boundaries are better than one large boundary. If one section fails, others can continue working.

## Implementation Examples

### Service with Logging

```typescript
import { createLogger } from '../../Components/utils';

const logger = createLogger({ component: 'BotService' });

export class BotService {
  async getBots(): Promise<Bot[]> {
    try {
      logger.info('Fetching bots from Dataverse');
      
      const bots = await this.dataverseService.retrieveBots();
      
      logger.info('Bots fetched successfully', { count: bots.length });
      return bots;
      
    } catch (error) {
      logger.error('Failed to fetch bots', error);
      throw error; // Re-throw for caller to handle
    }
  }
}
```

### Component with Error Boundary and Logging

```typescript
import * as React from 'react';
import { ErrorBoundary, createLogger } from '../../Components/utils';

const logger = createLogger({ component: 'MyComponent' });

function MyComponentInner() {
  React.useEffect(() => {
    logger.debug('Component mounted');
    
    return () => {
      logger.debug('Component unmounted');
    };
  }, []);

  const handleAction = () => {
    try {
      logger.info('Action started');
      // ... perform action
      logger.info('Action completed');
    } catch (error) {
      logger.error('Action failed', error);
      // Handle error appropriately
    }
  };

  return <div>...</div>;
}

export function MyComponent() {
  return (
    <ErrorBoundary>
      <MyComponentInner />
    </ErrorBoundary>
  );
}
```

## Migration from console.log

Replace direct console usage with the structured logger:

**Before:**
```typescript
console.log('Loading bots');
console.error('Failed to load:', error);
```

**After:**
```typescript
import { logger } from '../../Components/utils';

logger.info('Loading bots');
logger.error('Failed to load', error);
```

## Current Implementation

### Files Using Logger

**Services:**
- `Services/core/logger.ts` - Service-specific logger adapter (wraps centralized logger)
- `Services/core/DataverseService.ts` - Uses logger for all API operations
- All domain services inherit logging from base service

**Components:**
- `index.ts` - Top-level ErrorBoundary wrapping MainContainer
- `Components/Review/ReviewDialog.tsx` - ErrorBoundary around dialog content
- Service-specific logging via the logger adapter

### Migration Status

✅ **Completed:**
- Created centralized logger utility
- Created ErrorBoundary component
- Wrapped top-level app in ErrorBoundary
- Added ErrorBoundary to ReviewDialog
- Updated service logger to use centralized logger

🔄 **Backward Compatible:**
- Old service logger pattern still works (delegates to new logger)
- No breaking changes to existing code

## Best Practices

### Logging

1. **Use appropriate log levels**
   - Debug: Development-only details
   - Info: Normal operational messages
   - Warn: Unexpected but recoverable situations
   - Error: Actual errors that need attention

2. **Include context**
   - Component/service name
   - Operation being performed
   - Relevant data (sanitized - no PII!)

3. **Don't log sensitive data**
   - No passwords, tokens, or API keys
   - No personally identifiable information (PII)
   - Sanitize data before logging

4. **Log important lifecycle events**
   - Component mount/unmount
   - API calls (start/success/failure)
   - User actions
   - State changes

### Error Boundaries

1. **Place strategically**
   - Top-level for entire app
   - Around major features
   - Around complex components

2. **Avoid overuse**
   - Don't wrap every tiny component
   - Focus on logical UI sections

3. **Provide recovery options**
   - Reset button (try again)
   - Reload page option
   - Navigation to safe state

4. **Log errors**
   - Always log caught errors
   - Include context and stack traces
   - Consider telemetry integration

## Troubleshooting

### Logger not showing output

1. Check minimum log level:
   ```typescript
   import { loggerConfig, LogLevel } from '../../Components/utils';
   loggerConfig.setMinLevel(LogLevel.Debug);
   ```

2. Check if console is enabled:
   ```typescript
   loggerConfig.setConsoleEnabled(true);
   ```

### Error Boundary not catching errors

Error boundaries only catch errors in:
- Render methods
- Lifecycle methods
- Constructors of child components

They do NOT catch:
- Event handlers (use try/catch)
- Async code (use try/catch)
- Server-side rendering errors
- Errors in the boundary itself

**For event handlers:**
```typescript
const handleClick = () => {
  try {
    // ... code that might throw
  } catch (error) {
    logger.error('Click handler error', error);
    // Handle error appropriately
  }
};
```

## Future Enhancements

Potential improvements (not yet implemented):

- [ ] Log aggregation service integration
- [ ] Performance metrics logging
- [ ] User action tracking
- [ ] Remote error reporting
- [ ] Log filtering by component/level
- [ ] Log export functionality
- [ ] Error boundary telemetry

## References

- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- Logging Best Practices: Industry-standard structured logging patterns
