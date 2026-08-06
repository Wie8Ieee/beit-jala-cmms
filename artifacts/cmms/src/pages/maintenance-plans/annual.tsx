import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, Save } from "lucide-react";
import { OfficialFormHeader } from "@/components/official-form-header";
import { ElectronicSignatureField } from "@/components/electronic-signature-field";

type AnnualRow = {
  id: number;
  machineId: number;
  department: string | null;
  machineName: string;
  machineLocation: string | null;
  machineCode: string | null;
  frequencyMonths: number | null;
  startDate: string | null;
  scheduledMonths: number[];
  isOverride: boolean;
};

type AnnualPlan = {
  id: number;
  year: number;
  preparedByName: string | null;
  preparedByDate: string | null;
  approvedEngineeringName: string | null;
  approvedEngineeringDate: string | null;
  approvedProductionName: string | null;
  approvedProductionDate: string | null;
  approvedQcName: string | null;
  approvedQcDate: string | null;
  approvedRdName: string | null;
  approvedRdDate: string | null;
  approvedQaName: string | null;
  approvedQaDate: string | null;
  rows: AnnualRow[];
};

type AnnualPlanHeader = {
  documentNumber: string;
  effectiveOrExecutionDate: string | null;
};

function calculateScheduledMonths(startDate: string | null, frequencyMonths: number | null) {
  if (!startDate || !frequencyMonths || frequencyMonths < 1) return [];
  const month = Number(startDate.slice(5, 7));
  if (!month || month > 12) return [];
  const months: number[] = [];
  for (let current = month; current <= 12; current += frequencyMonths) months.push(current);
  return months;
}

