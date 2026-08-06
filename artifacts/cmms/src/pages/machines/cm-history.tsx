import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CorrectiveMaintenanceRecord } from "../maintenance-requests/types";

function repairDatesFor(record: CorrectiveMaintenanceRecord) {
  return [...new Set(record.events.flatMap((event) => [
    ...(event.repairTimeSlots ?? []).map((slot) => slot.date),
    event.requestDate ?? "",
  ]).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

export default function CmHistoryPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const [selectedMonth, setSelectedMonth] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["machine-cm-history", machineId, selectedMonth || "archived"],
    queryFn: () => apiRequest<CorrectiveMaintenanceRecord[]>(`/machines/${machineId}/corrective-maintenance/history${selectedMonth ? "?includeActive=true" : ""}`),
  });
  const records = useMemo(() => data
    .map((record) => ({ record, repairDates: repairDatesFor(record) }))
    .filter(({ repairDates }) => !selectedMonth || repairDates.some((date) => date.startsWith(selectedMonth)))
    .sort((left, right) => (right.repairDates.at(-1) ?? "").localeCompare(left.repairDates.at(-1) ?? "")), [data, selectedMonth]);

  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href={`/machines/${machineId}/corrective-maintenance`}><ArrowLeft className="h-4 w-4" /></Link></Button><div><h1 className="text-3xl font-bold tracking-tight">Corrective Maintenance Records</h1><p className="text-muted-foreground">السجلات المؤرشفة للصيانة العلاجية.</p></div></div>

    <Card><CardContent className="flex flex-wrap items-end gap-3 p-4"><div className="space-y-1"><label className="text-sm font-medium" htmlFor="repair-month">البحث حسب الشهر</label><Input id="repair-month" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></div>{selectedMonth && <Button variant="outline" onClick={() => setSelectedMonth("")}>إظهار كل السجلات</Button>}</CardContent></Card>

    {isLoading ? <div className="p-8 text-muted-foreground">Loading records...</div> : records.length === 0 ? <Card><CardContent className="p-6 text-muted-foreground">لا توجد سجلات مطابقة.</CardContent></Card> : <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>السجل</TableHead><TableHead>الحالة</TableHead><TableHead>تواريخ الإصلاح</TableHead><TableHead>الصفوف</TableHead><TableHead className="text-right">إجراءات</TableHead></TableRow></TableHeader><TableBody>{records.map(({ record, repairDates }) => { const isActive = record.status === "active"; return <TableRow key={record.id}><TableCell className="font-medium">سجل #{record.sequenceNumber}</TableCell><TableCell>{isActive ? "مفتوح" : "مؤرشف"}</TableCell><TableCell>{repairDates.join("، ") || "-"}</TableCell><TableCell>{record.events.length}/{record.maxRows}</TableCell><TableCell className="space-x-2 text-right"><Button asChild size="sm" variant="outline"><Link href={isActive ? `/machines/${machineId}/corrective-maintenance` : `/machines/${machineId}/corrective-maintenance/history/${record.id}`}><Eye className="mr-2 h-4 w-4" />Open</Link></Button><Button asChild size="sm" variant="outline"><Link href={isActive ? `/print/corrective-maintenance/${machineId}` : `/print/corrective-maintenance/${machineId}/history/${record.id}`}><Printer className="mr-2 h-4 w-4" />Print</Link></Button></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>}
  </div>;
}
