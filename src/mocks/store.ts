export type DemoOffering = {
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
  offeringCode: string;
  venue: string;
  date: string;
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

const INITIAL_DEMO_STATE: DemoState = {
  offerings: [
    {
      code: "ENG 301",
      title: "Engineering Mathematics III",
      department: "Electrical Engineering",
      level: "300 level",
      kind: "General",
      registration: "Open",
      lecturer: "Dr. Ngozi Eze",
    },
    {
      code: "CPE 305",
      title: "Computer Architecture",
      department: "Computer Engineering",
      level: "300 level",
      kind: "Core",
      registration: "Approval",
      lecturer: "Mr. Chidi Obi",
    },
    {
      code: "GST 201",
      title: "General Studies",
      department: "General Studies",
      level: "300 level",
      kind: "General",
      registration: "Open",
      lecturer: "Dr. Tunde Bello",
    },
    {
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
      id: "demo-session",
      offeringCode: "ENG 301",
      venue: "Engineering Building · Lecture Theatre 2",
      date: "2025-02-17",
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
      sessionId: "demo-session",
      webTime: "09:07",
      scanTime: "09:18",
      status: "verified",
      flags: ["shared_device"],
    },
    {
      studentId: "2021-19422",
      offeringCode: "ENG 301",
      sessionId: "demo-session",
      webTime: "09:14",
      scanTime: "—",
      status: "suspected_proxy",
      flags: ["identical_coordinates", "borderline_distance"],
    },
    {
      studentId: "2021-20117",
      offeringCode: "ENG 301",
      sessionId: "demo-session",
      webTime: "—",
      scanTime: "09:22",
      status: "scan_only",
      flags: ["late_synced"],
    },
    {
      studentId: "2021-18653",
      offeringCode: "ENG 301",
      sessionId: "demo-session",
      webTime: "—",
      scanTime: "—",
      status: "absent",
      flags: [],
    },
    {
      studentId: "2021-17703",
      offeringCode: "ENG 301",
      sessionId: "demo-session",
      webTime: "09:11",
      scanTime: "09:12",
      status: "verified",
      flags: [],
    },
    {
      studentId: "2021-19401",
      offeringCode: "ENG 301",
      sessionId: "demo-session",
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

export function recordDemoCheckIn(
  studentId: string,
  status: "verified" | "late",
): void {
  updateDemoState((current) => {
    const session = current.sessions.find(
      (candidate) => candidate.id === "demo-session",
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
  studentIds: string[],
  status: DemoAttendance["status"],
  reason: string,
): void {
  updateDemoState((current) => {
    const session = current.sessions.find(
      (candidate) => candidate.id === "demo-session",
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

export function setDemoSessionFixedCode(code: string): void {
  updateDemoState((current) => ({
    ...current,
    sessions: current.sessions.map((session) =>
      session.id === "demo-session"
        ? { ...session, code, rotating: false }
        : session,
    ),
  }));
}
