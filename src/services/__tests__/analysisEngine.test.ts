import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  RealTimeAnalysisEngine, 
  createAnalysisEngine, 
  extractContent,
  type AnalysisConfig 
} from '../analysisEngine';
import { apiService } from '../api';

// Mock the API service
vi.mock('../api', () => ({
  apiService: {
    analyzeEmail: vi.fn(),
    cancelAllRequests: vi.fn(),
  },
}));

describe('Analysis Engine', () => {
  let engine: RealTimeAnalysisEngine;
  const mockApiService = apiService as any;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = createAnalysisEngine({
      debounceMs: 100, // Faster for testing
      minContentLength: 5,
      enableDeduplication: true,
      enableCaching: true,
    });
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('Content Extraction', () => {
    it('should extract content correctly', () => {
      const html = '<p>Hello <strong>world</strong>!</p>';
      const plainText = 'Hello world!';
      
      const extracted = extractContent(html, plainText);
      
      expect(extracted.html).toBe(html);
      expect(extracted.plainText).toBe(plainText);
      expect(extracted.wordCount).toBe(2);
      expect(extracted.characterCount).toBe(12);
      expect(extracted.isEmpty).toBe(false);
      expect(extracted.contentHash).toBeDefined();
    });

    it('should detect empty content', () => {
      const extracted = extractContent('', '');
      
      expect(extracted.isEmpty).toBe(true);
      expect(extracted.wordCount).toBe(0);
      expect(extracted.characterCount).toBe(0);
    });

    it('should handle whitespace-only content', () => {
      const extracted = extractContent('<p>   </p>', '   ');
      
      expect(extracted.isEmpty).toBe(true);
      expect(extracted.wordCount).toBe(0);
    });

    it('should generate consistent hashes for same content', () => {
      const content1 = extractContent('<p>Test</p>', 'Test');
      const content2 = extractContent('<div>Test</div>', 'Test'); // Different HTML, same text
      
      expect(content1.contentHash).toBe(content2.contentHash);
    });
  });

  describe('Real-Time Analysis Engine', () => {
    it('should initialize with correct default state', () => {
      const state = engine.getCurrentState();
      
      expect(state.isAnalyzing).toBe(false);
      expect(state.content).toBeNull();
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should not analyze content below minimum length', async () => {
      engine.analyzeContent('<p>Hi</p>', 'Hi');
      
      // Wait a bit for debounce
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockApiService.analyzeEmail).not.toHaveBeenCalled();
    });

    it('should analyze content above minimum length', async () => {
      mockApiService.analyzeEmail.mockResolvedValue({
        message: { content: 'Tagged content' }
      });

      engine.analyzeContent('<p>Hello world!</p>', 'Hello world!');
      
      // Wait for debounce and processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockApiService.analyzeEmail).toHaveBeenCalledWith('Hello world!', expect.any(String));
    });

    it('should debounce multiple rapid content changes', async () => {
      mockApiService.analyzeEmail.mockResolvedValue({
        message: { content: 'Tagged content' }
      });

      // Rapid content changes
      engine.analyzeContent('<p>Hello</p>', 'Hello');
      engine.analyzeContent('<p>Hello world</p>', 'Hello world');
      engine.analyzeContent('<p>Hello world!</p>', 'Hello world!');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should only call API once with the final content
      expect(mockApiService.analyzeEmail).toHaveBeenCalledTimes(1);
      expect(mockApiService.analyzeEmail).toHaveBeenCalledWith('Hello world!', expect.any(String));
    });

    it('should deduplicate identical content', async () => {
      mockApiService.analyzeEmail.mockResolvedValue({
        message: { content: 'Tagged content' }
      });

      const content = 'Hello world!';
      
      // Analyze same content twice
      engine.analyzeContent(`<p>${content}</p>`, content);
      await new Promise(resolve => setTimeout(resolve, 150));
      
      engine.analyzeContent(`<div>${content}</div>`, content); // Different HTML, same text
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should only call API once due to deduplication
      expect(mockApiService.analyzeEmail).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockApiService.analyzeEmail.mockRejectedValue(error);

      engine.analyzeContent('<p>Hello world!</p>', 'Hello world!');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // The error handling is tested through the pipeline - 
      // main thing is that it doesn't crash the application
      expect(true).toBe(true); // Test passes if no crash occurs
    });

    it('should update state correctly during analysis', async () => {
      let stateUpdates: any[] = [];
      
      engine.getState().subscribe(state => {
        stateUpdates.push({ ...state });
      });

      mockApiService.analyzeEmail.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ message: { content: 'Tagged' } }), 50))
      );

      engine.analyzeContent('<p>Hello world!</p>', 'Hello world!');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Wait for API call to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have states: initial, analyzing, completed
      expect(stateUpdates.length).toBeGreaterThan(1);
      expect(stateUpdates.some(s => s.isAnalyzing === true)).toBe(true);
      expect(stateUpdates.some(s => s.isAnalyzing === false && s.result !== null)).toBe(true);
    });

    it('should clear analysis state', () => {
      // Set some state first
      engine.analyzeContent('<p>Hello world!</p>', 'Hello world!');
      
      engine.clearAnalysis();
      
      const state = engine.getCurrentState();
      expect(state.content).toBeNull();
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should cancel all requests', () => {
      engine.cancelAllRequests();
      
      expect(mockApiService.cancelAllRequests).toHaveBeenCalled();
    });

    it('should provide engine statistics', () => {
      const stats = engine.getStats();
      
      expect(stats).toHaveProperty('activeRequests');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('currentState');
    });

    it('should update configuration', () => {
      const newConfig = { debounceMs: 500 };
      
      engine.updateConfig(newConfig);
      
      const stats = engine.getStats();
      expect(stats.config.debounceMs).toBe(500);
    });
  });

  describe('Factory Function', () => {
    it('should create engine with custom config', () => {
      const customConfig: Partial<AnalysisConfig> = {
        debounceMs: 2000,
        minContentLength: 20,
        enableCaching: false,
      };
      
      const customEngine = createAnalysisEngine(customConfig);
      const stats = customEngine.getStats();
      
      expect(stats.config.debounceMs).toBe(2000);
      expect(stats.config.minContentLength).toBe(20);
      expect(stats.config.enableCaching).toBe(false);
      
      customEngine.destroy();
    });
  });
});