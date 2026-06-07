import { create } from 'zustand';
import { cartAPI } from '@/lib/api';
import type { Cart } from '@/lib/types';

interface CartStore {
  cart: Cart | null;
  loading: boolean;
  /** Product ID currently being added — drives loading state on Add to Cart button */
  addingProductId: number | null;

  fetchCart: () => Promise<void>;
  addItem: (productId: number, quantity?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart: null,
  loading: false,
  addingProductId: null,

  fetchCart: async () => {
    set({ loading: true });
    try {
      const { data } = await cartAPI.getCart();
      set({ cart: data.data ?? data });
    } catch {
      // Not authenticated or cart empty — leave as null
    } finally {
      set({ loading: false });
    }
  },

  addItem: async (productId, quantity = 1) => {
    set({ addingProductId: productId });
    try {
      const { data } = await cartAPI.addItem(productId, quantity);
      set({ cart: data.data ?? data });
    } finally {
      set({ addingProductId: null });
    }
  },

  updateItem: async (itemId, quantity) => {
    try {
      const { data } = await cartAPI.updateItem(itemId, quantity);
      set({ cart: data.data ?? data });
    } catch {
      get().fetchCart();
    }
  },

  removeItem: async (itemId) => {
    // Optimistic removal
    const prev = get().cart;
    if (prev) {
      set({
        cart: {
          ...prev,
          items: prev.items.filter((i) => i.id !== itemId),
          total_items: Math.max(0, prev.total_items - 1),
        },
      });
    }
    try {
      await cartAPI.removeItem(itemId);
      // Refresh for accurate total_amount
      get().fetchCart();
    } catch {
      set({ cart: prev });
    }
  },

  clearCart: async () => {
    try {
      await cartAPI.clearCart();
      set({ cart: null });
    } catch {}
  },
}));
