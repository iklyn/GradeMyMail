// High-performance highlighting engine with Canvas-based rendering and GPU acceleration

import type { 
  HighlightRange, 
  HighlightPosition, 
  HighlightColors, 
  AnimationState, 
  HighlightingConfig,
  HighlightingState,
  HighlightingEngine
} from '../types/highlighting';

// Default configuration
const DEFAULT_CONFIG: HighlightingConfig = {
  animationDuration: 800, // 800ms for smooth progressive highlighting
  animationDelay: 100, // 100ms delay between highlights
  enableGPUAcceleration: true,
  maxHighlights: 100,
  debounceMs: 16, // ~60fps
  colors: {
    fluff: {
      background: 'rgba(6, 182, 212, 0.2)', // cyan-500 with opacity
      border: 'rgba(6, 182, 212, 0.4)',
      opacity: 0.8,
    },
    spam_words: {
      background: 'rgba(234, 179, 8, 0.2)', // yellow-500 with opacity
      border: 'rgba(234, 179, 8, 0.4)',
      opacity: 0.8,
    },
    hard_to_read: {
      background: 'rgba(239, 68, 68, 0.2)', // red-500 with opacity
      border: 'rgba(239, 68, 68, 0.4)',
      opacity: 0.8,
    },
  },
};

// Easing functions for smooth animations
const EASING_FUNCTIONS = {
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number): number => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutQuart: (t: number): number => 1 - Math.pow(1 - t, 4),
};

// Text measurement utilities
class TextMeasurer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private measurementCache = new Map<string, TextMetrics>();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d')!;
  }

  // Measure text with caching for performance
  measureText(text: string, font: string): TextMetrics {
    const cacheKey = `${text}|${font}`;
    
    if (this.measurementCache.has(cacheKey)) {
      return this.measurementCache.get(cacheKey)!;
    }

    this.context.font = font;
    const metrics = this.context.measureText(text);
    
    // Cache with LRU eviction
    if (this.measurementCache.size > 1000) {
      const firstKey = this.measurementCache.keys().next().value;
      this.measurementCache.delete(firstKey);
    }
    
    this.measurementCache.set(cacheKey, metrics);
    return metrics;
  }

  // Clear cache
  clearCache(): void {
    this.measurementCache.clear();
  }
}

// Range-to-position calculator
class PositionCalculator {
  private textMeasurer = new TextMeasurer();

  // Calculate highlight positions from text ranges
  calculatePositions(
    ranges: HighlightRange[],
    textContent: string,
    containerElement: HTMLElement
  ): HighlightPosition[] {
    const positions: HighlightPosition[] = [];
    const containerRect = containerElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(containerElement);
    
    // Get font properties for text measurement
    const font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    const lineHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;

    for (const range of ranges) {
      try {
        const position = this.calculateSinglePosition(
          range,
          textContent,
          containerElement,
          containerRect,
          font,
          lineHeight
        );
        
        if (position) {
          positions.push(position);
        }
      } catch (error) {
        console.warn('Failed to calculate position for range:', range, error);
      }
    }

    return positions;
  }

  private calculateSinglePosition(
    range: HighlightRange,
    textContent: string,
    containerElement: HTMLElement,
    containerRect: DOMRect,
    font: string,
    lineHeight: number
  ): HighlightPosition | null {
    // Use Range API for precise text positioning
    const textRange = document.createRange();
    const walker = document.createTreeWalker(
      containerElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let startNode: Text | null = null;
    let endNode: Text | null = null;
    let startOffset = 0;
    let endOffset = 0;

    // Find the text nodes that contain our range
    let node: Text | null;
    while ((node = walker.nextNode() as Text)) {
      const nodeLength = node.textContent?.length || 0;
      
      if (currentOffset <= range.start && range.start < currentOffset + nodeLength) {
        startNode = node;
        startOffset = range.start - currentOffset;
      }
      
      if (currentOffset <= range.end && range.end <= currentOffset + nodeLength) {
        endNode = node;
        endOffset = range.end - currentOffset;
        break;
      }
      
      currentOffset += nodeLength;
    }

    if (!startNode || !endNode) {
      return null;
    }

    // Create range and get bounding rect
    try {
      textRange.setStart(startNode, startOffset);
      textRange.setEnd(endNode, endOffset);
      
      const rangeRect = textRange.getBoundingClientRect();
      
      return {
        x: rangeRect.left - containerRect.left,
        y: rangeRect.top - containerRect.top,
        width: rangeRect.width,
        height: rangeRect.height || lineHeight,
        lineHeight,
        range,
      };
    } catch (error) {
      console.warn('Failed to create text range:', error);
      return null;
    } finally {
      textRange.detach();
    }
  }
}

// Canvas-based renderer with GPU acceleration
class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;
  private config: HighlightingConfig;

