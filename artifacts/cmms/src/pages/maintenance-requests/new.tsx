import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import type { MaintenanceRequestDetail } from "./types";

type MachineOption = {
  id: number;
  machineName: string;
  machineNumber: string;
  location: string | null;
  departmentName: string | null;
};

export default function NewMaintenanceRequestPage() {
  const [, setLocation] = useLocation();
  const [machineId, setMachineId] = useState("");
  const [departmentSection, setDepartmentSection] = useState("");
  const [priority, setPriority] = useState("normal");
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [failureDescription, setFailureDescription] = useState("");
  const [reportingName, setReportingName] = useState("");
  const [reportingSignature, setReportingSignature] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorSignature, setSupervisorSignature] = useState("");

  const { data: machines = [] } = useQuery({
    queryKey: ["request-machine-options"],
    queryFn: () => apiRequest<MachineOption[]>("/maintenance-requests/machines"),
  });

  const createRequest = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceRequestDetail>("/maintenance-requests", {
        method: "POST",
        body: JSON.stringify({
          machineId: Number(machineId),
          departmentSection,
          priority,
          requestDate,
          failureDescription,
          reportingPersonName: reportingName,
          reportingPersonSignature: reportingSignature,
          departmentSupervisorName: supervisorName,
          departmentSupervisorSignature: supervisorSignature,
        }),
      }),
    onSuccess: (data) => setLocation(`/maintenance-requests/${data.request.id}`),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    createRequest.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/maintenance-requests/my">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Maintenance Request</h1>
          <p className="text-muted-foreground">FORM-10-0975 Section 1 — Request.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Machine name / machine number</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((machine) => (
                  <SelectItem key={machine.id} value={String(machine.id)}>
                    {machine.machineName} / {machine.machineNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Department / Section</Label>
            <Input value={departmentSection} onChange={(event) => setDepartmentSection(event.target.value)} />
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Failure description</Label>
            <Textarea required value={failureDescription} onChange={(event) => setFailureDescription(event.target.value)} />
          </div>
          <div>
            <Label>Person reporting failure name</Label>
            <Input value={reportingName} onChange={(event) => setReportingName(event.target.value)} />
          </div>
          <div>
            <Label>Person reporting failure signature placeholder</Label>
            <Input value={reportingSignature} onChange={(event) => setReportingSignature(event.target.value)} placeholder="Placeholder signature name" />
          </div>
          <div>
            <Label>Department supervisor name</Label>
            <Input value={supervisorName} onChange={(event) => setSupervisorName(event.target.value)} />
          </div>
          <div>
            <Label>Department supervisor signature placeholder</Label>
            <Input value={supervisorSignature} onChange={(event) => setSupervisorSignature(event.target.value)} placeholder="Placeholder signature name" />
          </div>
          <Button type="submit" disabled={createRequest.isPending || !machineId || !failureDescription.trim()} className="w-fit">
            <Save className="mr-2 h-4 w-4" />
            Submit Request
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
