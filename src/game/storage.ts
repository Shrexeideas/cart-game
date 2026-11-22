import type { LevelBestRecord } from './types';

const STORAGE_KEY = 'cart_chaos_records_v1';

export type RecordsMap = Record<number, LevelBestRecord>;

export function loadRecords(): RecordsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RecordsMap;
  } catch {
    return {};
  }
}

export function saveLevelRecord(
  levelId: number,
  stars: number,
  score: number,
  accuracy: number,
  time: number
): RecordsMap {
  const current = loadRecords();
  const prev = current[levelId];
  const updated: LevelBestRecord = {
    bestStars: Math.max(prev?.bestStars ?? 0, stars),
    bestScore: Math.max(prev?.bestScore ?? 0, score),
    bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
    bestTime: prev ? Math.min(prev.bestTime, time) : time,
  };
  const next = { ...current, [levelId]: updated };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function getBestOverallScore(records: RecordsMap): number {
  return Object.values(records).reduce((sum, r) => sum + r.bestScore, 0);
}

export function getTotalStars(records: RecordsMap): number {
  return Object.values(records).reduce((sum, r) => sum + r.bestStars, 0);
}
