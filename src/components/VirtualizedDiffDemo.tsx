import React, { useState, useMemo } from 'react';
import { SplitPaneDiffViewer, VirtualizedDiffViewer } from './VirtualizedDiff';

const VirtualizedDiffDemo: React.FC = () => {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [selectedExample, setSelectedExample] = useState<'email' | 'large' | 'custom'>('email');
  const [customOriginal, setCustomOriginal] = useState('');
  const [customModified, setCustomModified] = useState('');

  // Sample email content for demonstration
  const emailExample = useMemo(() => ({
    original: `Subject: Urgent Meeting Request - Please Respond ASAP!!!

Hi there,

I hope this email finds you well. I am writing to you today because I need to schedule a very important meeting with you and the team. This meeting is extremely urgent and we need to discuss several critical issues that have come up recently.

The issues we need to discuss include:
- Budget overruns in the marketing department
- Delays in the product launch timeline
- Customer complaints about our latest software update
- Staff turnover in the engineering team

I know everyone is very busy, but this really can't wait. We need to get everyone together as soon as possible to figure out what we're going to do about these problems. 

Please let me know your availability for this week. I'm thinking we could meet either Tuesday, Wednesday, or Thursday. The meeting will probably take about 2-3 hours, so please block out enough time in your calendar.

Looking forward to hearing from you soon.

Best regards,
John Smith
Project Manager
ABC Company
john.smith@abccompany.com
(555) 123-4567`,
    modified: `Subject: Team Meeting - Budget and Timeline Review

Hi Team,

I'd like to schedule a meeting to discuss some important project updates and address recent challenges.

Agenda items:
• Marketing budget review and optimization
• Product launch timeline adjustment
• Software update feedback analysis  
• Engineering team capacity planning

Please share your availability for this week (Tuesday-Thursday). The meeting will take approximately 90 minutes.

Thanks,
John Smith
Project Manager
ABC Company
john.smith@abccompany.com`
  }), []);

  // Large content example for performance testing
  const largeExample = useMemo(() => {
    const generateLargeText = (lines: number, prefix: string) => {
      return Array.from({ length: lines }, (_, i) => 
        `${prefix} Line ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`
      ).join('\n');
    };

    return {
      original: generateLargeText(1000, 'Original'),
      modified: generateLargeText(1000, 'Modified')
    };
  }, []);

  const getCurrentExample = () => {
    switch (selectedExample) {
      case 'email':
        return emailExample;
      case 'large':
        return largeExample;
      case 'custom':
        return {
          original: customOriginal,
          modified: customModified
        };
      default:
        return emailExample;
    }
  };

  const currentExample = getCurrentExample();

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Virtualized Diff Rendering System
        </h1>
        <p className="text-gray-600 mb-6">
          High-performance diff viewer with virtualized rendering, resizable panels, and smooth interactions.
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Example selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Example:</label>
            <select
              value={selectedExample}
              onChange={(e) => setSelectedExample(e.target.value as 'email' | 'large' | 'custom')}
              className="px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="email">Email Improvement</option>
              <option value="large">Large Content (1000 lines)</option>
              <option value="custom">Custom Content</option>
            </select>
          </div>

          {/* View mode selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">View:</label>
            <div className="flex border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 text-sm ${
                  viewMode === 'split'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Split View
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1 text-sm border-l ${
                  viewMode === 'unified'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Unified View
              </button>
            </div>
          </div>
        </div>

        {/* Custom content inputs */}
        {selectedExample === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Original Content
              </label>
              <textarea
                value={customOriginal}
                onChange={(e) => setCustomOriginal(e.target.value)}
                placeholder="Enter original content..."
                className="w-full h-32 px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modified Content
              </label>
              <textarea
                value={customModified}
                onChange={(e) => setCustomModified(e.target.value)}
                placeholder="Enter modified content..."
                className="w-full h-32 px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Enhanced Features info */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Interactive Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-1">Performance</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Virtualized rendering (1000+ lines)</li>
                <li>• GPU-accelerated animations</li>
                <li>• Minimal DOM manipulation</li>
                <li>• Smooth 60fps interactions</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-1">Interaction</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Synchronized hover highlighting</li>
                <li>• Keyboard navigation support</li>
                <li>• Resizable panels with smooth drag</li>
                <li>• Micro-interactions and transitions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Diff viewer */}
      <div className="bg-white rounded-lg shadow-sm">
        {viewMode === 'split' ? (
          <SplitPaneDiffViewer
            originalContent={currentExample.original}
            modifiedContent={currentExample.modified}
            height={600}
            itemSize={32}
            className="rounded-lg"
          />
        ) : (
          <VirtualizedDiffViewer
            originalContent={currentExample.original}
            modifiedContent={currentExample.modified}
            height={600}
            itemSize={32}
            className="rounded-lg"
          />
        )}
      </div>

      {/* Technical details */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Technical Implementation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Virtualization</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• React-window for efficient rendering</li>
              <li>• Only visible items in DOM</li>
              <li>• Smooth scrolling performance</li>
              <li>• Configurable overscan for smoother UX</li>
            </ul>
          </div>
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Split Panes</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• React-resizable-panels integration</li>
              <li>• Synchronized scrolling and hover</li>
              <li>• Responsive layout with minimum sizes</li>
              <li>• Smooth resize animations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualizedDiffDemo;