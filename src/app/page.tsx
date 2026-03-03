"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";

// Shift definitions
const SHIFT_OPTIONS = ["P", "P0", "S", "M", "L", "C", ""];

const SHIFT_COLORS: Record<string, string> = {
  P:   "bg-blue-500 text-white",
  P0:  "bg-sky-400 text-white",
  S:   "bg-yellow-500 text-white",
  M:   "bg-purple-600 text-white",
  L:   "bg-red-500 text-white",
  C:   "bg-green-500 text-white",
  "":  "bg-white text-gray-400",
};

const SHIFT_LABELS: Record<string, string> = {
  P:   "Pagi (06:00)",
  P0:  "Pagi (07:00)",
  S:   "Siang (14:00)",
  M:   "Malam (22:00)",
  L:   "Libur",
  C:   "Cuti",
  "":  "—",
};

// Employee type with NIK
type Employee = {
  nik: string;
  name: string;
  password: string;
};

const INITIAL_EMPLOYEES: Employee[] = [
  { nik: "001", name: "Ahmad Fauzi",   password: "001" },
  { nik: "002", name: "Budi Santoso",  password: "002" },
  { nik: "003", name: "Citra Dewi",    password: "003" },
  { nik: "004", name: "Dian Pratama",  password: "004" },
  { nik: "005", name: "Eka Rahayu",    password: "005" },
  { nik: "006", name: "Fajar Nugroho", password: "006" },
  { nik: "007", name: "Gita Permata",  password: "007" },
  { nik: "008", name: "Hendra Wijaya", password: "008" },
];

// Admin credentials (special user that can edit all rows)
const ADMIN_NIK = "ADMIN";
const ADMIN_PASSWORD = "admin123";

// Max employees that can have "L" (Libur) on the same day
const MAX_LIBUR_PER_DAY = 5;
// Max employees that can have "C" or "L" combined on the same day
const MAX_CL_PER_DAY = 6;

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getDayName(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  return date.toLocaleDateString("id-ID", { weekday: "short" });
}

