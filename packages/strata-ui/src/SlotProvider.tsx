import { useRef } from "react";
import { SlotContext, SlotRegistry } from "./SlotContext";
import type { SlotProviderProps } from "./types";

/**
 * Wraps a layout, creating an independent slot namespace.
 * Each SlotProvider instance gets its own registry — nested providers
 * do not share state with ancestors.
 */
export function SlotProvider({ children }: SlotProviderProps) {
  const registryRef = useRef<SlotRegistry | null>(null);
  if (registryRef.current === null) {
    registryRef.current = new SlotRegistry();
  }

  return (
    <SlotContext.Provider value={registryRef.current}>
      {children}
    </SlotContext.Provider>
  );
}
