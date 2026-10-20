import type { components } from "@/api/schema";

export type DemoOffering = {
  id: string;
  code: string;
  title: string;
  department: string;
  level: string;
  kind: "Core" | "Elective" | "General";
  registration: "Open" | "Approval" | "Closed";
  lecturer: string;
};

export type DemoStudent = {
  id: string;
  name: string;
  matric: string;
  department: string;
};

export type DemoSession = {
  id: string;
  offeringId: string;
  offeringCode: string;
  venueId: string;
  venue: string;
  date: string;
  startedAt: string;
  lateAfterMin: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  endedAt?: string;
  state: "scheduled" | "live" | "ended";
  code: string;
  rotating: boolean;
  scannerCoverage: "full" | "partial" | "none";
};

export type DemoScanner = {
  id: string;
  venue: string;
  status: "online" | "offline";
  offlineSince?: string;
};

export type DemoAttendance = {
  studentId: string;
  offeringCode: string;
  sessionId: string;
  webTime: string;
  scanTime: string;
  status:
    | "verified"
    | "suspected_proxy"
    | "scan_only"
    | "absent"
    | "late"
    | "excused";
  flags: string[];
};

export type DemoState = {
  offerings: DemoOffering[];
  students: DemoStudent[];
  sessions: DemoSession[];
  scanners: DemoScanner[];
  attendance: DemoAttendance[];
  enrollments: string[];
  auditEvents: string[];
};

export const DEMO_VENUES: components["schemas"]["Venue"][] = [
  {
    id: "3f2b8c1e-5a7d-4c1b-9e2a-8d6f4a1b7c90",
    name: "LT 2",
    latitude: 7.5172,
    longitude: 4.5226,
    radius_m: 60,
  },
  {
    id: "5f8b1042-7c3d-4b6e-a9f1-2d8c6e0a3b57",
    name: "Room 14",
    latitude: 7.5175,
    longitude: 4.5229,
    radius_m: 60,
  },
];

const SEEDED_SESSION_ID = globalThis.crypto.randomUUID();

const INITIAL_DEMO_STATE: DemoState = {
  offerings: [
    {
      id: "4c39d74e-7b7c-4cb0-8bd5-c8274905e3ce",
      code: "ENG 301",
      title: "Engineering Mathematics III",
      department: "Electrical Engineering",
      level: "300 level",
      kind: "General",
      registration: "Open",
      lecturer: "Dr. Ngozi Eze",
    },
    {
      id: "10000000-0000-4000-8000-000000000305",
      code: "CPE 305",
      title: "Computer Architecture",
      department: "Computer Engineering",
      level: "300 level",
      kind: "Core",
      registration: "Approval",
      lecturer: "Mr. Chidi Obi",
    },
    {
      id: "10000000-0000-4000-8000-000000000201",
      code: "GST 201",
      title: "General Studies",
      department: "General Studies",
      level: "300 level",
      kind: "General",
      registration: "Open",
      lecturer: "Dr. Tunde Bello",
    },
    {
      id: "10000000-0000-4000-8000-000000000318",
      code: "CPE 318",
      title: "Embedded Systems Design",
      department: "Computer Engineering",
      level: "300 level",
      kind: "Elective",
      registration: "Closed",
      lecturer: "Prof. Ada Nwosu",
    },
  ],
  students: [
    {
      id: "2021-18420",
      name: "Amara Okafor",
      matric: "2021 / 18420",
      department: "Computer Engineering",
    },
    {
      id: "2021-19422",
      name: "Tunde Adebayo",
      matric: "2021 / 19422",
      department: "Electrical Engineering",
    },
    {
      id: "2021-20117",
      name: "Zara Mohammed",
      matric: "2021 / 20117",
      department: "Computer Engineering",
    },
    {
      id: "2021-18653",
      name: "Daniel Eze",
      matric: "2021 / 18653",
      department: "Electrical Engineering",
    },
    {
      id: "2021-17703",
      name: "Ifeoma Obi",
      matric: "2021 / 17703",
      department: "Computer Engineering",
    },
    {
      id: "2021-19401",
      name: "Chidi Nwosu",
      matric: "2021 / 19401",
      department: "Electrical Engineering",
    },
  ],
  sessions: [
    {
      id: SEEDED_SESSION_ID,
      offeringId: "4c39d74e-7b7c-4cb0-8bd5-c8274905e3ce",
      offeringCode: "ENG 301",
      venueId: DEMO_VENUES[0]!.id,
      venue: DEMO_VENUES[0]!.name,
      date: "2025-02-17",
      startedAt: "2026-10-20T08:02:00Z",
      lateAfterMin: 15,
      latitude: DEMO_VENUES[0]!.latitude,
      longitude: DEMO_VENUES[0]!.longitude,
      radiusMeters: DEMO_VENUES[0]!.radius_m,
      state: "live",
      code: "381204",
      rotating: true,
      scannerCoverage: "full",
    },
  ],
  scanners: [
    {
      id: "scanner-lt2",
      venue: "Engineering Building · Lecture Theatre 2",
      status: "online",
    },
  ],
  attendance: [
    {
      studentId: "2021-18420",
      offeringCode: "ENG 301",
      sessionId: SEEDED_SESSION_ID,
      webTime: "09:07",
      scanTime: "09:18",
      status: "verified",
      flags: ["shared_device"],
    },
    {
      studentId: "2021-19422",
      offeringCode: "ENG 301",
      sessionId: SEEDED_SESSION_ID,
      webTime: "09:14",
      scanTime: "—",
      status: "suspected_proxy",
      flags: ["identical_coordinates", "borderline_distance"],
    },
    {
      studentId: "2021-20117",
      offeringCode: "ENG 301",
      sessionId: SEEDED_SESSION_ID,
      webTime: "—",
      scanTime: "09:22",
      status: "scan_only",
      flags: ["late_synced"],
    },
    {
      studentId: "2021-18653",
      offeringCode: "ENG 301",
      sessionId: SEEDED_SESSION_ID,
      webTime: "—",
      scanTime: "—",
      status: "absent",
      flags: [],
    },
    {
      studentId: "2021-17703",
      offeringCode: "ENG 301",
      sessionId: SEEDED_SESSION_ID,
      webTime: "09:11",
      scanTime: "09:12",
      status: "verified",
      flags: [],
    },
    {
      studentId: "2021-19401",
      offeringCode: "ENG 301",
      sessionId: SEEDED_SESSION_ID,
      webTime: "—",
      scanTime: "—",
      status: "absent",
      flags: [],
    },
  ],
  enrollments: ["ENG 301", "GST 201", "CPE 305"],
  auditEvents: [],
};

