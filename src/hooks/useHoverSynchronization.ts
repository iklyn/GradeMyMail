import { useState, useCallback, useRef, useEffect } from 'react';

export interface HoverSyncState {
  hoveredLine: number | null;
  focusedLine: number | null;
  hoverSource: 'original' | 'improved' | null;
  synchronizedHover: boolean;
  isAnimating: boolean;
}

export interface HoverSyncActions {
  setHoveredLine: (lineNumber: number | null, source?: 'original' | 'improved') => void;
  setFocusedLine: (lineNumber: number | null) => void;
  setSynchronizedHover: (enabled: boolean) => void;
  clearAll: () => void;
  handleKeyboardNavigation: (event: React.KeyboardEvent, totalLines: number) => void;
}

export interface UseHoverSynchronizationOptions {
  initialSyncEnabled?: boolean;
  animationDuration?: number;
  debounceDelay?: number;
  onHoverChange?: (lineNumber: number | null, source?: 'original' | 'improved') => void;
  onFocusChange?: (lineNumber: number | null) => void;
}

export function useHoverSynchronization(
  options: UseHoverSynchronizationOptions = {}
): [HoverSyncState, HoverSyncActions] {
  const {
    initialSyncEnabled = true,
    animationDuration = 300,
    debounceDelay = 50,
    onHoverChange,
    onFocusChange
  } = options;

  const [state, setState] = useState<HoverSyncState>({
    hoveredLine: null,
    focusedLine: null,
    hoverSource: null,
    synchronizedHover: initialSyncEnabled,
    isAnimating: false
  });

  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const setHoveredLine = useCallback((
    lineNumber: number | null, 
    source?: 'original' | 'improved'
  ) => {
    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce rapid hover changes
    debounceTimeoutRef.current = setTimeout(() => {
      setState(prevState => {
        const newState = {
          ...prevState,
          hoveredLine: lineNumber,
          hoverSource: lineNumber ? source || null : null,
          isAnimating: true
        };

        // Clear animation flag after duration
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
        }
        animationTimeoutRef.current = setTimeout(() => {
          setState(currentState => ({
            ...currentState,
            isAnimating: false
          }));
        }, animationDuration);

        return newState;
      });

      // Call external callback
      onHoverChange?.(lineNumber, source);
    }, debounceDelay);
  }, [animationDuration, debounceDelay, onHoverChange]);

  const setFocusedLine = useCallback((lineNumber: number | null) => {
    setState(prevState => ({
      ...prevState,
      focusedLine: lineNumber
    }));
    onFocusChange?.(lineNumber);
  }, [onFocusChange]);

  const setSynchronizedHover = useCallback((enabled: boolean) => {
    setState(prevState => ({
      ...prevState,
      synchronizedHover: enabled
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      hoveredLine: null,
      focusedLine: null,
      hoverSource: null,
      isAnimating: false
    }));
    
    // Clear timeouts
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  const handleKeyboardNavigation = useCallback((
    event: React.KeyboardEvent, 
    totalLines: number
  ) => {
    const { focusedLine } = state;
    
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (focusedLine && focusedLine > 1) {
          setFocusedLine(focusedLine - 1);
          setHoveredLine(focusedLine - 1);
        } else if (!focusedLine) {
          setFocusedLine(1);
          setHoveredLine(1);
        }
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        if (focusedLine && focusedLine < totalLines) {
          setFocusedLine(focusedLine + 1);
          setHoveredLine(focusedLine + 1);
        } else if (!focusedLine) {
          setFocusedLine(1);
          setHoveredLine(1);
        }
        break;
        
      case 'Home':
        event.preventDefault();
        setFocusedLine(1);
        setHoveredLine(1);
        break;
        
      case 'End':
        event.preventDefault();
        setFocusedLine(totalLines);
        setHoveredLine(totalLines);
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedLine) {
          // Toggle hover on current focused line
          setHoveredLine(state.hoveredLine === focusedLine ? null : focusedLine);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        clearAll();
        break;
        
      case 'PageUp':
        event.preventDefault();
        if (focusedLine) {
          const newLine = Math.max(1, focusedLine - 10);
          setFocusedLine(newLine);
          setHoveredLine(newLine);
        }
        break;
        
      case 'PageDown':
        event.preventDefault();
        if (focusedLine) {
          const newLine = Math.min(totalLines, focusedLine + 10);
          setFocusedLine(newLine);
          setHoveredLine(newLine);
        }
        break;
    }
  }, [state, setFocusedLine, setHoveredLine, clearAll]);

  const actions: HoverSyncActions = {
    setHoveredLine,
    setFocusedLine,
    setSynchronizedHover,
    clearAll,
    handleKeyboardNavigation
  };

  return [state, actions];
}

