import { useCallback, useContext, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { SlotContext } from "./SlotContext";
import type { FillSlotProps } from "./types";

let nextFillId = 0;

/**
 * Projects children into the SlotTarget with the given name via a React portal.
 *
 * Multiple FillSlots targeting the same name form a stack — the most recently
 * mounted (deepest in the tree) fill renders. On unmount, the previous fill
 * reasserts.
 */
export function FillSlot({ name, children }: FillSlotProps) {
  const registry = useContext(SlotContext);

  // Stable unique ID for this fill instance.
  const fillIdRef = useRef<string | null>(null);
  if (fillIdRef.current === null) {
    fillIdRef.current = `fill-${nextFillId++}`;
  }
  const fillId = fillIdRef.current;

  if (!registry) {
    return null;
  }

  // Register this fill on mount, remove on unmount.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useLayoutEffect(() => {
    registry.pushFill(name, fillId);
    return () => {
      registry.removeFill(name, fillId);
    };
  }, [registry, name, fillId]);

  const subscribe = useCallback(
    (cb: () => void) => registry.subscribe(name, cb),
    [registry, name],
  );

  const getTarget = useCallback(
    () => registry.getTarget(name),
    [registry, name],
  );

  const getIsActive = useCallback(
    () => registry.isTopFill(name, fillId),
    [registry, name, fillId],
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const target = useSyncExternalStore(subscribe, getTarget);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const isActive = useSyncExternalStore(subscribe, getIsActive);

  if (!isActive || !target) return null;
  return createPortal(children, target);
}
