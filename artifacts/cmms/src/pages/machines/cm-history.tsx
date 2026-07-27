import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CorrectiveMaintenanceRecord } from "../maintenance-requests/types";

function monthLabel(record: CorrectiveMaintenanceRecord) {
  // The archive is organised by the maintenance-request month, not by the
  // date on which the record page happened to be created.
  const date = record.events.find((event) => event.requestDate)?.requestDate || record.executionDate || record.createdAt;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date);
  return Number.isNaN(parsed.getTime()) ? "Undated records" : new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" }).format(parsed);
}

export default function CmHistoryPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const { data = [] } = useQuery({ queryKey: ["machine-cm-history", machineId], queryFn: () => apiRequest<CorrectiveMaintenanceRecord[]>(`/machines/${machineId}/corrective-maintenance/history`) });
  const monthGroups = data.reduce<Map<string, CorrectiveMaintenanceRecord[]>>((groups, record) => { const label = monthLabel(record); groups.set(label, [...(groups.get(label) ?? []), record]); return groups; }, new Map());
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href={`/machines/${machineId}/corrective-maintenance`}><ArrowLeft className="h-4 w-4" /></Link></Button><div><h1 className="text-3xl font-bold tracking-tight">Corrective Maintenance Record History</h1><p className="text-muted-foreground">Each record is one printed page. Records from the same month are grouped together and preserved permanently.</p></div></div>
    {[...monthGroups.entries()].map(([month, records]) => <Card key={month}><div className="border-b bg-muted/30 px-5 py-3"><h2 className="font-semibold">أرشيف {month}</h2></div><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>الصفحة</TableHead><TableHead>Status</TableHead><TableHead>Rows</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{records.map((record, index) => <TableRow key={record.id}><TableCell>الصفحة {index + 1} من {records.length}</TableCell><TableCell>{record.status}</TableCell><TableCell>{record.events.length}/{record.maxRows}</TableCell><TableCell>{new Date(record.createdAt).toLocaleDateString()}</TableCell><TableCell className="space-x-2 text-right"><Button asChild size="sm" variant="outline"><Link href={`/machines/${machineId}/corrective-maintenance/history/${record.id}`}><Eye className="mr-2 h-4 w-4" />Open</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/print/corrective-maintenance/${machineId}/history/${record.id}`}><Printer className="mr-2 h-4 w-4" />Print</Link></Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>)}
  </div>;
}
