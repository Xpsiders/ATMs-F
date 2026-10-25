import { useSyncExternalStore } from "react";
import {
  getDemoState,
  subscribeDemoState,
  type DemoState,
} from "./store";

const EMPTY_DEMO_STATE: DemoState = {
  offerings: [],
  students: [],
  sessions: [],
  scanners: [],
  attendance: [],
  enrollments: [],
  pendingRegistrations: [],
  teachingRequests: [],
  devices: [],
  auditEvents: [],
};

function subscribeToNothing() {
  return () => {};
}

export function useDemoState(enabled = true) {
  return useSyncExternalStore(
    enabled ? subscribeDemoState : subscribeToNothing,
    enabled ? getDemoState : () => EMPTY_DEMO_STATE,
    enabled ? getDemoState : () => EMPTY_DEMO_STATE,
  );
}
