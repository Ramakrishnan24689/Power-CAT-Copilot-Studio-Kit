/// <reference types="@testing-library/jest-dom" />

/**
 * Sample test file demonstrating Jest + React Testing Library setup
 * This ensures the test infrastructure is working correctly
 * 
 * Includes examples of:
 * - Basic component rendering
 * - Testing with ServiceProvider (dependency injection)
 * - Mocking WebAPI and other dependencies
 */

import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { ServiceProvider } from '../Components/context';

// Simple test component
const TestComponent: React.FC<{ message: string }> = ({ message }) => {
	return <div data-testid="test-message">{message}</div>;
};

// Component that uses ServiceContext
const ComponentWithContext: React.FC = () => {
	// This would use useServiceContext() in real components
	return <div data-testid="context-consumer">Using ServiceContext</div>;
};

// Mock WebAPI for testing
const createMockWebAPI = (): ComponentFramework.WebApi => ({
	createRecord: jest.fn(),
	deleteRecord: jest.fn(),
	updateRecord: jest.fn(),
	retrieveRecord: jest.fn(),
	retrieveMultipleRecords: jest.fn(),
} as unknown as ComponentFramework.WebApi);

describe('Test Infrastructure', () => {
	it('should render a component', () => {
		render(<TestComponent message="Hello, Testing!" />);
		expect(screen.getByTestId('test-message')).toBeInTheDocument();
	});

	it('should display the correct message', () => {
		const testMessage = 'Test infrastructure is working';
		render(<TestComponent message={testMessage} />);
		expect(screen.getByText(testMessage)).toBeInTheDocument();
	});

	it('should pass basic assertions', () => {
		expect(true).toBe(true);
		expect(1 + 1).toBe(2);
		expect('hello').toBeTruthy();
	});

	it('should render component with ServiceProvider', () => {
		const mockWebAPI = createMockWebAPI();
		const mockUserId = 'test-user-123';
		
		render(
			<ServiceProvider dependencies={{ webAPI: mockWebAPI, userId: mockUserId }}>
				<ComponentWithContext />
			</ServiceProvider>
		);
		
		expect(screen.getByTestId('context-consumer')).toBeInTheDocument();
	});
});
