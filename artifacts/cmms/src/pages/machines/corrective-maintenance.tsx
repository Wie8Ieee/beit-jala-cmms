import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil, Plus, Save, X } from "lucide-react";
import type { CorrectiveMaintenanceRecord } from "../maintenance-requests/types";
import { OfficialFormHeader } from "@/components/official-form-header";

export default function MachineCorrectiveMaintenancePage({ params }: { params: { id: string; recordId?: string } }) {
  const machineId = Number(params.id);
  const historicalRecordId = params.recordId ? Number(params.recordId) : undefined;
  const isHistorical = historicalRecordId !== undefined;
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState({ requestReportNumber: "", requestDate: "", maintenanceType: "", preliminaryCheckResults: "", expectedWorkTimeFrom: "", expectedWorkTimeTo: "", repairTimeSlots: [{ date: "", from: "", to: "" }], actionsTaken: "", technicianName: "", sparePartsUsed: "", receiverName: "", handoverDate: "" });
  const [headerDraft, setHeaderDraft] = useState({
    documentNumber: "",
    executionDate: "",
    pageCount: "",
  });
  const { data = [] } = useQuery({
    queryKey: ["machine-cm-history", machineId],
    queryFn: () => apiRequest<CorrectiveMaintenanceRecord[]>(`/machines/${machineId}/corrective-maintenance/history`),
  });

  const active = historicalRecordId ? data.find((record) => record.id === historicalRecordId) ?? null : data[data.length - 1] ?? null;

  useEffect(() => {
    if (!active) return;
    setHeaderDraft({
      documentNumber: active.documentNumber,
      executionDate: active.executionDate ?? "",
      pageCount: active.pageCount,
    });
  }, [active]);

  const updateHeader = useMutation({
    mutationFn: () => apiRequest<CorrectiveMaintenanceRecord>(`/machines/${machineId}/corrective-maintenance/header`, {
      method: "PUT",
      body: JSON.stringify(headerDraft),
    }),
    onSuccess: () => {
      setIsEditingHeader(false);
      queryClient.invalidateQueries({ queryKey: ["machine-cm-history", machineId] });
    },
  });

  const updateEvent = useMutation({
    mutationFn: () => apiRequest(`/machines/${machineId}/corrective-maintenance/events/${editingEventId}`, {
      method: "PUT",
      body: JSON.stringify(eventDraft),
    }),
    onSuccess: () => {
      setEditingEventId(null);
      queryClient.invalidateQueries({ queryKey: ["machine-cm-history", machineId] });
    },
  });
  const addLogRow = useMutation({
    mutationFn: () => apiRequest(`/machines/${machineId}/corrective-maintenance/events`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: (event: { id: number; requestReportNumber: string | null; requestDate?: string | null; maintenanceType?: string | null; priority?: string | null; preliminaryCheckResults: string | null; expectedWorkTimeFrom: string | null; expectedWorkTimeTo: string | null; repairTimeSlots?: Array<{ date: string; from: string; to: string }>; actionsTaken: string | null; technicianName?: string | null; sparePartsUsed?: string | null; receiverName: string | null; handoverDate: string | null }) => {
      queryClient.invalidateQueries({ queryKey: ["machine-cm-history", machineId] });
      setEditingEventId(event.id);
      setEventDraft({ requestReportNumber: event.requestReportNumber ?? "", requestDate: event.requestDate ?? "", maintenanceType: event.maintenanceType ?? event.priority ?? "", preliminaryCheckResults: event.preliminaryCheckResults ?? "", expectedWorkTimeFrom: event.expectedWorkTimeFrom ?? "", expectedWorkTimeTo: event.expectedWorkTimeTo ?? "", repairTimeSlots: event.repairTimeSlots?.length ? event.repairTimeSlots : [{ date: "", from: event.expectedWorkTimeFrom ?? "", to: event.expectedWorkTimeTo ?? "" }], actionsTaken: event.actionsTaken ?? "", technicianName: event.technicianName ?? "", sparePartsUsed: event.sparePartsUsed ?? "", receiverName: event.receiverName ?? "", handoverDate: event.handoverDate ?? "" });
    },
  });
  const canEditLog = !isHistorical && (hasPermission("fill_corrective_maintenance") || hasPermission("manage_maintenance_requests"));

  const beginEventEdit = (event: CorrectiveMaintenanceRecord["events"][number]) => {
    setEditingEventId(event.id);
    setEventDraft({
      requestReportNumber: event.requestReportNumber ?? "",
      requestDate: event.requestDate ?? "",
      maintenanceType: event.maintenanceType ?? event.priority ?? "",
      preliminaryCheckResults: event.preliminaryCheckResults ?? "",
      expectedWorkTimeFrom: event.expectedWorkTimeFrom ?? "",
      expectedWorkTimeTo: event.expectedWorkTimeTo ?? "",
      repairTimeSlots: event.repairTimeSlots?.length ? event.repairTimeSlots : [{ date: "", from: event.expectedWorkTimeFrom ?? "", to: event.expectedWorkTimeTo ?? "" }],
      actionsTaken: event.actionsTaken ?? "",
      technicianName: event.technicianName ?? "",
      sparePartsUsed: event.sparePartsUsed ?? "",
      receiverName: event.receiverName ?? "",
      handoverDate: event.handoverDate ?? "",
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/machines/${machineId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Corrective Maintenance Record</h1>
          <p className="text-muted-foreground">Equipment Corrective Maintenance log (LOG-00-0102-3).</p>
        </div>
        <Button asChild variant="outline">
          <Link href={isHistorical ? `/print/corrective-maintenance/${machineId}/history/${historicalRecordId}` : `/print/corrective-maintenance/${machineId}`}>Official Print</Link>
        </Button>
        <Button asChild variant="outline"><Link href={`/machines/${machineId}/corrective-maintenance/history`}>Record History</Link></Button>
      </div>

      {active ? (
        <>
          <Card>
            <CardHeader><CardTitle>Header</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-4 rounded-md bg-white p-4 text-black">
                <OfficialFormHeader
                  documentName="Corrective Maintenance Record"
                  documentNumber={active.documentNumber}
                  effectiveOrExecutionDate={active.executionDate}
                  page={active.pageCount}
                  machineName={active.machineName}
                  machineNumber={active.machineNumber}
                  machineLocation={active.machineLocation}
                  startupDate={active.startupDate}
                />
              </div>
              <div><Label>Document number</Label><Input value={isEditingHeader ? headerDraft.documentNumber : active.documentNumber} readOnly={!isEditingHeader} onChange={(event) => setHeaderDraft((current) => ({ ...current, documentNumber: event.target.value }))} /></div>
              <div><Label>Execution date</Label><Input type="date" value={isEditingHeader ? headerDraft.executionDate : active.executionDate ?? ""} readOnly={!isEditingHeader} onChange={(event) => setHeaderDraft((current) => ({ ...current, executionDate: event.target.value }))} /></div>
              <div><Label>Page count</Label><Input value={isEditingHeader ? headerDraft.pageCount : active.pageCount} readOnly={!isEditingHeader} onChange={(event) => setHeaderDraft((current) => ({ ...current, pageCount: event.target.value }))} /></div>
              <div><Label>Record sequence</Label><Input value={`#${active.sequenceNumber}`} readOnly /></div>
              <div><Label>Machine name</Label><Input value={active.machineName} readOnly /></div>
              <div><Label>Machine number</Label><Input value={active.machineNumber} readOnly /></div>
              <div><Label>Machine location</Label><Input value={active.machineLocation ?? ""} readOnly /></div>
              <div><Label>Start-up date</Label><Input value={active.startupDate ?? ""} readOnly /></div>
              {!isHistorical && hasPermission("edit_header") && (
                <div className="md:col-span-4 flex gap-2">
                  {isEditingHeader ? (
                    <>
                      <Button type="button" onClick={() => updateHeader.mutate()} disabled={updateHeader.isPending}>
                        <Save className="mr-2 h-4 w-4" />Save Header
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditingHeader(false)}>
                        <X className="mr-2 h-4 w-4" />Cancel
                      </Button>
                    </>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => setIsEditingHeader(true)}>
                      <Pencil className="mr-2 h-4 w-4" />Edit Header
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader dir="rtl" className="flex-row items-center justify-between space-y-0">
              <CardTitle>سجل أعمال الصيانة العلاجية</CardTitle>
              {canEditLog && <Button size="sm" onClick={() => addLogRow.mutate()} disabled={addLogRow.isPending}><Plus className="ml-1 h-4 w-4" />إضافة صف</Button>}
            </CardHeader>
            <CardContent dir="rtl" className="overflow-x-auto">
              {isHistorical && <p className="mb-4 text-sm text-muted-foreground">هذا السجل مؤرشف ومحفوظ للرجوع إليه فقط.</p>}
              <Table dir="rtl" className="min-w-max text-right">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap text-right">الرقم</TableHead>
                    <TableHead className="whitespace-nowrap text-right">تاريخ طلب الصيانة</TableHead>
                    <TableHead className="whitespace-nowrap text-right">رقم طلب الصيانة</TableHead>
                    <TableHead className="whitespace-nowrap text-right">نوع الصيانة العلاجية<br />عادي / مستعجل</TableHead>
                    <TableHead className="whitespace-nowrap text-right">نتائج الفحص الأولي</TableHead>
                    <TableHead className="whitespace-nowrap text-right">تاريخ التصليح</TableHead>
                    <TableHead className="whitespace-nowrap text-right">وقت التصليح<br />من</TableHead>
                    <TableHead className="whitespace-nowrap text-right">وقت التصليح<br />إلى</TableHead>
                    <TableHead className="whitespace-nowrap text-right">أعمال الصيانة</TableHead>
                    <TableHead className="whitespace-nowrap text-right">القائم بالعمل</TableHead>
                    <TableHead className="whitespace-nowrap text-right">قطع الغيار المستبدلة<br />وعددها</TableHead>
                    <TableHead className="whitespace-nowrap text-right">المستلم</TableHead>
                    <TableHead className="whitespace-nowrap text-right">تاريخ التسليم</TableHead>
                    <TableHead className="whitespace-nowrap text-right">الطلب المرتبط</TableHead>
                    {canEditLog && <TableHead className="whitespace-nowrap text-right">إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.events.map((event) => {
                    const isEditingEvent = editingEventId === event.id;
                    const repairSlots = event.repairTimeSlots?.filter((slot) => slot.date || slot.from || slot.to) ?? [];
                    return <TableRow key={event.id} className="align-top">
                      <TableCell>{event.rowNumber}</TableCell>
                      <TableCell>{isEditingEvent ? <Input className="min-w-36" type="date" value={eventDraft.requestDate} onChange={(input) => setEventDraft((draft) => ({ ...draft, requestDate: input.target.value }))} /> : event.requestDate || "-"}</TableCell>
                      <TableCell className="font-mono">
                        {isEditingEvent && !event.requestId ? <Input className="min-w-32" value={eventDraft.requestReportNumber} onChange={(input) => setEventDraft((draft) => ({ ...draft, requestReportNumber: input.target.value }))} /> : event.requestId ? <Link href={`/maintenance-requests/${event.requestId}`}>{event.requestReportNumber}</Link> : event.requestReportNumber || "-"}
                      </TableCell>
                      <TableCell>{isEditingEvent ? <Input className="min-w-28" value={eventDraft.maintenanceType} placeholder="عادي / مستعجل" onChange={(input) => setEventDraft((draft) => ({ ...draft, maintenanceType: input.target.value }))} /> : event.maintenanceType || event.priority || "-"}</TableCell>
                      <TableCell>{isEditingEvent ? <Textarea className="min-w-40" value={eventDraft.preliminaryCheckResults} onChange={(input) => setEventDraft((draft) => ({ ...draft, preliminaryCheckResults: input.target.value }))} /> : event.preliminaryCheckResults || "-"}</TableCell>
                      <TableCell>{isEditingEvent ? <div className="space-y-1">{eventDraft.repairTimeSlots.map((slot, index) => <Input key={index} className="min-w-36" type="date" value={slot.date} onChange={(input) => setEventDraft((draft) => ({ ...draft, repairTimeSlots: draft.repairTimeSlots.map((item, slotIndex) => slotIndex === index ? { ...item, date: input.target.value } : item) }))} />)}</div> : (repairSlots.length ? <div className="space-y-1 whitespace-nowrap">{repairSlots.map((slot, index) => <div key={index}>{slot.date || "-"}</div>)}</div> : "-")}</TableCell>
                      <TableCell>{isEditingEvent ? <div className="space-y-1">{eventDraft.repairTimeSlots.map((slot, index) => <Input key={index} className="min-w-28" type="time" value={slot.from} onChange={(input) => setEventDraft((draft) => ({ ...draft, repairTimeSlots: draft.repairTimeSlots.map((item, slotIndex) => slotIndex === index ? { ...item, from: input.target.value } : item) }))} />)}{eventDraft.repairTimeSlots.length < 5 && <Button type="button" size="sm" variant="outline" onClick={() => setEventDraft((draft) => ({ ...draft, repairTimeSlots: [...draft.repairTimeSlots, { date: "", from: "", to: "" }] }))}><Plus className="ml-1 h-3 w-3" />إضافة وقت</Button>}</div> : (repairSlots.length ? <div className="space-y-1 whitespace-nowrap">{repairSlots.map((slot, index) => <div key={index}>{slot.from || "-"}</div>)}</div> : event.expectedWorkTimeFrom || "-")}</TableCell>
                      <TableCell>{isEditingEvent ? <div className="space-y-1">{eventDraft.repairTimeSlots.map((slot, index) => <Input key={index} className="min-w-28" type="time" value={slot.to} onChange={(input) => setEventDraft((draft) => ({ ...draft, repairTimeSlots: draft.repairTimeSlots.map((item, slotIndex) => slotIndex === index ? { ...item, to: input.target.value } : item) }))} />)}</div> : (repairSlots.length ? <div className="space-y-1 whitespace-nowrap">{repairSlots.map((slot, index) => <div key={index}>{slot.to || "-"}</div>)}</div> : event.expectedWorkTimeTo || "-")}</TableCell>
                      <TableCell>{isEditingEvent ? <Textarea className="min-w-40" value={eventDraft.actionsTaken} onChange={(input) => setEventDraft((draft) => ({ ...draft, actionsTaken: input.target.value }))} /> : event.actionsTaken || "-"}</TableCell>
                      <TableCell>{isEditingEvent ? <Input className="min-w-32" value={eventDraft.technicianName} onChange={(input) => setEventDraft((draft) => ({ ...draft, technicianName: input.target.value }))} /> : event.technicianName || "-"}</TableCell>
                      <TableCell>{isEditingEvent ? <Textarea className="min-w-40" value={eventDraft.sparePartsUsed} onChange={(input) => setEventDraft((draft) => ({ ...draft, sparePartsUsed: input.target.value }))} /> : event.sparePartsUsed || "-"}</TableCell>
                      <TableCell>{isEditingEvent ? <Input className="min-w-32" value={eventDraft.receiverName} onChange={(input) => setEventDraft((draft) => ({ ...draft, receiverName: input.target.value }))} /> : event.receiverName || "-"}</TableCell>
                      <TableCell>{isEditingEvent ? <Input className="min-w-36" type="date" value={eventDraft.handoverDate} onChange={(input) => setEventDraft((draft) => ({ ...draft, handoverDate: input.target.value }))} /> : event.handoverDate || "-"}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/maintenance-requests/${event.requestId}`}>Open</Link>
                        </Button>
                      </TableCell>
                      {canEditLog && <TableCell className="text-right whitespace-nowrap">
                        {isEditingEvent ? <>
                          <Button size="sm" onClick={() => updateEvent.mutate()} disabled={updateEvent.isPending}><Save className="mr-1 h-3 w-3" />Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingEventId(null)}><X className="h-3 w-3" /></Button>
                        </> : <Button size="sm" variant="ghost" onClick={() => beginEventEdit(event)}><Pencil className="mr-1 h-3 w-3" />Edit</Button>}
                      </TableCell>}
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">No corrective maintenance records have been created for this machine yet.</CardContent>
        </Card>
      )}

    </div>
  );
}
