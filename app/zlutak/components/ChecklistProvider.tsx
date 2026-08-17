'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_CHECKLIST_STATE } from '../lib/checklist-data';

const STORAGE_KEY = 'zlutak-checklist-v1';

type ChecklistState = Record<string, boolean>;

type ChecklistContextValue = {
  checked: ChecklistState;
  toggle: (id: string) => void;
  reset: () => void;
};

const ChecklistContext = createContext<ChecklistContextValue | null>(null);

export function ChecklistProvider({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState<ChecklistState>(DEFAULT_CHECKLIST_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked({ ...DEFAULT_CHECKLIST_STATE, ...JSON.parse(raw) });
    } catch {
      // ignore corrupted storage
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [checked, loaded]);

  const toggle = useCallback((id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const reset = useCallback(() => {
    setChecked(DEFAULT_CHECKLIST_STATE);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <ChecklistContext.Provider value={{ checked, toggle, reset }}>
      {children}
    </ChecklistContext.Provider>
  );
}

export function useChecklist() {
  const ctx = useContext(ChecklistContext);
  if (!ctx) throw new Error('useChecklist musí být použit uvnitř ChecklistProvider');
  return ctx;
}
