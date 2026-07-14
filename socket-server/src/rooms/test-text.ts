import { getRandomWords } from "../../../lib/words-data";
import type { RoomSettings } from "../../../lib/models/room";

// Assumed floor WPM used to size the word buffer for time-mode contests, so a
// fast typist never runs out of text before the timer expires.
const ASSUMED_MIN_WPM = 30;

export function generateTestText(settings: RoomSettings): string {
  const rawDifficulty = settings.difficulty || "normal";
  const difficulty = (rawDifficulty === "normal" ? "medium" : rawDifficulty) as
    | "easy"
    | "medium"
    | "hard";

  let words: string[];
  if (settings.mode === "words") {
    const count = settings.wordCount || 50;
    words = getRandomWords(count, difficulty);
  } else {
    const timeLimit = settings.timeLimit || 60;
    const estimatedWords = Math.ceil((timeLimit / 60) * ASSUMED_MIN_WPM * 3); // generous margin
    words = getRandomWords(Math.max(estimatedWords, 40), difficulty);
  }

  return words.join(" ");
}
