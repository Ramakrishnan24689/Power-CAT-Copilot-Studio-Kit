import { JsonEditor } from '../JsonEditor';
import '@testing-library/jest-dom';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { IInputs } from '../generated/ManifestTypes';

// Mock ReactDOM.render and unmountComponentAtNode
jest.mock('react-dom', () => ({
  render: jest.fn(),
  unmountComponentAtNode: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('JsonEditor Component', () => {
  let jsonEditor: JsonEditor;
  let context: ComponentFramework.Context<IInputs>;
  let notifyOutputChanged: jest.Mock;
  let container: HTMLDivElement;

  beforeEach(() => {
    jest.clearAllMocks();

    notifyOutputChanged = jest.fn();
    container = document.createElement('div');
    context = {
      page: {
        entityTypeName: 'contact', // Correct entity name
        entityId: 'abc123',
        getClientUrl: () => 'https://example.com',
      },
      parameters: { 
        fileColumnLogicalName: { raw: 'file' }, 
        Value: { raw: '' }, 
        Height: { raw: '25' },
        FileColumn: { raw: 'True' }
      },
      mode: { isControlDisabled: false },
    } as unknown as ComponentFramework.Context<IInputs>;

    jsonEditor = new JsonEditor();
  });

  test('init sets up the component and calls updateView', async () => {
    const renderComponentSpy = jest.spyOn(jsonEditor as any, 'renderComponent');

    // Act: Call init and let updateView proceed without mocking
    await jsonEditor.init(context, notifyOutputChanged, {}, container);

    // Assert: Verify that the lifecycle proceeded as expected
    expect((jsonEditor as any)._container).toBe(container);
    expect((jsonEditor as any)._entityName).toBe('contact');
    expect((jsonEditor as any)._entityId).toBe('abc123');
    expect((jsonEditor as any)._clientUrl).toBe('https://example.com');
    expect((jsonEditor as any)._fileColumnLogicalName).toBe('file');

    // Ensure ReactDOM.render is called during the renderComponent process
    expect(renderComponentSpy).toHaveBeenCalled();
    expect(ReactDOM.render).toHaveBeenCalled();
  });

  test('updateView fetches content and updates value', async () => {
    const mockResponse = {
      status: 206,
      headers: new Headers({
        'x-ms-file-size': '12345',
      }),
      text: jest.fn().mockResolvedValue('{"some": "content"}'),
    };

    mockFetch.mockResolvedValue(mockResponse as any);
    jest.spyOn(jsonEditor as any, 'renderComponent').mockImplementation(() => {});

    await jsonEditor.init(context, notifyOutputChanged, {}, container);
    await jsonEditor.updateView(context);

    // Verify the correct URL is used
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/data/v9.2/contacts(abc123)/file/$value',
      {
        method: 'GET',
        headers: {
          Range: 'bytes=0-4194303',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0',
          'If-None-Match': 'null',
          Accept: 'application/json',
        },
      }
    );
    expect((jsonEditor as any).renderComponent).toHaveBeenCalled();
    expect((jsonEditor as any)._value).toEqual('{"some": "content"}');
    expect((jsonEditor as any)._isReadOnly).toBe(true);
  });

  test('destroy unmounts the component', () => {
    jsonEditor['_container'] = document.createElement('div');
    jsonEditor.destroy();

    expect(ReactDOM.unmountComponentAtNode).toHaveBeenCalledWith(jsonEditor['_container']);
  });

  test('notifyChange updates value and calls notifyOutputChanged', () => {
    (jsonEditor as any)._notifyOutputChanged = notifyOutputChanged;

    (jsonEditor as any).notifyChange('new value');

    expect((jsonEditor as any)._value).toBe('new value');
    expect(notifyOutputChanged).toHaveBeenCalled();
  });
});
