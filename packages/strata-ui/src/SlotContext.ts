import { createContext } from "react";

// ---------------------------------------------------------------------------
// SlotRegistry — mutable store powering the portal stack
// ---------------------------------------------------------------------------

type Listener = () => void;

export class SlotRegistry {
  /** Slot name → DOM element registered by SlotTarget */
  private targets = new Map<string, HTMLElement>();

  /** Slot name → ordered stack of fill IDs (last = top = active) */
  private fillStacks = new Map<string, string[]>();

  /** Slot name → set of subscriber callbacks */
  private listeners = new Map<string, Set<Listener>>();

  // -- targets --------------------------------------------------------------

  setTarget(name: string, el: HTMLElement | null): void {
    if (el) {
      this.targets.set(name, el);
    } else {
      this.targets.delete(name);
    }
    this.notify(name);
  }

  getTarget(name: string): HTMLElement | null {
    return this.targets.get(name) ?? null;
  }

  // -- fill stack -----------------------------------------------------------

  pushFill(name: string, id: string): void {
    let stack = this.fillStacks.get(name);
    if (!stack) {
      stack = [];
      this.fillStacks.set(name, stack);
    }
    stack.push(id);
    this.notify(name);
  }

  removeFill(name: string, id: string): void {
    const stack = this.fillStacks.get(name);
    if (!stack) return;
    const idx = stack.indexOf(id);
    if (idx !== -1) stack.splice(idx, 1);
    if (stack.length === 0) this.fillStacks.delete(name);
    this.notify(name);
  }

  /** Returns true if the given fill ID is at the top of the stack. */
  isTopFill(name: string, id: string): boolean {
    const stack = this.fillStacks.get(name);
    if (!stack || stack.length === 0) return false;
    return stack[stack.length - 1] === id;
  }

  /** Returns true if any fill is registered for the given slot name. */
  hasFills(name: string): boolean {
    const stack = this.fillStacks.get(name);
    return !!stack && stack.length > 0;
  }

  // -- subscriptions --------------------------------------------------------

  subscribe(name: string, cb: Listener): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
    };
  }

  private notify(name: string): void {
    const set = this.listeners.get(name);
    if (set) {
      set.forEach((cb) => cb());
    }
  }
}

// ---------------------------------------------------------------------------
// React context
// ---------------------------------------------------------------------------

export const SlotContext = createContext<SlotRegistry | null>(null);
