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
import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { OfficialFormHeader } from "@/components/official-form-header";
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
  machineId: number | null;
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
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const canEditPlan = hasPermission("edit_maintenance_plans");
  const canEditRows = hasPermission("edit_monthly_pm_plan_rows");
  const canDeleteRows = hasPermission("delete_monthly_pm_plan_rows");
  const [isEditingRows, setIsEditingRows] = useState(false);
  const [form, setForm] = useState<MonthlyPlan | null>(null);
  const [carryOverMachineId, setCarryOverMachineId] = useState("");
  const [carryOverDate, setCarryOverDate] = useState(`${year}-${String(month).padStart(2, "0")}-01`);
  const [changedActualDateRows, setChangedActualDateRows] = useState<Set<number>>(new Set());

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
      setChangedActualDateRows(new Set());
      queryClient.invalidateQueries({ queryKey: ["monthly-plan", year, month] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const addCarryOverRow = useMutation({
    mutationFn: () => {
      const [targetYear, targetMonth] = carryOverDate.split("-").map(Number);
      return apiRequest<MonthlyRow>(`/maintenance-plans/monthly/${targetYear}/${targetMonth}/rows`, {
        method: "POST",
        body: JSON.stringify({
          machineId: Number(carryOverMachineId),
          plannedDateFrom: carryOverDate,
          plannedDateTo: carryOverDate,
          sourceYear: year,
          sourceMonth: month,
        }),
      });
    },
    onSuccess: () => {
      const [targetYear, targetMonth] = carryOverDate.split("-").map(Number);
      setCarryOverMachineId("");
      queryClient.invalidateQueries({ queryKey: ["monthly-plan", targetYear, targetMonth] });
      navigate(`/maintenance-plans/monthly/${targetYear}/${targetMonth}`);
    },
  });

  const deleteRow = useMutation({
    mutationFn: (rowId: number) => apiRequest(`/maintenance-plans/monthly/${year}/${month}/rows/${rowId}`, { method: "DELETE" }),
    onSuccess: (_result, rowId) => {
      setForm((current) => current ? { ...current, rows: current.rows.filter((row) => row.id !== rowId) } : current);
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
    setChangedActualDateRows((current) => new Set(current).add(rowId));
  }

  function updateActualDate(rowId: number, actualDate: string) {
    updateRow(rowId, { actualDate });
    setChangedActualDateRows((current) => new Set(current).add(rowId));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  if (isLoading || !form) return <div className="p-8 text-muted-foreground">Loading monthly plan...</div>;

  return (
    <form onSubmit={submit} className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="outline" size="icon" aria-label="Back">
            <Link href={`/maintenance-plans/monthly/${year}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monthly Preventive Maintenance Program</h1>
          <p className="text-muted-foreground">FORM-10-0117 · {monthNames[month - 1]} {year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/print/monthly-plan/${year}/${month}`}>Official Print</Link>
          </Button>
          {canEditPlan && (
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
              <Input value={(form[field as keyof MonthlyPlan] as string | null) ?? ""} readOnly={!canEditPlan} onChange={(event) => updateField(field as keyof MonthlyPlan, event.target.value)} />
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
              <Input type="date" value={(form[field as keyof MonthlyPlan] as string | null) ?? ""} readOnly={!canEditPlan} onChange={(event) => updateField(field as keyof MonthlyPlan, event.target.value)} />
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Scheduled Machines</CardTitle>
          {(canEditRows || canDeleteRows) && (
            <Button type="button" variant={isEditingRows ? "outline" : "default"} onClick={() => setIsEditingRows((value) => !value)}>
              {isEditingRows ? <X className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
              {isEditingRows ? "Finish editing" : "Edit monthly table"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {canEditRows && isEditingRows && (
            <div className="mb-5 grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-[1fr_180px_auto] md:items-end">
              <div>
                <Label>Machine to reschedule</Label>
                <select value={carryOverMachineId} onChange={(event) => setCarryOverMachineId(event.target.value)} className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select machine</option>
                  {Array.from(
                    new Map(
                      form.rows
                        .filter((row) => row.machineId)
                        .map((row) => [row.machineId, row]),
                    ).values(),
                  ).map((row) => (
                    <option key={row.machineId!} value={row.machineId!}>
                      {row.machineName} / {row.identificationNumber}
                      {row.departmentName ? ` — ${row.departmentName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Target month / planned date</Label>
                <Input className="mt-2" type="date" value={carryOverDate} onChange={(event) => setCarryOverDate(event.target.value)} />
              </div>
              <Button type="button" onClick={() => addCarryOverRow.mutate()} disabled={!carryOverMachineId || addCarryOverRow.isPending}>
                <Plus className="mr-2 h-4 w-4" />Reschedule and shift following months
              </Button>
            </div>
          )}
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
                {canDeleteRows && isEditingRows && <TableHead>Actions</TableHead>}
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
                    <Input type="date" value={row.plannedDateFrom ?? ""} readOnly={!canEditRows || !isEditingRows} onChange={(event) => updateRow(row.id, { plannedDateFrom: event.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={row.plannedDateTo ?? ""} readOnly={!canEditRows || !isEditingRows} onChange={(event) => updateRow(row.id, { plannedDateTo: event.target.value })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-[230px] items-center gap-2">
                      <Input
                        type="date"
                        value={row.actualDate ?? ""}
                        readOnly={!canEditRows || !isEditingRows}
                        onChange={(event) => updateActualDate(row.id, event.target.value)}
                      />
                      {canEditRows && isEditingRows && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => save.mutate()}
                          disabled={save.isPending || !changedActualDateRows.has(row.id)}
                        >
                          <Save className="mr-1 h-4 w-4" />
                          Save
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input value={row.amendments ?? ""} readOnly={!canEditRows || !isEditingRows} onChange={(event) => updateRow(row.id, { amendments: event.target.value })} />
                  </TableCell>
                  <TableCell>{row.actualDate ? "completed" : "due"}</TableCell>
                  {canDeleteRows && isEditingRows && (
                    <TableCell>
                      <Button type="button" size="icon" variant="destructive" onClick={() => deleteRow.mutate(row.id)} disabled={deleteRow.isPending} title="Delete from this month">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </form>
  );
}
