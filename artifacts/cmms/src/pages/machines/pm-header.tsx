import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";

type Header = {
  procedureFormNumber: string;
  effectiveDate: string | null;
  department: string | null;
  columnsPerRecord: number;
};

export default function PmHeaderPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Header>({
    procedureFormNumber: "",
    effectiveDate: "",
    department: "",
    columnsPerRecord: 5,
  });

  const { data } = useQuery({
    queryKey: ["pm-header", machineId],
    queryFn: () => apiRequest<Header>(`/machines/${machineId}/pm/header`),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest<Header>(`/machines/${machineId}/pm/header`, {
        method: "PUT",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-header", machineId] });
      queryClient.invalidateQueries({ queryKey: ["pm-current", machineId] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/machines/${machineId}/pm`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit PM Header</h1>
          <p className="text-muted-foreground">Restricted header fields for the official PM record.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Header Fields</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Procedure / form number</Label>
            <Input
              value={form.procedureFormNumber}
              onChange={(event) => setForm((current) => ({ ...current, procedureFormNumber: event.target.value }))}
            />
          </div>
          <div>
            <Label>Effective date</Label>
            <Input
              type="date"
              value={form.effectiveDate ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))}
            />
          </div>
          <div>
            <Label>Department</Label>
            <Input
              value={form.department ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
            />
          </div>
          <div>
            <Label>Inspection columns per record</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={form.columnsPerRecord}
              onChange={(event) => setForm((current) => ({ ...current, columnsPerRecord: Number(event.target.value) }))}
            />
          </div>
          <Button type="submit" disabled={save.isPending} className="w-fit">
            <Save className="mr-2 h-4 w-4" />
            Save Header
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