  constructor(canvas: HTMLCanvasElement, config: HighlightingConfig) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d')!;
    this.config = config;
    
    // Enable GPU acceleration
    if (config.enableGPUAcceleration) {
      this.setupGPUAcceleration();
    }
  }

  private setupGPUAcceleration(): void {
    // Apply CSS transforms for GPU acceleration
    this.canvas.style.transform = 'translateZ(0)';
    this.canvas.style.willChange = 'transform, opacity';
    this.canvas.style.backfaceVisibility = 'hidden';
    this.canvas.style.perspective = '1000px';
  }

  // Render highlights with animation
  render(positions: HighlightPosition[], animationState: AnimationState): void {
    // Clear canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!positions.length || !animationState.isAnimating && animationState.progress === 0) {
      return;
    }

    // Calculate how many highlights to show based on animation progress
    const totalHighlights = positions.length;
    const highlightsToShow = Math.floor(totalHighlights * animationState.progress);
    
    // Render each highlight with progressive animation
    for (let i = 0; i < highlightsToShow; i++) {
      const position = positions[i];
      const highlightProgress = this.calculateHighlightProgress(i, highlightsToShow, animationState);
      
      this.renderSingleHighlight(position, highlightProgress);
    }

    // Render the currently animating highlight if there is one
    if (highlightsToShow < totalHighlights && animationState.isAnimating) {
      const currentPosition = positions[highlightsToShow];
      const currentProgress = this.calculateCurrentHighlightProgress(highlightsToShow, totalHighlights, animationState);
      
      if (currentProgress > 0) {
        this.renderSingleHighlight(currentPosition, currentProgress);
      }
    }
  }

  private calculateHighlightProgress(index: number, totalShown: number, animationState: AnimationState): number {
    if (index < totalShown - 1) {
      return 1; // Fully visible
    }
    
    // For the last highlight, calculate partial progress
    const baseProgress = (index / Math.max(1, totalShown - 1));
    return Math.min(1, animationState.progress * totalShown - index);
  }

  private calculateCurrentHighlightProgress(currentIndex: number, total: number, animationState: AnimationState): number {
    const progressPerHighlight = 1 / total;
    const currentStart = currentIndex * progressPerHighlight;
    const currentEnd = (currentIndex + 1) * progressPerHighlight;
    
    if (animationState.progress < currentStart) return 0;
    if (animationState.progress > currentEnd) return 1;
    
    return (animationState.progress - currentStart) / progressPerHighlight;
  }

  private renderSingleHighlight(position: HighlightPosition, progress: number): void {
    const colors = this.config.colors[position.range.type];
    const alpha = colors.opacity * progress;

    // Save context
    this.context.save();

    // Set styles
    this.context.globalAlpha = alpha;
    this.context.fillStyle = colors.background;
    this.context.strokeStyle = colors.border;
    this.context.lineWidth = 1;

    // Draw highlight background with rounded corners
    this.drawRoundedRect(
      position.x,
      position.y,
      position.width,
      position.height,
      2 // border radius
    );

    // Fill and stroke
    this.context.fill();
    this.context.stroke();

    // Restore context
    this.context.restore();
  }

  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.context.beginPath();
    this.context.moveTo(x + radius, y);
    this.context.lineTo(x + width - radius, y);
    this.context.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.context.lineTo(x + width, y + height - radius);
    this.context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.context.lineTo(x + radius, y + height);
    this.context.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.context.lineTo(x, y + radius);
    this.context.quadraticCurveTo(x, y, x + radius, y);
    this.context.closePath();
  }

  // Update canvas size
  updateSize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual size in memory (scaled for high DPI)
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    
    // Set display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    
    // Scale context for high DPI
    this.context.scale(dpr, dpr);
  }

  // Cleanup
  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

// Main highlighting engine implementation
export class HighlightingEngineImpl implements HighlightingEngine {
  private canvas: HTMLCanvasElement;
  private containerElement: HTMLElement;
  private renderer: CanvasRenderer;
  private positionCalculator = new PositionCalculator();
  private config: HighlightingConfig;
  
