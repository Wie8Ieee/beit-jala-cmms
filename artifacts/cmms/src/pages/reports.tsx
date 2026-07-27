import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardList, Wrench } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CorrectiveReport = {
  year: number;
  annualTotal: number;
  completedAnnualTotal: number;
  months: Array<{
    month: number;
    total: number;
    completed: number;
    requests: Array<{ id: number; requestReportNumber: string; machineName: string; machineNumber: string; requestDate: string; status: string }>;
  }>;
};

const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const statusNames: Record<string, string> = { Completed: "مكتمل", Closed: "مغلق", "In Progress": "قيد التنفيذ", Accepted: "مقبول", Submitted: "مقدّم", "Pending QA Approval": "بانتظار QA", "External Maintenance": "صيانة خارجية" };

export default function ReportsPage() {
  const [type, setType] = useState<"corrective" | "preventive">("corrective");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const selectedYear = Number(year) || new Date().getFullYear();
  const { data, isLoading } = useQuery({
    queryKey: ["corrective-maintenance-report", selectedYear],
    queryFn: () => apiRequest<CorrectiveReport>(`/maintenance-requests/reports/corrective-maintenance?year=${selectedYear}`),
    enabled: type === "corrective",
  });
  const highest = Math.max(1, ...(data?.months.map((month) => month.completed) ?? [0]));

  return <div className="space-y-6" dir="rtl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight">التقارير</h1><p className="mt-1 text-muted-foreground">ملخص الصيانة العلاجية والوقائية حسب الشهر والسنة.</p></div>
      <div className="flex items-end gap-2" dir="ltr"><div><label className="mb-1 block text-sm font-medium">Year</label><Input className="w-28" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} /></div></div>
    </div>

    <div className="flex flex-wrap gap-3">
      <Button onClick={() => setType("corrective")} variant={type === "corrective" ? "default" : "outline"}><Wrench className="ms-2 h-4 w-4" />الصيانة العلاجية</Button>
      <Button onClick={() => setType("preventive")} variant={type === "preventive" ? "default" : "outline"}><ClipboardList className="ms-2 h-4 w-4" />الصيانة الوقائية</Button>
    </div>

    {type === "preventive" ? <div className="rounded-xl border bg-card p-10 text-center"><ClipboardList className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><h2 className="text-xl font-semibold">تقارير الصيانة الوقائية</h2><p className="mt-2 text-muted-foreground">اختاري الصيانة العلاجية لعرض تقرير طلبات الصيانة الحالي.</p></div> : <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-5"><div className="text-sm text-muted-foreground">إجمالي طلبات الصيانة العلاجية لسنة {selectedYear}</div><div className="mt-2 text-3xl font-bold">{data?.annualTotal ?? 0}</div></div>
        <div className="rounded-xl border bg-card p-5"><div className="text-sm text-muted-foreground">الصيانات المنجزة أو المغلقة</div><div className="mt-2 text-3xl font-bold text-emerald-600">{data?.completedAnnualTotal ?? 0}</div></div>
      </div>

      <section className="rounded-xl border bg-card p-5"><div className="mb-5 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">الصيانات المنجزة حسب الشهر</h2><p className="text-sm text-muted-foreground">عدد الطلبات المكتملة أو المغلقة خلال سنة {selectedYear}</p></div></div>
        <div className="flex h-56 items-end gap-2 border-b border-slate-200 pb-7" dir="ltr">{(data?.months ?? []).map((month) => <div className="flex h-full min-w-0 flex-1 flex-col justify-end" key={month.month} title={`${monthNames[month.month - 1]}: ${month.completed}`}><div className="mb-1 text-center text-xs font-medium">{month.completed || ""}</div><div className="min-h-1 rounded-t bg-primary transition-all" style={{ height: `${Math.max(month.completed ? 7 : 1, (month.completed / highest) * 100)}%` }} /><div className="absolute" /></div>)}</div>
        <div className="mt-2 grid grid-cols-12 gap-2 text-center text-xs text-muted-foreground">{monthNames.map((name) => <div key={name}>{name}</div>)}</div>
      </section>

      <section className="rounded-xl border bg-card">
        <div className="border-b p-5"><h2 className="font-semibold">طلبات الصيانة العلاجية حسب الشهر</h2><p className="mt-1 text-sm text-muted-foreground">يشمل اسم الماكينة، رقمها، ورقم طلب الصيانة.</p></div>
        {isLoading ? <div className="p-8 text-center text-muted-foreground">جارٍ تحميل التقرير…</div> : <div className="divide-y">
          {(data?.months ?? []).map((month) => (
            <div key={month.month} className="p-5">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{monthNames[month.month - 1]} {selectedYear}</h3><span className="rounded-full bg-muted px-3 py-1 text-sm">{month.total} طلب</span></div>
              {month.requests.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد طلبات صيانة علاجية خلال هذا الشهر.</p> : <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-right text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-2">رقم الطلب</th><th className="p-2">اسم الماكينة</th><th className="p-2">رقم الماكينة</th><th className="p-2">تاريخ الطلب</th><th className="p-2">الحالة</th></tr></thead><tbody>
                  {month.requests.map((request) => (<tr className="border-b last:border-0" key={request.id}><td className="p-2 font-medium" dir="ltr">{request.requestReportNumber}</td><td className="p-2">{request.machineName}</td><td className="p-2" dir="ltr">{request.machineNumber}</td><td className="p-2" dir="ltr">{request.requestDate}</td><td className="p-2">{statusNames[request.status] ?? request.status}</td></tr>))}
                </tbody></table>
              </div>}
            </div>
          ))}
        </div>}
      </section>
    </>}
  </div>;
}
