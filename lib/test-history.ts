"use client";

export interface TestRecord {
  id: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correctChars: number;
  incorrectChars: number;
  totalChars: number;
  elapsedTime: number;
  mode: string;
  modeValue: string;
  difficulty: string;
  timestamp: number;
}

const STORAGE_KEY = "typeflow-history";
const MAX_RECORDS = 200;

export function loadHistory(): TestRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return [];
}

export function saveTestResult(record: Omit<TestRecord, "id" | "timestamp">): TestRecord {
  const entry: TestRecord = {
    ...record,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const history = loadHistory();
  history.unshift(entry);
  if (history.length > MAX_RECORDS) history.length = MAX_RECORDS;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
  return entry;
}

export function clearHistory(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getStats(history: TestRecord[]) {
  if (history.length === 0) {
    return {
      totalTests: 0,
      averageWpm: 0,
      bestWpm: 0,
      averageAccuracy: 0,
      currentStreak: 0,
      totalTime: 0,
      averageConsistency: 0,
    };
  }

  const totalTests = history.length;
  const averageWpm = Math.round(
    history.reduce((sum, t) => sum + t.wpm, 0) / totalTests
  );
  const bestWpm = Math.max(...history.map((t) => t.wpm));
  const averageAccuracy = Math.round(
    history.reduce((sum, t) => sum + t.accuracy, 0) / totalTests
  );
  const averageConsistency = Math.round(
    history.reduce((sum, t) => sum + t.consistency, 0) / totalTests
  );
  const totalTime = history.reduce((sum, t) => sum + t.elapsedTime, 0);

  // Calculate streak (days with at least one test)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const dayMs = 86400000;

  for (let d = 0; d < 365; d++) {
    const dayStart = today.getTime() - d * dayMs;
    const dayEnd = dayStart + dayMs;
    const hasTest = history.some(
      (t) => t.timestamp >= dayStart && t.timestamp < dayEnd
    );
    if (hasTest) {
      streak++;
    } else if (d > 0) {
      break;
    }
  }

  return {
    totalTests,
    averageWpm,
    bestWpm,
    averageAccuracy,
    currentStreak: streak,
    totalTime,
    averageConsistency,
  };
}

export function getDailyStats(history: TestRecord[], days = 7) {
  const result: { date: string; wpm: number; accuracy: number; count: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dayStart = date.getTime();
    const dayEnd = dayStart + 86400000;
    const dayTests = history.filter(
      (t) => t.timestamp >= dayStart && t.timestamp < dayEnd
    );

    const label = date.toLocaleDateString("en-US", { weekday: "short" });
    if (dayTests.length > 0) {
      result.push({
        date: label,
        wpm: Math.round(
          dayTests.reduce((s, t) => s + t.wpm, 0) / dayTests.length
        ),
        accuracy: Math.round(
          dayTests.reduce((s, t) => s + t.accuracy, 0) / dayTests.length
        ),
        count: dayTests.length,
      });
    } else {
      result.push({ date: label, wpm: 0, accuracy: 0, count: 0 });
    }
  }
  return result;
}

export function getModeBreakdown(history: TestRecord[]) {
  const counts: Record<string, number> = {};
  for (const t of history) {
    const key = `${t.mode} ${t.modeValue}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  const colors = ["#e2b714", "#ca4754", "#7e2a33", "#646669", "#4d9375", "#6c5ce7"];
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value], i) => ({
      name,
      value,
      color: colors[i % colors.length],
    }));
}
