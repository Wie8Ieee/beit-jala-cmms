import { Link } from "wouter";
import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Printer, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ClosedCorrectiveMaintenanceLogRow = {
  id: string;
  source: "automatic" | "manual";
  machineName: string;
  machineNumber: string;
  requestDate: string;
  requestReportNumber: string;
  priority: string;
  closedDate: string;
  remarks: string;
};

type ClosedLogHeader = { documentNumber: string; effectiveOrExecutionDate: string | null };

function maintenanceType(priority: string) {
  return priority.toLowerCase() === "urgent" ? "مستعجل" : "عادي";
}

export default function ClosedCorrectiveMaintenanceLogPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    machineName: "", machineNumber: "", requestDate: new Date().toISOString().slice(0, 10),
    requestReportNumber: "", priority: "normal", closedDate: new Date().toISOString().slice(0, 10), remarks: "",
  });
  const [header, setHeader] = useState<ClosedLogHeader>({ documentNumber: "", effectiveOrExecutionDate: "" });
  const { data = [], isLoading } = useQuery({
    queryKey: ["closed-corrective-maintenance-log"],
    queryFn: () => apiRequest<ClosedCorrectiveMaintenanceLogRow[]>("/maintenance-requests/closed-log"),
  });
  const canManage = hasPermission("manage_maintenance_requests");
  const canEditHeader = hasPermission("edit_header");
  const { data: savedHeader } = useQuery({
    queryKey: ["closed-corrective-maintenance-log-header"],
    queryFn: () => apiRequest<ClosedLogHeader>("/maintenance-requests/closed-log/header"),
  });
  useEffect(() => { if (savedHeader) setHeader(savedHeader); }, [savedHeader]);
  const saveHeader = useMutation({
    mutationFn: () => apiRequest<ClosedLogHeader>("/maintenance-requests/closed-log/header", { method: "PUT", body: JSON.stringify(header) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["closed-corrective-maintenance-log-header"] }),
  });
  const addEntry = useMutation({
    mutationFn: () => apiRequest<ClosedCorrectiveMaintenanceLogRow>("/maintenance-requests/closed-log/manual", {
      method: "POST", body: JSON.stringify(form),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closed-corrective-maintenance-log"] });
      setAddOpen(false);
      setForm({ machineName: "", machineNumber: "", requestDate: new Date().toISOString().slice(0, 10), requestReportNumber: "", priority: "normal", closedDate: new Date().toISOString().slice(0, 10), remarks: "" });
    },
  });
  const deleteEntry = useMutation({
    mutationFn: ({ id, source }: Pick<ClosedCorrectiveMaintenanceLogRow, "id" | "source">) => {
      const entryId = source === "manual" ? id.replace("manual-", "") : id.replace("automatic-", "");
      return apiRequest<{ success: boolean }>(`/maintenance-requests/closed-log/${source}/${entryId}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["closed-corrective-maintenance-log"] }),
  });

  function submitManualEntry(event: FormEvent) {
    event.preventDefault();
    addEntry.mutate();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6" dir="rtl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">سجل طلبات الصيانة العلاجية للأجهزة / الماكينات</h1>
          <p className="text-muted-foreground">LOG-10-0659-0 — يتم تعبئة السجل تلقائيًا عند إغلاق طلب الصيانة.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/maintenance-requests"><ArrowLeft className="ms-2 h-4 w-4" />العودة للطلبات</Link></Button>
          <Button variant="outline" asChild><Link href="/print/closed-corrective-maintenance-log"><Printer className="ms-2 h-4 w-4" />طباعة السجل</Link></Button>
          {canManage && <Button onClick={() => setAddOpen(true)}><Plus className="ms-2 h-4 w-4" />إضافة سجل</Button>}
        </div>
      </div>

      {canEditHeader && <Card>
        <CardHeader><CardTitle>إعدادات هيدر السجل</CardTitle></CardHeader>
        <CardContent className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div><Label>رقم الوثيقة</Label><Input dir="ltr" value={header.documentNumber} onChange={(event) => setHeader({ ...header, documentNumber: event.target.value })} /></div>
          <div><Label>تاريخ التنفيذ</Label><Input dir="ltr" value={header.effectiveOrExecutionDate ?? ""} onChange={(event) => setHeader({ ...header, effectiveOrExecutionDate: event.target.value })} /></div>
          <div className="sm:col-span-2"><Button onClick={() => saveHeader.mutate()} disabled={saveHeader.isPending}><Save className="ms-2 h-4 w-4" />{saveHeader.isPending ? "جارٍ الحفظ…" : "حفظ الهيدر"}</Button></div>
        </CardContent>
      </Card>}

      <Card>
        <CardContent className="p-0">
          <Table className="table-fixed" dir="rtl">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[17%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[18%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right whitespace-nowrap">اسم الجهاز</TableHead>
                <TableHead className="text-right whitespace-nowrap">رقم الجهاز</TableHead>
                <TableHead className="text-right whitespace-nowrap">التاريخ</TableHead>
                <TableHead className="text-right whitespace-nowrap">رقم طلب الصيانة العلاجية</TableHead>
                <TableHead className="text-right whitespace-nowrap">عادي / مستعجل</TableHead>
                <TableHead className="text-right">تاريخ إغلاق /<br />إنجاز الطلب</TableHead>
                <TableHead className="text-right whitespace-nowrap">ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">جارٍ تحميل السجل…</TableCell></TableRow>
                : data.length === 0 ? <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">لا توجد طلبات صيانة علاجية مغلقة حتى الآن.</TableCell></TableRow>
                : data.map((row) => <TableRow key={row.id}>
                  <TableCell className="font-medium text-right break-words">{row.machineName}</TableCell>
                  <TableCell dir="ltr" className="text-right whitespace-nowrap">{row.machineNumber}</TableCell>
                  <TableCell dir="ltr" className="text-right whitespace-nowrap">{row.requestDate}</TableCell>
                  <TableCell dir="ltr" className="font-mono text-right whitespace-nowrap">{row.requestReportNumber}</TableCell>
                  <TableCell className="text-right">{maintenanceType(row.priority)}</TableCell>
                  <TableCell dir="ltr" className="text-right whitespace-nowrap">{row.closedDate}</TableCell>
                  <TableCell className="text-right break-words">
                    <div className="flex items-center justify-between gap-2">
                      <span>{row.remarks || "—"}</span>
                      {canManage && <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" aria-label="حذف السجل" disabled={deleteEntry.isPending} onClick={() => {
                        if (window.confirm("هل تريد إزالة هذا السجل من سجل الطلبات المغلقة؟ لن يتم حذف طلب الصيانة الأصلي أو تاريخه.")) deleteEntry.mutate({ id: row.id, source: row.source });
                      }}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة سجل يدوي</DialogTitle></DialogHeader>
          <form onSubmit={submitManualEntry} className="space-y-4">
            <p className="text-sm text-muted-foreground">تُستخدم هذه الإضافة فقط للحالات الاستثنائية؛ أما الطلبات المغلقة فتظهر تلقائيًا في السجل.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>اسم الجهاز</Label><Input required value={form.machineName} onChange={(event) => setForm({ ...form, machineName: event.target.value })} /></div>
              <div><Label>رقم الجهاز</Label><Input required dir="ltr" value={form.machineNumber} onChange={(event) => setForm({ ...form, machineNumber: event.target.value })} /></div>
              <div><Label>تاريخ الطلب</Label><Input required type="date" dir="ltr" value={form.requestDate} onChange={(event) => setForm({ ...form, requestDate: event.target.value })} /></div>
              <div><Label>رقم طلب الصيانة العلاجية</Label><Input required dir="ltr" value={form.requestReportNumber} onChange={(event) => setForm({ ...form, requestReportNumber: event.target.value })} /></div>
              <div><Label>نوع الطلب</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="normal">عادي</option><option value="urgent">مستعجل</option></select></div>
              <div><Label>تاريخ إغلاق الطلب</Label><Input required type="date" dir="ltr" value={form.closedDate} onChange={(event) => setForm({ ...form, closedDate: event.target.value })} /></div>
            </div>
            <div><Label>ملاحظات</Label><Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></div>
            {addEntry.isError && <p className="text-sm text-destructive">{addEntry.error.message}</p>}
            <DialogFooter><Button type="submit" disabled={addEntry.isPending}>{addEntry.isPending ? "جارٍ الحفظ…" : "حفظ السجل"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
