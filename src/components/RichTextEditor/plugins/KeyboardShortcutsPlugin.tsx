import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  KEY_MODIFIER_COMMAND,
  COMMAND_PRIORITY_NORMAL,
} from 'lexical';
import { FORMAT_TEXT_COMMAND } from 'lexical';
import { $createHeadingNode } from '@lexical/rich-text';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from '@lexical/list';
import { $findMatchingParent } from '@lexical/utils';

const KeyboardShortcutsPlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeListener = editor.registerCommand(
      KEY_MODIFIER_COMMAND,
      (payload) => {
        const event: KeyboardEvent = payload;
        const { code, ctrlKey, metaKey, shiftKey } = event;

        // Check for Ctrl/Cmd key (cross-platform)
        const isModifierPressed = ctrlKey || metaKey;

        if (isModifierPressed) {
          switch (code) {
            case 'KeyB': {
              // Bold (Ctrl/Cmd + B)
              event.preventDefault();
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
              return true;
            }
            case 'KeyI': {
              // Italic (Ctrl/Cmd + I)
              event.preventDefault();
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
              return true;
            }
            case 'KeyU': {
              // Underline (Ctrl/Cmd + U)
              event.preventDefault();
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
              return true;
            }
            case 'KeyK': {
              // Link (Ctrl/Cmd + K)
              event.preventDefault();
              const url = window.prompt('Enter URL:');
              if (url) {
                editor.update(() => {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    // Import TOGGLE_LINK_COMMAND dynamically to avoid circular dependency
                    import('@lexical/link').then(({ TOGGLE_LINK_COMMAND }) => {
                      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
                    });
                  }
                });
              }
              return true;
            }
            case 'Digit1': {
              // Heading 1 (Ctrl/Cmd + 1)
              if (shiftKey) {
                event.preventDefault();
                editor.update(() => {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    const anchorNode = selection.anchor.getNode();
                    const element =
                      anchorNode.getKey() === 'root'
                        ? anchorNode
                        : $findMatchingParent(anchorNode, (e) => {
                            const parent = e.getParent();
                            return parent !== null && parent.getKey() === 'root';
                          });

                    if (element !== null) {
                      const headingNode = $createHeadingNode('h1');
                      element.replace(headingNode, true);
                    }
                  }
                });
                return true;
              }
              break;
            }
            case 'Digit2': {
              // Heading 2 (Ctrl/Cmd + 2)
              if (shiftKey) {
                event.preventDefault();
                editor.update(() => {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    const anchorNode = selection.anchor.getNode();
                    const element =
                      anchorNode.getKey() === 'root'
                        ? anchorNode
                        : $findMatchingParent(anchorNode, (e) => {
                            const parent = e.getParent();
                            return parent !== null && parent.getKey() === 'root';
                          });

                    if (element !== null) {
                      const headingNode = $createHeadingNode('h2');
                      element.replace(headingNode, true);
                    }
                  }
                });
                return true;
              }
              break;
            }
            case 'Digit3': {
              // Heading 3 (Ctrl/Cmd + 3)
              if (shiftKey) {
                event.preventDefault();
                editor.update(() => {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    const anchorNode = selection.anchor.getNode();
                    const element =
                      anchorNode.getKey() === 'root'
                        ? anchorNode
                        : $findMatchingParent(anchorNode, (e) => {
                            const parent = e.getParent();
                            return parent !== null && parent.getKey() === 'root';
                          });

                    if (element !== null) {
                      const headingNode = $createHeadingNode('h3');
                      element.replace(headingNode, true);
                    }
                  }
                });
                return true;
              }
              break;
            }
            case 'Digit8': {
              // Bullet List (Ctrl/Cmd + Shift + 8)
              if (shiftKey) {
                event.preventDefault();
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
                return true;
              }
              break;
            }
            case 'Digit7': {
              // Numbered List (Ctrl/Cmd + Shift + 7)
              if (shiftKey) {
                event.preventDefault();
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
                return true;
              }
              break;
            }
            case 'KeyE': {
              // Code (Ctrl/Cmd + E)
              event.preventDefault();
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
              return true;
            }
            case 'KeyD': {
              // Strikethrough (Ctrl/Cmd + D)
              event.preventDefault();
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
              return true;
            }
          }
        }

        return false;
      },
      COMMAND_PRIORITY_NORMAL
    );

    return removeListener;
  }, [editor]);

  return null;
};

export default KeyboardShortcutsPlugin;