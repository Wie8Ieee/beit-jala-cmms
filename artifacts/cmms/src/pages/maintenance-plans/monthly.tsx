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
import { PrintButton } from "@/components/print-button";
import { ElectronicSignatureField } from "@/components/electronic-signature-field";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type MonthlyRow = {
  id: number;
  rowNumber: number;
  departmentName: string | null;
  sectionName: string | null;
  machineName: string;
  identificationNumber: string | null;
  plannedDateFrom: string | null;
  plannedDateTo: string | null;
  actualDate: string | null;
  amendments: string | null;
  status: string;
};

type MonthlyPlan = {
  id: number;
  year: number;
  month: number;
  preparedByName: string | null;
  preparedByDate: string | null;
  maintenanceSupervisorName: string | null;
  maintenanceSupervisorDate: string | null;
  departmentManagerName: string | null;
  departmentManagerDate: string | null;
  approvedByName: string | null;
  approvedByDate: string | null;
  rows: MonthlyRow[];
};

export default function MonthlyPlanPage({ params }: { params: { year: string; month: string } }) {
  const year = Number(params.year);
  const month = Number(params.month);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("edit_maintenance_plans");
  const [form, setForm] = useState<MonthlyPlan | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["monthly-plan", year, month],
    queryFn: () => apiRequest<MonthlyPlan>(`/maintenance-plans/monthly/${year}/${month}`),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest<MonthlyPlan>(`/maintenance-plans/monthly/${year}/${month}`, {
        method: "PUT",
        body: JSON.stringify(form),
      }),
    onSuccess: (updated) => {
      setForm(updated);
      queryClient.invalidateQueries({ queryKey: ["monthly-plan", year, month] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function updateField(field: keyof MonthlyPlan, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateRow(rowId: number, patch: Partial<MonthlyRow>) {
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

  if (isLoading || !form) return <div className="p-8 text-muted-foreground">Loading monthly plan...</div>;

  return (
    <form onSubmit={submit} className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly Preventive Maintenance Program</h1>
          <p className="text-muted-foreground">FORM-10-0117 · {monthNames[month - 1]} {year}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/maintenance-plans/monthly/${year}`}>Back</Link>
          </Button>
          <PrintButton />
          <Button asChild variant="outline">
            <Link href={`/print/monthly-plan/${year}/${month}`}>Official Print</Link>
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
          documentName="Monthly Preventive Maintenance Program"
          documentNumber="FORM-10-0117"
          effectiveOrExecutionDate={`${monthNames[month - 1]} ${year}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign-Off Fields</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[ 
            ["preparedByName", "Prepared by"],
            ["maintenanceSupervisorName", "Maintenance Section Supervisor"],
            ["departmentManagerName", "Department Manager"],
            ["approvedByName", "Approved by"],
          ].map(([field, label]) => (
            <div key={field}>
              <Label>{label}</Label>
              <Input value={(form[field as keyof MonthlyPlan] as string | null) ?? ""} readOnly={!canEdit} onChange={(event) => updateField(field as keyof MonthlyPlan, event.target.value)} />
            </div>
          ))}
          {[
            ["preparedByDate", "Prepared date"],
            ["maintenanceSupervisorDate", "Supervisor date"],
            ["departmentManagerDate", "Manager date"],
            ["approvedByDate", "Approved date"],
          ].map(([field, label]) => (
            <div key={field}>
              <Label>{label}</Label>
              <Input type="date" value={(form[field as keyof MonthlyPlan] as string | null) ?? ""} readOnly={!canEdit} onChange={(event) => updateField(field as keyof MonthlyPlan, event.target.value)} />
            </div>
          ))}
          {[
            ["prepared_by", "Prepared By Electronic Signature"],
            ["maintenance_supervisor", "Maintenance Supervisor Electronic Signature"],
            ["department_manager", "Department Manager Electronic Signature"],
            ["approved_by", "Approved By Electronic Signature"],
          ].map(([fieldName, label]) => (
            <ElectronicSignatureField
              key={fieldName}
              documentType="MONTHLY_PLAN"
              documentId={form.id}
              fieldName={fieldName}
              label={label}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Machines</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Machine / ID</TableHead>
                <TableHead>Planned From</TableHead>
                <TableHead>Planned To</TableHead>
                <TableHead>Actual Date</TableHead>
                <TableHead>Amendments</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.rowNumber}</TableCell>
                  <TableCell>{row.departmentName}</TableCell>
                  <TableCell>{row.sectionName}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.machineName}</div>
                    <div className="text-xs text-muted-foreground">{row.identificationNumber}</div>
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={row.plannedDateFrom ?? ""} readOnly={!canEdit} onChange={(event) => updateRow(row.id, { plannedDateFrom: event.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={row.plannedDateTo ?? ""} readOnly={!canEdit} onChange={(event) => updateRow(row.id, { plannedDateTo: event.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={row.actualDate ?? ""} readOnly={!canEdit} onChange={(event) => updateRow(row.id, { actualDate: event.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input value={row.amendments ?? ""} readOnly={!canEdit} onChange={(event) => updateRow(row.id, { amendments: event.target.value })} />
                  </TableCell>
                  <TableCell>{row.actualDate ? "completed" : row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </form>
  );
}
