/**
 * Service Context - Dependency Injection for PCF Services
 * 
 * Provides centralized access to core service dependencies (webAPI, userId, etc.)
 * throughout the component tree without prop drilling.
 * 
 * Usage:
 * ```tsx
 * // In a component or hook:
 * const { webAPI, userId } = useServiceContext();
 * const botService = new BotService(webAPI);
 * ```
 */

import * as React from 'react';

/**
 * Extended PCF Context interface that includes the page property
 */
export interface ExtendedPCFContext {
	page?: {
		getClientUrl?: () => string;
	};
	// Allow any other PCF context properties
	[key: string]: unknown;
}

/**
 * Core service dependencies available throughout the application
 */
export interface ServiceDependencies {
	/** Power Apps WebAPI for Dataverse operations */
	webAPI: ComponentFramework.WebApi;
	/** Current user ID for personalization and tracking */
	userId: string;
	/** Base URL for the environment (optional, for future use) */
	baseUrl?: string;
	/** PCF Context for advanced operations (like getClientUrl) */
	pcfContext?: ExtendedPCFContext;
}

/**
 * Service Context - holds dependency injection container
 */
const ServiceContext = React.createContext<ServiceDependencies | undefined>(undefined);

ServiceContext.displayName = 'ServiceContext';

/**
 * Props for ServiceProvider component
 */
export interface ServiceProviderProps {
	/** Service dependencies to inject */
	dependencies: ServiceDependencies;
	/** Child components (optional - can be passed as createElement children) */
	children?: React.ReactNode;
}

/**
 * ServiceProvider - Wraps the component tree with service dependencies
 * 
 * Place this at the root of your component hierarchy to make services
 * available to all child components and hooks.
 * 
 * @example
 * ```tsx
 * <ServiceProvider dependencies={{ webAPI, userId, baseUrl }}>
 *   <App />
 * </ServiceProvider>
 * ```
 */
export const ServiceProvider: React.FC<ServiceProviderProps> = ({ dependencies, children }) => {
	return <ServiceContext.Provider value={dependencies}>{children}</ServiceContext.Provider>;
};

/**
 * useServiceContext - Hook to access service dependencies
 * 
 * Throws an error if used outside of ServiceProvider.
 * This ensures components fail fast if context is not properly set up.
 * 
 * @returns Service dependencies (webAPI, userId, etc.)
 * @throws Error if used outside ServiceProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { webAPI, userId } = useServiceContext();
 *   const botService = new BotService(webAPI);
 *   // ...
 * }
 * ```
 */
export function useServiceContext(): ServiceDependencies {
	const context = React.useContext(ServiceContext);
	
	if (context === undefined) {
		throw new Error(
			'useServiceContext must be used within a ServiceProvider. ' +
			'Ensure your component tree is wrapped with <ServiceProvider>.'
		);
	}
	
	return context;
}

/**
 * withServiceContext - HOC to inject service dependencies as props
 * 
 * For class components or when you prefer HOC pattern over hooks.
 * 
 * @example
 * ```tsx
 * interface MyComponentProps extends ServiceDependencies {
 *   title: string;
 * }
 * 
 * const MyComponent: React.FC<MyComponentProps> = ({ webAPI, userId, title }) => {
 *   // ...
 * };
 * 
 * export default withServiceContext(MyComponent);
 * ```
 */
export function withServiceContext<P extends ServiceDependencies>(
	Component: React.ComponentType<P>
): React.FC<Omit<P, keyof ServiceDependencies>> {
	const WrappedComponent: React.FC<Omit<P, keyof ServiceDependencies>> = (props) => {
		const serviceDeps = useServiceContext();
		return <Component {...(props as P)} {...serviceDeps} />;
	};
	
	WrappedComponent.displayName = `withServiceContext(${Component.displayName ?? Component.name ?? 'Component'})`;
	
	return WrappedComponent;
}
