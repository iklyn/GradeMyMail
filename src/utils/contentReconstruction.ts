import type { DiffData } from '../types/diff';
import { DiffEngine } from './diffEngine';

/**
 * Interface for tagged content analysis
 */
export interface TaggedSentence {
  type: 'fluff' | 'spam_words' | 'hard_to_read';
  originalText: string;
  startIndex: number;
  endIndex: number;
  tagId?: string; // For hard_to_read sentences with UUIDs
}

/**
 * Interface for improvement pairs from AI model
 */
export interface ImprovementPair {
  original: string;
  improved: string;
  confidence?: number;
}

/**
 * Interface for reconstruction result
 */
export interface ReconstructionResult {
  originalContent: string;
  improvedContent: string;
  htmlOriginalContent?: string;
  htmlImprovedContent?: string;
  diffData: DiffData;
  appliedImprovements: ImprovementPair[];
  errors: ReconstructionError[];
  metadata: {
    totalReplacements: number;
    preservedFormatting: boolean;
    processingTime: number;
  };
}

/**
 * Error types for reconstruction process
 */
export class ReconstructionError extends Error {
  public type: 'parsing' | 'validation' | 'html_structure' | 'content_mismatch';
  public context?: any;

  constructor(message: string, type: ReconstructionError['type'], context?: any) {
    super(message);
    this.name = 'ReconstructionError';
    this.type = type;
    this.context = context;
  }
}

/**
 * Content Reconstruction Engine
 * Handles replacing tagged portions with improvements while preserving HTML structure
 */
export class ContentReconstructionEngine {
  private static readonly TAG_PATTERNS = {
    fluff: /<fluff>(.*?)<\/fluff>/gi,
    spam_words: /<spam_words>(.*?)<\/spam_words>/gi,
    hard_to_read: /<hard_to_read>(.*?)<\/hard_to_read>/gi,
  };

  private static readonly IMPROVEMENT_PATTERNS = {
    old_draft: /<old_draft>(.*?)<\/old_draft>/gi,
    optimized_draft: /<optimized_draft>(.*?)<\/optimized_draft>/gi,
  };

  /**
   * Parse tagged content to extract problematic sentences
   */
  static parseTaggedContent(taggedContent: string): TaggedSentence[] {
    const sentences: TaggedSentence[] = [];

    try {
      // Process each tag type
      Object.entries(this.TAG_PATTERNS).forEach(([type, pattern]) => {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        
        while ((match = regex.exec(taggedContent)) !== null) {
          const originalText = match[1];
          const startIndex = match.index;
          const endIndex = match.index + match[0].length;

          // Special handling for hard_to_read tags with UUIDs
          if (type === 'hard_to_read' && this.isUUID(originalText)) {
            const tagId = originalText;
            // Find the actual sentence content before the tag
            const beforeTag = taggedContent.substring(0, startIndex);
            const sentenceMatch = beforeTag.match(/([^.!?]*[.!?])\s*$/);
            if (sentenceMatch) {
              const actualSentence = sentenceMatch[1].trim();
              const sentenceStart = startIndex - sentenceMatch[0].length + sentenceMatch.index! + 1;
              sentences.push({
                type: type as TaggedSentence['type'],
                originalText: actualSentence,
                startIndex: sentenceStart,
                endIndex: startIndex,
                tagId,
              });
              continue;
            }
          }

          sentences.push({
            type: type as TaggedSentence['type'],
            originalText,
            startIndex,
            endIndex,
          });
        }
      });

      // Sort by start index to maintain order
      sentences.sort((a, b) => a.startIndex - b.startIndex);

      return sentences;
    } catch (error) {
      throw new ReconstructionError(
        'Failed to parse tagged content',
        'parsing',
        { originalError: error, taggedContent: taggedContent.substring(0, 200) + '...' }
      );
    }
  }

