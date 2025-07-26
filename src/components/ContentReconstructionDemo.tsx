import React, { useState, useCallback, useEffect } from 'react';
import { ContentReconstructionEngine, type ReconstructionResult } from '../utils/contentReconstruction';
import { VirtualizedDiffViewer } from './VirtualizedDiff';
import { apiService } from '../services/api';

/**
 * Demo component showing content reconstruction algorithm integration
 * Demonstrates how to use the algorithm with the FixMyMail interface
 */
export const ContentReconstructionDemo: React.FC = () => {
  const [originalContent, setOriginalContent] = useState('');
  const [taggedContent, setTaggedContent] = useState('');
  const [improvementContent, setImprovementContent] = useState('');
  const [originalHtmlContent, setOriginalHtmlContent] = useState('');
  const [reconstructionResult, setReconstructionResult] = useState<ReconstructionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingImprovements, setIsGeneratingImprovements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<{ gmm: boolean; fmm: boolean } | null>(null);

  // Sample data for quick testing
  const loadSampleData = useCallback(() => {
    setOriginalContent('This is amazing content with incredible results. Get free access now! Limited time offer with fantastic benefits.');
    setTaggedContent('');
    setImprovementContent('');
    setOriginalHtmlContent('<p>This is <strong>amazing</strong> content with <em>incredible</em> results. Get <span style="color: red;">free</span> access now! <u>Limited time</u> offer with <strong>fantastic</strong> benefits.</p>');
  }, []);

  // Check Ollama model status
  const checkOllamaStatus = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health/ready');
      const data = await response.json();
      setOllamaStatus(data.services || { gmm: false, fmm: false });
    } catch (error) {
      console.error('Failed to check Ollama status:', error);
      setOllamaStatus({ gmm: false, fmm: false });
    }
  }, []);

  // Analyze content using GMM model
  const analyzeWithGMM = useCallback(async () => {
    if (!originalContent.trim()) {
      setError('Please enter some content to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setTaggedContent('');

    try {
      console.log('🤖 Calling GMM model for analysis...');
      const response = await apiService.analyzeEmail(originalContent);
      setTaggedContent(response.message.content);
      console.log('✅ GMM analysis complete');
    } catch (error) {
      console.error('❌ GMM analysis failed:', error);
      setError(`GMM Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [originalContent]);

  // Generate improvements using FMM model
  const generateImprovements = useCallback(async () => {
    if (!taggedContent.trim()) {
      setError('Please analyze content first to generate tagged content');
      return;
    }

    setIsGeneratingImprovements(true);
    setError(null);
    setImprovementContent('');

    try {
      console.log('🔧 Calling FMM model for improvements...');
      const response = await apiService.fixEmail(taggedContent);
      setImprovementContent(response.message.content);
      console.log('✅ FMM improvements complete');
    } catch (error) {
      console.error('❌ FMM improvements failed:', error);
      setError(`FMM Improvements failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingImprovements(false);
    }
  }, [taggedContent]);

  // Full pipeline: Original → GMM → FMM → Reconstruction
  const runFullPipeline = useCallback(async () => {
    if (!originalContent.trim()) {
      setError('Please enter some content to process');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTaggedContent('');
    setImprovementContent('');
    setReconstructionResult(null);

    try {
      // Step 1: Analyze with GMM
      console.log('🔍 Step 1: Analyzing with GMM model...');
      const analysisResponse = await apiService.analyzeEmail(originalContent);
      const gmmTaggedContent = analysisResponse.message.content;
      setTaggedContent(gmmTaggedContent);

      // Step 2: Generate improvements with FMM
      console.log('🔧 Step 2: Generating improvements with FMM model...');
      const improvementsResponse = await apiService.fixEmail(gmmTaggedContent);
      const fmmImprovements = improvementsResponse.message.content;
      setImprovementContent(fmmImprovements);

      // Step 3: Reconstruct content
      console.log('🏗️ Step 3: Reconstructing content...');
      const result = ContentReconstructionEngine.reconstructContent(
        originalContent,
        gmmTaggedContent,
        fmmImprovements,
        originalHtmlContent || undefined
      );

      setReconstructionResult(result);
      console.log('✅ Full pipeline complete!');

      if (result.errors.length > 0) {
        setError(`Pipeline completed with ${result.errors.length} warnings`);
      }
    } catch (error) {
      console.error('❌ Pipeline failed:', error);
      setError(`Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setReconstructionResult(null);
    } finally {
      setIsProcessing(false);
    }
  }, [originalContent, originalHtmlContent]);

  // Check Ollama status on component mount
  useEffect(() => {
    checkOllamaStatus();
  }, [checkOllamaStatus]);

  const handleReconstruction = useCallback(async () => {
    if (!originalContent || !taggedContent || !improvementContent) {
      setError('Please provide original content, tagged content, and improvements');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = ContentReconstructionEngine.reconstructContent(
        originalContent,
        taggedContent,
        improvementContent,
        originalHtmlContent || undefined
      );

      setReconstructionResult(result);

      if (result.errors.length > 0) {
        setError(`Reconstruction completed with ${result.errors.length} warnings`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setReconstructionResult(null);
    } finally {
      setIsProcessing(false);
    }
  }, [originalContent, taggedContent, improvementContent, originalHtmlContent]);

  const clearAll = useCallback(() => {
    setOriginalContent('');
    setTaggedContent('');
    setImprovementContent('');
    setOriginalHtmlContent('');
    setReconstructionResult(null);
    setError(null);
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Content Reconstruction Algorithm Demo
        </h1>
        <p className="text-gray-600 mb-6">
          Test the content reconstruction algorithm that replaces tagged portions with improvements
          while preserving HTML structure and generating diff comparisons.
        </p>

        {/* Ollama Status */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Ollama Models Status</h3>
            <button
              onClick={checkOllamaStatus}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Check Status
            </button>
          </div>
          {ollamaStatus && (
            <div className="mt-3 flex gap-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${ollamaStatus.gmm ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">GMM (GradeMyMail): {ollamaStatus.gmm ? 'Online' : 'Offline'}</span>
              </div>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${ollamaStatus.fmm ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">FMM (FixMyMail): {ollamaStatus.fmm ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={loadSampleData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Load Sample Data
          </button>
          <button
            onClick={analyzeWithGMM}
            disabled={isAnalyzing || !originalContent.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? 'Analyzing...' : '1. Analyze with GMM'}
          </button>
          <button
            onClick={generateImprovements}
            disabled={isGeneratingImprovements || !taggedContent.trim()}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isGeneratingImprovements ? 'Generating...' : '2. Improve with FMM'}
          </button>
          <button
            onClick={runFullPipeline}
            disabled={isProcessing || !originalContent.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? 'Processing...' : 'Run Full Pipeline'}
          </button>
          <button
            onClick={clearAll}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Clear All
          </button>
        </div>

        {/* Pipeline Flow */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ollama Pipeline Flow</h3>
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold mb-2">1</div>
              <span className="text-center">Original<br/>Content</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center font-bold mb-2">2</div>
              <span className="text-center">GMM<br/>Analysis</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold mb-2">3</div>
              <span className="text-center">FMM<br/>Improvements</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-300 mx-4"></div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold mb-2">4</div>
              <span className="text-center">Content<br/>Reconstruction</span>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📝 Original Content (Input)
            </label>
            <textarea
              value={originalContent}
              onChange={(e) => setOriginalContent(e.target.value)}
              className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter the original email content here..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🏷️ Tagged Content (GMM Output)
              {isAnalyzing && <span className="ml-2 text-blue-600">Analyzing...</span>}
            </label>
            <textarea
              value={taggedContent}
              onChange={(e) => setTaggedContent(e.target.value)}
              className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent bg-green-50"
              placeholder="GMM model will generate tagged content here..."
              readOnly={isAnalyzing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔧 Improvement Content (FMM Output)
              {isGeneratingImprovements && <span className="ml-2 text-orange-600">Generating...</span>}
            </label>
            <textarea
              value={improvementContent}
              onChange={(e) => setImprovementContent(e.target.value)}
              className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-orange-50"
              placeholder="FMM model will generate improvements here..."
              readOnly={isGeneratingImprovements}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🌐 Original HTML Content (Optional)
            </label>
            <textarea
              value={originalHtmlContent}
              onChange={(e) => setOriginalHtmlContent(e.target.value)}
              className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter HTML version for structure preservation..."
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={handleReconstruction}
            disabled={isProcessing || !originalContent || !taggedContent || !improvementContent}
            className="px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Reconstruct Content'
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {reconstructionResult && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Reconstruction Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {reconstructionResult.appliedImprovements.length}
                  </div>
                  <div className="text-sm text-gray-600">Improvements Applied</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {reconstructionResult.metadata.processingTime}ms
                  </div>
                  <div className="text-sm text-gray-600">Processing Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {reconstructionResult.errors.length}
                  </div>
                  <div className="text-sm text-gray-600">Errors/Warnings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {reconstructionResult.metadata.preservedFormatting ? 'Yes' : 'No'}
                  </div>
                  <div className="text-sm text-gray-600">HTML Preserved</div>
                </div>
              </div>
            </div>

            {/* Applied Improvements */}
            {reconstructionResult.appliedImprovements.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Applied Improvements</h3>
                <div className="space-y-3">
                  {reconstructionResult.appliedImprovements.map((improvement, index) => (
                    <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-md">
                      <div className="flex-1">
                        <span className="text-red-600 line-through">"{improvement.original}"</span>
                        <span className="mx-2">→</span>
                        <span className="text-green-600 font-medium">"{improvement.improved}"</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {(improvement.confidence! * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors/Warnings */}
            {reconstructionResult.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-4">Warnings & Issues</h3>
                <div className="space-y-2">
                  {reconstructionResult.errors.map((error, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        <svg className="h-4 w-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-yellow-800">[{error.type}]</div>
                        <div className="text-sm text-yellow-700">{error.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diff Viewer */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Content Comparison</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Side-by-side comparison showing original vs improved content
                </p>
              </div>
              <div className="p-6">
                <VirtualizedDiffViewer
                  originalContent={reconstructionResult.originalContent}
                  modifiedContent={reconstructionResult.improvedContent}
                  height={400}
                  className="border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* HTML Comparison (if available) */}
            {reconstructionResult.htmlImprovedContent && reconstructionResult.htmlOriginalContent && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">HTML Structure Comparison</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Original HTML</h4>
                    <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto">
                      {reconstructionResult.htmlOriginalContent}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Improved HTML</h4>
                    <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto">
                      {reconstructionResult.htmlImprovedContent}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Diff Statistics */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Diff Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-md">
                  <div className="text-lg font-bold text-gray-900">
                    {reconstructionResult.diffData.totalLines}
                  </div>
                  <div className="text-sm text-gray-600">Total Lines</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-md">
                  <div className="text-lg font-bold text-green-600">
                    +{reconstructionResult.diffData.addedLines}
                  </div>
                  <div className="text-sm text-gray-600">Added</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-md">
                  <div className="text-lg font-bold text-red-600">
                    -{reconstructionResult.diffData.removedLines}
                  </div>
                  <div className="text-sm text-gray-600">Removed</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-md">
                  <div className="text-lg font-bold text-blue-600">
                    {reconstructionResult.diffData.modifiedLines}
                  </div>
                  <div className="text-sm text-gray-600">Modified</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentReconstructionDemo;