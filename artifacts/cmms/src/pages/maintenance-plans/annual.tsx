import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save } from "lucide-react";
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
  duration: string | null;
  startDate: string | null;
  finishDate: string | null;
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

export default function AnnualPlanPage({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("edit_maintenance_plans");
  const [form, setForm] = useState<AnnualPlan | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["annual-plan", year],
    queryFn: () => apiRequest<AnnualPlan>(`/maintenance-plans/annual/${year}`),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest<AnnualPlan>(`/maintenance-plans/annual/${year}`, {
        method: "PUT",
        body: JSON.stringify(form),
      }),
    onSuccess: (updated) => {
      setForm(updated);
      queryClient.invalidateQueries({ queryKey: ["annual-plan", year] });
    },
  });

  function updateField(field: keyof AnnualPlan, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateRow(rowId: number, patch: Partial<AnnualRow>) {
    setForm((current) =>
      current
        ? { ...current, rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) }
        : current,
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  if (isLoading || !form) return <div className="p-8 text-muted-foreground">Loading annual plan...</div>;

  return (
    <form onSubmit={submit} className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Annual Preventive Maintenance Plan</h1>
          <p className="text-muted-foreground">FORM-10-1025 · {year}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/maintenance-plans">Back</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/print/annual-plan/${year}`}>Official Print</Link>
          </Button>
          {canEdit && (
            <Button type="submit" disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save
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
        <CardHeader>
          <CardTitle>Machine Schedule</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Machine / Location / Code</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Finish</TableHead>
                <TableHead>Months</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.machineName}</div>
                    <div className="text-xs text-muted-foreground">{row.machineLocation || "-"} · {row.machineCode || "-"}</div>
                  </TableCell>
                  <TableCell>{row.frequencyMonths ? `Every ${row.frequencyMonths} months` : "-"}</TableCell>
                  <TableCell>
                    <Input value={row.duration ?? ""} readOnly={!canEdit} onChange={(event) => updateRow(row.id, { duration: event.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={row.startDate ?? ""} readOnly={!canEdit} onChange={(event) => updateRow(row.id, { startDate: event.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={row.finishDate ?? ""} readOnly={!canEdit} onChange={(event) => updateRow(row.id, { finishDate: event.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.scheduledMonths.join(",")}
                      readOnly={!canEdit}
                      onChange={(event) =>
                        updateRow(row.id, {
                          scheduledMonths: event.target.value
                            .split(",")
                            .map((value) => Number(value.trim()))
                            .filter((value) => value >= 1 && value <= 12),
                        })
                      }
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
