import { create } from 'zustand';
import { cartAPI } from '@/lib/api';
import type { Cart } from '@/lib/types';

interface CartStore {
  cart: Cart | null;
  loading: boolean;
  /** Product ID currently being added — drives loading state on Add to Cart button */
  addingProductId: number | null;

  fetchCart: () => Promise<void>;
  addItem: (productId: number, quantity?: number, productPackId?: number | null) => Promise<void>;
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

  addItem: async (productId, quantity = 1, productPackId = null) => {
    const { useAuthStore } = require('./store');
    const user = useAuthStore.getState().user;
    if (user?.role === 'vendor' && user?.kyc_status !== 'verified' && user?.kyc_status !== 'approved') {
      throw new Error('Your Business KYC is currently pending review. You cannot place B2B wholesale orders until verified. Please upload documents in your Business KYC settings.');
    }
    set({ addingProductId: productId });
    try {
      const { data } = await cartAPI.addItem(productId, quantity, productPackId);
      set({ cart: data.data ?? data });
    } finally {
      set({ addingProductId: null });
    }
  },

  updateItem: async (itemId, quantity) => {
    const { useAuthStore } = require('./store');
    const user = useAuthStore.getState().user;
    const cart = get().cart;
    const item = cart?.items.find((i) => i.id === itemId);
    if (item && user?.role === 'vendor') {
      const minQty = item.product?.min_order_quantity ?? 1;
      if (quantity < minQty) {
        throw new Error(`Minimum order quantity for "${item.product?.name}" is ${minQty} units.`);
      }
    }

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
