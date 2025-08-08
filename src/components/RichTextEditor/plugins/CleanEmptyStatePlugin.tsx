import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode } from 'lexical';

/**
 * Plugin to ensure clean empty state without HTML markup showing as text
 */
const CleanEmptyStatePlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Initialize with clean empty state
    editor.update(() => {
      const root = $getRoot();
      const children = root.getChildren();
      
      // If root is empty or has problematic content, create clean paragraph
      if (children.length === 0) {
        const paragraph = $createParagraphNode();
        root.append(paragraph);
      } else {
        // Check for any text nodes that contain HTML markup
        children.forEach(child => {
          const textContent = child.getTextContent();
          if (textContent.includes('<') && textContent.includes('>')) {
            // Remove nodes with HTML markup
            child.remove();
            // Add clean paragraph if root becomes empty
            if (root.getChildren().length === 0) {
              const paragraph = $createParagraphNode();
              root.append(paragraph);
            }
          }
        });
      }
    });

    // Listen for editor updates to clean up any HTML markup that appears as text
    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        
        children.forEach(child => {
          const textContent = child.getTextContent();
          // If we find HTML markup as text content, clean it up
          if (textContent.includes('<p class="editor-paragraph">') || 
              textContent.includes('<br>') || 
              textContent.includes('</p>')) {
            
            editor.update(() => {
              child.remove();
              // Ensure we have at least one clean paragraph
              if (root.getChildren().length === 0) {
                const paragraph = $createParagraphNode();
                root.append(paragraph);
              }
            });
          }
        });
      });
    });

    return removeListener;
  }, [editor]);

  return null;
};

export default CleanEmptyStatePlugin;