  /**
   * Parse improvement pairs from AI response
   */
  static parseImprovements(improvementContent: string): ImprovementPair[] {
    const improvements: ImprovementPair[] = [];

    try {
      const oldDrafts: string[] = [];
      const optimizedDrafts: string[] = [];

      // Extract old drafts
      let match;
      const oldDraftRegex = new RegExp(this.IMPROVEMENT_PATTERNS.old_draft.source, this.IMPROVEMENT_PATTERNS.old_draft.flags);
      while ((match = oldDraftRegex.exec(improvementContent)) !== null) {
        oldDrafts.push(match[1]);
      }

      // Extract optimized drafts
      const optimizedDraftRegex = new RegExp(this.IMPROVEMENT_PATTERNS.optimized_draft.source, this.IMPROVEMENT_PATTERNS.optimized_draft.flags);
      while ((match = optimizedDraftRegex.exec(improvementContent)) !== null) {
        optimizedDrafts.push(match[1]);
      }

      // Pair them up
      const minLength = Math.min(oldDrafts.length, optimizedDrafts.length);
      for (let i = 0; i < minLength; i++) {
        improvements.push({
          original: oldDrafts[i].trim(),
          improved: optimizedDrafts[i].trim(),
          confidence: 1.0, // Default confidence
        });
      }

      // Validate that we have matching pairs
      if (oldDrafts.length !== optimizedDrafts.length) {
        throw new ReconstructionError(
          'Mismatched improvement pairs',
          'validation',
          { oldDraftsCount: oldDrafts.length, optimizedDraftsCount: optimizedDrafts.length }
        );
      }

      return improvements;
    } catch (error) {
      if (error instanceof ReconstructionError) {
        throw error;
      }
      throw new ReconstructionError(
        'Failed to parse improvements',
        'parsing',
        { originalError: error, improvementContent: improvementContent.substring(0, 200) + '...' }
      );
    }
  }

