import { useRef, useEffect, useCallback, useState } from 'react';
import { useAnalysisEngine } from '../services/analysisEngine';
import type { HighlightRange, HighlightingConfig } from '../types/highlighting';
import type { AnalysisState } from '../services/analysisEngine';

interface UseHighlightingOptions {
  // Configuration
  config?: Partial<HighlightingConfig>;
  
  // Auto-highlighting options
  enableAutoHighlighting?: boolean;
  debounceMs?: number;
  
  // Event handlers
  onHighlightClick?: (range: HighlightRange) => void;
  onHighlightHover?: (range: HighlightRange | null) => void;
  
  // Debug mode
  enableDebugMode?: boolean;
}

interface UseHighlightingReturn {
  // Highlight data
  ranges: HighlightRange[];
  taggedContent: string | null;
  isAnalyzing: boolean;
  
  // Control functions
  updateContent: (html: string, plainText: string) => void;
  clearHighlights: () => void;
  toggleLegend: () => void;
  
  // State
  showLegend: boolean;
  analysisState: AnalysisState;
  
  // Error handling
  error: Error | null;
  
  // Performance stats
  stats: {
    totalHighlights: number;
    highlightsByType: Record<string, number>;
    lastUpdateTime: number | null;
  };
}

export const useHighlighting = (options: UseHighlightingOptions = {}): UseHighlightingReturn => {
  const {
    config,
    enableAutoHighlighting = true,
    debounceMs = 1000,
    onHighlightClick,
    onHighlightHover,
    enableDebugMode = false,
  } = options;

  // State
  const [ranges, setRanges] = useState<HighlightRange[]>([]);
  const [showLegend, setShowLegend] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState({
    totalHighlights: 0,
    highlightsByType: {} as Record<string, number>,
    lastUpdateTime: null as number | null,
  });

  // Analysis engine
  const analysisEngine = useAnalysisEngine({
    debounceMs,
    enableDeduplication: true,
    enableCaching: true,
    ...config,
  });

  // Refs for stable callbacks
  const onHighlightClickRef = useRef(onHighlightClick);
  const onHighlightHoverRef = useRef(onHighlightHover);

  // Update refs when callbacks change
  useEffect(() => {
    onHighlightClickRef.current = onHighlightClick;
  }, [onHighlightClick]);

  useEffect(() => {
    onHighlightHoverRef.current = onHighlightHover;
  }, [onHighlightHover]);

  // Subscribe to analysis state changes
  const [analysisState, setAnalysisState] = useState<AnalysisState>(analysisEngine.getCurrentState());

  useEffect(() => {
    const subscription = analysisEngine.getState().subscribe(setAnalysisState);
    return () => subscription.unsubscribe();
  }, [analysisEngine]);

  // Extract ranges from analysis result
  const extractRangesFromTaggedContent = useCallback((taggedContent: string): HighlightRange[] => {
    if (!taggedContent) return [];

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

      // Determine severity based on type (could be enhanced with AI analysis)
      const severity = tagMatch.type === 'hard_to_read' ? 'high' : 
                      tagMatch.type === 'spam_words' ? 'medium' : 'low';

      extractedRanges.push({
        start: startPos,
        end: endPos,
        type: tagMatch.type as 'fluff' | 'spam_words' | 'hard_to_read',
        severity: severity as 'low' | 'medium' | 'high',
        text: tagMatch.text,
        id: `${tagMatch.type}_${startPos}_${endPos}_${Date.now()}`,
      });

      plainTextOffset += plainBefore.length + tagMatch.text.length;
      currentOffset = tagMatch.end;
    }

    return extractedRanges;
  }, []);

  // Update ranges when analysis result changes
  useEffect(() => {
    try {
      if (analysisState.result?.message?.content) {
        const newRanges = extractRangesFromTaggedContent(analysisState.result.message.content);
        setRanges(newRanges);
        
        // Update stats
        const highlightsByType = newRanges.reduce((acc, range) => {
          acc[range.type] = (acc[range.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setStats({
          totalHighlights: newRanges.length,
          highlightsByType,
          lastUpdateTime: Date.now(),
        });

        // Auto-show legend if there are highlights
        if (newRanges.length > 0 && !showLegend) {
          setShowLegend(true);
        }

        setError(null);

        if (enableDebugMode) {
          console.log('🎨 Highlights updated from analysis:', {
            rangesCount: newRanges.length,
            taggedContent: analysisState.result.message.content,
            ranges: newRanges,
          });
        }
      } else if (!analysisState.isAnalyzing && !analysisState.result) {
        // Clear highlights when no result
        setRanges([]);
        setStats({
          totalHighlights: 0,
          highlightsByType: {},
          lastUpdateTime: null,
        });
      }
    } catch (err) {
      console.error('Error extracting highlights from analysis result:', err);
      setError(err as Error);
    }
  }, [analysisState.result, analysisState.isAnalyzing, extractRangesFromTaggedContent, showLegend, enableDebugMode]);

  // Handle analysis errors
  useEffect(() => {
    if (analysisState.error) {
      setError(new Error(`Analysis failed: ${analysisState.error.message}`));
    }
  }, [analysisState.error]);

  // Public API
  const updateContent = useCallback((html: string, plainText: string) => {
    if (enableAutoHighlighting) {
      analysisEngine.analyzeContent(html, plainText);
      
      if (enableDebugMode) {
        console.log('🎨 Content updated for highlighting:', {
          htmlLength: html.length,
          textLength: plainText.length,
        });
      }
    }
  }, [analysisEngine, enableAutoHighlighting, enableDebugMode]);

  const clearHighlights = useCallback(() => {
    analysisEngine.clearAnalysis();
    setRanges([]);
    setError(null);
    setStats({
      totalHighlights: 0,
      highlightsByType: {},
      lastUpdateTime: null,
    });
    
    if (enableDebugMode) {
      console.log('🎨 Highlights cleared');
    }
  }, [analysisEngine, enableDebugMode]);

  const toggleLegend = useCallback(() => {
    setShowLegend(prev => !prev);
  }, []);

  // Stable event handlers (commented out as unused)
  // const _handleHighlightClick = useCallback((range: HighlightRange) => {
  //   onHighlightClickRef.current?.(range);
  // }, []);

  // const _handleHighlightHover = useCallback((range: HighlightRange | null) => {
  //   onHighlightHoverRef.current?.(range);
  // }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      analysisEngine.destroy();
    };
  }, [analysisEngine]);

  return {
    // Highlight data
    ranges,
    taggedContent: analysisState.result?.message?.content || null,
    isAnalyzing: analysisState.isAnalyzing,
    
    // Control functions
    updateContent,
    clearHighlights,
    toggleLegend,
    
    // State
    showLegend,
    analysisState,
    
    // Error handling
    error,
    
    // Performance stats
    stats,
  };
};