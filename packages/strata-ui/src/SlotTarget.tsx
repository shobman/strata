import { useCallback, useContext, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { SlotContext } from "./SlotContext";
import type { SlotTargetProps } from "./types";

/**
 * Renders a portal target for a named slot.
 * Returns null when no FillSlot targets this name (container visibility rule).
 */
export function SlotTarget({ name }: SlotTargetProps) {
  const registry = useContext(SlotContext);
  const divRef = useRef<HTMLDivElement>(null);

  if (!registry) {
    return null;
  }

  const subscribe = useCallback(
    (cb: () => void) => registry.subscribe(name, cb),
    [registry, name],
  );

  const getSnapshot = useCallback(
    () => registry.hasFills(name),
    [registry, name],
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const hasFills = useSyncExternalStore(subscribe, getSnapshot);

  // Register / unregister the DOM element as the portal target.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useLayoutEffect(() => {
    if (divRef.current) {
      registry.setTarget(name, divRef.current);
    }
    return () => {
      registry.setTarget(name, null);
    };
  }, [registry, name, hasFills]); // re-run when hasFills changes (div mounts/unmounts)

  if (!hasFills) return null;
  return <div ref={divRef} data-strata-slot={name} />;
}
