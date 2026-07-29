import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Printer, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SummaryStats = { planned: number; achieved: number } | { total: number; achieved: number };
type AnnualMaintenanceSummary = {
  year: number;
  months: Array<{
    month: number;
    preventive: { planned: number; achieved: number } | null;
    corrective: { total: number; achieved: number } | null;
  }>;
};

const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function completionRate(total: number, achieved: number) {
  if (total <= 0) return "";
  return `${((achieved / total) * 100).toFixed(2).replace(/\.00$/, "")}%`;
}

export default function ReportsPage() {
  const [type, setType] = useState<"corrective" | "preventive">("corrective");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const selectedYear = Number(year) || new Date().getFullYear();
  const { data, isLoading } = useQuery({
    queryKey: ["annual-maintenance-summary", selectedYear],
    queryFn: () => apiRequest<AnnualMaintenanceSummary>(`/maintenance-requests/reports/annual-maintenance-summary?year=${selectedYear}`),
  });

  const isPreventive = type === "preventive";
  const title = isPreventive ? "ملخص الصيانة الوقائية السنوي" : "ملخص الصيانة العلاجية السنوي";
  const totalLabel = isPreventive ? "إجمالي الأنشطة المخططة" : "إجمالي طلبات الصيانة";
  const achievedLabel = isPreventive ? "إجمالي الأنشطة المنجزة" : "إجمالي الطلبات المنجزة أو المغلقة";
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

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">التقارير</h1>
          <p className="mt-1 text-muted-foreground">ملخص الصيانة العلاجية والوقائية حسب الشهر والسنة.</p>
        </div>
        <div dir="ltr">
          <label className="mb-1 block text-sm font-medium">Year</label>
          <Input className="w-28" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setType("corrective")} variant={!isPreventive ? "default" : "outline"}>
          <Wrench className="ms-2 h-4 w-4" />الصيانة العلاجية
        </Button>
        <Button onClick={() => setType("preventive")} variant={isPreventive ? "default" : "outline"}>
          <ClipboardList className="ms-2 h-4 w-4" />الصيانة الوقائية
        </Button>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">ملخص سنوي مطابق لفكرة ملف تقييم الصيانة الشهري، باستخدام بيانات النظام الفعلية.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">السنة: <span className="font-semibold text-foreground">{selectedYear}</span></div>
            <Button asChild variant="outline"><Link href={`/print/annual-maintenance-summary/${type}/${selectedYear}`}><Printer className="ms-2 h-4 w-4" />طباعة التقرير</Link></Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4"><div className="text-sm text-muted-foreground">{totalLabel}</div><div className="mt-1 text-2xl font-bold">{annual.total}</div></div>
          <div className="rounded-lg border bg-muted/30 p-4"><div className="text-sm text-muted-foreground">{achievedLabel}</div><div className="mt-1 text-2xl font-bold text-emerald-600">{annual.achieved}</div></div>
          <div className="rounded-lg border bg-muted/30 p-4"><div className="text-sm text-muted-foreground">نسبة الإنجاز السنوية</div><div className="mt-1 text-2xl font-bold text-primary">{completionRate(annual.total, annual.achieved) || "—"}</div></div>
        </div>

        <div className="mt-6 rounded-lg border bg-[#d1d5db] p-4" dir="ltr">
          <h3 className="mb-2 text-center text-base font-bold text-black">
            {isPreventive ? "% of monthly preventive maintenance achievement chart" : "% of monthly corrective maintenance achievement chart"}
          </h3>
          <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 24, right: 20, left: 8, bottom: 32 }} barCategoryGap="28%">
              <CartesianGrid stroke="#111827" strokeOpacity={0.75} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#111827" }} interval={0} angle={-42} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fill: "#111827" }} label={{ value: isPreventive ? "# of preventive maintenance activities" : "# of corrective maintenance requests", angle: -90, position: "insideLeft", fill: "#111827", fontSize: 12, fontWeight: 700 }} />
              <Tooltip />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 18 }} />
              <Bar dataKey="total" name={isPreventive ? "# of preventive maintenance activities" : "# of corrective maintenance requests"} fill="#8b8be8" stroke="#111827" />
              <Bar dataKey="achieved" name={isPreventive ? "# of preventive maintenance activities achieved" : "# of corrective maintenance requests achieved"} fill="#a33a76" stroke="#111827">
                <LabelList dataKey="completion" position="top" angle={-90} offset={8} fill="#dc2626" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="border-b bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">الشهر / السنة</th>
                <th className="p-3 font-medium">{isPreventive ? "عدد نشاطات الصيانة الوقائية" : "عدد طلبات الصيانة العلاجية"}</th>
                <th className="p-3 font-medium">{isPreventive ? "عدد نشاطات الصيانة الوقائية المنجزة" : "عدد طلبات الصيانة العلاجية المنجزة"}</th>
                <th className="p-3 font-medium">نسبة الإنجاز</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="p-8 text-center text-muted-foreground" colSpan={4}>جارٍ تحميل التقرير…</td></tr>
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

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">تقرير تقييم أعمال الصيانة الشهري</h2>
            <p className="mt-1 text-sm text-muted-foreground">FORM-10-0944-0 — إدخال وتقييم بيانات كل شهر.</p>
          </div>
          <Button asChild><Link href="/reports/monthly-maintenance-evaluation">فتح التقرير</Link></Button>
        </div>
      </section>
    </div>
  );
}
