import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import type { CartDTO } from "../../shared/types";

// useCart — manages the cart state across the app.
// The cart is stored server-side, keyed by session ID.
export function useCart() {
  const [cart, setCart] = useState<CartDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { cart } = await api.getCart();
      setCart(cart);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (ticketTypeId: string, quantity: number) => {
      setLoading(true);
      setError(null);
      try {
        const { cart } = await api.addToCart(ticketTypeId, quantity);
        setCart(cart);
        return cart;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateItem = useCallback(async (reservationId: string, quantity: number) => {
    try {
      const { cart } = await api.updateCart(reservationId, quantity);
      setCart(cart);
      return cart;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeItem = useCallback(async (reservationId: string) => {
    try {
      const { cart } = await api.removeFromCart(reservationId);
      setCart(cart);
      return cart;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const itemCount = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const total = cart?.total ?? 0;

  return { cart, loading, error, itemCount, total, refresh, addItem, updateItem, removeItem };
}
