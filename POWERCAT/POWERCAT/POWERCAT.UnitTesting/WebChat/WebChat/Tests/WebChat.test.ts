import { WebChat } from '../WebChat';
import '@testing-library/jest-dom';
import { IInputs } from '../generated/ManifestTypes';

// Mock ReactDOM.createRoot
jest.mock('react-dom/client', () => ({
  createRoot: jest.fn(() => ({
    render: jest.fn(),
    unmount: jest.fn(),
  })),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('WebChat Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('init sets up the component and calls updateView', async () => {
    // Arrange
    const context = {
      page: {
        entityTypeName: 'contacts',
        entityId: 'abc123',
        getClientUrl: () => 'https://example.com',
      },
      parameters: { fileColumnLogicalName: { raw: 'file' } },
      client: {} as any,
      device: {} as any,
      factory: {} as any,
      formatting: {} as any,
      isV9: true,
      userSettings: {} as any,
      async: {} as any,
      user: {} as any,
      service: {} as any,
      navigation: {} as any,
      ui: {} as any,
      localization: {} as any,
      ...{} as any
    } as unknown as ComponentFramework.Context<IInputs>;

    const notifyOutputChanged = jest.fn();
    const state = {};
    const container = document.createElement('div');
    const webChat = new WebChat();

    // Mock updateView to verify it's called during init
    jest.spyOn(webChat as any, 'updateView').mockResolvedValue(undefined);

    // Act
    await webChat.init(context, notifyOutputChanged, state, container);

    // Assert
    expect(webChat['_container']).toBe(container);
    expect(webChat['_entityName']).toBe('contacts');
    expect(webChat['_entityId']).toBe('abc123');
    expect(webChat['_clientUrl']).toBe('https://example.com');
    expect(webChat['_fileColumnLogicalName']).toBe('file');
    expect((webChat as any).updateView).toHaveBeenCalledWith(context);
  });

  test('fetches content and updates transcript', async () => {
    // Arrange a minimal context for fetch
    const context = {
      page: {
        entityTypeName: 'contacts',
        entityId: 'abc123',
        getClientUrl: () => 'https://example.com',
      },
      parameters: { fileColumnLogicalName: { raw: 'file' } },
    } as unknown as ComponentFramework.Context<IInputs>;

    const webChat = new WebChat();

    // Mock the fetch call to simulate multiple successful responses
    mockFetch.mockResolvedValueOnce({
      status: 206,
      headers: new Headers({
        'x-ms-file-size': '12345',
      }),
      text: jest.fn().mockResolvedValueOnce('{"some": "transcript"}'),
    });

    mockFetch.mockResolvedValueOnce({
      status: 206,
      headers: new Headers({
        'x-ms-file-size': '12345',
      }),
      text: jest.fn().mockResolvedValueOnce('{"some": "transcript"}'),
    });

    // Act: Call the method directly to test fetch and transcript update
    await webChat.init(context, jest.fn(), {}, document.createElement('div'));
    await webChat.updateView(context);

    // Log the number of times fetch is called
    console.log(`Fetch calls: ${mockFetch.mock.calls.length}`);

    // Assert: Ensure the fetch was called (possibly more than once)
    expect(mockFetch).toHaveBeenCalledTimes(2); // Adjust this based on the number of fetches you expect
    expect(webChat['_transcript']).toEqual({ some: 'transcript' });
  });

  test('destroy unmounts the component', () => {
    // Arrange
    const webChat = new WebChat();
    webChat['_root'] = {
      unmount: jest.fn(),
    } as any;

    // Act
    webChat.destroy();

    // Assert
    expect(webChat['_root'].unmount).toHaveBeenCalled();
  });
});
