import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ElectronicSignatureField } from "@/components/electronic-signature-field";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Report = Record<string, string | number | null | undefined>;
type FlexibleRow = Record<string, string>;
const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const pct = (part: unknown, total: unknown) => Number(total) > 0 ? ((Number(part) / Number(total)) * 100).toFixed(1) : "0.0";

function readRows(value: unknown, keys: string[], legacy?: FlexibleRow): FlexibleRow[] {
  if (typeof value === "string" && value) {
    try {
      const rows = JSON.parse(value);
      if (Array.isArray(rows)) return rows.map((row) => Object.fromEntries(keys.map((key) => [key, String(row?.[key] ?? "")])));
    } catch { /* Legacy plain-text values remain supported. */ }
    return [{ ...Object.fromEntries(keys.map((key) => [key, ""])), ...(legacy ?? { [keys[0]]: value }) }];
  }
  return [{ ...Object.fromEntries(keys.map((key) => [key, ""])), ...(legacy ?? {}) }];
}

const writeRows = (rows: FlexibleRow[]) => JSON.stringify(rows);

function YesNo({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <div className="flex gap-6" dir="rtl">{["نعم", "لا"].map((item) => <button key={item} type="button" disabled={disabled} onClick={() => onChange(item)} className="flex items-center gap-2 disabled:cursor-default"><span className="flex h-5 w-5 items-center justify-center border border-black text-sm">{value === item ? "✓" : ""}</span>{item}</button>)}</div>;
}

export default function MonthlyMaintenanceEvaluationPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [form, setForm] = useState<Report>({});
  const { hasPermission } = useAuth(); const canEdit = hasPermission("edit_maintenance_plans");
  const { toast } = useToast(); const client = useQueryClient();
  const query = useQuery({ queryKey: ["monthly-maintenance-evaluation", year, month], queryFn: () => apiRequest<Report>(`/maintenance-requests/reports/monthly-maintenance-evaluation?year=${year}&month=${month}`) });
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const set = (key: string, value: string | number) => setForm((old) => ({ ...old, [key]: value }));
  const save = useMutation({ mutationFn: () => apiRequest<Report>("/maintenance-requests/reports/monthly-maintenance-evaluation", { method: "PUT", body: JSON.stringify({ ...form, year, month }) }), onSuccess: () => { client.invalidateQueries({ queryKey: ["monthly-maintenance-evaluation", year, month] }); toast({ title: "تم حفظ التقرير الشهري" }); }, onError: (error: Error) => toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" }) });
  const input = (key: string, label: string, type = "text") => <div><label className="mb-1 block font-medium">{label}</label><Input type={type} disabled={!canEdit} value={String(form[key] ?? "")} onChange={(e) => set(key, type === "number" ? Number(e.target.value) : e.target.value)} /></div>;
  const formula = (a: string, b: string, title: string) => <div className="rounded-md border bg-muted/30 p-3"><div className="font-medium">{title}</div><div className="mt-1 text-lg" dir="ltr">({form[a] ?? 0} / {form[b] ?? 0}) × 100 = <strong>{pct(form[a], form[b])}%</strong></div></div>;
  const rowsTable = (storageKey: string, columns: { key: string; label: string }[], legacy?: FlexibleRow, afterUpdate?: (rows: FlexibleRow[]) => void) => {
    const rows = readRows(form[storageKey], columns.map((column) => column.key), legacy);
    const updateRows = (next: FlexibleRow[]) => {
      set(storageKey, writeRows(next));
      afterUpdate?.(next);
    };
    return <div className="space-y-2">
      <div className="flex items-center justify-between">{canEdit && <Button type="button" size="sm" variant="outline" onClick={() => updateRows([...rows, Object.fromEntries(columns.map((column) => [column.key, ""]))])}><Plus className="ms-1 h-4 w-4" />إضافة صف</Button>}</div>
      <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[650px] text-sm"><thead className="bg-muted/50"><tr>{columns.map((column) => <th key={column.key} className="border-b px-3 py-2 text-right font-medium">{column.label}</th>)}{canEdit && <th className="w-12 border-b" />}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column.key} className="border-b p-1.5"><Input disabled={!canEdit} value={row[column.key] ?? ""} onChange={(event) => updateRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, [column.key]: event.target.value } : item))} /></td>)}{canEdit && <td className="border-b p-1 text-center"><Button type="button" size="icon" variant="ghost" disabled={rows.length === 1} onClick={() => updateRows(rows.filter((_, itemIndex) => itemIndex !== index))} aria-label="حذف الصف"><Trash2 className="h-4 w-4 text-destructive" /></Button></td>}</tr>)}</tbody></table></div>
    </div>;
  };
  const header = useMemo(() => `${months[month - 1]} ${year}`, [year, month]);
  return <main className="mx-auto max-w-5xl space-y-5 pb-10" dir="rtl">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><Button asChild variant="ghost" className="mb-2"><Link href="/reports"><ArrowLeft className="ms-2 h-4 w-4" />العودة للتقارير</Link></Button><h1 className="text-3xl font-bold">تقرير تقييم أعمال الصيانة الشهري</h1><p className="mt-1 text-muted-foreground">FORM-10-0944-0</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href={`/print/monthly-maintenance-evaluation/${year}/${month}`}>Official Print</Link></Button>{canEdit && <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="ms-2 h-4 w-4" />حفظ التقرير</Button>}</div></div>
    <section className="rounded-xl border bg-card p-5"><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1 block font-medium">السنة</label><Input type="number" disabled={!canEdit} value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} /></div><div><label className="mb-1 block font-medium">الشهر</label><select disabled={!canEdit} className="h-10 w-full rounded-md border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60" value={month} onChange={(e) => setMonth(Number(e.target.value))}>{months.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select></div></div><p className="mt-3 text-sm text-muted-foreground">تقرير شهر {header}</p></section>
    {query.isLoading ? <p className="text-center text-muted-foreground">جارٍ تحميل التقرير…</p> : <>
      <section className="rounded-xl border bg-card p-5 space-y-5"><h2 className="text-lg font-bold">تقييم تنفيذ أعمال الصيانة</h2><div><p className="mb-2 font-medium">(1) أعمال الصيانة الوقائية المجدولة في هذا الشهر والتي لم يتم تنفيذها</p>{rowsTable("delayedActivities", [{ key: "activity", label: "نشاطات أعمال الصيانة" }, { key: "reason", label: "سبب التأخير" }], { activity: String(form.delayedActivities ?? ""), reason: String(form.delayReason ?? "") }, () => set("delayReason", ""))}</div><div><p className="mb-2 font-medium">(2) هل تم جدولة جميع هذه النشاطات في برنامج الصيانة الوقائية الشهرية للشهر القادم؟</p><YesNo value={String(form.followUpIncluded ?? "")} disabled={!canEdit} onChange={(v) => set("followUpIncluded", v)} /></div><div className="grid gap-4 md:grid-cols-2">{input("completedPmOnTime", "عدد نشاطات الصيانة الوقائية التي طُبقت", "number")}{input("totalPmActivities", "عدد النشاطات التي خُطّط لها", "number")}</div>{formula("completedPmOnTime", "totalPmActivities", "(3) النسبة المئوية لإنجاز برنامج الصيانة الوقائية الشهرية")}</section>
      <section className="rounded-xl border bg-card p-5 space-y-5"><div><p className="mb-2 font-medium">(4) هل هناك أي منتج تم رفضه نتيجة أعمال الصيانة في منطقة الإنتاج؟</p><YesNo value={String(form.productionImpact ?? "")} disabled={!canEdit} onChange={(v) => set("productionImpact", v)} /></div><div><p className="mb-2 font-medium">(5) هل حدث أن وقع نفس العطل لنفس الماكينة خلال شهر من تاريخ إصلاح العطل؟</p><YesNo value={String(form.sparePartShortage ?? "")} disabled={!canEdit} onChange={(v) => set("sparePartShortage", v)} /></div><div className="border-t pt-4 space-y-4"><p className="mb-2 font-medium">(6) عدد طلبات الصيانة العلاجية خلال هذا الشهر</p><div className="grid gap-4 md:grid-cols-3">{input("totalCorrectiveRequests", "إجمالي طلبات الصيانة العلاجية", "number")}{input("unclosedCorrectiveRequests", "الطلبات التي لم يتم إنجازها بعد (لم يتم إغلاقها)", "number")}{input("completedCorrectiveRequests", "عدد الطلبات المنجزة", "number")}</div>{formula("completedCorrectiveRequests", "totalCorrectiveRequests", "النسبة المئوية للصيانة العلاجية المنجزة")}{rowsTable("correctiveMaintenanceDetails", [{ key: "machineArea", label: "اسم الماكينة / منطقة العمل" }, { key: "requestNo", label: "رقم أمر / طلب الصيانة" }, { key: "reason", label: "سبب التأخير" }])}</div><div className="border-t pt-4"><p className="mb-2 font-medium">(7) عدد طلبات الصيانة الخارجية</p>{input("totalExternalActivities", "عدد طلبات الصيانة الخارجية", "number")}{rowsTable("externalMaintenanceDetails", [{ key: "requestNo", label: "رقم أمر / طلب الصيانة" }, { key: "activities", label: "نشاطات أعمال الصيانة الخارجية" }, { key: "reason", label: "أسباب إرسالها للصيانة العلاجية" }, { key: "performer", label: "اسم القائم بالعمل" }])}</div></section>
      <section className="rounded-xl border bg-card p-5 space-y-5"><div><p className="mb-2 font-medium">(8) هل حدث أن أُصيب أحد الموظفين أثناء تنفيذ أعمال الصيانة أو نتيجة خلل حدث للماكينة؟</p><YesNo value={String(form.employeeDelayImpact ?? "")} disabled={!canEdit} onChange={(v) => set("employeeDelayImpact", v)} /></div><div className="grid gap-4 md:grid-cols-2">{input("workingDays", "(9) عدد أيام العمل في هذا الشهر", "number")}{input("lostWorkDays", "عدد أيام العمل الضائعة", "number")}</div>{formula("lostWorkDays", "workingDays", "النسبة المئوية لخسائر موظفي الدائرة خلال هذا الشهر")}{input("preparedBy", "إعداد")}{input("preparedDate", "تاريخ الإعداد", "date")}{input("engineeringManagerSignature", "اسم مدير دائرة الهندسة / توقيع بديل")}<div><label className="mb-1 block font-medium">تاريخ توقيع مدير دائرة الهندسة</label><div className="flex gap-2"><Input type="date" disabled={!canEdit} value={String(form.engineeringManagerDate ?? "")} onChange={(event) => set("engineeringManagerDate", event.target.value)} />{canEdit && <Button type="button" variant="outline" onClick={() => set("engineeringManagerDate", new Date().toISOString().slice(0, 10))}>تاريخ اليوم</Button>}</div></div>{Number(form.id) > 0 ? <ElectronicSignatureField documentType="MONTHLY_MAINTENANCE_EVALUATION" documentId={Number(form.id)} fieldName="engineering_manager" label="التوقيع الإلكتروني لمدير دائرة الهندسة" /> : <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">احفظ التقرير أولاً، ثم يمكن لمدير دائرة الهندسة المعتمد توقيعه إلكترونياً.</p>}</section>
    </>}
  </main>;
}
