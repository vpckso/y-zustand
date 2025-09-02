import type { StateCreator } from "zustand";
import * as Y from "yjs";

// A flag to prevent infinite loops
let isSyncingFromYjs = false;

/**
 * A function to recursively convert plain JavaScript objects and arrays into Yjs types.
 */
function jsToY(value: any): any {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return Y.Array.from(value.map(jsToY));
  }
  const ymap = new Y.Map();
  for (const [key, val] of Object.entries(value)) {
    ymap.set(key, jsToY(val));
  }
  return ymap;
}

export interface SyncYjsOptions<T> {
  /**
   * A function that takes the current state and returns a new state object
   * with only the fields that should be synced with Yjs.
   * By default, all fields are synced.
   */
  partialize?: (state: T) => Partial<T>;
}

export const syncYjsMiddleware =
  <T extends object>(
    doc: Y.Doc,
    name: string,
    options: SyncYjsOptions<T> = {}
  ) =>
  (creator: StateCreator<T>): StateCreator<T> => {
    const ymap = doc.getMap(name);
    const { partialize = (state: T) => state } = options;

    return (set, get, api) => {
      // ---- 1. Yjs -> Zustand ----
      // Observe deep changes in the Yjs document and update the Zustand store.
      const observer = () => {
        isSyncingFromYjs = true;
        set(ymap.toJSON() as T);
        isSyncingFromYjs = false;
      };
      ymap.observeDeep(observer);

      // ---- 2. Zustand -> Yjs ----
      // Subscribe to the Zustand store and update the Yjs document on changes.
      api.subscribe((state, prevState) => {
        if (isSyncingFromYjs) {
          return;
        }

        // Apply partialize to get only the fields that should be synced
        const partialState = partialize(state) as Partial<T>;
        const partialPrevState = partialize(prevState) as Partial<T>;

        doc.transact(() => {
          Object.entries(partialState).forEach(([key, value]) => {
            // Ignore functions
            if (typeof value === 'function') {
              return;
            }

            const prevValue = partialPrevState[key as keyof T];

            if (JSON.stringify(value) !== JSON.stringify(prevValue)) {
              ymap.set(key, jsToY(value));
            }
          });
        });
      });

      // ---- 3. Initial State ----
      // Set the initial state. If the Yjs doc is already populated, use that.
      // Otherwise, populate it with the store's initial state.
      const initialStateFromCreator = creator(set, get, api);
      if (ymap.size === 0) {
        doc.transact(() => {
          // Apply partialize to get only the fields that should be synced
          const partialState = partialize(initialStateFromCreator);
          
          for (const key in partialState) {
            const value = partialState[key as keyof T];
            if (typeof value !== 'function') {
              ymap.set(key, jsToY(value));
            }
          }
        });
        return initialStateFromCreator;
      } else {
        const stateFromYjs = ymap.toJSON() as T;
        const mergedState = { ...initialStateFromCreator, ...stateFromYjs };
        return mergedState;
      }
    };
  };