function isWeekend(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

// Schedule data keyed by "YYYY-MM" then employee NIK then day
type MonthSchedule = Record<string, Record<number, string>>;
type AllScheduleData = Record<string, MonthSchedule>;

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default function Home() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  
  // Load employees from localStorage or use initial data
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("employees");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return INITIAL_EMPLOYEES;
        }
      }
    }
    return INITIAL_EMPLOYEES;
  });
  // Load schedule data from localStorage or use empty object
  const [allSchedule, setAllSchedule] = useState<AllScheduleData>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("scheduleData");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });
  
  // Persist employees to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("employees", JSON.stringify(employees));
    }
  }, [employees]);

  // Persist schedule data to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("scheduleData", JSON.stringify(allSchedule));
    }
  }, [allSchedule]);

  // Add employee form
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpNik, setNewEmpNik] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [addEmpError, setAddEmpError] = useState("");

  // Upload modal
  const [uploadError, setUploadError] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Login modal state
  const [loginModal, setLoginModal] = useState<{
    open: boolean;
    nik: string;
    name: string;
    inputPassword: string;
    error: string;
  }>({ open: false, nik: "", name: "", inputPassword: "", error: "" });

  // Currently logged-in session: null = not logged in, "ADMIN" = admin, or NIK string
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);

  // Admin login modal
  const [adminLoginModal, setAdminLoginModal] = useState<{
    open: boolean;
    inputPassword: string;
    error: string;
  }>({ open: false, inputPassword: "", error: "" });

  // Password change modal state
  const [passwordChangeModal, setPasswordChangeModal] = useState<{
    open: boolean;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    error: string;
    success: string;
  }>({ open: false, currentPassword: "", newPassword: "", confirmPassword: "", error: "", success: "" });

  const isAdmin = loggedInAs === ADMIN_NIK;

  const monthKey = getMonthKey(year, month);
  const schedule: MonthSchedule = useMemo(
    () => allSchedule[monthKey] || {},
    [allSchedule, monthKey]
  );

  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Count how many employees have "L" on a given day
  const getLiburCountForDay = useCallback(
    (day: number) => employees.filter((emp) => schedule[emp.nik]?.[day] === "L").length,
    [schedule, employees]
  );

  // Count how many employees have "C" or "L" on a given day
  const getCLCountForDay = useCallback(
    (day: number) =>
      employees.filter((emp) => {
        const v = schedule[emp.nik]?.[day];
        return v === "C" || v === "L";
      }).length,
    [schedule, employees]
  );

  // Check if a cell is editable by the current user
  const canEditCell = useCallback(
    (nik: string) => {
      if (loggedInAs === null) return false; // must be logged in
      if (isAdmin) return true;
      return loggedInAs === nik;
    },
    [loggedInAs, isAdmin]
  );

  // A cell is locked for "L" if the day already has MAX_LIBUR_PER_DAY employees with L
  const isDayLockedForLibur = useCallback(
    (nik: string, day: number) => {
      const currentVal = schedule[nik]?.[day] || "";
      if (currentVal === "L") return false;
      return getLiburCountForDay(day) >= MAX_LIBUR_PER_DAY;
    },
    [schedule, getLiburCountForDay]
  );

  // A cell is locked for "C" if the day already has MAX_CL_PER_DAY employees with C or L
  const isDayLockedForCL = useCallback(
    (nik: string, day: number, nextShift: string) => {
      if (nextShift !== "C" && nextShift !== "L") return false;
      const currentVal = schedule[nik]?.[day] || "";
      // If already C or L, not locked (can still change)
      if (currentVal === "C" || currentVal === "L") return false;
      return getCLCountForDay(day) >= MAX_CL_PER_DAY;
    },
    [schedule, getCLCountForDay]
  );

  const handleCellClick = useCallback(
    (nik: string, day: number) => {
      if (!canEditCell(nik)) return;

      const currentVal = schedule[nik]?.[day] || "";
      const currentIndex = SHIFT_OPTIONS.indexOf(currentVal);
      let nextIndex = (currentIndex + 1) % SHIFT_OPTIONS.length;

      const dayLiburCount = getLiburCountForDay(day);
      const dayCLCount = getCLCountForDay(day);
      let attempts = 0;

      while (attempts < SHIFT_OPTIONS.length) {
        const candidate = SHIFT_OPTIONS[nextIndex];
        let skip = false;

        // Skip "L" if day is already at max libur (and current is not L)
        if (
          candidate === "L" &&
          dayLiburCount >= MAX_LIBUR_PER_DAY &&
          currentVal !== "L"
        ) {
          skip = true;
        }

        // Skip "C" or "L" if day is already at max C+L combined (and current is not C/L)
        if (
          (candidate === "C" || candidate === "L") &&
          dayCLCount >= MAX_CL_PER_DAY &&
          currentVal !== "C" &&
          currentVal !== "L"
        ) {
          skip = true;
        }

        if (!skip) break;
        nextIndex = (nextIndex + 1) % SHIFT_OPTIONS.length;
        attempts++;
      }

      setAllSchedule((prev) => ({
        ...prev,
        [monthKey]: {
          ...(prev[monthKey] || {}),
          [nik]: {
            ...((prev[monthKey] || {})[nik] || {}),
            [day]: SHIFT_OPTIONS[nextIndex],
          },
        },
      }));
    },
    [schedule, getLiburCountForDay, getCLCountForDay, canEditCell, monthKey]
  );

  const handleAddEmployee = () => {
    const name = newEmpName.trim();
    const nik = newEmpNik.trim();
    const password = newEmpPassword.trim();
    setAddEmpError("");

    if (!nik) { setAddEmpError("NIK tidak boleh kosong."); return; }
    if (!name) { setAddEmpError("Nama tidak boleh kosong."); return; }
    if (!password) { setAddEmpError("Password tidak boleh kosong."); return; }
    if (nik === ADMIN_NIK) { setAddEmpError("NIK tidak boleh menggunakan kata 'ADMIN'."); return; }
    if (employees.some((e) => e.nik === nik)) { setAddEmpError("NIK sudah terdaftar."); return; }
    if (employees.some((e) => e.name === name)) { setAddEmpError("Nama sudah terdaftar."); return; }

    setEmployees((prev) => [...prev, { nik, name, password }]);
    setNewEmpName("");
    setNewEmpNik("");
    setNewEmpPassword("");
    setShowAddEmployee(false);
    setAddEmpError("");
  };

  const handleRemoveEmployee = (nik: string) => {
    setEmployees((prev) => prev.filter((e) => e.nik !== nik));
    if (loggedInAs === nik) setLoggedInAs(null);
    setAllSchedule((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (next[key][nik]) {
          next[key] = { ...next[key] };
          delete next[key][nik];
        }
      });
      return next;
    });
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const monthName = new Date(year, month, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const getDaySummary = (day: number) => {
    const counts: Record<string, number> = { P: 0, P0: 0, S: 0, M: 0, L: 0, C: 0 };
    employees.forEach((emp) => {
      const val = schedule[emp.nik]?.[day] || "";
      if (val && counts[val] !== undefined) counts[val]++;
    });
    return counts;
  };

  const getEmployeeSummary = (nik: string) => {
    const counts: Record<string, number> = { P: 0, P0: 0, S: 0, M: 0, L: 0, C: 0 };
    days.forEach((day) => {
      const val = schedule[nik]?.[day] || "";
      if (val && counts[val] !== undefined) counts[val]++;
    });
    return counts;
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    const csvContent = "NIK,Nama Karyawan\n001,Ahmad Fauzi\n002,Budi Santoso\n003,Citra Dewi\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_karyawan.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle CSV upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setUploadError("File harus berformat .csv atau .txt");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

      if (lines.length === 0) { setUploadError("File kosong."); return; }

      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes("nik") || firstLine.includes("nama");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      if (dataLines.length === 0) { setUploadError("File tidak memiliki data karyawan."); return; }

      const hasTwoColumns = dataLines[0].includes(",");
      const newEmployees: Employee[] = [];
      const nikSet = new Set<string>();
      const nameSet = new Set<string>();

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        let nik = "";
        let name = "";

        if (hasTwoColumns) {
          const parts = line.split(",");
          nik = parts[0]?.trim() || "";
          name = parts[1]?.trim() || "";
        } else {
          name = line.trim();
          nik = String(i + 1).padStart(3, "0");
        }

        if (!nik || !name) continue;
        if (nik === ADMIN_NIK) continue;
        if (nikSet.has(nik) || nameSet.has(name)) continue;

        nikSet.add(nik);
        nameSet.add(name);
        newEmployees.push({ nik, name, password: nik });
      }

      if (newEmployees.length === 0) {
        setUploadError("Tidak ada data karyawan yang valid ditemukan.");
        return;
      }

      setEmployees(newEmployees);
      if (loggedInAs !== ADMIN_NIK) setLoggedInAs(null);
      setShowUploadModal(false);
      setUploadError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => setUploadError("Gagal membaca file. Coba lagi.");
    reader.readAsText(file);
  };

  // Open login modal for an employee
  const openLoginModal = (emp: Employee) => {
    setLoginModal({ open: true, nik: emp.nik, name: emp.name, inputPassword: "", error: "" });
  };

  // Handle employee login submit
  const handleLoginSubmit = () => {
    const emp = employees.find((e) => e.nik === loginModal.nik);
    if (!emp) return;
    if (loginModal.inputPassword === emp.password) {
      setLoggedInAs(emp.nik);
      setLoginModal({ open: false, nik: "", name: "", inputPassword: "", error: "" });
    } else {
      setLoginModal((prev) => ({ ...prev, error: "Password salah. Coba lagi." }));
    }
  };

  // Handle admin login submit
  const handleAdminLoginSubmit = () => {
    if (adminLoginModal.inputPassword === ADMIN_PASSWORD) {
      setLoggedInAs(ADMIN_NIK);
      setAdminLoginModal({ open: false, inputPassword: "", error: "" });
    } else {
      setAdminLoginModal((prev) => ({ ...prev, error: "Password admin salah." }));
    }
  };

  // Logout
  const handleLogout = () => setLoggedInAs(null);

  // Handle password change
  const handlePasswordChange = () => {
    setPasswordChangeModal((prev) => ({ ...prev, error: "", success: "" }));
    
    if (!loggedInAs || isAdmin) return;
    
    const emp = employees.find((e) => e.nik === loggedInAs);
    if (!emp) return;
    
    const { currentPassword, newPassword, confirmPassword } = passwordChangeModal;
    
    if (currentPassword !== emp.password) {
      setPasswordChangeModal((prev) => ({ ...prev, error: "Password saat ini salah." }));
      return;
    }
    
    if (!newPassword || newPassword.length < 1) {
      setPasswordChangeModal((prev) => ({ ...prev, error: "Password baru tidak boleh kosong." }));
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordChangeModal((prev) => ({ ...prev, error: "Konfirmasi password tidak cocok." }));
      return;
    }
    
    setEmployees((prev) =>
      prev.map((e) => (e.nik === loggedInAs ? { ...e, password: newPassword } : e))
    );
    
    setPasswordChangeModal((prev) => ({ ...prev, success: "Password berhasil diubah!", currentPassword: "", newPassword: "", confirmPassword: "" }));
    
    setTimeout(() => {
      setPasswordChangeModal((prev) => ({ ...prev, open: false, success: "" }));
    }, 1500);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Build header row: NIK | Nama | day1 | day2 | ... | P | P0 | S | M | L | C
    const header = [
      "NIK",
      "Nama Karyawan",
      ...days.map((d) => {
        const dayName = getDayName(year, month, d);
        return `${d} ${dayName}`;
      }),
      "Total P",
      "Total P0",
      "Total S",
      "Total M",
      "Total L",
      "Total C",
    ];

    const rows = employees.map((emp) => {
      const summary = getEmployeeSummary(emp.nik);
      return [
        emp.nik,
        emp.name,
        ...days.map((d) => schedule[emp.nik]?.[d] || ""),
        summary.P,
        summary.P0,
        summary.S,
        summary.M,
        summary.L,
        summary.C,
      ];
    });

    // Summary row
    const summaryRow = [
      "",
      "TOTAL / HARI",
      ...days.map((d) => {
        const s = getDaySummary(d);
        return Object.entries(s)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k}:${v}`)
          .join(" ");
      }),
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    const wsData = [header, ...rows, summaryRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = [
      { wch: 8 },  // NIK
      { wch: 22 }, // Nama
      ...days.map(() => ({ wch: 7 })),
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    ];

    const sheetName = new Date(year, month, 1).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

    const fileName = `jadwal_${year}_${String(month + 1).padStart(2, "0")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Determine login status label
  const loginStatusLabel = () => {
    if (loggedInAs === null) return null;
    if (isAdmin) return { label: "Admin", color: "bg-orange-500" };
    const emp = employees.find((e) => e.nik === loggedInAs);
    if (emp) return { label: `${emp.name} (${emp.nik})`, color: "bg-green-600" };
    return null;
  };
  const loginStatus = loginStatusLabel();

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-full px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                📅 Jadwal Kerja Karyawan
              </h1>
              <p className="text-blue-200 text-sm mt-0.5">
                Klik sel untuk mengubah shift • L maks {MAX_LIBUR_PER_DAY}/hari • C+L maks {MAX_CL_PER_DAY}/hari
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Export Excel - always visible in header */}
              <button
                onClick={handleExportExcel}
                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1"
              >
                📊 Excel
              </button>
              {/* Upload button - admin only in header */}
              {isAdmin && (
                <button
                  onClick={() => { setShowUploadModal(true); setUploadError(""); }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                >
                  📂 Upload
                </button>
              )}
              {/* Login status */}
              {loginStatus ? (
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${loginStatus.color}`}>
                    {isAdmin ? "👑" : "👤"} {loginStatus.label}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAdminLoginModal({ open: true, inputPassword: "", error: "" })}
                    className="text-xs bg-orange-500 hover:bg-orange-400 px-3 py-1.5 rounded-lg font-semibold transition"
                  >
                    👑 Login Admin
                  </button>
                </div>
              )}

              {/* Month navigation */}
              <button
                onClick={prevMonth}
                className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg font-semibold transition"
              >
                ‹
              </button>
              <span className="text-lg font-semibold min-w-[160px] text-center capitalize">
                {monthName}
              </span>
              <button
                onClick={nextMonth}
                className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg font-semibold transition"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full px-4 py-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <span className="text-sm font-semibold text-gray-600 mr-1">Shift:</span>
          {Object.entries(SHIFT_LABELS)
            .filter(([k]) => k !== "")
            .map(([key, label]) => (
              <span
                key={key}
                className={`px-3 py-1 rounded-full text-xs font-bold ${SHIFT_COLORS[key]}`}
              >
                {key} = {label}
              </span>
            ))}
          <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-500 border-2 border-dashed border-gray-400">
            🔒L = maks {MAX_LIBUR_PER_DAY} • 🔒C+L = maks {MAX_CL_PER_DAY}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl shadow-md bg-white">
          <table className="border-collapse text-sm w-full">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th className="sticky left-0 z-20 bg-blue-700 px-4 py-3 text-left font-semibold min-w-[200px] border-r border-blue-600">
                  Karyawan
                </th>
                {days.map((day) => {
                  const liburCount = getLiburCountForDay(day);
                  const clCount = getCLCountForDay(day);
                  const liburFull = liburCount >= MAX_LIBUR_PER_DAY;
                  const clFull = clCount >= MAX_CL_PER_DAY;
                  return (
                    <th
                      key={day}
                      className={`px-1 py-2 text-center font-semibold min-w-[46px] border-r border-blue-600 ${
                        isWeekend(year, month, day) ? "bg-blue-900" : "bg-blue-700"
                      }`}
                    >
                      <div className="text-[10px] opacity-75">
                        {getDayName(year, month, day)}
                      </div>
                      <div className="text-sm">{day}</div>
                      {liburFull && (
                        <div className="text-[9px] bg-red-500 rounded px-0.5 mt-0.5 leading-tight">
                          🔒L
                        </div>
                      )}
                      {clFull && !liburFull && (
                        <div className="text-[9px] bg-orange-500 rounded px-0.5 mt-0.5 leading-tight">
                          🔒C+L
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="px-2 py-3 text-center font-semibold min-w-[90px] bg-blue-800 border-r border-blue-600 text-xs">
                  Rekap
                </th>
                <th className="px-2 py-3 text-center font-semibold min-w-[80px] bg-blue-800">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, empIdx) => {
                const empSummary = getEmployeeSummary(emp.nik);
                const isMyRow = loggedInAs === emp.nik;
                const canEdit = canEditCell(emp.nik);
                return (
                  <tr
                    key={emp.nik}
                    className={`border-b border-gray-200 ${
                      empIdx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } ${isMyRow ? "ring-2 ring-inset ring-blue-400" : ""} hover:bg-blue-50 transition-colors`}
                  >
                    {/* Employee name + NIK */}
                    <td className="sticky left-0 z-10 px-3 py-2 font-medium text-gray-800 border-r border-gray-200 bg-inherit min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ${isMyRow ? "bg-blue-500" : "bg-blue-600"}`}>
                          {emp.name.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate max-w-[120px] text-sm font-semibold" title={emp.name}>
                            {emp.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            NIK: {emp.nik}
                          </span>
                        </div>
                        {/* Login/logout button per row */}
                        {isMyRow ? (
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              onClick={() => setPasswordChangeModal({ open: true, currentPassword: "", newPassword: "", confirmPassword: "", error: "", success: "" })}
                              className="text-[10px] bg-blue-100 text-blue-700 border border-blue-300 rounded px-1.5 py-0.5 hover:bg-blue-200 transition flex-shrink-0"
                              title="Ubah password"
                            >
                              🔐
                            </button>
                            <button
                              onClick={handleLogout}
                              className="text-[10px] bg-green-100 text-green-700 border border-green-300 rounded px-1.5 py-0.5 hover:bg-green-200 transition flex-shrink-0"
                              title="Klik untuk logout"
                            >
                              🔓
                            </button>
                          </div>
                        ) : loggedInAs === null ? (
                          <button
                            onClick={() => openLoginModal(emp)}
                            className="ml-auto text-[10px] bg-gray-100 text-gray-500 border border-gray-300 rounded px-1.5 py-0.5 hover:bg-blue-100 hover:text-blue-600 transition flex-shrink-0"
                            title="Login sebagai karyawan ini"
                          >
                            🔑
                          </button>
                        ) : null}
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map((day) => {
                      const val = schedule[emp.nik]?.[day] || "";
                      const lockedForLibur = isDayLockedForLibur(emp.nik, day);
                      const lockedForCL = isDayLockedForCL(emp.nik, day, "C");
                      const weekend = isWeekend(year, month, day);
                      const editable = canEdit;

                      return (
                        <td
                          key={day}
                          className={`px-0.5 py-1 text-center border-r border-gray-100 ${
                            weekend ? "bg-orange-50" : ""
                          }`}
                        >
                          <button
                            onClick={() => handleCellClick(emp.nik, day)}
                            disabled={!editable}
                            className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center font-bold text-xs transition-all ${
                              editable
                                ? "hover:scale-110 hover:shadow-md cursor-pointer"
                                : "cursor-not-allowed opacity-70"
                            } ${
                              val
                                ? SHIFT_COLORS[val]
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                            title={
                              !editable
                                ? `Login terlebih dahulu untuk mengedit`
                                : lockedForLibur && !val
                                ? `${emp.name} - ${day}: L terkunci (maks ${MAX_LIBUR_PER_DAY} orang)`
                                : lockedForCL && !val
                                ? `${emp.name} - ${day}: C+L terkunci (maks ${MAX_CL_PER_DAY} orang)`
                                : `${emp.name} - ${day}: ${SHIFT_LABELS[val] || "Kosong"} (klik untuk ubah)`
                            }
                          >
                            {val || "·"}
                          </button>
                        </td>
                      );
                    })}

                    {/* Employee summary */}
                    <td className="px-2 py-1 text-center border-r border-gray-200">
                      <div className="flex flex-col gap-0.5 items-center">
                        {empSummary.P > 0 && (
                          <span className="text-[9px] bg-blue-500 text-white rounded px-1 leading-tight w-full text-center">P:{empSummary.P}</span>
                        )}
                        {empSummary.P0 > 0 && (
                          <span className="text-[9px] bg-sky-400 text-white rounded px-1 leading-tight w-full text-center">P0:{empSummary.P0}</span>
                        )}
                        {empSummary.S > 0 && (
                          <span className="text-[9px] bg-yellow-500 text-white rounded px-1 leading-tight w-full text-center">S:{empSummary.S}</span>
                        )}
                        {empSummary.M > 0 && (
                          <span className="text-[9px] bg-purple-600 text-white rounded px-1 leading-tight w-full text-center">M:{empSummary.M}</span>
                        )}
                        {empSummary.L > 0 && (
                          <span className="text-[9px] bg-red-500 text-white rounded px-1 leading-tight w-full text-center">L:{empSummary.L}</span>
                        )}
                        {empSummary.C > 0 && (
                          <span className="text-[9px] bg-green-500 text-white rounded px-1 leading-tight w-full text-center">C:{empSummary.C}</span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-2 py-2 text-center">
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveEmployee(emp.nik)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-1 transition"
                          title="Hapus karyawan"
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Summary row per day */}
              <tr className="bg-blue-50 border-t-2 border-blue-300 font-semibold">
                <td className="sticky left-0 z-10 bg-blue-50 px-4 py-2 text-blue-800 border-r border-blue-200 text-xs">
                  TOTAL / HARI
                </td>
                {days.map((day) => {
                  const summary = getDaySummary(day);
                  const liburFull = summary.L >= MAX_LIBUR_PER_DAY;
                  const clTotal = (summary.C || 0) + (summary.L || 0);
                  const clFull = clTotal >= MAX_CL_PER_DAY;
                  return (
                    <td
                      key={day}
                      className={`px-0.5 py-1 text-center border-r border-blue-100 ${clFull ? "bg-red-50" : ""}`}
                    >
                      <div className="flex flex-col gap-0.5 items-center">
                        {summary.P > 0 && (
                          <span className="text-[9px] bg-blue-500 text-white rounded px-1 leading-tight">P:{summary.P}</span>
                        )}
                        {summary.P0 > 0 && (
                          <span className="text-[9px] bg-sky-400 text-white rounded px-1 leading-tight">P0:{summary.P0}</span>
                        )}
                        {summary.S > 0 && (
                          <span className="text-[9px] bg-yellow-500 text-white rounded px-1 leading-tight">S:{summary.S}</span>
                        )}
                        {summary.M > 0 && (
                          <span className="text-[9px] bg-purple-600 text-white rounded px-1 leading-tight">M:{summary.M}</span>
                        )}
                        {summary.L > 0 && (
                          <span className={`text-[9px] rounded px-1 leading-tight ${liburFull ? "bg-red-600 text-white font-bold" : "bg-red-500 text-white"}`}>
                            L:{summary.L}{liburFull ? "🔒" : ""}
                          </span>
                        )}
                        {summary.C > 0 && (
                          <span className={`text-[9px] rounded px-1 leading-tight ${clFull ? "bg-orange-600 text-white font-bold" : "bg-green-500 text-white"}`}>
                            C:{summary.C}{clFull ? "🔒" : ""}
                          </span>
                        )}
                        {clFull && (
                          <span className="text-[8px] text-orange-700 font-bold leading-tight">C+L:{clTotal}🔒</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center text-blue-700 text-xs border-r border-blue-200">—</td>
                <td className="px-2 py-2 text-center text-blue-700 text-xs">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action buttons row */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {/* Add employee - admin only */}
          {isAdmin && (
            showAddEmployee ? (
              <div className="bg-white border border-gray-200 rounded-xl shadow p-4 flex flex-col gap-3 w-full max-w-md">
                <p className="font-semibold text-gray-700 text-sm">➕ Tambah Karyawan Baru</p>
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs text-gray-500 font-medium">NIK</label>
                    <input
                      type="text"
                      value={newEmpNik}
                      onChange={(e) => setNewEmpNik(e.target.value)}
                      placeholder="Contoh: 009"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-[2]">
                    <label className="text-xs text-gray-500 font-medium">Nama Karyawan</label>
                    <input
                      type="text"
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      placeholder="Nama lengkap..."
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500 font-medium">Password Login</label>
                  <input
                    type="password"
                    value={newEmpPassword}
                    onChange={(e) => setNewEmpPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEmployee()}
                    placeholder="Password untuk login karyawan..."
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                {addEmpError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    ⚠️ {addEmpError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddEmployee}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex-1"
                  >
                    Tambah
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEmployee(false);
                      setNewEmpName("");
                      setNewEmpNik("");
                      setNewEmpPassword("");
                      setAddEmpError("");
                    }}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddEmployee(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                ➕ Tambah Karyawan
              </button>
            )
          )}

          {/* Upload button - admin only */}
          {isAdmin && !showAddEmployee && (
            <button
              onClick={() => { setShowUploadModal(true); setUploadError(""); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              📂 Upload Daftar Karyawan
            </button>
          )}

          {/* Export Excel - always visible */}
          {!showAddEmployee && (
            <button
              onClick={handleExportExcel}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              📊 Export Excel
            </button>
          )}

          <div className="ml-auto text-sm text-gray-500">
            Total karyawan:{" "}
            <span className="font-semibold text-gray-700">{employees.length}</span>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <p className="font-semibold mb-1">ℹ️ Cara Penggunaan:</p>
          <ul className="list-disc list-inside space-y-1 text-yellow-700">
            <li>
              Klik sel untuk mengubah shift: <strong>P → P0 → S → M → L → C → (kosong)</strong>
            </li>
            <li>
              Libur (L) maks <strong>{MAX_LIBUR_PER_DAY} orang/hari</strong> • C+L gabungan maks <strong>{MAX_CL_PER_DAY} orang/hari</strong>
            </li>
            <li>
              <strong>Login Admin</strong> (👑) untuk mengedit semua baris, tambah/hapus karyawan, dan upload CSV.
            </li>
            <li>
              <strong>Login per NIK</strong> (🔑) untuk mengedit baris sendiri saja.
            </li>
            <li>
              Klik <strong>📊 Export Excel</strong> untuk mengunduh jadwal bulan ini ke file .xlsx.
            </li>
            <li>
              Upload CSV mendukung format: <strong>NIK,Nama Karyawan</strong>. Password default = NIK.
            </li>
          </ul>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">📂 Upload Daftar Karyawan</h2>
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(""); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-800 font-semibold mb-1">📋 Format Template CSV</p>
              <p className="text-xs text-blue-700 mb-3">
                Dua kolom: <strong>NIK</strong> dan <strong>Nama Karyawan</strong>.
              </p>
              <div className="bg-white border border-blue-200 rounded-lg p-3 font-mono text-xs text-gray-700 mb-3">
                <div className="text-blue-600 font-bold">NIK,Nama Karyawan</div>
                <div>001,Ahmad Fauzi</div>
                <div>002,Budi Santoso</div>
                <div className="text-gray-400">...</div>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                💡 Password default = NIK karyawan.
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition w-full flex items-center justify-center gap-2"
              >
                ⬇️ Download Template CSV
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Upload File CSV:</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-gray-300 rounded-lg p-1 cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">Format: .csv atau .txt</p>
            </div>

            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                ⚠️ {uploadError}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              ⚠️ <strong>Perhatian:</strong> Upload akan <strong>mengganti</strong> seluruh daftar karyawan.
            </div>

            <button
              onClick={() => { setShowUploadModal(false); setUploadError(""); }}
              className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Employee Login Modal */}
      {loginModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">🔑 Login Karyawan</h2>
              <button
                onClick={() => setLoginModal({ open: false, nik: "", name: "", inputPassword: "", error: "" })}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {loginModal.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{loginModal.name}</p>
                  <p className="text-xs text-gray-500 font-mono">NIK: {loginModal.nik}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password:</label>
              <input
                type="password"
                value={loginModal.inputPassword}
                onChange={(e) => setLoginModal((prev) => ({ ...prev, inputPassword: e.target.value, error: "" }))}
                onKeyDown={(e) => e.key === "Enter" && handleLoginSubmit()}
                placeholder="Masukkan password..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
            </div>

            {loginModal.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                ⚠️ {loginModal.error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleLoginSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Login
              </button>
              <button
                onClick={() => setLoginModal({ open: false, nik: "", name: "", inputPassword: "", error: "" })}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Batal
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-3 text-center">
              Password default = NIK karyawan
            </p>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {adminLoginModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">👑 Login Admin</h2>
              <button
                onClick={() => setAdminLoginModal({ open: false, inputPassword: "", error: "" })}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-orange-800">
                Admin dapat mengedit <strong>semua baris</strong>, menambah/menghapus karyawan, dan mengupload daftar karyawan.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password Admin:</label>
              <input
                type="password"
                value={adminLoginModal.inputPassword}
                onChange={(e) => setAdminLoginModal((prev) => ({ ...prev, inputPassword: e.target.value, error: "" }))}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLoginSubmit()}
                placeholder="Masukkan password admin..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                autoFocus
              />
            </div>

            {adminLoginModal.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                ⚠️ {adminLoginModal.error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAdminLoginSubmit}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Login Admin
              </button>
              <button
                onClick={() => setAdminLoginModal({ open: false, inputPassword: "", error: "" })}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {passwordChangeModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">🔐 Ubah Password</h2>
              <button
                onClick={() => setPasswordChangeModal({ open: false, currentPassword: "", newPassword: "", confirmPassword: "", error: "", success: "" })}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-800">
                Anda sedang mengubah password untuk akun <strong>{loggedInAs}</strong>
              </p>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password Saat Ini:</label>
              <input
                type="password"
                value={passwordChangeModal.currentPassword}
                onChange={(e) => setPasswordChangeModal((prev) => ({ ...prev, currentPassword: e.target.value, error: "", success: "" }))}
                placeholder="Masukkan password saat ini..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password Baru:</label>
              <input
                type="password"
                value={passwordChangeModal.newPassword}
                onChange={(e) => setPasswordChangeModal((prev) => ({ ...prev, newPassword: e.target.value, error: "", success: "" }))}
                placeholder="Masukkan password baru..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Konfirmasi Password Baru:</label>
              <input
                type="password"
                value={passwordChangeModal.confirmPassword}
                onChange={(e) => setPasswordChangeModal((prev) => ({ ...prev, confirmPassword: e.target.value, error: "", success: "" }))}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordChange()}
                placeholder="Masukkan ulang password baru..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {passwordChangeModal.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                ⚠️ {passwordChangeModal.error}
              </div>
            )}

            {passwordChangeModal.success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700">
                ✅ {passwordChangeModal.success}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePasswordChange}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Simpan Password
              </button>
              <button
                onClick={() => setPasswordChangeModal({ open: false, currentPassword: "", newPassword: "", confirmPassword: "", error: "", success: "" })}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
