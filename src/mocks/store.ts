import type { components } from "@/api/schema";
import type {
  LiveClassesResponse,
  PendingRegistrationsResponse,
  RegistrationResponse,
  SearchOfferingsQuery,
  SearchOfferingsResponse,
  StudentAttendanceResponse,
  StudentCoursesResponse,
  StudentTimetableResponse,
  StartSessionRequest,
  VenueListResponse,
} from "@/api/contracts";

export type DemoOffering = {
  id: string;
  code: string;
  title: string;
  department: string;
  level: string;
  kind: "Core" | "Elective" | "General";
  registration: "Open" | "Approval" | "Closed";
  lecturer: string;
  attendanceSummary: {
    sessionsHeld: number;
    sessionsAttended: number;
    minimumPercentage: number;
  };
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
  pendingRegistrations: string[];
  auditEvents: string[];
};

export const DEMO_VENUES: VenueListResponse["items"] = [
  {
    id: "3f2b8c1e-5a7d-4c1b-9e2a-8d6f4a1b7c90",
    name: "LT 2",
    latitude: 7.5172,
    longitude: 4.5226,
    radius_meters: 60,
  },
  {
    id: "5f8b1042-7c3d-4b6e-a9f1-2d8c6e0a3b57",
    name: "Room 14",
    latitude: 7.5175,
    longitude: 4.5229,
    radius_meters: 60,
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
      attendanceSummary: {
        sessionsHeld: 13,
        sessionsAttended: 12,
        minimumPercentage: 75,
      },
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
      attendanceSummary: {
        sessionsHeld: 25,
        sessionsAttended: 21,
        minimumPercentage: 75,
      },
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
      attendanceSummary: {
        sessionsHeld: 25,
        sessionsAttended: 17,
        minimumPercentage: 75,
      },
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
      attendanceSummary: {
        sessionsHeld: 0,
        sessionsAttended: 0,
        minimumPercentage: 75,
      },
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
      date: "2026-10-20",
      startedAt: "2026-10-20T08:02:00Z",
      lateAfterMin: 15,
      latitude: DEMO_VENUES[0]!.latitude,
      longitude: DEMO_VENUES[0]!.longitude,
      radiusMeters: DEMO_VENUES[0]!.radius_meters,
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
  enrollments: ["ENG 301", "GST 201"],
  pendingRegistrations: [],
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
    items: demoState.offerings.map(({ id, code, title }) => ({
      id,
      course_code: code,
      course_title: title,
    })),
    limit: demoState.offerings.length,
    offset: 0,
    has_more: false,
  };
}

export function listDemoVenues(): VenueListResponse {
  return {
    items: structuredClone(DEMO_VENUES),
    limit: DEMO_VENUES.length,
    offset: 0,
    total: DEMO_VENUES.length,
  };
}

