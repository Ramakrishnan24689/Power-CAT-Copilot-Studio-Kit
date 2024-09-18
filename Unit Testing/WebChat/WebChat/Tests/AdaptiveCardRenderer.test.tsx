import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdaptiveCardRenderer from '../Components/AdaptiveCardRenderer';
import * as AdaptiveCards from 'adaptivecards';

interface AdaptiveCardContent {
  type: string;
  version: string;
  body: Array<any>;
}

const mockAdaptiveCardContent: AdaptiveCardContent = {
  type: "AdaptiveCard",
  version: "1.0", // Include the version field
  body: [
    {
      type: "TextBlock",
      text: "Hello, Adaptive Card!"
    },
    {
      type: "Input.Text",
      id: "input1",
      value: "Sample input"
    }
  ]
};

describe('AdaptiveCardRenderer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders adaptive card content', () => {
    const parseMock = jest.spyOn(AdaptiveCards.AdaptiveCard.prototype, 'parse');
    const renderMock = jest.spyOn(AdaptiveCards.AdaptiveCard.prototype, 'render').mockImplementation(() => {
      const div = document.createElement('div');
      div.innerHTML = '<div><p>Hello, Adaptive Card!</p></div>';
      return div;
    });

    const { getByText } = render(<AdaptiveCardRenderer card={mockAdaptiveCardContent} />);

    expect(parseMock).toHaveBeenCalledWith(mockAdaptiveCardContent);
    expect(renderMock).toHaveBeenCalled();
    
    expect(getByText('Hello, Adaptive Card!')).toBeInTheDocument();
  });

  test('sets input fields to read-only', () => {
    const renderMock = jest.spyOn(AdaptiveCards.AdaptiveCard.prototype, 'render').mockImplementation(() => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div>
          <input type="text" value="Sample input" />
        </div>
      `;
      return div;
    });

    const { getByDisplayValue } = render(<AdaptiveCardRenderer card={mockAdaptiveCardContent} />);

    const inputElement = getByDisplayValue('Sample input') as HTMLInputElement;

    expect(inputElement).toHaveAttribute('readonly');
  });
});
