import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import RichTextEditor from '../RichTextEditor';

describe('RichTextEditor', () => {
  it('renders with placeholder text', () => {
    const placeholder = 'Test placeholder';
    render(<RichTextEditor placeholder={placeholder} />);
    
    // Check if the editor container is rendered
    const editor = screen.getByRole('textbox');
    expect(editor).toBeInTheDocument();
  });

  it('renders toolbar buttons', () => {
    render(<RichTextEditor />);
    
    // Check for some key toolbar buttons
    expect(screen.getByTitle(/Bold/)).toBeInTheDocument();
    expect(screen.getByTitle(/Italic/)).toBeInTheDocument();
    expect(screen.getByTitle(/Underline/)).toBeInTheDocument();
  });

  it('can be set to read-only mode', () => {
    render(<RichTextEditor readOnly />);
    
    // In read-only mode, toolbar should not be present
    expect(screen.queryByTitle(/Bold/)).not.toBeInTheDocument();
  });
});