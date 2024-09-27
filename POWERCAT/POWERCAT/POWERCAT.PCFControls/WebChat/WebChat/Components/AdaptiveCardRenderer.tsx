import React, { useEffect, useRef } from 'react';
import * as AdaptiveCards from 'adaptivecards';
import { AdaptiveCardContent } from '../src/model/Transcript';

  /**
 * AdaptiveCardRenderer Component
 * 
 * This component is responsible for rendering Adaptive Cards using the Adaptive Cards library.
 * It takes a card content as a prop and renders it inside a div container. The component ensures
 * that the rendered card's input elements are set to read-only mode.
 */

interface AdaptiveCardRendererProps {
  card: AdaptiveCardContent; // Replace with a more specific type if available
}

const AdaptiveCardRenderer: React.FC<AdaptiveCardRendererProps> = ({ card }) => {

  // Reference to the container div where the Adaptive Card will be rendered
  const containerRef = useRef<HTMLDivElement>(null);

  // useEffect hook to handle the rendering of the Adaptive Card
  useEffect(() => {
    if (containerRef.current) {
      const adaptiveCard = new AdaptiveCards.AdaptiveCard();
      adaptiveCard.parse(card);
      containerRef.current.innerHTML = '';
      
      // Render the card and append it to the container
      const renderedCard = adaptiveCard.render();
      if (renderedCard) {
        containerRef.current.appendChild(renderedCard);

        // Set all input elements within the rendered card to read-only
        const inputElements = renderedCard.querySelectorAll('input, textarea, select');
        inputElements.forEach(input => {
          (input as HTMLInputElement | HTMLTextAreaElement).readOnly = true;
        });
      }
    }
  }, [card]); 

  // Render a div to serve as the container for the Adaptive Card
  return <div ref={containerRef} />;
};

export default AdaptiveCardRenderer;
