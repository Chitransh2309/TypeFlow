"use client";

import React from "react";

import { useEffect, useRef, type RefObject, useState } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/settings-context";

interface CharState {
  char: string;
  state: "correct" | "incorrect" | "current" | "upcoming";
}

interface TypingAreaProps {
  words: string[];
  charStates: CharState[][];
  currentWordIndex: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClick: () => void;
  isActive: boolean;
  fontSize?: "small" | "medium" | "large";
}

export function TypingArea({
  words,
  charStates,
  currentWordIndex,
  inputRef,
  onKeyDown,
  onClick,
  isActive,
  fontSize = "medium",
}: TypingAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);
  const { settings } = useSettings();
  const [caretFaded, setCaretFaded] = useState(false);

  // Auto-scroll to keep current word visible
  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeWord = activeWordRef.current;

      // Check visibility
      const checkVisibility = () => {
        const containerRect = container.getBoundingClientRect();
        const wordRect = activeWord.getBoundingClientRect();

        const isOutOfView =
          wordRect.top < containerRect.top ||
          wordRect.bottom > containerRect.bottom;

        // Check if word is scrolled above the visible area (past the top)
        // Add small buffer (5px) to handle edge cases
        const isScrolledAbove = wordRect.bottom < containerRect.top - 5;
        setCaretFaded(isScrolledAbove);

        if (isOutOfView) {
          activeWord.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };

      // Check immediately
      checkVisibility();

      // Re-check after scroll animation completes
      const timer = setTimeout(checkVisibility, 500);
      return () => clearTimeout(timer);
    }
  }, [currentWordIndex]);

  // Also check visibility on scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !activeWordRef.current) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const wordRect = activeWordRef.current!.getBoundingClientRect();
      const isScrolledAbove = wordRect.bottom < containerRect.top - 5;
      setCaretFaded(isScrolledAbove);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  const fontSizeClass =
    fontSize === "small"
      ? "text-xl md:text-2xl"
      : fontSize === "large"
        ? "text-3xl md:text-4xl"
        : "text-2xl md:text-3xl";

  return (
    <div className="relative cursor-text" onClick={onClick}>
      {/* Hidden input for capturing keystrokes */}
      <input
        ref={inputRef}
        type="text"
        className="absolute opacity-0 w-0 h-0"
        onKeyDown={onKeyDown}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />

      {/* Text display */}
      <div
        ref={containerRef}
        className={cn(
          "relative font-mono leading-relaxed max-h-[200px] overflow-hidden",
          "select-none transition-opacity duration-200",
          fontSizeClass,
          !isActive && words.length > 0 && "blur-[2px] opacity-80"
        )}
      >
        {/* Gradient overlays for scroll indication */}
        {/* <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" /> */}
        {/* <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" /> */}

        {/* Words */}
        <div className="relative px-4 py-8">
          {charStates.map((wordChars, wordIdx) => (
            <span
              key={wordIdx}
              ref={wordIdx === currentWordIndex ? activeWordRef : undefined}
              className={cn(
                "inline-block mr-3 mb-2",
                wordIdx === currentWordIndex && "relative"
              )}
            >
              {wordChars.map((charState, charIdx) => (
                <span
                  key={charIdx}
                  className={cn(
                    "typing-char inline-block",
                    charState.state === "correct" && "typing-correct",
                    charState.state === "incorrect" && "typing-incorrect",
                    charState.state === "current" &&
                      `typing-current caret-${settings.caretStyle}`,
                    charState.state === "current" &&
                      caretFaded &&
                      "caret-faded",
                    charState.state === "upcoming" && "typing-upcoming"
                  )}
                >
                  {charState.char}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Click to focus overlay */}
      {!isActive && words.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground animate-pulse">
            <p className="text-lg font-medium">Click here or start typing</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {words.length === 0 && (
        <div className="flex items-center justify-center h-[200px]">
          <div className="text-muted-foreground animate-pulse">
            Loading...
          </div>
        </div>
      )}
    </div>
  );
}