  private state: HighlightingState = {
    highlights: [],
    animationState: {
      progress: 0,
      isAnimating: false,
      startTime: 0,
      duration: 0,
      easing: EASING_FUNCTIONS.easeOutCubic,
    },
    isVisible: true,
    containerRect: null,
    textContent: '',
  };

  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    containerElement: HTMLElement,
    config: Partial<HighlightingConfig> = {}
  ) {
    this.canvas = canvas;
    this.containerElement = containerElement;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.renderer = new CanvasRenderer(canvas, this.config);
    
    this.setupCanvas();
    this.setupResizeObserver();
  }

  private setupCanvas(): void {
    // Position canvas as overlay
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '10';
    
    this.updateCanvasSize();
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateCanvasSize();
        this.recalculatePositions();
      });
      
      this.resizeObserver.observe(this.containerElement);
    }
  }

  private updateCanvasSize(): void {
    const rect = this.containerElement.getBoundingClientRect();
    this.state.containerRect = rect;
    this.renderer.updateSize(rect.width, rect.height);
  }

  private recalculatePositions(): void {
    if (this.state.textContent) {
      const ranges = this.extractRangesFromContent(this.state.textContent);
      const positions = this.positionCalculator.calculatePositions(
        ranges,
        this.state.textContent,
        this.containerElement
      );
      
      this.state.highlights = positions;
    }
  }

  private extractRangesFromContent(taggedContent: string): HighlightRange[] {
    const ranges: HighlightRange[] = [];
    const tagRegex = /<(fluff|spam_words|hard_to_read)>(.*?)<\/\1>/g;
    let match;
    let plainTextOffset = 0;

    // Create plain text version and track ranges
    let plainText = taggedContent;
    const tagMatches: Array<{ type: string; text: string; start: number; end: number }> = [];

    while ((match = tagRegex.exec(taggedContent)) !== null) {
      tagMatches.push({
        type: match[1],
        text: match[2],
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    // Remove tags and calculate positions in plain text
    plainText = taggedContent.replace(tagRegex, '$2');
    
    let currentOffset = 0;
    for (const tagMatch of tagMatches) {
      const beforeTag = taggedContent.substring(currentOffset, tagMatch.start);
      const plainBefore = beforeTag.replace(/<[^>]*>/g, '');
      const startPos = plainTextOffset + plainBefore.length;
      const endPos = startPos + tagMatch.text.length;

      ranges.push({
        start: startPos,
        end: endPos,
        type: tagMatch.type as 'fluff' | 'spam_words' | 'hard_to_read',
        severity: 'medium', // Default severity
        text: tagMatch.text,
        id: `${tagMatch.type}_${startPos}_${endPos}`,
      });

      plainTextOffset += plainBefore.length + tagMatch.text.length;
      currentOffset = tagMatch.end;
    }

    return ranges;
  }

  // Public API implementation
  updateHighlights(ranges: HighlightRange[], textContent: string): void {
    this.state.textContent = textContent;
    
    // Calculate positions
    const positions = this.positionCalculator.calculatePositions(
      ranges,
      textContent,
      this.containerElement
    );
    
    this.state.highlights = positions;
    
    // Start animation
    this.startAnimation();
  }

  private startAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.state.animationState = {
      progress: 0,
      isAnimating: true,
      startTime: performance.now(),
      duration: this.config.animationDuration,
      easing: EASING_FUNCTIONS.easeOutCubic,
    };

    this.animate();
  }

  private animate = (): void => {
    const now = performance.now();
    const elapsed = now - this.state.animationState.startTime;
    const rawProgress = Math.min(elapsed / this.state.animationState.duration, 1);
    
    // Apply easing
    this.state.animationState.progress = this.state.animationState.easing(rawProgress);
    
    // Render current frame
    if (this.state.isVisible) {
      this.renderer.render(this.state.highlights, this.state.animationState);
    }
    
    // Continue animation or finish
    if (rawProgress < 1) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      this.state.animationState.isAnimating = false;
      this.animationFrameId = null;
    }
  };

  clearHighlights(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.state.highlights = [];
    this.state.animationState.progress = 0;
    this.state.animationState.isAnimating = false;
    this.state.textContent = '';
    
    // Clear canvas
    this.renderer.render([], this.state.animationState);
  }

  setVisibility(visible: boolean): void {
    this.state.isVisible = visible;
    this.canvas.style.display = visible ? 'block' : 'none';
    
    if (visible && this.state.highlights.length > 0) {
      this.renderer.render(this.state.highlights, this.state.animationState);
    }
  }

  getState(): HighlightingState {
    return { ...this.state };
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.renderer.destroy();
  }
}

// Factory function
export const createHighlightingEngine = (
  canvas: HTMLCanvasElement,
  containerElement: HTMLElement,
  config?: Partial<HighlightingConfig>
): HighlightingEngine => {
  return new HighlightingEngineImpl(canvas, containerElement, config);
};