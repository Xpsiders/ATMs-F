import { useSyncExternalStore } from "react";
import { getDemoState, subscribeDemoState } from "./store";

export function useDemoState() {
  return useSyncExternalStore(subscribeDemoState, getDemoState, getDemoState);
}
