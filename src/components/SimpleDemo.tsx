import React, { useRef, useState } from 'react';
import RichTextEditor from './RichTextEditor/RichTextEditor';
import type { RichTextEditorRef } from './RichTextEditor/RichTextEditor';

const SimpleDemo: React.FC = () => {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [content, setContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');

  const handleChange = (html: string, text: string) => {
    setContent(text);
    setHtmlContent(html);
  };

  const handleGetContent = () => {
    if (editorRef.current) {
      const html = editorRef.current.getHTML();
      const text = editorRef.current.getPlainText();
      alert(`HTML: ${html}\n\nText: ${text}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Rich Text Editor Demo</h1>
      
      <div className="mb-4">
        <button
          onClick={handleGetContent}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Get Content
        </button>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <RichTextEditor
          ref={editorRef}
          placeholder="Start typing your email content here..."
          onChange={handleChange}
          autoFocus
        />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Plain Text:</h3>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40">
            {content || 'No content yet...'}
          </pre>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">HTML:</h3>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40">
            {htmlContent || 'No content yet...'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SimpleDemo;