let demoState = structuredClone(INITIAL_DEMO_STATE);
const listeners = new Set<() => void>();

export function getDemoState(): DemoState {
  return demoState;
}

export function updateDemoState(
  update: (current: DemoState) => DemoState,
): void {
  demoState = update(demoState);
  listeners.forEach((listener) => listener());
}

export function subscribeDemoState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetDemoData(): void {
  demoState = structuredClone(INITIAL_DEMO_STATE);
  listeners.forEach((listener) => listener());
}

export function listDemoOfferings(): components["schemas"]["PagedCatalogueItems"] {
  return {
    items: demoState.offerings.map(({ id }) => ({ id })),
    limit: demoState.offerings.length,
    offset: 0,
    has_more: false,
  };
}

export function listDemoVenues(): components["schemas"]["VenueListResponse"] {
  return { items: structuredClone(DEMO_VENUES), total: DEMO_VENUES.length };
}

export function listDemoLiveClasses(
  studentId?: string,
): components["schemas"]["LiveClassesResponse"] {
  return {
    items: demoState.sessions
      .filter((session) => session.state === "live")
      .flatMap((session) => {
        const offering = demoState.offerings.find(
          (candidate) => candidate.id === session.offeringId,
        );
        const venue = DEMO_VENUES.find(
          (candidate) => candidate.id === session.venueId,
        );
        if (!offering || !venue) return [];
        return [
          {
            session_id: session.id,
            offering_id: offering.id,
            course_code: offering.code,
            course_title: offering.title,
            venue_id: venue.id,
            venue_name: venue.name,
            lecturer_name: offering.lecturer,
            started_at: session.startedAt,
            late_after_min: session.lateAfterMin,
            rotating_code: session.rotating,
            already_checked_in: demoState.attendance.some(
              (record) =>
                record.studentId === studentId &&
                record.sessionId === session.id &&
                record.webTime !== "—",
            ),
          },
        ];
      }),
  };
}

export function createDemoSession(
  request: components["schemas"]["StartSessionRequest"],
): components["schemas"]["SessionCodeResponse"] | null {
  const offering = demoState.offerings.find(
    (candidate) => candidate.id === request.offering_id,
  );
  const venue = DEMO_VENUES.find(
    (candidate) => candidate.id === request.venue_id,
  );
  if (!offering || !venue) return null;
  const id = globalThis.crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const code = "726519";
  const session: DemoSession = {
    id,
    offeringId: offering.id,
    offeringCode: offering.code,
    venueId: venue.id,
    venue: venue.name,
    date: startedAt.slice(0, 10),
    startedAt,
    lateAfterMin: request.late_after_min ?? 10,
    latitude: request.latitude ?? venue.latitude,
    longitude: request.longitude ?? venue.longitude,
    radiusMeters: request.radius_meters ?? venue.radius_m,
    state: "live",
    code,
    rotating: request.rotating_code,
    scannerCoverage: "full",
  };
  updateDemoState((current) => ({
    ...current,
    sessions: [...current.sessions, session],
  }));
  return {
    session: {
      id,
      offering_id: offering.id,
      venue_id: venue.id,
      started_at: startedAt,
      latitude: session.latitude,
      longitude: session.longitude,
      radius_meters: session.radiusMeters,
      rotating_code: session.rotating,
      late_after_min: session.lateAfterMin,
    },
    code,
    seconds_remaining: 30,
  };
}

