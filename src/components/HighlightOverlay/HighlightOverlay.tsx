import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { createHighlightingEngine } from '../../utils/highlightingEngine';
import type { HighlightRange, HighlightingEngine, HighlightingConfig } from '../../types/highlighting';

interface HighlightOverlayProps {
  // Content to highlight
  taggedContent?: string;
  textContent?: string;
  ranges?: HighlightRange[];
  
  // Container element reference
  containerRef: React.RefObject<HTMLDivElement | null>;
  
  // Configuration
  config?: Partial<HighlightingConfig>;
  
  // Visibility control
  visible?: boolean;
  
  // Event handlers
  onHighlightClick?: (range: HighlightRange) => void;
  onHighlightHover?: (range: HighlightRange | null) => void;
  
  // Performance options
  enableDebugMode?: boolean;
  className?: string;
}

export const HighlightOverlay: React.FC<HighlightOverlayProps> = ({
  taggedContent,
  textContent = '',
  ranges = [],
  containerRef,
  config,
  visible = true,
  onHighlightClick,
  onHighlightHover,
  enableDebugMode = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<HighlightingEngine | null>(null);
  const isInitializedRef = useRef(false);

  // Memoize configuration to prevent unnecessary re-initializations
  const memoizedConfig = useMemo(() => ({
    animationDuration: 600,
    animationDelay: 50,
    enableGPUAcceleration: true,
    maxHighlights: 100,
    debounceMs: 16,
    colors: {
      fluff: {
        background: 'rgba(6, 182, 212, 0.35)', // cyan-500 - more visible
        border: 'rgba(6, 182, 212, 0.6)',
        opacity: 0.9,
      },
      spam_words: {
        background: 'rgba(234, 179, 8, 0.35)', // yellow-500 - more visible
        border: 'rgba(234, 179, 8, 0.6)',
        opacity: 0.9,
      },
      hard_to_read: {
        background: 'rgba(239, 68, 68, 0.35)', // red-500 - more visible
        border: 'rgba(239, 68, 68, 0.6)',
        opacity: 0.9,
      },
    },
    ...config,
  }), [config]);

  // Extract ranges from tagged content
  const extractedRanges = useMemo(() => {
    if (ranges.length > 0) {
      return ranges;
    }

    if (!taggedContent) {
      return [];
    }

    const extractedRanges: HighlightRange[] = [];
    const tagRegex = /<(fluff|spam_words|hard_to_read)>(.*?)<\/\1>/g;
    let match;
    let plainTextOffset = 0;

    // Create plain text version and track ranges
    // let _plainText = taggedContent;
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
    // const plainText = taggedContent.replace(tagRegex, '$2');
    
    let currentOffset = 0;
    for (const tagMatch of tagMatches) {
      const beforeTag = taggedContent.substring(currentOffset, tagMatch.start);
      const plainBefore = beforeTag.replace(/<[^>]*>/g, '');
      const startPos = plainTextOffset + plainBefore.length;
      const endPos = startPos + tagMatch.text.length;

      extractedRanges.push({
        start: startPos,
        end: endPos,
        type: tagMatch.type as 'fluff' | 'spam_words' | 'hard_to_read',
        severity: 'medium',
        text: tagMatch.text,
        id: `${tagMatch.type}_${startPos}_${endPos}`,
      });

      plainTextOffset += plainBefore.length + tagMatch.text.length;
      currentOffset = tagMatch.end;
    }

    return extractedRanges;
  }, [taggedContent, ranges]);

  // Initialize highlighting engine
  const initializeEngine = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || isInitializedRef.current) {
      return;
    }

    try {
      engineRef.current = createHighlightingEngine(
        canvasRef.current,
        containerRef.current,
        memoizedConfig
      );
      
      isInitializedRef.current = true;
      
      if (enableDebugMode) {
        console.log('🎨 Highlighting engine initialized', {
          canvas: canvasRef.current,
          container: containerRef.current,
          config: memoizedConfig,
        });
      }
    } catch (error) {
      console.error('Failed to initialize highlighting engine:', error);
    }
  }, [containerRef, memoizedConfig, enableDebugMode]);

  // Update highlights when content changes
  const updateHighlights = useCallback(() => {
    if (!engineRef.current || !extractedRanges.length) {
      return;
    }

    try {
      const contentToUse = textContent || (taggedContent ? taggedContent.replace(/<[^>]*>/g, '') : '');
      engineRef.current.updateHighlights(extractedRanges, contentToUse);
      
      if (enableDebugMode) {
        console.log('🎨 Highlights updated', {
          rangesCount: extractedRanges.length,
          textLength: contentToUse.length,
          ranges: extractedRanges,
        });
      }
    } catch (error) {
      console.error('Failed to update highlights:', error);
    }
  }, [extractedRanges, textContent, taggedContent, enableDebugMode]);

  // Clear highlights
  const clearHighlights = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.clearHighlights();
      
      if (enableDebugMode) {
        console.log('🎨 Highlights cleared');
      }
    }
  }, [enableDebugMode]);

  // Initialize engine when refs are ready
  useEffect(() => {
    if (canvasRef.current && containerRef.current && !isInitializedRef.current) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(initializeEngine, 10);
      return () => clearTimeout(timeoutId);
    }
  }, [initializeEngine]);

  // Update highlights when content changes
  useEffect(() => {
    if (isInitializedRef.current && extractedRanges.length > 0) {
      updateHighlights();
    } else if (isInitializedRef.current && extractedRanges.length === 0) {
      clearHighlights();
    }
  }, [extractedRanges, updateHighlights, clearHighlights]);

  // Handle visibility changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setVisibility(visible);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  // Handle canvas click events for highlight interaction
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !onHighlightClick) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find clicked highlight
    const state = engineRef.current.getState();
    const clickedHighlight = state.highlights.find(highlight => 
      x >= highlight.x && 
      x <= highlight.x + highlight.width &&
      y >= highlight.y && 
      y <= highlight.y + highlight.height
    );

    if (clickedHighlight) {
      onHighlightClick(clickedHighlight.range);
    }
  }, [onHighlightClick]);

  // Handle canvas hover events for highlight interaction
  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || !onHighlightHover) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Find hovered highlight
    const state = engineRef.current.getState();
    const hoveredHighlight = state.highlights.find(highlight => 
      x >= highlight.x && 
      x <= highlight.x + highlight.width &&
      y >= highlight.y && 
      y <= highlight.y + highlight.height
    );

    onHighlightHover(hoveredHighlight?.range || null);
  }, [onHighlightHover]);

  const handleCanvasMouseLeave = useCallback(() => {
    if (onHighlightHover) {
      onHighlightHover(null);
    }
  }, [onHighlightHover]);

  // Debug information
  const debugInfo = useMemo(() => {
    if (!enableDebugMode) return null;

    return {
      initialized: isInitializedRef.current,
      rangesCount: extractedRanges.length,
      visible,
      hasEngine: !!engineRef.current,
      hasCanvas: !!canvasRef.current,
      hasContainer: !!containerRef.current,
    };
  }, [enableDebugMode, extractedRanges.length, visible]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`highlight-overlay ${className}`}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: onHighlightClick || onHighlightHover ? 'auto' : 'none',
          zIndex: 10,
          // GPU acceleration
          transform: 'translateZ(0)',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
        }}
      />
      
      {/* Debug overlay */}
      {enableDebugMode && debugInfo && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <div>Initialized: {debugInfo.initialized ? '✅' : '❌'}</div>
          <div>Ranges: {debugInfo.rangesCount}</div>
          <div>Visible: {debugInfo.visible ? '✅' : '❌'}</div>
          <div>Engine: {debugInfo.hasEngine ? '✅' : '❌'}</div>
          <div>Canvas: {debugInfo.hasCanvas ? '✅' : '❌'}</div>
          <div>Container: {debugInfo.hasContainer ? '✅' : '❌'}</div>
        </div>
      )}
    </>
  );
};

export default HighlightOverlay;