export function listDemoLiveClasses(
  studentId?: string,
): LiveClassesResponse {
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

export function listDemoStudentCourses(): StudentCoursesResponse {
  const items = demoState.offerings
    .filter(
      (offering) =>
        demoState.enrollments.includes(offering.code) &&
        !demoState.pendingRegistrations.includes(offering.code),
    )
    .map((offering) => {
      const { sessionsHeld, sessionsAttended, minimumPercentage } =
        offering.attendanceSummary;
      const percentage = sessionsHeld
        ? Math.round((sessionsAttended / sessionsHeld) * 100)
        : 0;
      return {
        offering_id: offering.id,
        course_code: offering.code,
        course_title: offering.title,
        lecturer_names: [offering.lecturer],
        sessions_held: sessionsHeld,
        sessions_attended: sessionsAttended,
        attendance_percentage: percentage,
        minimum_attendance_percentage: minimumPercentage,
        below_threshold: percentage < minimumPercentage,
      };
    });
  return { items };
}

export function listDemoStudentTimetable(): StudentTimetableResponse {
  const items = demoState.offerings
    .filter(
      (offering) =>
        demoState.enrollments.includes(offering.code) &&
        !demoState.pendingRegistrations.includes(offering.code),
    )
    .slice(0, 2)
    .map((offering, index) => ({
      offering_id: offering.id,
      course_code: offering.code,
      course_title: offering.title,
      venue_id: DEMO_VENUES[index % DEMO_VENUES.length]!.id,
      venue_name: DEMO_VENUES[index % DEMO_VENUES.length]!.name,
      starts_at: index === 0 ? "09:00:00" : "11:00:00",
      ends_at: index === 0 ? "10:30:00" : "12:30:00",
      live_now:
        demoState.sessions.some(
          (session) =>
            session.state === "live" && session.offeringId === offering.id,
        ),
    }));
  return { date: currentDemoDate(), items };
}

export function listDemoStudentAttendance(
  offeringId: string,
  studentId = "2021-18420",
): StudentAttendanceResponse {
  const offering = demoState.offerings.find(
    (candidate) => candidate.id === offeringId,
  );
  if (!offering) return { items: [] };
  const items = demoState.attendance
    .filter(
      (record) =>
        record.studentId === studentId &&
        record.offeringCode === offering.code,
    )
    .map((record) => {
      const session = demoState.sessions.find(
        (candidate) => candidate.id === record.sessionId,
      );
      const status: StudentAttendanceResponse["items"][number]["status"] =
        record.status === "late" ||
        record.status === "absent" ||
        record.status === "excused"
          ? record.status
          : "present";
      const classification: StudentAttendanceResponse["items"][number]["classification"] =
        record.status === "suspected_proxy"
          ? "suspected_proxy"
          : record.status === "scan_only"
            ? "present_no_web_log"
            : record.status === "absent"
              ? "absent"
              : record.status === "excused"
                ? "excused"
                : record.status === "late"
                  ? "web_only_unverified"
                  : "verified";
      return {
        session_id: record.sessionId,
        date: session?.date ?? currentDemoDate(),
        status,
        classification,
        override_reason: record.status === "excused" ? "Approved excusal" : null,
      };
    });
  return { items };
}

export function listDemoPendingRegistrations(): PendingRegistrationsResponse {
  return {
    items: demoState.offerings
      .filter((offering) =>
        demoState.pendingRegistrations.includes(offering.code),
      )
      .map((offering) => ({
        offering_id: offering.id,
        course_code: offering.code,
        course_title: offering.title,
        status: "pending",
        created_at: new Date().toISOString(),
      })),
  };
}

export function searchDemoOfferings(
  query: SearchOfferingsQuery,
): SearchOfferingsResponse {
  const matching = demoState.offerings.filter((offering) => {
    const searchText = `${offering.code} ${offering.title} ${offering.lecturer}`;
    const departmentMatches =
      !query.department_id ||
      query.department_id === demoDepartmentId(offering.department);
    const levelMatches = !query.level || query.level === Number.parseInt(offering.level, 10);
    const kindMatches =
      !query.kind ||
      query.kind === (offering.kind === "General" ? "general" : "departmental");
    return (
      searchText.toLowerCase().includes(query.q.toLowerCase()) &&
      departmentMatches &&
      levelMatches &&
      kindMatches
    );
  });
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  const items: SearchOfferingsResponse["items"] = matching
    .slice(offset, offset + limit)
    .map((offering) => {
      const pending = demoState.pendingRegistrations.includes(offering.code);
      const registered =
        demoState.enrollments.includes(offering.code) && !pending;
      return {
        offering_id: offering.id,
        course_id: offering.id,
        course_code: offering.code,
        course_title: offering.title,
        code: offering.code,
        title: offering.title,
        department_id: demoDepartmentId(offering.department),
        department_name: offering.department,
        level: Number.parseInt(offering.level, 10),
        kind: offering.kind === "General" ? "general" : "departmental",
        registration_mode:
          offering.registration === "Open"
            ? "open"
            : offering.registration === "Approval"
              ? "approval"
              : "closed",
        lecturers: [offering.lecturer],
        registration_status: pending
          ? "pending"
          : registered
            ? "approved"
            : "none",
        is_registered: registered,
        is_pending: pending,
        semester_id: "10000000-0000-4000-8000-000000000002",
        semester: "Semester 2",
        rank: 1,
      };
    });
  return {
    items,
    limit,
    offset,
    has_more: offset + limit < matching.length,
  };
}

export function registerDemoOffering(offeringId: string): RegistrationResponse | null {
  const offering = demoState.offerings.find(
    (candidate) => candidate.id === offeringId,
  );
  if (!offering || offering.registration === "Closed") return null;
  const pending = offering.registration === "Approval";
  updateDemoState((current) => ({
    ...current,
    enrollments: pending
      ? current.enrollments
      : [...new Set([...current.enrollments, offering.code])],
    pendingRegistrations: pending
      ? [...new Set([...current.pendingRegistrations, offering.code])]
      : current.pendingRegistrations,
  }));
  return {
    student_id: "20000000-0000-4000-8000-000000000001",
    matric_no: "2021-18420",
    display_name: "Amara Okafor",
    department_id: demoDepartmentId(offering.department),
    level: Number.parseInt(offering.level, 10),
    status: pending ? "pending" : "approved",
    created_at: new Date().toISOString(),
    approved_at: pending ? null : new Date().toISOString(),
    on_roster: !pending,
  };
}

function demoDepartmentId(department: string): string {
  return department === "Computer Engineering"
    ? "10000000-0000-4000-8000-000000000004"
    : department === "Electrical Engineering"
      ? "10000000-0000-4000-8000-000000000005"
      : "10000000-0000-4000-8000-000000000006";
}

function currentDemoDate(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function createDemoSession(
  request: StartSessionRequest,
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
    latitude: venue.latitude,
    longitude: venue.longitude,
    radiusMeters: venue.radius_meters,
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
