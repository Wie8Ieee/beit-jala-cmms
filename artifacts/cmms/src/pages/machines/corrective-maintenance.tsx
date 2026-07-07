import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import type { CorrectiveMaintenanceRecord } from "../maintenance-requests/types";
import { OfficialFormHeader } from "@/components/official-form-header";
import { PrintButton } from "@/components/print-button";

export default function MachineCorrectiveMaintenancePage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const { data = [] } = useQuery({
    queryKey: ["machine-cm-history", machineId],
    queryFn: () => apiRequest<CorrectiveMaintenanceRecord[]>(`/machines/${machineId}/corrective-maintenance/history`),
  });

  const active = data[data.length - 1] ?? null;

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
        <PrintButton />
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
              <div><Label>Document number</Label><Input value={active.documentNumber} readOnly /></div>
              <div><Label>Execution date</Label><Input value={active.executionDate ?? ""} readOnly /></div>
              <div><Label>Page count</Label><Input value={active.pageCount} readOnly /></div>
              <div><Label>Record sequence</Label><Input value={`#${active.sequenceNumber}`} readOnly /></div>
              <div><Label>Machine name</Label><Input value={active.machineName} readOnly /></div>
              <div><Label>Machine number</Label><Input value={active.machineNumber} readOnly /></div>
              <div><Label>Machine location</Label><Input value={active.machineLocation ?? ""} readOnly /></div>
              <div><Label>Start-up date</Label><Input value={active.startupDate ?? ""} readOnly /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fixed Log Rows</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Request / Report No.</TableHead>
                    <TableHead>Preliminary Check</TableHead>
                    <TableHead>Actions Taken</TableHead>
                    <TableHead>Receiver</TableHead>
                    <TableHead>Handover</TableHead>
                    <TableHead>Linked Request</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.rowNumber}</TableCell>
                      <TableCell className="font-mono">
                        <Link href={`/maintenance-requests/${event.requestId}`}>{event.requestReportNumber}</Link>
                      </TableCell>
                      <TableCell>{event.preliminaryCheckResults || "-"}</TableCell>
                      <TableCell>{event.actionsTaken || "-"}</TableCell>
                      <TableCell>{event.receiverName || "-"}</TableCell>
                      <TableCell>{event.handoverDate || "-"}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/maintenance-requests/${event.requestId}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {Array.from({ length: Math.max(0, active.maxRows - active.events.length) }).map((_, index) => (
                    <TableRow key={`empty-${index}`}>
                      <TableCell>{active.events.length + index + 1}</TableCell>
                      <TableCell colSpan={6} className="text-muted-foreground">Empty fixed row</TableCell>
                    </TableRow>
                  ))}
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

      <Card>
        <CardHeader><CardTitle>Record History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.map((record) => (
            <div key={record.id} className="rounded-md border p-3">
              <div className="font-medium">Record #{record.sequenceNumber} - {record.status}</div>
              <div className="text-sm text-muted-foreground">{record.events.length}/{record.maxRows} rows filled</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
