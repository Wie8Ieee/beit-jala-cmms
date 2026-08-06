import { Link } from "wouter";
import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Pencil, Plus, Printer, Save, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ClosedCorrectiveMaintenanceLogRow = {
  id: string;
  source: "automatic" | "manual" | "corrective-record";
  machineName: string;
  machineNumber: string;
  requestDate: string;
  requestReportNumber: string;
  priority: string;
  closedDate: string;
  handoverDate?: string | null;
  remarks: string;
  eventId?: number;
  recordId?: number;
};

type ClosedLogHeader = { documentNumber: string; effectiveOrExecutionDate: string | null };

function maintenanceType(priority: string, isArabic: boolean) {
  const normalized = priority.toLowerCase();
  if (normalized === "urgent" || priority === "مستعجل") return isArabic ? "مستعجل" : "Urgent";
  if (normalized === "normal" || priority === "عادي") return isArabic ? "عادي" : "Normal";
  return priority;
}

export default function ClosedCorrectiveMaintenanceLogPage() {
  const { hasPermission } = useAuth();
  const { isArabic } = useLang();
  const queryClient = useQueryClient();
  const tr = (english: string, arabic: string) => isArabic ? arabic : english;
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    machineName: "", machineNumber: "", requestDate: new Date().toISOString().slice(0, 10),
    requestReportNumber: "", priority: "normal", closedDate: new Date().toISOString().slice(0, 10), remarks: "",
  });
  const [header, setHeader] = useState<ClosedLogHeader>({ documentNumber: "", effectiveOrExecutionDate: "" });
  const [editingRow, setEditingRow] = useState<ClosedCorrectiveMaintenanceLogRow | null>(null);
  const [editForm, setEditForm] = useState({ requestDate: "", maintenanceType: "normal", handoverDate: "", remarks: "" });
  const { data = [], isLoading } = useQuery({
    queryKey: ["closed-corrective-maintenance-log"],
    queryFn: () => apiRequest<ClosedCorrectiveMaintenanceLogRow[]>("/maintenance-requests/closed-log"),
  });
  const canManage = hasPermission("manage_maintenance_requests");
  const canEditHeader = hasPermission("edit_header");
  const canEditLogRows = hasPermission("edit_closed_corrective_maintenance_log");
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
      if (source === "corrective-record") throw new Error("Corrective-maintenance log rows cannot be excluded here.");
      const entryId = source === "manual" ? id.replace("manual-", "") : id.replace("automatic-", "");
      return apiRequest<{ success: boolean }>(`/maintenance-requests/closed-log/${source}/${entryId}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["closed-corrective-maintenance-log"] }),
  });
  const editEntry = useMutation({
    mutationFn: () => apiRequest(`/maintenance-requests/closed-log/events/${editingRow!.eventId}`, {
      method: "PATCH",
      body: JSON.stringify(editForm),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closed-corrective-maintenance-log"] });
      setEditingRow(null);
    },
  });

  function beginEdit(row: ClosedCorrectiveMaintenanceLogRow) {
    if (!row.eventId) return;
    setEditingRow(row);
    setEditForm({
      requestDate: row.requestDate,
      maintenanceType: row.priority.toLowerCase() === "urgent" || row.priority === "مستعجل" ? "urgent" : "normal",
      handoverDate: row.handoverDate ?? "",
      remarks: row.remarks,
    });
  }

  function submitManualEntry(event: FormEvent) {
    event.preventDefault();
    addEntry.mutate();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-1" aria-label={tr("Back to requests", "العودة للطلبات")} title={tr("Back to requests", "العودة للطلبات")}>
            <Link href="/maintenance-requests">{isArabic ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}</Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tr("Closed Corrective Maintenance Requests Log", "سجل طلبات الصيانة العلاجية للأجهزة / الماكينات")}</h1>
            <p className="text-muted-foreground">{tr("LOG-10-0659-0 — The log is populated automatically when a maintenance request is closed.", "LOG-10-0659-0 — يتم تعبئة السجل تلقائيًا عند إغلاق طلب الصيانة.")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/print/closed-corrective-maintenance-log"><Printer className="me-2 h-4 w-4" />{tr("Print log", "طباعة السجل")}</Link></Button>
          {canManage && <Button onClick={() => setAddOpen(true)}><Plus className="me-2 h-4 w-4" />{tr("Add entry", "إضافة سجل")}</Button>}
        </div>
      </div>

      {canEditHeader && <Card>
        <CardHeader><CardTitle>{tr("Log header settings", "إعدادات هيدر السجل")}</CardTitle></CardHeader>
        <CardContent className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <div><Label>{tr("Document number", "رقم الوثيقة")}</Label><Input dir="ltr" value={header.documentNumber} onChange={(event) => setHeader({ ...header, documentNumber: event.target.value })} /></div>
          <div><Label>{tr("Effective date", "تاريخ التنفيذ")}</Label><Input dir="ltr" value={header.effectiveOrExecutionDate ?? ""} onChange={(event) => setHeader({ ...header, effectiveOrExecutionDate: event.target.value })} /></div>
          <div className="sm:col-span-2"><Button onClick={() => saveHeader.mutate()} disabled={saveHeader.isPending}><Save className="me-2 h-4 w-4" />{saveHeader.isPending ? tr("Saving…", "جارٍ الحفظ…") : tr("Save header", "حفظ الهيدر")}</Button></div>
        </CardContent>
      </Card>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[1000px]" dir={isArabic ? "rtl" : "ltr"}>
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[12%]" />
              {canEditLogRows && <col className="w-[10%]" />}
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{tr("Machine name", "اسم الجهاز")}</TableHead>
                <TableHead className="whitespace-nowrap">{tr("Machine number", "رقم الجهاز")}</TableHead>
                <TableHead className="whitespace-nowrap">{tr("Date", "التاريخ")}</TableHead>
                <TableHead className="whitespace-nowrap">{tr("Corrective maintenance request no.", "رقم طلب الصيانة العلاجية")}</TableHead>
                <TableHead className="whitespace-nowrap">{tr("Normal / urgent", "عادي / مستعجل")}</TableHead>
                <TableHead>{isArabic ? <>تاريخ إغلاق /<br />إنجاز الطلب</> : "Request closed / completed date"}</TableHead>
                <TableHead className="whitespace-nowrap">{tr("Remarks", "ملاحظات")}</TableHead>
                {canEditLogRows && <TableHead className="whitespace-nowrap">{tr("Actions", "إجراءات")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={canEditLogRows ? 8 : 7} className="h-24 text-center text-muted-foreground">{tr("Loading log…", "جارٍ تحميل السجل…")}</TableCell></TableRow>
                : data.length === 0 ? <TableRow><TableCell colSpan={canEditLogRows ? 8 : 7} className="h-24 text-center text-muted-foreground">{tr("No closed corrective maintenance requests yet.", "لا توجد طلبات صيانة علاجية مغلقة حتى الآن.")}</TableCell></TableRow>
                : data.map((row) => <TableRow key={row.id}>
                  <TableCell className="font-medium break-words">{row.machineName}</TableCell>
                  <TableCell dir="ltr" className="whitespace-nowrap">{row.machineNumber}</TableCell>
                  <TableCell dir="ltr" className="whitespace-nowrap">{row.requestDate}</TableCell>
                  <TableCell dir="ltr" className="font-mono whitespace-nowrap">{row.requestReportNumber}</TableCell>
                  <TableCell>{maintenanceType(row.priority, isArabic)}</TableCell>
                  <TableCell dir="ltr" className="whitespace-nowrap">{row.closedDate}</TableCell>
                  <TableCell className="break-words">
                    <div className="flex items-center justify-between gap-2">
                      <span>{row.remarks || "—"}</span>
                      {canManage && row.source !== "corrective-record" && <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" aria-label={tr("Delete entry", "حذف السجل")} disabled={deleteEntry.isPending} onClick={() => {
                        if (window.confirm(tr("Remove this entry from the closed-requests log? The original maintenance request and its history will not be deleted.", "هل تريد إزالة هذا السجل من سجل الطلبات المغلقة؟ لن يتم حذف طلب الصيانة الأصلي أو تاريخه."))) deleteEntry.mutate({ id: row.id, source: row.source });
                      }}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                  {canEditLogRows && <TableCell>{row.eventId ? <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(row)}><Pencil className="me-1 h-4 w-4" />{tr("Edit", "تعديل")}</Button> : "-"}</TableCell>}
                </TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingRow)} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle>{tr("Edit corrective maintenance log row", "تعديل صف سجل الصيانة العلاجية")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>{tr("Request date", "تاريخ الطلب")}</Label><Input type="date" dir="ltr" value={editForm.requestDate} onChange={(event) => setEditForm({ ...editForm, requestDate: event.target.value })} /></div>
            <div><Label>{tr("Maintenance type", "نوع الصيانة")}</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.maintenanceType} onChange={(event) => setEditForm({ ...editForm, maintenanceType: event.target.value })}><option value="normal">{tr("Normal", "عادي")}</option><option value="urgent">{tr("Urgent", "مستعجل")}</option></select></div>
            <div><Label>{tr("Handover date", "تاريخ التسليم")}</Label><Input type="date" dir="ltr" value={editForm.handoverDate} onChange={(event) => setEditForm({ ...editForm, handoverDate: event.target.value })} /></div>
            <div className="sm:col-span-2"><Label>{tr("Remarks", "ملاحظات")}</Label><Textarea value={editForm.remarks} onChange={(event) => setEditForm({ ...editForm, remarks: event.target.value })} /></div>
          </div>
          <DialogFooter><Button type="button" onClick={() => editEntry.mutate()} disabled={editEntry.isPending}>{editEntry.isPending ? tr("Saving…", "جارٍ الحفظ…") : tr("Save changes", "حفظ التعديلات")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle>{tr("Add manual entry", "إضافة سجل يدوي")}</DialogTitle></DialogHeader>
          <form onSubmit={submitManualEntry} className="space-y-4">
            <p className="text-sm text-muted-foreground">{tr("Use this only for exceptional cases; closed requests appear in the log automatically.", "تُستخدم هذه الإضافة فقط للحالات الاستثنائية؛ أما الطلبات المغلقة فتظهر تلقائيًا في السجل.")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>{tr("Machine name", "اسم الجهاز")}</Label><Input required value={form.machineName} onChange={(event) => setForm({ ...form, machineName: event.target.value })} /></div>
              <div><Label>{tr("Machine number", "رقم الجهاز")}</Label><Input required dir="ltr" value={form.machineNumber} onChange={(event) => setForm({ ...form, machineNumber: event.target.value })} /></div>
              <div><Label>{tr("Request date", "تاريخ الطلب")}</Label><Input required type="date" dir="ltr" value={form.requestDate} onChange={(event) => setForm({ ...form, requestDate: event.target.value })} /></div>
              <div><Label>{tr("Corrective maintenance request no.", "رقم طلب الصيانة العلاجية")}</Label><Input required dir="ltr" value={form.requestReportNumber} onChange={(event) => setForm({ ...form, requestReportNumber: event.target.value })} /></div>
              <div><Label>{tr("Request type", "نوع الطلب")}</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="normal">{tr("Normal", "عادي")}</option><option value="urgent">{tr("Urgent", "مستعجل")}</option></select></div>
              <div><Label>{tr("Request closed date", "تاريخ إغلاق الطلب")}</Label><Input required type="date" dir="ltr" value={form.closedDate} onChange={(event) => setForm({ ...form, closedDate: event.target.value })} /></div>
            </div>
            <div><Label>{tr("Remarks", "ملاحظات")}</Label><Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></div>
            {addEntry.isError && <p className="text-sm text-destructive">{addEntry.error.message}</p>}
            <DialogFooter><Button type="submit" disabled={addEntry.isPending}>{addEntry.isPending ? tr("Saving…", "جارٍ الحفظ…") : tr("Save entry", "حفظ السجل")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
