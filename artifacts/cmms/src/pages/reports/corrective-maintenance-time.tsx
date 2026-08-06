import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

type RepairInterval = {
  date: string;
  from: string;
  to: string;
  minutes: number;
};

type MachineTime = {
  machineId: string;
  machineName: string;
  machineNumber: string;
  totalMinutes: number;
  intervals: RepairInterval[];
};

type CorrectiveMaintenanceTimeSummary = {
  year: number;
  month: number;
  machines: MachineTime[];
  totalMinutes: number;
  totalIntervals: number;
};

const englishMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatDuration(minutes: number, isArabic: boolean) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (isArabic) {
    if (hours && remainder) return `${hours} ساعة و ${remainder} دقيقة`;
    if (hours) return `${hours} ساعة`;
    return `${remainder} دقيقة`;
  }

  if (hours && remainder) return `${hours} h ${remainder} min`;
  if (hours) return `${hours} h`;
  return `${remainder} min`;
}

export default function CorrectiveMaintenanceTimePage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ["corrective-maintenance-time", year, month],
    queryFn: () => apiRequest<CorrectiveMaintenanceTimeSummary>(
      `/maintenance-requests/reports/corrective-maintenance-time?year=${year}&month=${month}`,
    ),
  });

  const copy = isArabic
    ? {
        title: "وقت الصيانة العلاجية",
        description: "إجمالي وقت الإصلاح المسجل للصيانة العلاجية فقط، لكل ماكينة خلال الشهر المحدد.",
        back: "العودة إلى التقارير",
        year: "السنة",
        month: "الشهر",
        machines: "الماكينات التي تمت صيانتها علاجياً",
        totalTime: "إجمالي وقت الإصلاح",
        repairPeriods: "فترات الإصلاح (من / إلى)",
        totalMachines: "إجمالي الماكينات",
        intervals: "فترات الإصلاح",
        allMachinesTotal: "إجمالي وقت الصيانة لجميع الماكينات",
        loading: "جارٍ تحميل بيانات الصيانة العلاجية...",
        empty: "لا توجد فترات إصلاح علاجية مكتملة لهذا الشهر.",
      }
    : {
        title: "Corrective Maintenance Time",
        description: "Total recorded repair time for corrective maintenance only, by machine for the selected month.",
        back: "Back to reports",
        year: "Year",
        month: "Month",
        machines: "Machines with corrective maintenance",
        totalTime: "Total repair time",
        repairPeriods: "Repair periods (from / to)",
        totalMachines: "Total machines",
        intervals: "Repair periods",
        allMachinesTotal: "Total maintenance time for all machines",
        loading: "Loading corrective maintenance data...",
        empty: "No completed corrective repair periods were recorded for this month.",
      };

  const monthNames = isArabic ? arabicMonths : englishMonths;

  return (
    <main className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" aria-label={copy.back}>
          <Link href="/reports"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-muted-foreground">{copy.description}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,220px)]">
          <label className="grid gap-2 text-sm font-medium">
            {copy.year}
            <Input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(event) => setYear(Number(event.target.value) || today.getFullYear())}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {copy.month}
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{copy.totalMachines}</p>
          <p className="mt-2 text-3xl font-bold">{data?.machines.length ?? 0}</p>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{copy.intervals}</p>
          <p className="mt-2 text-3xl font-bold">{data?.totalIntervals ?? 0}</p>
        </section>
        <section className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{copy.allMachinesTotal}</p>
          <p className="mt-2 text-3xl font-bold text-primary">{formatDuration(data?.totalMinutes ?? 0, isArabic)}</p>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b p-5">
          <Clock3 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{copy.machines}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-start">{copy.machines}</th>
                <th className="px-5 py-3 text-start">{copy.repairPeriods}</th>
                <th className="px-5 py-3 text-start">{copy.totalTime}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={3}>{copy.loading}</td></tr>
              ) : !data?.machines.length ? (
                <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={3}>{copy.empty}</td></tr>
              ) : data.machines.map((machine) => (
                <tr key={machine.machineId} className="border-t align-top">
                  <td className="px-5 py-4 font-medium">
                    {machine.machineName}
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">{machine.machineNumber}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      {machine.intervals.map((slot, index) => (
                        <div key={`${slot.date}-${slot.from}-${index}`}>
                          {slot.date} · {slot.from}–{slot.to}
                          <span className="text-muted-foreground"> ({formatDuration(slot.minutes, isArabic)})</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold">{formatDuration(machine.totalMinutes, isArabic)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
