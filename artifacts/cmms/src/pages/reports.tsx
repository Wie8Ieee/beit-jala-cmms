import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardList, Pencil, Plus, Printer, Trash2, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

type SummaryStats = { planned: number; achieved: number } | { total: number; achieved: number };
type ManualSummaryAdjustment = { id: string; total: number; achieved: number; description?: string; createdAt: string };
type AnnualMaintenanceSummary = {
  year: number;
  months: Array<{
    month: number;
    preventive: { planned: number; achieved: number } | null;
    corrective: { total: number; achieved: number } | null;
    manualAdjustments: { corrective: ManualSummaryAdjustment[]; preventive: ManualSummaryAdjustment[] };
  }>;
};

const arabicMonthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const englishMonthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function completionRate(total: number, achieved: number) {
  if (total <= 0) return "";
  return `${((achieved / total) * 100).toFixed(2).replace(/\.00$/, "")}%`;
}

export default function ReportsPage() {
  const { i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState<"corrective" | "preventive">("corrective");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isEditing, setIsEditing] = useState(false);
  const [adjustmentMonth, setAdjustmentMonth] = useState("1");
  const [adjustmentTotal, setAdjustmentTotal] = useState("");
  const [adjustmentAchieved, setAdjustmentAchieved] = useState("");
  const [adjustmentDescription, setAdjustmentDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const selectedYear = Number(year) || new Date().getFullYear();
  const { data, isLoading } = useQuery({
    queryKey: ["annual-maintenance-summary", selectedYear],
    queryFn: () => apiRequest<AnnualMaintenanceSummary>(`/maintenance-requests/reports/annual-maintenance-summary?year=${selectedYear}`),
  });

  const isArabic = i18n.language.startsWith("ar");
  const monthNames = isArabic ? arabicMonthNames : englishMonthNames;
  const isPreventive = type === "preventive";
  const copy = isArabic ? {
    pageTitle: "التقارير", pageSubtitle: "ملخص الصيانة العلاجية والوقائية حسب الشهر والسنة.", year: "السنة",
    corrective: "الصيانة العلاجية", preventive: "الصيانة الوقائية",
    correctiveTitle: "ملخص الصيانة العلاجية السنوي", preventiveTitle: "ملخص الصيانة الوقائية السنوي",
    summary: "ملخص سنوي مطابق لفكرة ملف تقييم الصيانة الشهري، باستخدام بيانات النظام الفعلية.", print: "طباعة التقرير",
    totalCorrective: "إجمالي طلبات الصيانة", totalPreventive: "إجمالي الأنشطة المخططة",
    achievedCorrective: "إجمالي الطلبات المنجزة أو المغلقة", achievedPreventive: "إجمالي الأنشطة المنجزة",
    annualRate: "نسبة الإنجاز السنوية", monthYear: "الشهر / السنة", rate: "نسبة الإنجاز", loading: "جارٍ تحميل التقرير…",
    correctiveChart: "% من إنجاز طلبات الصيانة العلاجية الشهرية", preventiveChart: "% من إنجاز أنشطة الصيانة الوقائية الشهرية",
    correctiveAxis: "طلبات الصيانة العلاجية", preventiveAxis: "أنشطة الصيانة الوقائية",
    correctiveTotal: "عدد طلبات الصيانة العلاجية", preventiveTotal: "عدد نشاطات الصيانة الوقائية",
    correctiveAchieved: "عدد طلبات الصيانة العلاجية المنجزة", preventiveAchieved: "عدد نشاطات الصيانة الوقائية المنجزة",
    monthlyTitle: "تقرير تقييم أعمال الصيانة الشهري", monthlyDescription: "FORM-10-0944-0 — إدخال وتقييم بيانات كل شهر.", correctiveTimeTitle: "وقت الصيانة العلاجية", correctiveTimeDescription: "إجمالي وقت الإصلاح لكل ماكينة خلال الشهر المحدد.", open: "فتح التقرير",
    edit: "تعديل الملخص", done: "إنهاء التعديل", manualAdjustments: "تعديلات يدوية", adjustmentNote: "تُحسب بيانات النظام تلقائياً. هذه التعديلات تؤثر في الملخص فقط ولا تحذف طلبات الصيانة.",
    adjustmentMonth: "الشهر", totalAdjustment: "تعديل العدد", achievedAdjustment: "تعديل المنجز", description: "ملاحظة (اختياري)", addAdjustment: "إضافة تعديل", delete: "حذف", noAdjustments: "لا توجد تعديلات يدوية.", invalidAdjustment: "أدخلي أرقاماً صحيحة لتعديل العدد والمنجز.", saving: "جارٍ الحفظ…", deleteConfirm: "هل تريدين حذف هذا التعديل اليدوي؟",
  } : {
    pageTitle: "Reports", pageSubtitle: "Summary of corrective and preventive maintenance by month and year.", year: "Year",
    corrective: "Corrective Maintenance", preventive: "Preventive Maintenance",
    correctiveTitle: "Annual Corrective Maintenance Summary", preventiveTitle: "Annual Preventive Maintenance Summary",
    summary: "Annual summary based on the monthly maintenance evaluation report and actual system data.", print: "Print Report",
    totalCorrective: "Total maintenance requests", totalPreventive: "Total planned activities",
    achievedCorrective: "Total completed or closed requests", achievedPreventive: "Total completed activities",
    annualRate: "Annual completion rate", monthYear: "Month / Year", rate: "Completion rate", loading: "Loading report…",
    correctiveChart: "% of monthly corrective maintenance achievement chart", preventiveChart: "% of monthly preventive maintenance achievement chart",
    correctiveAxis: "Corrective requests", preventiveAxis: "Preventive activities",
    correctiveTotal: "# of corrective maintenance requests", preventiveTotal: "# of preventive maintenance activities",
    correctiveAchieved: "# of corrective maintenance requests achieved", preventiveAchieved: "# of preventive maintenance activities achieved",
    monthlyTitle: "Monthly Maintenance Evaluation Report", monthlyDescription: "FORM-10-0944-0 — enter and evaluate data for each month.", correctiveTimeTitle: "Corrective Maintenance Time", correctiveTimeDescription: "Total corrective repair time per machine for the selected month.", open: "Open report",
    edit: "Edit summary", done: "Finish editing", manualAdjustments: "Manual adjustments", adjustmentNote: "System data is calculated automatically. Manual adjustments affect this summary only and never delete maintenance requests.",
    adjustmentMonth: "Month", totalAdjustment: "Total adjustment", achievedAdjustment: "Achieved adjustment", description: "Note (optional)", addAdjustment: "Add adjustment", delete: "Delete", noAdjustments: "No manual adjustments.", invalidAdjustment: "Enter whole-number total and achieved adjustments.", saving: "Saving…", deleteConfirm: "Delete this manual adjustment?",
  };
  const title = isPreventive ? copy.preventiveTitle : copy.correctiveTitle;
  const totalLabel = isPreventive ? copy.totalPreventive : copy.totalCorrective;
  const achievedLabel = isPreventive ? copy.achievedPreventive : copy.achievedCorrective;
  const statsFor = (month: AnnualMaintenanceSummary["months"][number]): SummaryStats | null =>
    isPreventive ? month.preventive : month.corrective;
  const annual = (data?.months ?? []).reduce(
    (summary, month) => {
      const stats = statsFor(month);
      if (!stats) return summary;
      return {
        total: summary.total + ("planned" in stats ? stats.planned : stats.total),
        achieved: summary.achieved + stats.achieved,
      };
    },
    { total: 0, achieved: 0 },
  );
  const chartRows = (data?.months ?? []).map((month) => {
    const stats = statsFor(month);
    const total = stats ? ("planned" in stats ? stats.planned : stats.total) : 0;
    const achieved = stats?.achieved ?? 0;
    return {
      month: `${monthNames[month.month - 1]} ${selectedYear}`,
      total,
      achieved,
      completion: total > 0 ? completionRate(total, achieved) : "",
    };
  });
  const canEdit = hasPermission("edit_reports");
  const activeAdjustments = (data?.months ?? []).flatMap((month) =>
    (month.manualAdjustments?.[type] ?? []).map((adjustment) => ({ ...adjustment, month: month.month })),
  );
  const refreshSummary = () => queryClient.invalidateQueries({ queryKey: ["annual-maintenance-summary", selectedYear] });
  const addAdjustment = useMutation({
    mutationFn: () => apiRequest("/maintenance-requests/reports/annual-maintenance-summary/adjustments", {
      method: "POST",
      body: JSON.stringify({ year: selectedYear, month: Number(adjustmentMonth), type, total: Number(adjustmentTotal), achieved: Number(adjustmentAchieved), description: adjustmentDescription.trim() }),
    }),
    onSuccess: () => {
      setAdjustmentTotal(""); setAdjustmentAchieved(""); setAdjustmentDescription(""); setEditError(null); refreshSummary();
    },
    onError: (error) => setEditError(error instanceof Error ? error.message : copy.invalidAdjustment),
  });
  const deleteAdjustment = useMutation({
    mutationFn: ({ month, id }: { month: number; id: string }) => apiRequest(`/maintenance-requests/reports/annual-maintenance-summary/adjustments/${selectedYear}/${month}/${type}/${id}`, { method: "DELETE" }),
    onSuccess: refreshSummary,
    onError: (error) => setEditError(error instanceof Error ? error.message : copy.invalidAdjustment),
  });
  const submitAdjustment = () => {
    if (!Number.isInteger(Number(adjustmentTotal)) || !Number.isInteger(Number(adjustmentAchieved))) {
      setEditError(copy.invalidAdjustment);
      return;
    }
    addAdjustment.mutate();
  };

  return (
    <div className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{copy.pageTitle}</h1>
          <p className="mt-1 text-muted-foreground">{copy.pageSubtitle}</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{copy.year}</label>
          <Input className="w-28" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setType("corrective")} variant={!isPreventive ? "default" : "outline"}>
          <Wrench className="ms-2 h-4 w-4" />{copy.corrective}
        </Button>
        <Button onClick={() => setType("preventive")} variant={isPreventive ? "default" : "outline"}>
          <ClipboardList className="ms-2 h-4 w-4" />{copy.preventive}
        </Button>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{copy.monthlyTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.monthlyDescription}</p>
          </div>
          <Button asChild><Link href="/reports/monthly-maintenance-evaluation">{copy.open}</Link></Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{copy.correctiveTimeTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.correctiveTimeDescription}</p>
          </div>
          <Button asChild variant="outline"><Link href="/reports/corrective-maintenance-time">{copy.correctiveTimeTitle}</Link></Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.summary}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">{copy.year}: <span className="font-semibold text-foreground">{selectedYear}</span></div>
            {canEdit && <Button variant={isEditing ? "secondary" : "outline"} onClick={() => { setIsEditing((current) => !current); setEditError(null); }}><Pencil className="ms-2 h-4 w-4" />{isEditing ? copy.done : copy.edit}</Button>}
            <Button asChild variant="outline"><Link href={`/print/annual-maintenance-summary/${type}/${selectedYear}`}><Printer className="ms-2 h-4 w-4" />{copy.print}</Link></Button>
          </div>
        </div>

        {isEditing && canEdit && (
          <div className="mt-5 rounded-lg border border-dashed bg-muted/20 p-4">
            <h3 className="font-semibold">{copy.manualAdjustments}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{copy.adjustmentNote}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(220px,2fr)_auto]">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={adjustmentMonth} onChange={(event) => setAdjustmentMonth(event.target.value)}>
                {monthNames.map((name, index) => <option key={name} value={index + 1}>{name} {selectedYear}</option>)}
              </select>
              <Input type="number" step="1" placeholder={copy.totalAdjustment} value={adjustmentTotal} onChange={(event) => setAdjustmentTotal(event.target.value)} />
              <Input type="number" step="1" placeholder={copy.achievedAdjustment} value={adjustmentAchieved} onChange={(event) => setAdjustmentAchieved(event.target.value)} />
              <Input placeholder={copy.description} value={adjustmentDescription} onChange={(event) => setAdjustmentDescription(event.target.value)} />
              <Button onClick={submitAdjustment} disabled={addAdjustment.isPending}><Plus className="ms-2 h-4 w-4" />{addAdjustment.isPending ? copy.saving : copy.addAdjustment}</Button>
            </div>
            {editError && <p className="mt-3 text-sm text-destructive">{editError}</p>}
            <div className="mt-4 space-y-2">
              {activeAdjustments.length === 0 ? <p className="text-sm text-muted-foreground">{copy.noAdjustments}</p> : activeAdjustments.map((adjustment) => (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm" key={adjustment.id}>
                  <span>{monthNames[adjustment.month - 1]} {selectedYear} · {copy.totalAdjustment}: {adjustment.total >= 0 ? "+" : ""}{adjustment.total} · {copy.achievedAdjustment}: {adjustment.achieved >= 0 ? "+" : ""}{adjustment.achieved}{adjustment.description ? ` · ${adjustment.description}` : ""}</span>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={deleteAdjustment.isPending} onClick={() => { if (window.confirm(copy.deleteConfirm)) deleteAdjustment.mutate({ month: adjustment.month, id: adjustment.id }); }}><Trash2 className="ms-1 h-4 w-4" />{copy.delete}</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4"><div className="text-sm text-muted-foreground">{totalLabel}</div><div className="mt-1 text-2xl font-bold">{annual.total}</div></div>
          <div className="rounded-lg border bg-muted/30 p-4"><div className="text-sm text-muted-foreground">{achievedLabel}</div><div className="mt-1 text-2xl font-bold text-emerald-600">{annual.achieved}</div></div>
          <div className="rounded-lg border bg-muted/30 p-4"><div className="text-sm text-muted-foreground">{copy.annualRate}</div><div className="mt-1 text-2xl font-bold text-primary">{completionRate(annual.total, annual.achieved) || "—"}</div></div>
        </div>

        <div className="mt-6 rounded-lg border bg-white p-5 shadow-sm" dir="ltr">
          <h3 className="mb-3 text-center text-lg font-bold text-slate-900">
            {isPreventive ? copy.preventiveChart : copy.correctiveChart}
          </h3>
          <div className="relative h-[26rem]">
            <div className="pointer-events-none absolute left-12 top-1/2 z-10 -mt-16 -translate-y-1/2 whitespace-nowrap text-sm font-bold text-slate-900 [writing-mode:vertical-rl] rotate-180">
              {isPreventive ? copy.preventiveTotal : copy.correctiveTotal}
            </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 28, right: 22, left: 72, bottom: 58 }} barCategoryGap="30%" barGap={4}>
              <CartesianGrid stroke="#cbd5e1" strokeOpacity={1} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#334155" }}
                axisLine={{ stroke: "#64748b" }}
                tickLine={{ stroke: "#64748b" }}
                interval={0}
                angle={-42}
                textAnchor="end"
                height={72}
              />
              <YAxis allowDecimals={false} tick={{ fill: "#334155" }} axisLine={{ stroke: "#64748b" }} tickLine={{ stroke: "#64748b" }} />
              <Tooltip />
              <Bar dataKey="total" barSize={18} name={isPreventive ? copy.preventiveTotal : copy.correctiveTotal} fill="#174b72" stroke="#123b5a" radius={[1, 1, 0, 0]}>
                <LabelList
                  dataKey="completion"
                  content={({ x, y, width, value }: any) => value ? (
                    <text x={Number(x) + Number(width) + 2} y={Number(y) - 8} textAnchor="middle" fill="#b91c1c" fontSize={13} fontWeight={800}>
                      {value}
                    </text>
                  ) : null}
                />
              </Bar>
              <Bar dataKey="achieved" barSize={18} name={isPreventive ? copy.preventiveAchieved : copy.correctiveAchieved} fill="#2aa198" stroke="#208078" radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
          <div className="relative -top-20 text-center text-base font-bold text-slate-900">{copy.monthYear}</div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium">
            <span className="inline-flex items-center gap-2 text-[#174b72]"><span className="h-3 w-3 bg-[#174b72]" />{isPreventive ? copy.preventiveTotal : copy.correctiveTotal}</span>
            <span className="inline-flex items-center gap-2 text-[#208078]"><span className="h-3 w-3 bg-[#2aa198]" />{isPreventive ? copy.preventiveAchieved : copy.correctiveAchieved}</span>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className={`w-full min-w-[640px] text-sm ${isArabic ? "text-right" : "text-left"}`}>
            <thead className="border-b bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">{copy.monthYear}</th>
                <th className="p-3 font-medium">{isPreventive ? copy.preventiveTotal : copy.correctiveTotal}</th>
                <th className="p-3 font-medium">{isPreventive ? copy.preventiveAchieved : copy.correctiveAchieved}</th>
                <th className="p-3 font-medium">{copy.rate}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="p-8 text-center text-muted-foreground" colSpan={4}>{copy.loading}</td></tr>
              ) : (data?.months ?? []).map((month) => {
                const stats = statsFor(month);
                const total = stats ? ("planned" in stats ? stats.planned : stats.total) : null;
                return (
                  <tr className="border-b last:border-0" key={month.month}>
                    <td className="p-3 font-medium">{monthNames[month.month - 1]} {selectedYear}</td>
                    <td className="p-3">{total ?? ""}</td>
                    <td className="p-3">{stats?.achieved ?? ""}</td>
                    <td className="p-3" dir="ltr">{stats && total !== null ? completionRate(total, stats.achieved) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
