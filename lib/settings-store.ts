"use client";

import { createContext, useContext } from "react";

export interface UserSettings {
  soundEnabled: boolean;
  soundVolume: number;
  keyboardLayout: "qwerty" | "dvorak" | "colemak" | "azerty";
  fontSize: "small" | "medium" | "large";
  smoothCaret: boolean;
  showLiveWpm: boolean;
  showProgressBar: boolean;
  defaultMode: "time" | "words" | "quote";
  defaultTimeLimit: number;
  defaultWordCount: number;
  defaultDifficulty: "easy" | "medium" | "hard";
  caretStyle: "line" | "block" | "underline";
}

export const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  soundVolume: 50,
  keyboardLayout: "qwerty",
  fontSize: "medium",
  smoothCaret: true,
  showLiveWpm: true,
  showProgressBar: true,
  defaultMode: "time",
  defaultTimeLimit: 30,
  defaultWordCount: 50,
  defaultDifficulty: "easy",
  caretStyle: "line",
};

const STORAGE_KEY = "typeflow-settings";

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
