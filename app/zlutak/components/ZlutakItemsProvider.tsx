'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ALL_ITEM_IDS, defaultZlutakItemState, type ZlutakItemState } from '../lib/zlutak-items';
import { CHECKLIST_STORAGE_KEY } from './ChecklistProvider';

const STORAGE_KEY = 'zlutak-items-v1';

type ItemsState = Record<string, ZlutakItemState>;

type ZlutakItemsContextValue = {
  items: ItemsState;
  loaded: boolean;
  updateItem: (id: string, patch: Partial<Omit<ZlutakItemState, 'updatedAt'>>) => void;
};

const ZlutakItemsContext = createContext<ZlutakItemsContextValue | null>(null);

function initialItemsState(): ItemsState {
  return Object.fromEntries(ALL_ITEM_IDS.map((id) => [id, defaultZlutakItemState(id)]));
}

export function ZlutakItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemsState>(initialItemsState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const next = initialItemsState();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const stored: Partial<Record<string, ZlutakItemState>> = raw ? JSON.parse(raw) : {};

      // Jednorázová migrace: staré zaškrtnutí v legacy ChecklistProvider (localStorage,
      // stejná id jako vozidla-0 apod.) → "Vyřešené komplet", pokud pro danou položku
      // ještě neexistuje záznam v novém úložišti.
      let legacyChecked: Record<string, boolean> = {};
      try {
        const legacyRaw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
        if (legacyRaw) legacyChecked = JSON.parse(legacyRaw);
      } catch {
        // ignore corrupted legacy storage
      }

      for (const id of ALL_ITEM_IDS) {
        if (stored[id]) {
          next[id] = { ...next[id], ...stored[id] };
        } else if (legacyChecked[id]) {
          next[id] = { ...next[id], resolved: true };
        }
      }
    } catch {
      // ignore corrupted storage, keep defaults
    }
    setItems(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [items, loaded]);

  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<ZlutakItemState, 'updatedAt'>>) => {
      setItems((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...patch, updatedAt: new Date().toISOString() },
      }));
    },
    [],
  );

  return (
    <ZlutakItemsContext.Provider value={{ items, loaded, updateItem }}>
      {children}
    </ZlutakItemsContext.Provider>
  );
}

export function useZlutakItems() {
  const ctx = useContext(ZlutakItemsContext);
  if (!ctx) throw new Error('useZlutakItems musí být použit uvnitř ZlutakItemsProvider');
  return ctx;
}