// Enhanced hover effects utility with GPU acceleration
export const getHoverTransform = (
  isHighlighted: boolean,
  isFocused: boolean,
  synchronizedHover: boolean,
  isAnimating: boolean
): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    willChange: 'transform, background-color, box-shadow, filter, opacity',
    backfaceVisibility: 'hidden',
    perspective: '1000px',
    transformStyle: 'preserve-3d',
    WebkitTransform: 'translateZ(0)', // Webkit-specific GPU acceleration
    WebkitBackfaceVisibility: 'hidden',
  };

  if (isHighlighted) {
    const baseTransform = synchronizedHover 
      ? 'translateX(12px) scale(1.008) translateZ(0)' 
      : 'translateX(6px) scale(1.004) translateZ(0)';
    
    if (isAnimating && synchronizedHover) {
      return {
        ...baseStyle,
        transform: `${baseTransform} rotateX(2deg) rotateY(1deg)`,
        perspective: '1200px',
      };
    }
    
    return {
      ...baseStyle,
      transform: baseTransform,
    };
  }
  
  if (isFocused) {
    return {
      ...baseStyle,
      transform: 'translateX(3px) scale(1.003) translateZ(0) rotateX(0.5deg)',
      perspective: '800px',
    };
  }
  
  return {
    ...baseStyle,
    transform: 'translateX(0) scale(1) translateZ(0) rotateX(0deg)',
  };
};

// Enhanced background styling utility
export const getHoverBackground = (
  isHighlighted: boolean,
  isFocused: boolean,
  synchronizedHover: boolean,
  isAnimating: boolean
): string => {
  if (isHighlighted) {
    const baseClasses = synchronizedHover 
      ? 'bg-gradient-to-r from-blue-50 via-blue-100 via-blue-50 to-blue-100 ring-2 ring-blue-400 ring-opacity-80 shadow-xl backdrop-blur-sm border-l-4 border-blue-500' 
      : 'bg-gradient-to-r from-blue-50 to-blue-100 ring-2 ring-blue-300 ring-opacity-70 shadow-lg border-l-2 border-blue-400';
    
    if (isAnimating && synchronizedHover) {
      return `${baseClasses} animate-pulse`;
    }
    
    return baseClasses;
  }
  
  if (isFocused) {
    return 'bg-gradient-to-r from-indigo-50 to-indigo-100 ring-1 ring-indigo-300 shadow-md border-l-2 border-indigo-400';
  }
  
  return 'bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:shadow-md hover:border-l-2 hover:border-gray-300';
};

// Glow effect utility for enhanced synchronization
export const getGlowEffect = (
  isHighlighted: boolean,
  synchronizedHover: boolean,
  isAnimating: boolean
): string => {
  if (isHighlighted && synchronizedHover) {
    const baseGlow = 'before:absolute before:inset-0 before:bg-gradient-to-r before:from-blue-400/30 before:via-blue-300/20 before:to-blue-400/30 before:blur-md before:-z-10';
    
    if (isAnimating) {
      return `${baseGlow} after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-blue-200/10 after:to-transparent after:animate-pulse after:-z-10`;
    }
    
    return baseGlow;
  }
  
  if (isHighlighted) {
    return 'before:absolute before:inset-0 before:bg-gradient-to-r before:from-blue-300/20 before:to-transparent before:blur-sm before:-z-10';
  }
  
  return '';
};