import { FormEvent, useMemo, useState } from "react";
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
import { ArrowLeft, Save, Settings2 } from "lucide-react";
import { OfficialFormHeader } from "@/components/official-form-header";
import { PrintButton } from "@/components/print-button";
import { ElectronicSignatureField } from "@/components/electronic-signature-field";

type PmChecklistPoint = {
  id: number;
  pointText: string;
  resultType: "yes_no" | "value" | "text";
  sortOrder: number;
};

type PmInspection = {
  id: number;
  columnNumber: number;
  inspectionDate: string;
  inspectionTime: string;
  actionTaken: string | null;
  examinerName: string | null;
  machineReceiverName: string | null;
  results: Array<{ checklistPointId: number; value: string | null }>;
};

type PmRecordDetail = {
  record: { id: number; sequenceNumber: number; inspectionCount: number; status: string };
  header: {
    procedureFormNumber: string;
    effectiveDate: string | null;
    department: string | null;
    columnsPerRecord: number;
  };
  checklistPoints: PmChecklistPoint[];
  inspections: PmInspection[];
  pageCount: number;
};

export default function PmRecordPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [results, setResults] = useState<Record<number, string>>({});
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [inspectionTime, setInspectionTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [actionTaken, setActionTaken] = useState("");
  const [examinerName, setExaminerName] = useState("");
  const [receiverName, setReceiverName] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["pm-current", machineId],
    queryFn: () => apiRequest<PmRecordDetail>(`/machines/${machineId}/pm/current`),
  });

  const saveInspection = useMutation({
    mutationFn: () =>
      apiRequest<PmRecordDetail>(`/machines/${machineId}/pm/inspections`, {
        method: "POST",
        body: JSON.stringify({
          inspectionDate,
          inspectionTime,
          actionTaken,
          examinerName,
          examinerSignature: examinerName,
          machineReceiverName: receiverName,
          machineReceiverSignature: receiverName,
          results: data?.checklistPoints.map((point) => ({
            checklistPointId: point.id,
            value: results[point.id] ?? "",
          })),
        }),
      }),
    onSuccess: () => {
      setResults({});
      setActionTaken("");
      queryClient.invalidateQueries({ queryKey: ["pm-current", machineId] });
    },
  });

  const resultMap = useMemo(() => {
    const map = new Map<string, string | null>();
    data?.inspections.forEach((inspection) => {
      inspection.results.forEach((result) => {
        map.set(`${inspection.id}-${result.checklistPointId}`, result.value);
      });
    });
    return map;
  }, [data]);

  function submit(event: FormEvent) {
    event.preventDefault();
    saveInspection.mutate();
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading PM record...</div>;
  if (error || !data) return <div className="p-8 text-destructive">Failed to load PM record.</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/machines/${machineId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Preventive Maintenance Record</h1>
          <p className="text-muted-foreground">
            Record #{data.record.sequenceNumber} · {data.record.inspectionCount}/{data.header.columnsPerRecord} inspection columns used
          </p>
        </div>
        {hasPermission("manage_pm_checklist") && (
          <Button asChild variant="outline">
            <Link href={`/machines/${machineId}/pm/checklist`}>
              <Settings2 className="mr-2 h-4 w-4" />
              Checklist Points
            </Link>
          </Button>
        )}
        <PrintButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fixed Header</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Procedure / form number</Label>
            <Input value={data.header.procedureFormNumber} readOnly />
          </div>
          <div>
            <Label>Effective date</Label>
            <Input value={data.header.effectiveDate ?? ""} readOnly />
          </div>
          <div>
            <Label>Department</Label>
            <Input value={data.header.department ?? ""} readOnly />
          </div>
          <div>
            <Label>Page count</Label>
            <Input value={`Page 1 of ${data.pageCount}`} readOnly />
          </div>
          {hasPermission("edit_header") && (
            <Button asChild variant="secondary" className="md:col-span-4 w-fit">
              <Link href={`/machines/${machineId}/pm/header`}>Edit Header</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border bg-white p-6 text-black shadow-sm print:border-none print:p-0 print:shadow-none">
        <OfficialFormHeader
          documentName="Preventive Maintenance Record"
          documentNumber={data.header.procedureFormNumber}
          effectiveOrExecutionDate={data.header.effectiveDate}
          page={`Page 1 of ${data.pageCount}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-72">Checklist Point</TableHead>
                  {data.inspections.map((inspection) => (
                    <TableHead key={inspection.id} className="min-w-40">
                      Inspection {inspection.columnNumber}
                      <div className="text-xs font-normal text-muted-foreground">{inspection.inspectionDate}</div>
                    </TableHead>
                  ))}
                  {hasPermission("fill_pm_record") && <TableHead className="min-w-48">New Inspection</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.checklistPoints.map((point, index) => (
                  <TableRow key={point.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{point.pointText}</TableCell>
                    {data.inspections.map((inspection) => (
                      <TableCell key={inspection.id}>{resultMap.get(`${inspection.id}-${point.id}`) ?? ""}</TableCell>
                    ))}
                    {hasPermission("fill_pm_record") && (
                      <TableCell>
                        <Input
                          value={results[point.id] ?? ""}
                          placeholder={point.resultType === "yes_no" ? "Yes / No" : "Value"}
                          onChange={(event) => setResults((current) => ({ ...current, [point.id]: event.target.value }))}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {hasPermission("fill_pm_record") && (
        <form onSubmit={submit}>
          <Card>
            <CardHeader>
              <CardTitle>Closing Block</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Inspection date</Label>
                <Input type="date" value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} />
              </div>
              <div>
                <Label>Inspection time</Label>
                <Input type="time" value={inspectionTime} onChange={(event) => setInspectionTime(event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Action taken in case of error/deviation</Label>
                <Textarea value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} />
              </div>
              <div>
                <Label>Examiner's name</Label>
                <Input value={examinerName} onChange={(event) => setExaminerName(event.target.value)} />
              </div>
              <div>
                <Label>Machine receiver's name</Label>
                <Input value={receiverName} onChange={(event) => setReceiverName(event.target.value)} />
              </div>
              <ElectronicSignatureField
                documentType="PM_RECORD"
                documentId={machineId}
                fieldName="examiner"
                label="Examiner Electronic Signature"
              />
              <ElectronicSignatureField
                documentType="PM_RECORD"
                documentId={machineId}
                fieldName="machine_receiver"
                label="Machine Receiver Electronic Signature"
              />
              <Button type="submit" disabled={saveInspection.isPending || data.checklistPoints.length === 0} className="w-fit">
                <Save className="mr-2 h-4 w-4" />
                Save Inspection
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
