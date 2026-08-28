'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

export interface StyleTag {
  value: string;
  label: string;
  color: string;
}

// Style colors mapping
export const STYLE_COLORS: Record<string, string> = {
  realistic: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  anime: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  oil_painting: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  watercolor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  pixel_art: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cyberpunk: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  minimalist: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  sketch: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

// --- Special token definitions ---
// Each special token is a piece of the prompt that appears as a standalone chip.
// When composing the final prompt string for the API all tokens are appended,
// so the AI still receives the exact wording.

const TRANSPARENT_PHRASE = '无背景、transparent';
const TRANSPARENT_REGEX_SRC = TRANSPARENT_PHRASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "比例1:1" "比例16:9" ... "比例自定义"
const RATIO_REGEX_SRC = '比例(?:\\d+:\\d+|自定义)';

// Combined regex — matches any special token in the prompt, used to split them
// out of the plain user text while preserving their order.
const TOKEN_REGEX = new RegExp(`${TRANSPARENT_REGEX_SRC}|${RATIO_REGEX_SRC}`, 'g');

interface ParsedToken {
  /** The literal token text (e.g. "比例1:1" or "透明背景的PNG图像") */
  text: string;
  /** Stable key for React list rendering (index + text) */
  key: string;
}

function parseTokens(raw: string): { tokens: ParsedToken[]; stripped: string } {
  const tokens: ParsedToken[] = [];
  let lastIndex = 0;
  const strippedParts: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(TOKEN_REGEX.source, 'g');
  let i = 0;
  while ((match = regex.exec(raw)) !== null) {
    strippedParts.push(raw.slice(lastIndex, match.index));
    const tokenText = match[0];
    tokens.push({ text: tokenText, key: `${i++}-${tokenText}` });
    lastIndex = regex.lastIndex;
  }
  strippedParts.push(raw.slice(lastIndex));
  return { tokens, stripped: strippedParts.join('') };
}

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  refImageCount: number;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PromptInput({
  value,
  onChange,
  refImageCount,
  onGenerate,
  isGenerating,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const getImageLabel = (index: number) => {
    const labels = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return labels[index] || String(index + 1);
  };

  // Parse value into { special-token list, plain user text }
  const { tokens, stripped: strippedValue } = useMemo(
    () => parseTokens(value),
    [value],
  );

  const isEmpty = !value.trim();

  // When the user edits the textarea, rebuild the final prompt.
  // The user may have typed a special token manually inside the textarea —
  // we detect that, strip it from plain text and fold it into the token list.
  const handleTextareaChange = useCallback(
    (rawUserText: string) => {
      const parsedUserEdit = parseTokens(rawUserText);
      // Existing tokens from the outer value (they were not rendered in the textarea
      // so they should all be preserved) + new tokens the user just typed inline.
      const combinedText =
        parsedUserEdit.stripped +
        [...tokens.map((t) => t.text), ...parsedUserEdit.tokens.map((t) => t.text)].join('');
      onChange(combinedText);
    },
    [tokens, onChange],
  );

  // Remove a single specific chip by its unique key (whole block deleted)
  const handleRemoveToken = useCallback(
    (targetKey: string) => {
      const remaining = tokens.filter((t) => t.key !== targetKey);
      const newValue = strippedValue + remaining.map((t) => t.text).join('');
      onChange(newValue);
    },
    [tokens, strippedValue, onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const refImageIndex = e.dataTransfer.getData('ref-image-index');
      if (refImageIndex === '' || refImageCount === 0) return;

      const index = parseInt(refImageIndex, 10);
      if (isNaN(index) || index >= refImageCount) return;

      const label = `图${getImageLabel(index)}`;
      const textarea = textareaRef.current;
      // Cursor offset relates only to stripped text (tokens are not in textarea)
      const cursorPos = textarea?.selectionStart ?? strippedValue.length;
      const textBefore = strippedValue.substring(0, cursorPos);
      const textAfter = strippedValue.substring(cursorPos);
      const newStripped = `${textBefore}${label}${textAfter}`;
      const newValue = newStripped + tokens.map((t) => t.text).join('');
      onChange(newValue);

      requestAnimationFrame(() => {
        const newPos = cursorPos + label.length;
        textarea?.setSelectionRange(newPos, newPos);
        textarea?.focus();
      });
    },
    [strippedValue, tokens, refImageCount, onChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating) {
        e.preventDefault();
        onGenerate();
      }
    },
    [onGenerate, isGenerating],
  );

  return (
    <div className="relative flex-1 flex flex-col gap-1">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={strippedValue}
          onChange={(e) => handleTextareaChange(e.target.value)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onKeyDown={handleKeyDown}
          placeholder="描述你想要生成的图像..."
          rows={2}
          className={`
            w-full px-1 py-1 pr-7 bg-transparent text-zinc-100 placeholder-zinc-600
            focus:outline-none resize-none text-sm leading-relaxed
            transition-all duration-150
            ${isDragOver ? 'ring-1 ring-blue-500/30 rounded-lg' : ''}
          `}
        />
        {/* Clear text button */}
        <button
          type="button"
          onClick={() => onChange('')}
          disabled={isEmpty}
          className={`
            absolute top-1 right-0.5 w-5 h-5 rounded-md flex items-center justify-center
            transition-all duration-150
            ${isEmpty
              ? 'text-zinc-700 cursor-default'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 cursor-pointer'}
          `}
          title="清空文本"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg">
            <span className="px-3 py-1 rounded-md bg-blue-500/20 text-blue-300 text-sm">
              松开插入参考图引用
            </span>
          </div>
        )}
      </div>

      {/* Special tokens rendered as standalone gray chips (比例 / 透明背景 / ...) */}
      <div
        className={`grid transition-all duration-250 ease-out origin-top ${
          tokens.length > 0 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
        style={{ transitionDuration: tokens.length > 0 ? '280ms' : '180ms' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-wrap gap-1 px-1 py-1 pt-0.5">
            {tokens.map((token) => (
              <span
                key={token.key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 text-[11px] select-none"
              >
                {token.text}
                <button
                  type="button"
                  onClick={() => handleRemoveToken(token.key)}
                  className="ml-0.5 rounded p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
                  title="整块删除"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
