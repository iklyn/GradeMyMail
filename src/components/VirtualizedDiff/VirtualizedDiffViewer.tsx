import React from 'react';
import type { DiffViewerProps } from '../../types/diff';
import './DiffViewer.css';

const VirtualizedDiffViewer: React.FC<DiffViewerProps> = ({
  originalContent,
  modifiedContent,
  height = 600,
  className = ''
}) => {
  return (
    <div className={`diff-viewer bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-white/5 rounded-lg overflow-hidden ${className}`}>
      {/* Clean minimal header */}
      <div className="flex border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#1C1C1E]">
        <div className="flex-1 px-6 py-4 border-r border-gray-200 dark:border-white/5">
          <h3 className="text-base font-medium text-gray-900 dark:text-[#FFFFFF]">
            Original
          </h3>
        </div>
        <div className="flex-1 px-6 py-4">
          <h3 className="text-base font-medium text-gray-900 dark:text-[#FFFFFF]">
            Improved
          </h3>
        </div>
      </div>

      {/* Clean side-by-side comparison */}
      <div className="flex" style={{ height: height - 60 }}>
        {/* Original content pane */}
        <div className="flex-1 border-r border-gray-200 dark:border-white/5 diff-pane">
          <div className="p-6">
            <pre className="diff-content text-sm text-gray-700 dark:text-[#EBEBF5]">
              {originalContent}
            </pre>
          </div>
        </div>

        {/* Improved content pane */}
        <div className="flex-1 diff-pane">
          <div className="p-6">
            <pre className="diff-content text-sm text-gray-700 dark:text-[#EBEBF5]">
              {modifiedContent}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualizedDiffViewer;