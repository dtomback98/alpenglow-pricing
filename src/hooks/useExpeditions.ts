'use client';

import { useState, useEffect } from 'react';
import { EXPEDITIONS } from '@/lib/constants';

const STORAGE_KEY = 'alpenglow_custom_expeditions';

// Insert custom expeditions just before 'Other'
function buildList(custom: string[]): string[] {
  const otherIdx = EXPEDITIONS.indexOf('Other');
  const base = otherIdx >= 0 ? EXPEDITIONS.slice(0, otherIdx) : EXPEDITIONS;
  return [...base, ...custom, 'Other'];
}

export function useExpeditions() {
  const [custom, setCustom] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCustom(JSON.parse(stored));
    } catch {}
  }, []);

  const expeditions = buildList(custom);

  const addExpedition = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed || expeditions.includes(trimmed)) return false;
    const next = [...custom, trimmed];
    setCustom(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    return true;
  };

  return { expeditions, addExpedition };
}
