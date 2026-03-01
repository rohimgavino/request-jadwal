"use client";

import { useState, useCallback } from "react";

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

type ScheduleData = Record<string, Record<number, string>>;

export default function Home() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [employees, setEmployees] = useState<string[]>(INITIAL_EMPLOYEES);
  const [schedule, setSchedule] = useState<ScheduleData>({});
  const [newEmployee, setNewEmployee] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Count how many employees have "L" on a given day
  const getLiburCountForDay = useCallback(
    (day: number) => {
      return employees.filter((emp) => schedule[emp]?.[day] === "L").length;
    },
    [schedule, employees]
  );

  // A cell is locked for "L" if the day already has MAX_LIBUR_PER_DAY employees with L
  // and this employee doesn't already have L on that day
  const isDayLockedForLibur = useCallback(
    (employee: string, day: number) => {
      const currentVal = schedule[employee]?.[day] || "";
      if (currentVal === "L") return false; // already L, not locked
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

      setSchedule((prev) => ({
        ...prev,
        [employee]: {
          ...(prev[employee] || {}),
          [day]: SHIFT_OPTIONS[nextIndex],
        },
      }));
    },
    [schedule, getLiburCountForDay]
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
    setSchedule((prev) => {
      const next = { ...prev };
      delete next[emp];
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
                          {lockedForLibur && val !== "L" ? (
                            // Show lock only on empty cells when day is full for L
                            // But still allow non-L shifts
                            <button
                              onClick={() => handleCellClick(emp, day)}
                              className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center font-bold text-xs transition-all hover:scale-110 hover:shadow-md cursor-pointer ${
                                val
                                  ? SHIFT_COLORS[val]
                                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                              }`}
                              title={`${emp} - ${day}: ${SHIFT_LABELS[val] || "Kosong"} (L terkunci: sudah ${MAX_LIBUR_PER_DAY} orang libur)`}
                            >
                              {val || "·"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCellClick(emp, day)}
                              className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center font-bold text-xs transition-all hover:scale-110 hover:shadow-md cursor-pointer ${
                                val
                                  ? SHIFT_COLORS[val]
                                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                              }`}
                              title={`${emp} - ${day}: ${SHIFT_LABELS[val] || "Kosong"} (klik untuk ubah)`}
                            >
                              {val || "·"}
                            </button>
                          )}
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

        {/* Add Employee */}
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
    </main>
  );
}
