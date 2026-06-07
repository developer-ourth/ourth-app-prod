import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import api from '@/lib/api';
import type { Product } from '@/lib/types';

interface CollectionsStore {
  /** Map of product id → product object */
  liked: Record<number, Product>;
  toggle: (product: Product) => Promise<void>;
  syncFromApi: () => Promise<void>;
}

export const useCollectionsStore = create<CollectionsStore>()(
  persist(
    (set, get) => ({
      liked: {},

      toggle: async (product) => {
        const isLiked = Boolean(get().liked[product.id]);

        // Optimistic local update
        set((state) => {
          const next = { ...state.liked };
          if (next[product.id]) {
            delete next[product.id];
          } else {
            next[product.id] = product;
          }
          return { liked: next };
        });

        // Sync to API (best-effort — local state already updated)
        try {
          if (isLiked) {
            await api.delete(`/me/wishlist/${product.id}`);
          } else {
            await api.post('/me/wishlist', { product_id: product.id });
          }
        } catch {
          // Revert local update on failure
          set((state) => {
            const next = { ...state.liked };
            if (isLiked) {
              next[product.id] = product;
            } else {
              delete next[product.id];
            }
            return { liked: next };
          });
        }
      },

      syncFromApi: async () => {
        try {
          const { data } = await api.get<{ data: Product[] }>('/me/wishlist');
          const liked: Record<number, Product> = {};
          for (const product of data.data) {
            liked[product.id] = product;
          }
          set({ liked });
        } catch {
          // Silently keep local cache if API unavailable
        }
      },
    }),
    {
      name: 'ourth-collections',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
