import React, { useRef, useState, useCallback } from 'react';
import RichTextEditor, { type RichTextEditorRef } from './RichTextEditor/RichTextEditor';
import { useRealTimeAnalysis, useEditorAnalysis } from '../hooks/useRealTimeAnalysis';
import type { AnalysisState, ExtractedContent } from '../services/analysisEngine';

// Demo component for real-time analysis
const RealTimeAnalysisDemo: React.FC = () => {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    timestamp: Date;
    content: ExtractedContent;
    result?: any;
    error?: any;
  }>>([]);

  // Analysis configuration
  const analysisConfig = {
    debounceMs: 1000, // 1 second debounce
    minContentLength: 10,
    enableDeduplication: true,
    enableCaching: true,
    cacheExpiryMs: 5 * 60 * 1000, // 5 minutes
  };

  // Analysis callbacks
  const handleAnalysisStart = useCallback((content: ExtractedContent) => {
    console.log('🚀 Analysis started for content:', content.contentHash);
    setAnalysisHistory(prev => [...prev, {
      timestamp: new Date(),
      content,
    }]);
  }, []);

  const handleAnalysisComplete = useCallback((result: any, content: ExtractedContent) => {
    console.log('✅ Analysis completed for content:', content.contentHash, result);
    setAnalysisHistory(prev => prev.map(entry => 
      entry.content.contentHash === content.contentHash && !entry.result
        ? { ...entry, result }
        : entry
    ));
  }, []);

  const handleAnalysisError = useCallback((error: any, content: ExtractedContent) => {
    console.error('❌ Analysis failed for content:', content.contentHash, error);
    setAnalysisHistory(prev => prev.map(entry => 
      entry.content.contentHash === content.contentHash && !entry.error
        ? { ...entry, error }
        : entry
    ));
  }, []);

  const handleStateChange = useCallback((state: AnalysisState) => {
    console.log('📊 Analysis state changed:', {
      isAnalyzing: state.isAnalyzing,
      hasResult: !!state.result,
      hasError: !!state.error,
    });
  }, []);

  // Use the editor analysis hook
  const analysis = useEditorAnalysis(editorRef, {
    ...analysisConfig,
    onAnalysisStart: handleAnalysisStart,
    onAnalysisComplete: handleAnalysisComplete,
    onAnalysisError: handleAnalysisError,
    onStateChange: handleStateChange,
  });

  // Handle editor content changes
  const handleEditorChange = useCallback((html: string, plainText: string) => {
    console.log('📝 Editor content changed:', { htmlLength: html.length, textLength: plainText.length });
    analysis.handleEditorChange(html, plainText);
  }, [analysis]);

  // Manual analysis trigger
  const handleManualAnalysis = useCallback(() => {
    analysis.triggerAnalysis();
  }, [analysis]);

  // Clear analysis data
  const handleClearAnalysis = useCallback(() => {
    analysis.clearAnalysis();
    setAnalysisHistory([]);
  }, [analysis]);

  // Get engine stats
  const handleGetStats = useCallback(() => {
    const stats = analysis.getStats();
    console.log('📊 Analysis engine stats:', stats);
    alert(JSON.stringify(stats, null, 2));
  }, [analysis]);

  // Format analysis result for display
  const formatAnalysisResult = (result: any) => {
    if (!result) return 'No result';
    
    try {
      if (typeof result === 'object' && result.message?.content) {
        return result.message.content;
      }
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  };

  return (
    <div className="real-time-analysis-demo p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Real-Time Analysis Demo
        </h1>
        <p className="text-gray-600">
          Type in the editor below to see real-time email analysis in action. 
          The system uses RxJS for reactive processing with debouncing, deduplication, and caching.
        </p>
      </div>

      {/* Analysis Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Analysis Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${analysis.isAnalyzing ? 'text-blue-600' : 'text-gray-400'}`}>
              {analysis.isAnalyzing ? '🔄' : '⏸️'}
            </div>
            <div className="text-sm text-gray-600">
              {analysis.isAnalyzing ? 'Analyzing...' : 'Idle'}
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${analysis.lastResult ? 'text-green-600' : 'text-gray-400'}`}>
              {analysis.lastResult ? '✅' : '⭕'}
            </div>
            <div className="text-sm text-gray-600">
              {analysis.lastResult ? 'Has Result' : 'No Result'}
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${analysis.lastError ? 'text-red-600' : 'text-gray-400'}`}>
              {analysis.lastError ? '❌' : '✅'}
            </div>
            <div className="text-sm text-gray-600">
              {analysis.lastError ? 'Has Error' : 'No Error'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {analysisHistory.length}
            </div>
            <div className="text-sm text-gray-600">
              Total Requests
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={handleManualAnalysis}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          🔍 Analyze Now
        </button>
        <button
          onClick={handleClearAnalysis}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          🧹 Clear Analysis
        </button>
        <button
          onClick={analysis.cancelRequests}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          🛑 Cancel Requests
        </button>
        <button
          onClick={handleGetStats}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          📊 Show Stats
        </button>
      </div>

      {/* Rich Text Editor */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Email Content Editor</h2>
        <div className="border rounded-lg overflow-hidden">
          <RichTextEditor
            ref={editorRef}
            placeholder="Start typing your email content here... Analysis will begin automatically after you stop typing for 1 second."
            onChange={handleEditorChange}
            className="min-h-[300px]"
            enableAutoSave={false} // Disable auto-save for demo
            showValidation={true}
          />
        </div>
      </div>

      {/* Current Analysis Result */}
      {(analysis.lastResult || analysis.lastError) && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Current Analysis Result</h2>
          <div className="bg-white border rounded-lg p-4">
            {analysis.lastError ? (
              <div className="text-red-600">
                <div className="font-semibold">❌ Error:</div>
                <div className="mt-1 font-mono text-sm">
                  {analysis.lastError.message || String(analysis.lastError)}
                </div>
              </div>
            ) : analysis.lastResult ? (
              <div className="text-green-600">
                <div className="font-semibold">✅ Success:</div>
                <div className="mt-1 font-mono text-sm whitespace-pre-wrap">
                  {formatAnalysisResult(analysis.lastResult)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Analysis History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Analysis History</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {analysisHistory.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No analysis requests yet. Start typing in the editor above.
            </div>
          ) : (
            analysisHistory.slice().reverse().map((entry, index) => (
              <div key={index} className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">
                    {entry.timestamp.toLocaleTimeString()}
                  </div>
                  <div className="text-sm font-mono text-gray-400">
                    Hash: {entry.content.contentHash}
                  </div>
                </div>
                
                <div className="mb-2">
                  <div className="text-sm text-gray-600">
                    Content: {entry.content.wordCount} words, {entry.content.characterCount} chars
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    "{entry.content.plainText.substring(0, 100)}..."
                  </div>
                </div>

                {entry.result && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                    <div className="font-semibold text-green-700">✅ Result:</div>
                    <div className="font-mono text-green-600 mt-1 whitespace-pre-wrap">
                      {formatAnalysisResult(entry.result)}
                    </div>
                  </div>
                )}

                {entry.error && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-sm">
                    <div className="font-semibold text-red-700">❌ Error:</div>
                    <div className="font-mono text-red-600 mt-1">
                      {entry.error.message || String(entry.error)}
                    </div>
                  </div>
                )}

                {!entry.result && !entry.error && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <div className="font-semibold text-blue-700">🔄 Processing...</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeAnalysisDemo;