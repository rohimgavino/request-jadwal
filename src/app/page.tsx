"use client";

import { useState, useCallback, useRef, useMemo } from "react";

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

const INITIAL_EMPLOYEES = [
  "Ahmad Fauzi",
  "Budi Santoso",
  "Citra Dewi",
  "Dian Pratama",
  "Eka Rahayu",
  "Fajar Nugroho",
  "Gita Permata",
  "Hendra Wijaya",
];

// Max employees that can have "L" (Libur) on the same day
const MAX_LIBUR_PER_DAY = 5;

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

// Schedule data keyed by "YYYY-MM" then employee name then day
type MonthSchedule = Record<string, Record<number, string>>;
type AllScheduleData = Record<string, MonthSchedule>;

function getMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default function Home() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [employees, setEmployees] = useState<string[]>(INITIAL_EMPLOYEES);
  // All schedule data across months
  const [allSchedule, setAllSchedule] = useState<AllScheduleData>({});
  const [newEmployee, setNewEmployee] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monthKey = getMonthKey(year, month);
  // Current month's schedule (memoized to avoid new object reference each render)
  const schedule: MonthSchedule = useMemo(
    () => allSchedule[monthKey] || {},
    [allSchedule, monthKey]
  );

  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Count how many employees have "L" on a given day (current month only)
  const getLiburCountForDay = useCallback(
    (day: number) => {
      return employees.filter((emp) => schedule[emp]?.[day] === "L").length;
    },
    [schedule, employees]
  );

  // A cell is locked for "L" if the day already has MAX_LIBUR_PER_DAY employees with L
  const isDayLockedForLibur = useCallback(
    (employee: string, day: number) => {
      const currentVal = schedule[employee]?.[day] || "";
      if (currentVal === "L") return false;
      return getLiburCountForDay(day) >= MAX_LIBUR_PER_DAY;
    },
    [schedule, getLiburCountForDay]
  );

  const handleCellClick = useCallback(
    (employee: string, day: number) => {
      const currentVal = schedule[employee]?.[day] || "";
      const currentIndex = SHIFT_OPTIONS.indexOf(currentVal);
      let nextIndex = (currentIndex + 1) % SHIFT_OPTIONS.length;

      // Skip "L" if day is already at max libur
      const dayLiburCount = getLiburCountForDay(day);
      let attempts = 0;
      while (
        SHIFT_OPTIONS[nextIndex] === "L" &&
        dayLiburCount >= MAX_LIBUR_PER_DAY &&
        currentVal !== "L" &&
        attempts < SHIFT_OPTIONS.length
      ) {
        nextIndex = (nextIndex + 1) % SHIFT_OPTIONS.length;
        attempts++;
      }

      setAllSchedule((prev) => ({
        ...prev,
        [monthKey]: {
          ...(prev[monthKey] || {}),
          [employee]: {
            ...((prev[monthKey] || {})[employee] || {}),
            [day]: SHIFT_OPTIONS[nextIndex],
          },
        },
      }));
    },
    [schedule, getLiburCountForDay, monthKey]
  );

  const handleAddEmployee = () => {
    const name = newEmployee.trim();
    if (name && !employees.includes(name)) {
      setEmployees((prev) => [...prev, name]);
      setNewEmployee("");
      setShowAddEmployee(false);
    }
  };

  const handleRemoveEmployee = (emp: string) => {
    setEmployees((prev) => prev.filter((e) => e !== emp));
    setAllSchedule((prev) => {
      const next = { ...prev };
      // Remove employee from all months
      Object.keys(next).forEach((key) => {
        if (next[key][emp]) {
          next[key] = { ...next[key] };
          delete next[key][emp];
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

  // Summary counts per day
  const getDaySummary = (day: number) => {
    const counts: Record<string, number> = { P: 0, P0: 0, S: 0, M: 0, L: 0, C: 0 };
    employees.forEach((emp) => {
      const val = schedule[emp]?.[day] || "";
      if (val && counts[val] !== undefined) counts[val]++;
    });
    return counts;
  };

  // Per-employee summary
  const getEmployeeSummary = (emp: string) => {
    const counts: Record<string, number> = { P: 0, P0: 0, S: 0, M: 0, L: 0, C: 0 };
    days.forEach((day) => {
      const val = schedule[emp]?.[day] || "";
      if (val && counts[val] !== undefined) counts[val]++;
    });
    return counts;
  };

  // Download CSV template
  const handleDownloadTemplate = () => {
    const csvContent = "Nama Karyawan\nAhmad Fauzi\nBudi Santoso\nCitra Dewi\n";
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
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // Skip header row if it matches "Nama Karyawan" (case-insensitive)
      const dataLines = lines[0]?.toLowerCase() === "nama karyawan" ? lines.slice(1) : lines;

      if (dataLines.length === 0) {
        setUploadError("File tidak memiliki data nama karyawan.");
        return;
      }

      const newNames = dataLines.filter((name) => name.length > 0);
      if (newNames.length === 0) {
        setUploadError("Tidak ada nama karyawan yang valid ditemukan.");
        return;
      }

      setEmployees(newNames);
      setShowUploadModal(false);
      setUploadError("");
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = () => {
      setUploadError("Gagal membaca file. Coba lagi.");
    };
    reader.readAsText(file);
  };

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
                Klik sel untuk mengubah shift • Libur (L) maksimal {MAX_LIBUR_PER_DAY} orang per hari
              </p>
            </div>
            <div className="flex items-center gap-3">
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
            🔒 = Libur penuh ({MAX_LIBUR_PER_DAY} orang)
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl shadow-md bg-white">
          <table className="border-collapse text-sm w-full">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th className="sticky left-0 z-20 bg-blue-700 px-4 py-3 text-left font-semibold min-w-[160px] border-r border-blue-600">
                  Karyawan
                </th>
                {days.map((day) => {
                  const liburCount = getLiburCountForDay(day);
                  const liburFull = liburCount >= MAX_LIBUR_PER_DAY;
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
                    </th>
                  );
                })}
                <th className="px-2 py-3 text-center font-semibold min-w-[90px] bg-blue-800 border-r border-blue-600 text-xs">
                  Rekap
                </th>
                <th className="px-2 py-3 text-center font-semibold min-w-[50px] bg-blue-800">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, empIdx) => {
                const empSummary = getEmployeeSummary(emp);
                return (
                  <tr
                    key={emp}
                    className={`border-b border-gray-200 ${
                      empIdx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-blue-50 transition-colors`}
                  >
                    {/* Employee name */}
                    <td className="sticky left-0 z-10 px-4 py-2 font-medium text-gray-800 border-r border-gray-200 bg-inherit min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {emp.charAt(0)}
                        </div>
                        <span className="truncate max-w-[110px]" title={emp}>
                          {emp}
                        </span>
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map((day) => {
                      const val = schedule[emp]?.[day] || "";
                      const lockedForLibur = isDayLockedForLibur(emp, day);
                      const weekend = isWeekend(year, month, day);

                      return (
                        <td
                          key={day}
                          className={`px-0.5 py-1 text-center border-r border-gray-100 ${
                            weekend ? "bg-orange-50" : ""
                          }`}
                        >
                          <button
                            onClick={() => handleCellClick(emp, day)}
                            className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center font-bold text-xs transition-all hover:scale-110 hover:shadow-md cursor-pointer ${
                              val
                                ? SHIFT_COLORS[val]
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                            title={
                              lockedForLibur && !val
                                ? `${emp} - ${day}: Kosong (L terkunci: sudah ${MAX_LIBUR_PER_DAY} orang libur)`
                                : `${emp} - ${day}: ${SHIFT_LABELS[val] || "Kosong"} (klik untuk ubah)`
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
                          <span className="text-[9px] bg-blue-500 text-white rounded px-1 leading-tight w-full text-center">
                            P:{empSummary.P}
                          </span>
                        )}
                        {empSummary.P0 > 0 && (
                          <span className="text-[9px] bg-sky-400 text-white rounded px-1 leading-tight w-full text-center">
                            P0:{empSummary.P0}
                          </span>
                        )}
                        {empSummary.S > 0 && (
                          <span className="text-[9px] bg-yellow-500 text-white rounded px-1 leading-tight w-full text-center">
                            S:{empSummary.S}
                          </span>
                        )}
                        {empSummary.M > 0 && (
                          <span className="text-[9px] bg-purple-600 text-white rounded px-1 leading-tight w-full text-center">
                            M:{empSummary.M}
                          </span>
                        )}
                        {empSummary.L > 0 && (
                          <span className="text-[9px] bg-red-500 text-white rounded px-1 leading-tight w-full text-center">
                            L:{empSummary.L}
                          </span>
                        )}
                        {empSummary.C > 0 && (
                          <span className="text-[9px] bg-green-500 text-white rounded px-1 leading-tight w-full text-center">
                            C:{empSummary.C}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => handleRemoveEmployee(emp)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-1 transition"
                        title="Hapus karyawan"
                      >
                        🗑️
                      </button>
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
                  return (
                    <td
                      key={day}
                      className={`px-0.5 py-1 text-center border-r border-blue-100 ${liburFull ? "bg-red-50" : ""}`}
                    >
                      <div className="flex flex-col gap-0.5 items-center">
                        {summary.P > 0 && (
                          <span className="text-[9px] bg-blue-500 text-white rounded px-1 leading-tight">
                            P:{summary.P}
                          </span>
                        )}
                        {summary.P0 > 0 && (
                          <span className="text-[9px] bg-sky-400 text-white rounded px-1 leading-tight">
                            P0:{summary.P0}
                          </span>
                        )}
                        {summary.S > 0 && (
                          <span className="text-[9px] bg-yellow-500 text-white rounded px-1 leading-tight">
                            S:{summary.S}
                          </span>
                        )}
                        {summary.M > 0 && (
                          <span className="text-[9px] bg-purple-600 text-white rounded px-1 leading-tight">
                            M:{summary.M}
                          </span>
                        )}
                        {summary.L > 0 && (
                          <span className={`text-[9px] rounded px-1 leading-tight ${liburFull ? "bg-red-600 text-white font-bold" : "bg-red-500 text-white"}`}>
                            L:{summary.L}{liburFull ? "🔒" : ""}
                          </span>
                        )}
                        {summary.C > 0 && (
                          <span className="text-[9px] bg-green-500 text-white rounded px-1 leading-tight">
                            C:{summary.C}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center text-blue-700 text-xs border-r border-blue-200">
                  —
                </td>
                <td className="px-2 py-2 text-center text-blue-700 text-xs">
                  —
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action buttons row */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {showAddEmployee ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newEmployee}
                onChange={(e) => setNewEmployee(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEmployee()}
                placeholder="Nama karyawan baru..."
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
              <button
                onClick={handleAddEmployee}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Tambah
              </button>
              <button
                onClick={() => { setShowAddEmployee(false); setNewEmployee(""); }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddEmployee(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              ➕ Tambah Karyawan
            </button>
          )}

          {/* Upload button */}
          <button
            onClick={() => { setShowUploadModal(true); setUploadError(""); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
          >
            📂 Upload Daftar Karyawan
          </button>

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
              Klik sel untuk mengubah shift secara berurutan:{" "}
              <strong>P → P0 → S → M → L → C → (kosong)</strong>
            </li>
            <li>
              Jika sudah <strong>{MAX_LIBUR_PER_DAY} orang</strong> libur (L) pada hari yang sama,
              pilihan L akan dilewati otomatis 🔒
            </li>
            <li>
              Data jadwal <strong>terpisah per bulan</strong> — pindah bulan tidak akan mengubah jadwal bulan lain
            </li>
            <li>
              <strong>P</strong> = Pagi 06:00 &nbsp;|&nbsp;
              <strong>P0</strong> = Pagi 07:00 &nbsp;|&nbsp;
              <strong>S</strong> = Siang 14:00 &nbsp;|&nbsp;
              <strong>M</strong> = Malam 22:00 &nbsp;|&nbsp;
              <strong>L</strong> = Libur &nbsp;|&nbsp;
              <strong>C</strong> = Cuti
            </li>
            <li>Kolom berwarna oranye = hari Sabtu/Minggu</li>
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

            {/* Template download */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-blue-800 font-semibold mb-1">📋 Format Template CSV</p>
              <p className="text-xs text-blue-700 mb-3">
                File CSV dengan satu kolom <strong>Nama Karyawan</strong>, satu nama per baris.
              </p>
              <div className="bg-white border border-blue-200 rounded-lg p-3 font-mono text-xs text-gray-700 mb-3">
                <div className="text-blue-600 font-bold">Nama Karyawan</div>
                <div>Ahmad Fauzi</div>
                <div>Budi Santoso</div>
                <div>Citra Dewi</div>
                <div className="text-gray-400">... (tambah nama lainnya)</div>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition w-full flex items-center justify-center gap-2"
              >
                ⬇️ Download Template CSV
              </button>
            </div>

            {/* File upload */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Upload File CSV:
              </label>
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
              ⚠️ <strong>Perhatian:</strong> Upload akan <strong>mengganti</strong> seluruh daftar karyawan yang ada saat ini. Data jadwal yang sudah diisi akan tetap tersimpan.
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
    </main>
  );
}
