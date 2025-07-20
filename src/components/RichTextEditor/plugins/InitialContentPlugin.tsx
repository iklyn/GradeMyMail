import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import { $generateNodesFromDOM } from '@lexical/html';

interface InitialContentPluginProps {
  initialValue?: string;
}

const InitialContentPlugin: React.FC<InitialContentPluginProps> = ({ initialValue }) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (initialValue && initialValue.trim()) {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialValue, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.append(...nodes);
      });
    }
  }, [editor, initialValue]);

  return null;
};

export default InitialContentPlugin;