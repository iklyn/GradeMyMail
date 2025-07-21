// Types for the high-performance highlighting system

export interface HighlightRange {
  start: number;
  end: number;
  type: 'fluff' | 'spam_words' | 'hard_to_read';
  severity: 'low' | 'medium' | 'high';
  text: string;
  id: string;
}

export interface HighlightPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  lineHeight: number;
  range: HighlightRange;
}

export interface HighlightColors {
  fluff: {
    background: string;
    border: string;
    opacity: number;
  };
  spam_words: {
    background: string;
    border: string;
    opacity: number;
  };
  hard_to_read: {
    background: string;
    border: string;
    opacity: number;
  };
}

export interface AnimationState {
  progress: number; // 0 to 1
  isAnimating: boolean;
  startTime: number;
  duration: number;
  easing: (t: number) => number;
}

export interface HighlightingConfig {
  animationDuration: number;
  animationDelay: number;
  enableGPUAcceleration: boolean;
  maxHighlights: number;
  debounceMs: number;
  colors: HighlightColors;
}

export interface HighlightingState {
  highlights: HighlightPosition[];
  animationState: AnimationState;
  isVisible: boolean;
  containerRect: DOMRect | null;
  textContent: string;
}

export interface HighlightingEngine {
  updateHighlights: (ranges: HighlightRange[], textContent: string) => void;
  clearHighlights: () => void;
  setVisibility: (visible: boolean) => void;
  destroy: () => void;
  getState: () => HighlightingState;
}