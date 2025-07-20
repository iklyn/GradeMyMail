import { useRef, useState } from 'react';
import RichTextEditor from './RichTextEditor/RichTextEditor';
import type { RichTextEditorRef } from './RichTextEditor/RichTextEditor';
import type { ContentValidationResult } from '../utils/sanitization';

export default function SecurityDemo() {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [validationResult, setValidationResult] = useState<ContentValidationResult | null>(null);
  const [pasteWarnings, setPasteWarnings] = useState<string[]>([]);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handleValidationChange = (result: ContentValidationResult) => {
    setValidationResult(result);
  };

  const handlePasteWarning = (warnings: string[]) => {
    setPasteWarnings(warnings);
    setTimeout(() => setPasteWarnings([]), 5000);
  };

  const handlePasteError = (error: string) => {
    setPasteError(error);
    setTimeout(() => setPasteError(null), 5000);
  };

  const insertMaliciousContent = () => {
    if (editorRef.current) {
      const maliciousHTML = `
        <p>Normal content</p>
        <script>alert('This should be blocked!');</script>
        <div onclick="alert('Event handler should be removed')">Click me</div>
        <a href="javascript:alert('Dangerous link')">Dangerous Link</a>
        <a href="https://example.com">Safe Link</a>
      `;
      editorRef.current.setContent(maliciousHTML);
    }
  };

  const getContent = () => {
    if (editorRef.current) {
      const html = editorRef.current.getHTML();
      const text = editorRef.current.getPlainText();
      console.log('HTML:', html);
      console.log('Text:', text);
      alert('Check console for content (HTML should be sanitized)');
    }
  };

  const saveNow = () => {
    if (editorRef.current) {
      editorRef.current.saveNow();
      alert('Content saved immediately!');
    }
  };

  const restoreAutoSave = () => {
    if (editorRef.current) {
      const restored = editorRef.current.restoreAutoSave();
      if (restored) {
        alert('Auto-saved content restored!');
      } else {
        alert('No auto-saved content found.');
      }
    }
  };

  const clearAutoSave = () => {
    if (editorRef.current) {
      editorRef.current.clearAutoSave();
      alert('Auto-saved content cleared!');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Rich Text Editor Security Demo</h1>
        
        <div className="mb-4 space-x-2">
          <button
            onClick={insertMaliciousContent}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Insert Malicious Content
          </button>
          <button
            onClick={getContent}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Get Content (Check Console)
          </button>
          <button
            onClick={saveNow}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Save Now
          </button>
          <button
            onClick={restoreAutoSave}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Restore Auto-Save
          </button>
          <button
            onClick={clearAutoSave}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Auto-Save
          </button>
        </div>

        <RichTextEditor
          ref={editorRef}
          placeholder="Try pasting content with scripts, event handlers, or dangerous links..."
          enableAutoSave={true}
          autoSaveKey="security-demo"
          showValidation={true}
          onValidationChange={handleValidationChange}
          onPasteWarning={handlePasteWarning}
          onPasteError={handlePasteError}
          className="mb-4"
        />

        {/* Display alerts */}
        {pasteError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            <strong>Paste Error:</strong> {pasteError}
          </div>
        )}

        {pasteWarnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
            <strong>Paste Warnings:</strong>
            <ul className="list-disc list-inside mt-1">
              {pasteWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Validation info */}
        {validationResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Content Validation</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Characters:</span> {validationResult.stats.characterCount.toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Words:</span> {validationResult.stats.wordCount.toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Size:</span> {(validationResult.stats.htmlSize / 1024).toFixed(1)}KB
              </div>
            </div>
            
            {validationResult.errors.length > 0 && (
              <div className="mt-2">
                <span className="font-medium text-red-600">Errors:</span>
                <ul className="list-disc list-inside text-red-600 text-sm">
                  {validationResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validationResult.warnings.length > 0 && (
              <div className="mt-2">
                <span className="font-medium text-yellow-600">Warnings:</span>
                <ul className="list-disc list-inside text-yellow-600 text-sm">
                  {validationResult.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-2">Security Features Demonstrated:</h3>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><strong>XSS Prevention:</strong> Script tags and dangerous attributes are automatically removed</li>
            <li><strong>Smart Paste:</strong> Pasted content is sanitized and warnings are shown for suspicious content</li>
            <li><strong>Content Validation:</strong> Real-time validation with character/word limits and size constraints</li>
            <li><strong>Auto-Save:</strong> Content is automatically saved to localStorage with debouncing</li>
            <li><strong>Safe Output:</strong> All content retrieved from the editor is sanitized</li>
          </ul>
        </div>
      </div>
    </div>
  );
}