export function getDemoSession(
  sessionId: string,
): DemoSession | undefined {
  return demoState.sessions.find((session) => session.id === sessionId);
}

export function getDemoSessionCode(
  sessionId: string,
): components["schemas"]["SessionCodeResponse"] | null {
  const session = getDemoSession(sessionId);
  if (!session || session.state !== "live") return null;
  return {
    session: {
      id: session.id,
      offering_id: session.offeringId,
      venue_id: session.venueId,
      started_at: session.startedAt,
      latitude: session.latitude,
      longitude: session.longitude,
      radius_meters: session.radiusMeters,
      rotating_code: session.rotating,
      late_after_min: session.lateAfterMin,
    },
    code: session.code,
    seconds_remaining: session.rotating ? 30 : 0,
  };
}

export function endDemoSession(
  sessionId: string,
): components["schemas"]["Session"] | null {
  const existing = getDemoSession(sessionId);
  if (!existing) return null;
  const endedAt = new Date().toISOString();
  updateDemoState((current) => ({
    ...current,
    sessions: current.sessions.map((session) =>
      session.id === sessionId
        ? { ...session, state: "ended", endedAt }
        : session,
    ),
  }));
  return {
    id: existing.id,
    offering_id: existing.offeringId,
    venue_id: existing.venueId,
    started_at: existing.startedAt,
    ended_at: endedAt,
    latitude: existing.latitude,
    longitude: existing.longitude,
    radius_meters: existing.radiusMeters,
    rotating_code: existing.rotating,
    late_after_min: existing.lateAfterMin,
  };
}

export function recordDemoCheckIn(
  studentId: string,
  sessionId: string,
  status: "verified" | "late",
): void {
  updateDemoState((current) => {
    const session = current.sessions.find(
      (candidate) => candidate.id === sessionId,
    );
    if (!session) throw new Error("The demo attendance session is missing.");
    const webTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const existing = current.attendance.find(
      (record) =>
        record.studentId === studentId && record.sessionId === session.id,
    );
    const attendance = existing
      ? current.attendance.map((record) =>
          record === existing ? { ...record, webTime, status } : record,
        )
      : [
          ...current.attendance,
          {
            studentId,
            offeringCode: session.offeringCode,
            sessionId: session.id,
            webTime,
            scanTime: "—",
            status,
            flags: [],
          },
        ];
    return { ...current, attendance };
  });
}

export function overrideDemoAttendance(
  sessionId: string,
  studentIds: string[],
  status: DemoAttendance["status"],
  reason: string,
): void {
  updateDemoState((current) => {
    const session = current.sessions.find(
      (candidate) => candidate.id === sessionId,
    );
    if (!session) throw new Error("The demo attendance session is missing.");
    const attendance = [...current.attendance];
    const auditEvents = [...current.auditEvents];
    for (const studentId of studentIds) {
      const index = attendance.findIndex(
        (record) =>
          record.studentId === studentId && record.sessionId === session.id,
      );
      if (index === -1) {
        attendance.push({
          studentId,
          offeringCode: session.offeringCode,
          sessionId: session.id,
          webTime: "—",
          scanTime: "—",
          status,
          flags: [],
        });
      } else {
        attendance[index] = { ...attendance[index]!, status };
      }
      auditEvents.push(
        `${new Date().toISOString()} ${studentId} ${status} ${reason}`,
      );
    }
    return { ...current, attendance, auditEvents };
  });
}

export function setDemoScannerStatus(status: DemoScanner["status"]): void {
  updateDemoState((current) => {
    const scanners = current.scanners.map((scanner) => ({
      ...scanner,
      status,
      offlineSince:
        status === "offline" ? (scanner.offlineSince ?? "09:31") : undefined,
    }));
    const offlineCount = scanners.filter(
      (scanner) => scanner.status === "offline",
    ).length;
    const scannerCoverage: DemoSession["scannerCoverage"] =
      offlineCount === 0
        ? "full"
        : offlineCount === scanners.length
          ? "none"
          : "partial";
    const sessions = current.sessions.map((session) => ({
      ...session,
      scannerCoverage,
    }));
    return { ...current, scanners, sessions };
  });
}

export function setDemoSessionFixedCode(sessionId: string, code: string): void {
  updateDemoState((current) => ({
    ...current,
    sessions: current.sessions.map((session) =>
      session.id === sessionId
        ? { ...session, code, rotating: false }
        : session,
    ),
  }));
}
