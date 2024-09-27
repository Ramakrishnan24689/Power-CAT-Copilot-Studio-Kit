import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BotTranscript from '../Components/BotTranscript';
import AdaptiveCardRenderer from '../Components/AdaptiveCardRenderer';
import Transcript from '../src/model/Transcript';

// Mock the AdaptiveCardRenderer to prevent actual rendering of adaptive cards
jest.mock('../Components/AdaptiveCardRenderer', () => jest.fn(() => <div>Mocked Adaptive Card</div>));

describe('BotTranscript Component', () => {
  const mockTranscript: Transcript = {
    activities: [
      {
        type: 'message',
        from: { role: 0, id: 'bot123' }, // Bot message with 'id'
        text: 'Hello, this is the bot!',
        timestamp: 1629828000,
        attachments: []
      },
      {
        type: 'message',
        from: { role: 1, id: 'user123' }, // User message with 'id'
        text: 'Hi there!',
        timestamp: 1629828600,
        attachments: []
      },
      {
        type: 'message',
        from: { role: 0, id: 'bot123' }, // Bot message with adaptive card and 'id'
        text: '',
        timestamp: 1629828600,
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: { type: 'AdaptiveCard', version: '1.0', body: [] }
          }
        ]
      }
    ]
  };

  test('renders bot and user messages correctly', () => {
    render(<BotTranscript transcript={mockTranscript} />);

    // Check for bot message
    expect(screen.getByText('Hello, this is the bot!')).toBeInTheDocument();
    // Check for user message
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  test('renders adaptive cards correctly', () => {
    render(<BotTranscript transcript={mockTranscript} />);

    // Check if the mocked AdaptiveCardRenderer was rendered
    expect(screen.getByText('Mocked Adaptive Card')).toBeInTheDocument();
  });

  test('formats and displays timestamps correctly', () => {
    render(<BotTranscript transcript={mockTranscript} />);

    // Check if the correct number of timestamps are displayed
    const timestamps = screen.getAllByText(/August/i);
    expect(timestamps.length).toBe(3); // Adjust this number to match the number of expected timestamps

    // Verify each timestamp's exact content
    expect(timestamps[0]).toHaveTextContent('24 August at 11:30 pm');
    expect(timestamps[1]).toHaveTextContent('24 August at 11:40 pm');
    expect(timestamps[2]).toHaveTextContent('24 August at 11:40 pm');
  });
});
