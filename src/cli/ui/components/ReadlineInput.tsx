/**
 * ReadlineInput - Enhanced text input with readline-style keybindings
 * 
 * Supports common terminal shortcuts:
 * - Ctrl+A: Go to beginning of line
 * - Ctrl+E: Go to end of line
 * - Ctrl+U: Delete from cursor to beginning of line
 * - Ctrl+K: Delete from cursor to end of line
 * - Ctrl+W: Delete word backward
 * - Alt+B / Ctrl+Left: Move cursor back one word
 * - Alt+F / Ctrl+Right: Move cursor forward one word
 * - Ctrl+B / Left: Move cursor back one character
 * - Ctrl+F / Right: Move cursor forward one character
 * - Alt+Backspace: Delete word backward (same as Ctrl+W)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Text, useInput } from 'ink';
import { colors } from '../theme';

interface ReadlineInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
  showCursor?: boolean;
}

export const ReadlineInput: React.FC<ReadlineInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  focus = true,
  showCursor = true,
}) => {
  const [cursorPosition, setCursorPosition] = useState(value.length);

  // Keep cursor at end when value changes externally
  useEffect(() => {
    if (cursorPosition > value.length) {
      setCursorPosition(value.length);
    }
  }, [value]);

  // Find word boundary moving backward
  const findPrevWordBoundary = useCallback((text: string, pos: number): number => {
    if (pos === 0) return 0;
    let i = pos - 1;
    // Skip any spaces
    while (i > 0 && text[i] === ' ') i--;
    // Skip word characters
    while (i > 0 && text[i - 1] !== ' ') i--;
    return i;
  }, []);

  // Find word boundary moving forward
  const findNextWordBoundary = useCallback((text: string, pos: number): number => {
    if (pos >= text.length) return text.length;
    let i = pos;
    // Skip current word
    while (i < text.length && text[i] !== ' ') i++;
    // Skip any spaces
    while (i < text.length && text[i] === ' ') i++;
    return i;
  }, []);

  useInput((input, key) => {
    if (!focus) return;

    // Submit on Enter
    if (key.return) {
      onSubmit?.(value);
      return;
    }

    // Ctrl+A: Go to beginning of line
    if (key.ctrl && input === 'a') {
      setCursorPosition(0);
      return;
    }

    // Ctrl+E: Go to end of line
    if (key.ctrl && input === 'e') {
      setCursorPosition(value.length);
      return;
    }

    // Ctrl+U: Delete from cursor to beginning of line
    if (key.ctrl && input === 'u') {
      onChange(value.slice(cursorPosition));
      setCursorPosition(0);
      return;
    }

    // Ctrl+K: Delete from cursor to end of line
    if (key.ctrl && input === 'k') {
      onChange(value.slice(0, cursorPosition));
      return;
    }

    // Ctrl+W or Alt+Backspace: Delete word backward
    if ((key.ctrl && input === 'w') || (key.meta && key.backspace)) {
      const wordStart = findPrevWordBoundary(value, cursorPosition);
      onChange(value.slice(0, wordStart) + value.slice(cursorPosition));
      setCursorPosition(wordStart);
      return;
    }

    // Alt+B: Move cursor back one word
    if (key.meta && input === 'b') {
      setCursorPosition(findPrevWordBoundary(value, cursorPosition));
      return;
    }

    // Alt+F: Move cursor forward one word
    if (key.meta && input === 'f') {
      setCursorPosition(findNextWordBoundary(value, cursorPosition));
      return;
    }

    // Ctrl+B or Left Arrow: Move cursor back one character
    if ((key.ctrl && input === 'b') || key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
      return;
    }

    // Ctrl+F or Right Arrow: Move cursor forward one character
    if ((key.ctrl && input === 'f') || key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1));
      return;
    }

    // Backspace: Delete character before cursor
    if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        onChange(value.slice(0, cursorPosition - 1) + value.slice(cursorPosition));
        setCursorPosition(cursorPosition - 1);
      }
      return;
    }

    // Delete key (Ctrl+D when not empty): Delete character at cursor
    if (key.ctrl && input === 'd' && value.length > 0) {
      if (cursorPosition < value.length) {
        onChange(value.slice(0, cursorPosition) + value.slice(cursorPosition + 1));
      }
      return;
    }

    // Home key
    if (key.ctrl && input === 'a') {
      setCursorPosition(0);
      return;
    }

    // End key
    if (key.ctrl && input === 'e') {
      setCursorPosition(value.length);
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta && input.length === 1 && input >= ' ') {
      onChange(value.slice(0, cursorPosition) + input + value.slice(cursorPosition));
      setCursorPosition(cursorPosition + 1);
    }
  }, { isActive: focus });

  // Render with cursor
  const displayValue = value || placeholder;
  const isPlaceholder = !value && placeholder;

  if (!showCursor || !focus) {
    return (
      <Text color={isPlaceholder ? colors.textDim : colors.text}>
        {displayValue}
      </Text>
    );
  }

  // Split text at cursor position for rendering
  const beforeCursor = value.slice(0, cursorPosition);
  const cursorChar = value[cursorPosition] || ' ';
  const afterCursor = value.slice(cursorPosition + 1);

  if (isPlaceholder) {
    return (
      <>
        <Text backgroundColor={colors.accent} color={colors.background}>{placeholder[0] || ' '}</Text>
        <Text color={colors.textDim}>{placeholder.slice(1)}</Text>
      </>
    );
  }

  return (
    <>
      <Text color={colors.text}>{beforeCursor}</Text>
      <Text backgroundColor={colors.accent} color={colors.background}>{cursorChar}</Text>
      <Text color={colors.text}>{afterCursor}</Text>
    </>
  );
};

export default ReadlineInput;