export default function AnnualPlanPage({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("edit_maintenance_plans");
  const canEditHeader = hasPermission("edit_header");
  const [form, setForm] = useState<AnnualPlan | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [header, setHeader] = useState<AnnualPlanHeader>({ documentNumber: "", effectiveOrExecutionDate: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["annual-plan", year],
    queryFn: () => apiRequest<AnnualPlan>(`/maintenance-plans/annual/${year}`),
  });

  useEffect(() => {
    if (data) {
      setForm({ ...data, rows: data.rows.map((row) => ({ ...row, scheduledMonths: calculateScheduledMonths(row.startDate, row.frequencyMonths) })) });
      setHasUnsavedChanges(false);
    }
  }, [data]);

  const { data: savedHeader } = useQuery({
    queryKey: ["annual-pm-header"],
    queryFn: () => apiRequest<AnnualPlanHeader>("/maintenance-plans/annual/header"),
  });

  useEffect(() => {
    if (savedHeader) setHeader(savedHeader);
  }, [savedHeader]);

  const saveHeader = useMutation({
    mutationFn: () => apiRequest<AnnualPlanHeader>("/maintenance-plans/annual/header", { method: "PUT", body: JSON.stringify(header) }),
    onSuccess: (saved) => {
      setHeader(saved);
      queryClient.invalidateQueries({ queryKey: ["annual-pm-header"] });
    },
  });

  const save = useMutation({
    mutationFn: () =>
      apiRequest<AnnualPlan>(`/maintenance-plans/annual/${year}`, {
        method: "PUT",
        body: JSON.stringify(form),
      }),
    onSuccess: (updated) => {
      setForm(updated);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["annual-plan", year] });
    },
  });

  function updateField(field: keyof AnnualPlan, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setHasUnsavedChanges(true);
  }

  function updateRow(rowId: number, patch: Partial<AnnualRow>) {
    setForm((current) =>
      current
        ? { ...current, rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) }
        : current,
    );
    setHasUnsavedChanges(true);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  if (isLoading || !form) return <div className="p-8 text-muted-foreground">Loading annual plan...</div>;

  return (
    <form onSubmit={submit} className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Button type="button" variant="outline" size="icon" title="Back" aria-label="Back to previous page" onClick={() => window.history.length > 1 ? window.history.back() : navigate("/maintenance-plans")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Annual Preventive Maintenance Plan</h1>
            <p className="text-muted-foreground">FORM-10-1025 · {year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/print/annual-plan/${year}`}>Official Print</Link>
          </Button>
          {canEdit && (
            <Button type="submit" disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {hasUnsavedChanges ? "Save changes" : "Save"}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-white p-6 text-black shadow-sm print:border-none print:p-0 print:shadow-none">
        <OfficialFormHeader
          documentName="Annual Preventive Maintenance Plan"
          documentNumber="FORM-10-1025"
          effectiveOrExecutionDate={String(year)}
        />
      </div>

      {canEditHeader && (
        <Card>
          <CardHeader><CardTitle>Annual Plan Header Settings</CardTitle></CardHeader>
          <CardContent className="grid max-w-2xl gap-4 md:grid-cols-2">
            <div>
              <Label>Document number</Label>
              <Input value={header.documentNumber} onChange={(event) => setHeader({ ...header, documentNumber: event.target.value })} />
            </div>
            <div>
              <Label>Effective date</Label>
              <Input value={header.effectiveOrExecutionDate ?? ""} onChange={(event) => setHeader({ ...header, effectiveOrExecutionDate: event.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button type="button" onClick={() => saveHeader.mutate()} disabled={saveHeader.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Save Header for All Annual Plans
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Approval Page</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[ 
            ["preparedByName", "Prepared by"],
            ["approvedEngineeringName", "Engineering Department Manager"],
            ["approvedProductionName", "Production Department Manager"],
            ["approvedQcName", "QC Department Manager"],
            ["approvedRdName", "R&D Department Manager"],
            ["approvedQaName", "QA Department Manager"],
          ].map(([field, label]) => (
            <div key={field}>
              <Label>{label}</Label>
              <Input value={(form[field as keyof AnnualPlan] as string | null) ?? ""} readOnly={!canEdit} onChange={(event) => updateField(field as keyof AnnualPlan, event.target.value)} />
            </div>
          ))}
          {[
            ["preparedByDate", "Prepared date"],
            ["approvedEngineeringDate", "Engineering date"],
            ["approvedProductionDate", "Production date"],
            ["approvedQcDate", "QC date"],
            ["approvedRdDate", "R&D date"],
            ["approvedQaDate", "QA date"],
          ].map(([field, label]) => (
            <div key={field}>
              <Label>{label}</Label>
              <Input type="date" value={(form[field as keyof AnnualPlan] as string | null) ?? ""} readOnly={!canEdit} onChange={(event) => updateField(field as keyof AnnualPlan, event.target.value)} />
            </div>
          ))}
          {[
            ["prepared_by", "Prepared By Electronic Signature"],
            ["engineering_manager", "Engineering Manager Electronic Signature"],
            ["production_manager", "Production Manager Electronic Signature"],
            ["qc_manager", "QC Manager Electronic Signature"],
            ["rd_manager", "R&D Manager Electronic Signature"],
            ["qa_manager", "QA Manager Electronic Signature"],
          ].map(([fieldName, label]) => (
            <ElectronicSignatureField
              key={fieldName}
              documentType="ANNUAL_PLAN"
              documentId={form.id}
              fieldName={fieldName}
              label={label}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Machine Schedule</CardTitle>
          <div className="flex items-center gap-2">
            {canEdit && hasUnsavedChanges && <span className="text-sm font-medium text-amber-600">Unsaved changes</span>}
            {canEdit && (
              <Button type="submit" size="sm" disabled={save.isPending || !hasUnsavedChanges}>
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/print/annual-plan/${year}/schedule`}>
                <Printer className="mr-2 h-4 w-4" />
                Print Schedule
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Machine / Code</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Months</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.machineName}</div>
                    <div className="text-xs text-muted-foreground">{row.machineCode || "-"}</div>
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="1" value={row.frequencyMonths ?? ""} readOnly={!canEdit} onChange={(event) => {
                      const frequencyMonths = Number.parseInt(event.target.value, 10);
                      updateRow(row.id, {
                        frequencyMonths: Number.isInteger(frequencyMonths) && frequencyMonths > 0 ? frequencyMonths : null,
                        scheduledMonths: calculateScheduledMonths(row.startDate, Number.isInteger(frequencyMonths) && frequencyMonths > 0 ? frequencyMonths : null),
                      });
                    }} />
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={row.startDate ?? ""} readOnly={!canEdit} onChange={(event) => updateRow(row.id, { startDate: event.target.value, scheduledMonths: calculateScheduledMonths(event.target.value, row.frequencyMonths) })} />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.scheduledMonths.join(",")}
                      readOnly
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </form>
  );
}
