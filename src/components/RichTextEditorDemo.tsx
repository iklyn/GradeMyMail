import React, { useRef, useState, useCallback } from 'react';
import RichTextEditor from './RichTextEditor/RichTextEditor';
import type { RichTextEditorRef } from './RichTextEditor/RichTextEditor';
import type { ContentValidationResult } from '../utils/sanitization';

const RichTextEditorDemo: React.FC = () => {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [content, setContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [validationResult, setValidationResult] = useState<ContentValidationResult | null>(null);
  const [spellingIssues, setSpellingIssues] = useState<string[]>([]);
  const [grammarIssues, setGrammarIssues] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [advancedFeaturesEnabled, setAdvancedFeaturesEnabled] = useState(true);

  const handleChange = (html: string, text: string) => {
    setContent(text);
    setHtmlContent(html);
  };

  const handleValidationChange = useCallback((result: ContentValidationResult) => {
    setValidationResult(result);
  }, []);



  const handleSpellingSuggestion = useCallback((word: string, suggestions: string[]) => {
    const suggestionText = suggestions.length > 0 
      ? `"${word}" -> ${suggestions.join(', ')}` 
      : `"${word}" (no suggestions)`;
    
    setSpellingIssues(prev => {
      // Avoid duplicates
      if (!prev.includes(suggestionText)) {
        return [...prev.slice(-9), suggestionText]; // Keep last 10 issues
      }
      return prev;
    });
  }, []);

  const handleGrammarIssue = useCallback((issues: string[]) => {
    setGrammarIssues(prev => {
      const newIssues = issues.filter(issue => !prev.includes(issue));
      return [...prev.slice(-7), ...newIssues].slice(-10); // Keep last 10 issues
    });
  }, []);

  const handleAccessibilityAnnouncement = useCallback((message: string) => {
    setAnnouncements(prev => [...prev.slice(-4), message]); // Keep last 5 announcements
  }, []);

  const handleGetContent = () => {
    if (editorRef.current) {
      const html = editorRef.current.getHTML();
      const text = editorRef.current.getPlainText();
      console.log('HTML:', html);
      console.log('Text:', text);
      alert(`HTML: ${html}\n\nText: ${text}`);
    }
  };

  const handleSetContent = () => {
    if (editorRef.current) {
      const sampleContent = '<h1>Sample Heading</h1><p>This is a <strong>bold</strong> and <em>italic</em> text with a <a href="https://example.com">link</a>.</p><ul><li>First item</li><li>Second item</li></ul>';
      editorRef.current.setContent(sampleContent);
    }
  };

  const handleClear = () => {
    if (editorRef.current) {
      editorRef.current.clear();
    }
  };

  const handleFocus = () => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const handleTestSpelling = () => {
    if (editorRef.current) {
      const testContent = 'Teh quick brown fox recieved seperate accomodation. I definately beleive this is neccessary for begining the calender';
      editorRef.current.setContent(testContent);
    }
  };

  const handleTestGrammar = () => {
    if (editorRef.current) {
      const testContent = 'this is a test  sentence with double spaces. another sentence without punctuation\nthis this is a repeated word issue';
      editorRef.current.setContent(testContent);
    }
  };



  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Rich Text Editor Demo</h1>
      
      <div className="mb-4 space-x-2 flex flex-wrap gap-2">
        <button
          onClick={handleGetContent}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Get Content
        </button>
        <button
          onClick={handleSetContent}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Set Sample Content
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Clear
        </button>
        <button
          onClick={handleFocus}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Focus
        </button>
        <button
          onClick={() => {
            setSpellingIssues([]);
            setGrammarIssues([]);
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Clear Issues
        </button>
        <button
          onClick={handleTestSpelling}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Test Spell Check
        </button>
        <button
          onClick={handleTestGrammar}
          className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600"
        >
          Test Grammar Check
        </button>
      </div>

      <div className="mb-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={advancedFeaturesEnabled}
            onChange={(e) => setAdvancedFeaturesEnabled(e.target.checked)}
            className="rounded"
          />
          <span>Enable Advanced Features (Spell Check, Grammar Check, Accessibility)</span>
        </label>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <RichTextEditor
          ref={editorRef}
          placeholder="Start writing your newsletter content here... Try typing misspelled words like 'teh', 'recieve', 'seperate' to see spell check in action!"
          onChange={handleChange}
          onValidationChange={handleValidationChange}
          onSpellingSuggestion={handleSpellingSuggestion}
          onGrammarIssue={handleGrammarIssue}
          onAccessibilityAnnouncement={handleAccessibilityAnnouncement}
          enableSpellCheck={advancedFeaturesEnabled}
          enableGrammarCheck={advancedFeaturesEnabled}
          enableAccessibility={advancedFeaturesEnabled}
          customDictionary={['lexical', 'typescript', 'javascript']}
          autoFocus
        />
      </div>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Plain Text Output:</h3>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40">
            {content || 'No content yet...'}
          </pre>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">HTML Output:</h3>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40">
            {htmlContent || 'No content yet...'}
          </pre>
        </div>
      </div>

      {/* Newsletter Writing Features Status */}
      {advancedFeaturesEnabled && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Content Validation */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Content Stats:</h3>
            <div className="bg-gray-50 p-3 rounded text-sm max-h-32 overflow-auto">
              {validationResult ? (
                <div className="space-y-1">
                  <div>Words: {validationResult.stats.wordCount}</div>
                  <div>Characters: {validationResult.stats.characterCount}</div>
                  <div>Size: {(validationResult.stats.htmlSize / 1024).toFixed(1)}KB</div>
                  {validationResult.errors.length > 0 && (
                    <div className="text-red-600">
                      Errors: {validationResult.errors.length}
                    </div>
                  )}
                  {validationResult.warnings.length > 0 && (
                    <div className="text-amber-600">
                      Warnings: {validationResult.warnings.length}
                    </div>
                  )}
                </div>
              ) : (
                'No content stats yet...'
              )}
            </div>
          </div>

          {/* Spelling Issues */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Spelling Suggestions:</h3>
            <div className="bg-gray-50 p-3 rounded text-sm max-h-32 overflow-auto">
              {spellingIssues.length > 0 ? (
                <ul className="space-y-1">
                  {spellingIssues.map((issue, index) => (
                    <li key={index} className="text-orange-600 text-xs">
                      {issue}
                    </li>
                  ))}
                </ul>
              ) : (
                'No spelling issues detected...'
              )}
            </div>
          </div>

          {/* Grammar Issues */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Grammar Issues:</h3>
            <div className="bg-gray-50 p-3 rounded text-sm max-h-32 overflow-auto">
              {grammarIssues.length > 0 ? (
                <ul className="space-y-1">
                  {grammarIssues.map((issue, index) => (
                    <li key={index} className="text-purple-600 text-xs">
                      {issue}
                    </li>
                  ))}
                </ul>
              ) : (
                'No grammar issues detected...'
              )}
            </div>
          </div>

          {/* Accessibility Announcements */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Accessibility Log:</h3>
            <div className="bg-gray-50 p-3 rounded text-sm max-h-32 overflow-auto">
              {announcements.length > 0 ? (
                <ul className="space-y-1">
                  {announcements.map((announcement, index) => (
                    <li key={index} className="text-blue-600 text-xs">
                      {announcement}
                    </li>
                  ))}
                </ul>
              ) : (
                'No accessibility announcements yet...'
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Keyboard Shortcuts:</h3>
          <div className="bg-gray-50 p-4 rounded text-sm">
            <ul className="space-y-1">
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + B</kbd> - Bold</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + I</kbd> - Italic</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + U</kbd> - Underline</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + K</kbd> - Add Link</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + E</kbd> - Code</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + D</kbd> - Strikethrough</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + Shift + 1/2/3</kbd> - Headings</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + Shift + 7</kbd> - Numbered List</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + Shift + 8</kbd> - Bullet List</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + Z</kbd> - Undo</li>
              <li><kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl/Cmd + Y</kbd> - Redo</li>
            </ul>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Newsletter Writing Features:</h3>
          <div className="bg-blue-50 p-4 rounded text-sm">
            <ul className="space-y-2">
              <li className="flex items-start space-x-2">
                <span className="text-green-600">✓</span>
                <div>
                  <strong>Spell Check:</strong> Automatic detection of common misspellings
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-purple-600">📝</span>
                <div>
                  <strong>Grammar Check:</strong> Writing style and grammar suggestions
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-orange-600">♿</span>
                <div>
                  <strong>Accessibility:</strong> Screen reader support and keyboard navigation
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-red-600">📱</span>
                <div>
                  <strong>Responsive:</strong> Optimized for mobile and touch devices
                </div>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-600">🔒</span>
                <div>
                  <strong>Security:</strong> Content sanitization and validation
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Try These Newsletter Writing Features:</h3>
        <div className="bg-yellow-50 p-4 rounded text-sm">
          <ul className="space-y-1">
            <li>• Click "Test Spell Check" to see spelling suggestions</li>
            <li>• Click "Test Grammar Check" to see grammar and style issues</li>
            <li>• Type misspelled words like "teh", "recieve", "seperate"</li>
            <li>• Type sentences without punctuation to trigger grammar check</li>
            <li>• Use keyboard shortcuts for faster formatting (Ctrl+B, Ctrl+I, etc.)</li>
            <li>• Use Tab and Shift+Tab to navigate toolbar buttons</li>
            <li>• Try the editor on mobile for responsive design</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RichTextEditorDemo;