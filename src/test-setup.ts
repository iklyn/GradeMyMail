import '@testing-library/jest-dom';

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock DOMParser for Lexical
global.DOMParser = class DOMParser {
  parseFromString(str: string, type: string) {
    const doc = document.implementation.createHTMLDocument();
    doc.documentElement.innerHTML = str;
    return doc;
  }
};

// Mock Range for Lexical
global.Range = class Range {
  startContainer: Node = document.createElement('div');
  endContainer: Node = document.createElement('div');
  startOffset: number = 0;
  endOffset: number = 0;
  collapsed: boolean = true;
  commonAncestorContainer: Node = document.createElement('div');

  setStart() {}
  setEnd() {}
  selectNode() {}
  selectNodeContents() {}
  collapse() {}
  cloneContents() { return document.createDocumentFragment(); }
  deleteContents() {}
  extractContents() { return document.createDocumentFragment(); }
  insertNode() {}
  surroundContents() {}
  compareBoundaryPoints() { return 0; }
  cloneRange() { return new Range(); }
  detach() {}
  toString() { return ''; }
  getBoundingClientRect() {
    return {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({})
    };
  }
  getClientRects() {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {}
    };
  }
};

// Mock Selection for Lexical
global.Selection = class Selection {
  anchorNode: Node | null = null;
  anchorOffset: number = 0;
  focusNode: Node | null = null;
  focusOffset: number = 0;
  isCollapsed: boolean = true;
  rangeCount: number = 0;
  type: string = 'None';

  addRange() {}
  collapse() {}
  collapseToEnd() {}
  collapseToStart() {}
  containsNode() { return false; }
  deleteFromDocument() {}
  empty() {}
  extend() {}
  getRangeAt() { return new Range(); }
  modify() {}
  removeAllRanges() {}
  removeRange() {}
  selectAllChildren() {}
  setBaseAndExtent() {}
  setPosition() {}
  toString() { return ''; }
};

// Mock getSelection
global.getSelection = () => new Selection();

// Mock document.createRange
document.createRange = () => new Range();