  /**
   * Reconstruct content by replacing tagged portions with improvements
   */
  static reconstructContent(
    originalContent: string,
    taggedContent: string,
    improvementContent: string,
    originalHtmlContent?: string
  ): ReconstructionResult {
    const startTime = Date.now();
    const errors: ReconstructionError[] = [];
    let appliedImprovements: ImprovementPair[] = [];

    try {
      // Parse tagged sentences and improvements
      const taggedSentences = this.parseTaggedContent(taggedContent);
      const improvements = this.parseImprovements(improvementContent);

      // Create improvement lookup map with flexible matching
      const improvementMap = new Map<string, string>();
      improvements.forEach(improvement => {
        const normalizedOriginal = improvement.original.toLowerCase().trim();
        improvementMap.set(normalizedOriginal, improvement.improved);
      });

      // Reconstruct plain text content
      let improvedContent = this.removeAllTags(taggedContent);
      let htmlImprovedContent = originalHtmlContent;

      // Apply improvements with flexible matching
      taggedSentences.forEach(sentence => {
        const sentenceText = sentence.originalText.trim();
        const normalizedSentence = sentenceText.toLowerCase().trim();
        
        // Try exact match first
        let improvement = improvementMap.get(normalizedSentence);
        
        // If no exact match, try partial matching
        if (!improvement) {
          for (const [oldDraft, newDraft] of improvementMap.entries()) {
            // Check if the old_draft is contained in the sentence or vice versa
            if (normalizedSentence.includes(oldDraft) || oldDraft.includes(normalizedSentence)) {
              improvement = newDraft;
              break;
            }
          }
        }

        if (improvement) {
          // Apply to plain text
          improvedContent = improvedContent.replace(sentenceText, improvement);
          
          // Apply to HTML content if available
          if (htmlImprovedContent) {
            htmlImprovedContent = this.replaceInHtml(htmlImprovedContent, sentenceText, improvement);
          }

          appliedImprovements.push({
            original: sentenceText,
            improved: improvement,
            confidence: 1.0,
          });
        } else {
          errors.push(new ReconstructionError(
            `No improvement found for tagged sentence: "${sentenceText}"`,
            'content_mismatch',
            { sentence, availableImprovements: Array.from(improvementMap.keys()) }
          ));
        }
      });

      // Generate diff data
      const diffData = DiffEngine.generateDiff(originalContent, improvedContent);

      // Validate reconstruction
      this.validateReconstruction(originalContent, improvedContent, appliedImprovements);

      const processingTime = Date.now() - startTime;

      return {
        originalContent,
        improvedContent,
        htmlOriginalContent: originalHtmlContent,
        htmlImprovedContent,
        diffData,
        appliedImprovements,
        errors,
        metadata: {
          totalReplacements: appliedImprovements.length,
          preservedFormatting: !!originalHtmlContent,
          processingTime,
        },
      };

    } catch (error) {
      if (error instanceof ReconstructionError) {
        errors.push(error);
      } else {
        errors.push(new ReconstructionError(
          'Unexpected error during reconstruction',
          'parsing',
          { originalError: error }
        ));
      }

      // Return fallback result
      return {
        originalContent,
        improvedContent: originalContent, // Fallback to original
        htmlOriginalContent: originalHtmlContent,
        htmlImprovedContent: originalHtmlContent,
        diffData: DiffEngine.generateDiff(originalContent, originalContent),
        appliedImprovements: [],
        errors,
        metadata: {
          totalReplacements: 0,
          preservedFormatting: !!originalHtmlContent,
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Remove all XML-style tags from content
   */
  private static removeAllTags(content: string): string {
    return content
      .replace(/<\/?fluff>/gi, '')
      .replace(/<\/?spam_words>/gi, '')
      .replace(/<\/?hard_to_read>/gi, '');
  }

  /**
   * Replace text in HTML content while preserving structure
   */
  private static replaceInHtml(htmlContent: string, originalText: string, improvedText: string): string {
    try {
      // Create a temporary DOM element to parse HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      // Function to recursively replace text in text nodes
      const replaceTextInNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent && node.textContent.includes(originalText)) {
            node.textContent = node.textContent.replace(originalText, improvedText);
          }
        } else {
          // Recursively process child nodes
          Array.from(node.childNodes).forEach(replaceTextInNode);
        }
      };

      replaceTextInNode(tempDiv);
      return tempDiv.innerHTML;

    } catch (error) {
      // Fallback to simple string replacement if DOM manipulation fails
      console.warn('HTML structure preservation failed, falling back to string replacement:', error);
      return htmlContent.replace(originalText, improvedText);
    }
  }

  /**
   * Validate reconstruction results
   */
  private static validateReconstruction(
    originalContent: string,
    improvedContent: string,
    appliedImprovements: ImprovementPair[]
  ): void {
    // Check that content length is reasonable
    const lengthRatio = improvedContent.length / originalContent.length;
    if (lengthRatio > 3 || lengthRatio < 0.1) {
      throw new ReconstructionError(
        'Reconstructed content length is unreasonable',
        'validation',
        { originalLength: originalContent.length, improvedLength: improvedContent.length, ratio: lengthRatio }
      );
    }

    // Check that improvements were actually applied
    if (appliedImprovements.length === 0 && originalContent !== improvedContent) {
      throw new ReconstructionError(
        'Content changed but no improvements were recorded',
        'validation',
        { originalContent: originalContent.substring(0, 100), improvedContent: improvedContent.substring(0, 100) }
      );
    }

    // Validate that all improvements are present in the final content
    appliedImprovements.forEach((improvement, index) => {
      if (!improvedContent.includes(improvement.improved)) {
        throw new ReconstructionError(
          `Applied improvement not found in final content: "${improvement.improved}"`,
          'validation',
          { improvement, index, finalContent: improvedContent.substring(0, 200) }
        );
      }
    });
  }

  /**
   * Check if a string is a valid UUID
   */
  private static isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Extract sentences that need improvement from tagged content
   */
  static extractSentencesForImprovement(taggedContent: string): string[] {
    const sentences: string[] = [];
    const taggedSentences = this.parseTaggedContent(taggedContent);

    taggedSentences.forEach(sentence => {
      sentences.push(sentence.originalText);
    });

    return sentences;
  }

  /**
   * Create a summary of reconstruction results
   */
  static createReconstructionSummary(result: ReconstructionResult): {
    success: boolean;
    improvementsApplied: number;
    errorsEncountered: number;
    processingTime: number;
    qualityScore: number;
  } {
    const success = result.errors.length === 0 || result.appliedImprovements.length > 0;
    const qualityScore = result.appliedImprovements.length > 0 
      ? Math.min(1.0, result.appliedImprovements.length / (result.appliedImprovements.length + result.errors.length))
      : 0;

    return {
      success,
      improvementsApplied: result.appliedImprovements.length,
      errorsEncountered: result.errors.length,
      processingTime: result.metadata.processingTime,
      qualityScore,
    };
  }
}

/**
 * Utility functions for content reconstruction
 */
export const contentReconstructionUtils = {
  /**
   * Clean and normalize text content
   */
  normalizeText: (text: string): string => {
    return text
      .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Normalize multiple line breaks to double
      .trim();
  },

  /**
   * Estimate content quality improvement
   */
  calculateImprovementScore: (original: string, improved: string): number => {
    // Simple heuristic based on length and word count changes
    const originalWords = original.split(/\s+/).length;
    const improvedWords = improved.split(/\s+/).length;
    
    // Prefer concise improvements
    const conciseness = originalWords > improvedWords ? 0.2 : 0;
    
    // Base score for any improvement
    const baseScore = original !== improved ? 0.5 : 0;
    
    return Math.min(1.0, baseScore + conciseness);
  },

  /**
   * Validate HTML structure integrity
   */
  validateHtmlStructure: (html: string): boolean => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.innerHTML.length > 0;
    } catch {
      return false;
    }
  },

  /**
   * Extract plain text from HTML while preserving structure
   */
  extractPlainText: (html: string): string => {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent || tempDiv.innerText || '';
    } catch {
      // Fallback: simple tag removal
      return html.replace(/<[^>]*>/g, '');
    }
  },
};