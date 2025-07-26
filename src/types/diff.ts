export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  content: string;
  lineNumber: number;
  originalLineNumber?: number;
  modifiedLineNumber?: number;
}

export interface DiffChunk {
  lines: DiffLine[];
  startLine: number;
  endLine: number;
}

export interface DiffData {
  chunks: DiffChunk[];
  totalLines: number;
  addedLines: number;
  removedLines: number;
  modifiedLines: number;
}

export interface VirtualizedDiffProps {
  originalContent: string;
  modifiedContent: string;
  className?: string;
  onLineHover?: (lineNumber: number | null) => void;
  highlightedLine?: number | null;
}

export interface DiffViewerProps extends VirtualizedDiffProps {
  height?: number;
  width?: number;
  itemSize?: number;
  overscanCount?: number;
}