import { create, type StoreApi } from 'zustand';
import * as Y from 'yjs';
import { syncYjsMiddleware } from './y-zustand';
import { describe, it, expect, beforeEach } from 'vitest';

// Define the store's interface
interface MyState {
  count: number;
  name: string;
  items: string[];
  details: { id: number; value: string };
  increment: () => void;
  setName: (name: string) => void;
  addItem: (item: string) => void;
  updateDetails: (value: string) => void;
  reorderItems: (items: string[]) => void;
}

describe('syncYjsMiddleware', () => {
  let ydoc: Y.Doc;
  let store1: StoreApi<MyState>;
  let store2: StoreApi<MyState>;

  beforeEach(() => {
    // Create a new Yjs document for each test
    ydoc = new Y.Doc();

    const creator = (set: any) => ({
      count: 0,
      name: 'Alice',
      items: ['apple', 'banana', 'cherry'],
      details: { id: 1, value: 'initial' },
      increment: () => set((state: MyState) => ({ count: state.count + 1 })),
      setName: (name: string) => set({ name }),
      addItem: (item: string) => set((state: MyState) => ({ items: [...state.items, item] })),
      updateDetails: (value: string) =>
        set((state: MyState) => ({ details: { ...state.details, value } })),
      reorderItems: (items: string[]) => set({ items }),
    });

    store1 = create<MyState>()(syncYjsMiddleware(ydoc, 'shared')(creator));
    store2 = create<MyState>()(syncYjsMiddleware(ydoc, 'shared')(creator));
  });

  it('should initialize both stores with the same initial state', () => {
    expect(JSON.stringify(store1.getState())).toEqual(JSON.stringify(store2.getState()));
  });

  it('should sync changes from store1 to store2', () => {
    store1.getState().increment();
    expect(store2.getState().count).toBe(1);

    store1.getState().setName('Bob');
    expect(store2.getState().name).toBe('Bob');

    store1.getState().addItem('date');
    expect(store2.getState().items).toEqual(['apple', 'banana', 'cherry', 'date']);

    store1.getState().updateDetails('updated');
    expect(store2.getState().details).toEqual({ id: 1, value: 'updated' });
  });

  it('should sync changes from store2 to store1', () => {
    store2.getState().increment();
    expect(store1.getState().count).toBe(1);

    store2.getState().setName('Charlie');
    expect(store1.getState().name).toBe('Charlie');

    store2.getState().addItem('elderberry');
    expect(store1.getState().items).toEqual(['apple', 'banana', 'cherry', 'elderberry']);

    store2.getState().updateDetails('from store2');
    expect(store1.getState().details).toEqual({ id: 1, value: 'from store2' });
  });

  it('should sync array reordering from store1 to store2', () => {
    store1.getState().reorderItems(['cherry', 'apple', 'banana']);
    expect(store2.getState().items).toEqual(['cherry', 'apple', 'banana']);
  });

  it('should sync array reordering from store2 to store1', () => {
    store2.getState().reorderItems(['banana', 'cherry', 'apple']);
    expect(store1.getState().items).toEqual(['banana', 'cherry', 'apple']);
  });
});
