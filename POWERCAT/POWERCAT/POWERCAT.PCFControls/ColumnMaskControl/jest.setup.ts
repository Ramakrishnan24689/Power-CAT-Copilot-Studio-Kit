import '@testing-library/jest-dom/extend-expect';

// Polyfill ResizeObserver for jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-ignore
global.ResizeObserver = global.ResizeObserver || ResizeObserverMock;

// Polyfill visualViewport for tests where code checks it
// @ts-ignore
if (!global.window.visualViewport) {
  // @ts-ignore
  global.window.visualViewport = {
    width: 1024,
    height: 768,
    scale: 1,
    pageLeft: 0,
    pageTop: 0,
    addEventListener: () => {},
    removeEventListener: () => {}
  } as any;
}


