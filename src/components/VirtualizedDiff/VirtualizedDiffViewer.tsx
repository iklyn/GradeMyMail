import React, { useMemo, useState, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { DiffEngine } from '../../utils/diffEngine';
import type { DiffViewerProps, DiffLine as DiffLineType } from '../../types/diff';
import DiffLine from './DiffLine';
import './DiffViewer.css';

interface ListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    lines: DiffLineType[];
    highlightedLine: number | null;
    focusedLine: number | null;
    onLineHover: (lineNumber: number | null) => void;
    onLineFocus: (lineNumber: number | null) => void;
    synchronizedHover: boolean;
  };
}

const ListItem: React.FC<ListItemProps> = ({ index, style, data }) => {
  const { lines, highlightedLine, focusedLine, onLineHover, onLineFocus, synchronizedHover } = data;
  const line = lines[index];

  if (!line) {
    return <div style={style} />;
  }

  return (
    <DiffLine
      line={line}
      isHighlighted={highlightedLine === line.lineNumber}
      isFocused={focusedLine === line.lineNumber}
      onHover={onLineHover}
      onFocus={onLineFocus}
      style={style}
      synchronizedHover={synchronizedHover}
    />
  );
};

const VirtualizedDiffViewer: React.FC<DiffViewerProps> = ({
  originalContent,
  modifiedContent,
  height = 600,
  width = '100%',
  itemSize = 40,
  overscanCount = 10,
  onLineHover,
  highlightedLine,
  className = ''
}) => {
  const [internalHighlightedLine, setInternalHighlightedLine] = useState<number | null>(null);
  const [focusedLine, setFocusedLine] = useState<number | null>(null);
  const [synchronizedHover, setSynchronizedHover] = useState(true);
  
  // Generate diff data
  const diffData = useMemo(() => {
    return DiffEngine.generateDiff(originalContent, modifiedContent);
  }, [originalContent, modifiedContent]);

  // Flatten all lines for virtualized rendering
  const allLines = useMemo(() => {
    const lines: DiffLineType[] = [];
    for (const chunk of diffData.chunks) {
      lines.push(...chunk.lines);
    }
    return lines;
  }, [diffData]);

  // Handle line hover with enhanced synchronization
  const handleLineHover = useCallback((lineNumber: number | null) => {
    setInternalHighlightedLine(lineNumber);
    onLineHover?.(lineNumber);
  }, [onLineHover]);

  // Handle line focus for keyboard navigation
  const handleLineFocus = useCallback((lineNumber: number | null) => {
    setFocusedLine(lineNumber);
  }, []);

  // Use external or internal highlighted line
  const currentHighlightedLine = highlightedLine ?? internalHighlightedLine;

  // Prepare data for the virtualized list
  const listData = useMemo(() => ({
    lines: allLines,
    highlightedLine: currentHighlightedLine,
    focusedLine: focusedLine,
    onLineHover: handleLineHover,
    onLineFocus: handleLineFocus,
    synchronizedHover
  }), [allLines, currentHighlightedLine, focusedLine, handleLineHover, handleLineFocus, synchronizedHover]);

  // Statistics for display
  const stats = useMemo(() => ({
    total: diffData.totalLines,
    added: diffData.addedLines,
    removed: diffData.removedLines,
    modified: diffData.modifiedLines
  }), [diffData]);

  return (
    <div className={`flex flex-col bg-white border rounded-lg shadow-sm ${className}`}>
      {/* Enhanced header with statistics and controls */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b rounded-t-lg">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Content Comparison
          </h3>
          
          {/* Synchronization toggle */}
          <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={synchronizedHover}
              onChange={(e) => setSynchronizedHover(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Enhanced Hover</span>
          </label>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Current line indicator */}
          {currentHighlightedLine && (
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-gray-600">Line {currentHighlightedLine}</span>
            </div>
          )}
          
          {/* Statistics */}
          <div className="flex items-center space-x-4 text-sm">
            <span className="flex items-center text-green-600">
              <span className="w-3 h-3 bg-green-400 rounded-full mr-2"></span>
              +{stats.added}
            </span>
            <span className="flex items-center text-red-600">
              <span className="w-3 h-3 bg-red-400 rounded-full mr-2"></span>
              -{stats.removed}
            </span>
            <span className="flex items-center text-yellow-600">
              <span className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
              ~{stats.modified}
            </span>
            <span className="text-gray-600">
              {stats.total} total
            </span>
          </div>
        </div>
      </div>

      {/* Keyboard navigation hint */}
      <div className="px-4 py-2 bg-blue-50 border-b text-xs text-blue-700">
        <span className="font-medium">Keyboard Navigation:</span>
        <span className="ml-2">↑↓ Navigate • Enter/Space Select • Esc Clear</span>
      </div>

      {/* Virtualized diff content with enhanced accessibility */}
      <div 
        className="flex-1 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-opacity-20"
        role="region"
        aria-label={`Diff content with ${allLines.length} lines`}
      >
        {allLines.length > 0 ? (
          <List
            height={height - 100} // Account for header and hint
            width={width}
            itemCount={allLines.length}
            itemSize={itemSize}
            itemData={listData}
            overscanCount={overscanCount}
          >
            {ListItem}
          </List>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <div>No differences found</div>
              <div className="text-sm mt-1">The content appears to be identical</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualizedDiffViewer;