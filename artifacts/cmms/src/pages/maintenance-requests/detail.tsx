import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Play, Save, X } from "lucide-react";
import type { MaintenanceRequestDetail, PerformingStaff } from "./types";
import { PrintButton } from "@/components/print-button";
import { OfficialFormHeader } from "@/components/official-form-header";
import { ElectronicSignatureField } from "@/components/electronic-signature-field";

type TechnicianOption = {
  id: number;
  username: string;
  fullName: string | null;
};

export default function MaintenanceRequestDetailPage({ params }: { params: { id: string } }) {
  const requestId = Number(params.id);
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuth();
  const [qaNotes, setQaNotes] = useState("");
  const [qaSignature, setQaSignature] = useState("");
  const [engineeringNotes, setEngineeringNotes] = useState("");
  const [engineeringReviewSignature, setEngineeringReviewSignature] = useState("");
  const [assignedTechnicianId, setAssignedTechnicianId] = useState("");
  const [workFrom, setWorkFrom] = useState("");
  const [workTo, setWorkTo] = useState("");
  const [preliminary, setPreliminary] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [techSignature, setTechSignature] = useState("");
  const [sectionSupervisorSignature, setSectionSupervisorSignature] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [remarks, setRemarks] = useState("");
  const [staff, setStaff] = useState<PerformingStaff[]>([{ no: "1", name: "", signature: "" }]);
  const [receiverName, setReceiverName] = useState("");
  const [receiverSignature, setReceiverSignature] = useState("");
  const [handoverDate, setHandoverDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [engineeringSignature, setEngineeringSignature] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance-request", requestId],
    queryFn: () => apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}`),
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["maintenance-request-technicians"],
    queryFn: () => apiRequest<TechnicianOption[]>("/maintenance-requests/technicians"),
    enabled: hasPermission("review_engineering_requests"),
  });

  useEffect(() => {
    if (!data) return;
    const event = data.correctiveEvent;
    setQaNotes(data.qaReviewNotes ?? "");
    setQaSignature(data.qaSupervisorSignature ?? "");
    setEngineeringNotes(data.engineeringReviewNotes ?? "");
    setEngineeringReviewSignature(data.engineeringSupervisorSignature ?? "");
    setAssignedTechnicianId(data.assignedTechnicianUserId ? String(data.assignedTechnicianUserId) : "");
    setWorkFrom(event?.expectedWorkTimeFrom ?? data.expectedWorkTimeFrom ?? "");
    setWorkTo(event?.expectedWorkTimeTo ?? data.expectedWorkTimeTo ?? "");
    setPreliminary(event?.preliminaryCheckResults ?? "");
    setTechnicianName(event?.technicianName ?? "");
    setTechSignature(event?.maintenanceTechnicianSignature ?? "");
    setSectionSupervisorSignature(event?.concernedSectionSupervisorSignature ?? "");
    setActionsTaken(event?.actionsTaken ?? "");
    setRemarks(event?.remarksRecommendations ?? "");
    setStaff(event?.performingStaff.length ? event.performingStaff : [{ no: "1", name: "", signature: "" }]);
    setReceiverName(event?.receiverName ?? "");
    setReceiverSignature(event?.receiverSignature ?? "");
    setHandoverDate(event?.handoverDate ?? new Date().toISOString().slice(0, 10));
    setEngineeringSignature(event?.engineeringSignature ?? "");
  }, [data]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["maintenance-request", requestId] });
    queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
  }

  const qaReview = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/qa-review`, {
        method: "PATCH",
        body: JSON.stringify({ decision, notes: qaNotes, signature: qaSignature }),
      }),
    onSuccess: refresh,
  });

  const engineeringReview = useMutation({
    mutationFn: (decision: "accept" | "reject") =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/engineering-review`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          notes: engineeringNotes,
          signature: engineeringReviewSignature,
          assignedTechnicianUserId: assignedTechnicianId ? Number(assignedTechnicianId) : null,
          expectedWorkTimeFrom: workFrom,
          expectedWorkTimeTo: workTo,
        }),
      }),
    onSuccess: refresh,
  });

  const startWork = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/start-work`, {
        method: "PATCH",
      }),
    onSuccess: refresh,
  });

  const savePreliminary = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/preliminary-findings`, {
        method: "PATCH",
        body: JSON.stringify({
          preliminaryCheckResults: preliminary,
          expectedWorkTimeFrom: workFrom,
          expectedWorkTimeTo: workTo,
          technicianName,
          maintenanceTechnicianSignature: techSignature,
          concernedSectionSupervisorSignature: sectionSupervisorSignature,
        }),
      }),
    onSuccess: refresh,
  });

  const saveActions = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/actions-taken`, {
        method: "PATCH",
        body: JSON.stringify({
          actionsTaken,
          remarksRecommendations: remarks,
          performingStaff: staff,
        }),
      }),
    onSuccess: refresh,
  });

  const saveHandover = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/handover`, {
        method: "PATCH",
        body: JSON.stringify({
          receiverName,
          receiverSignature,
          handoverDate,
          engineeringSignature,
        }),
      }),
    onSuccess: refresh,
  });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading request...</div>;

  const request = data.request;
  const isAssignedTechnician = data.assignedTechnicianUserId === user?.id;
  const canQaReview = hasPermission("review_qa_requests") && request.status === "Pending QA Approval";
  const canEngineeringReview = hasPermission("review_engineering_requests") && request.status === "QA Approved";
  const canStartWork = hasPermission("fill_corrective_maintenance") && isAssignedTechnician && request.status === "Accepted";
  const canTechnicianWork = hasPermission("fill_corrective_maintenance") && isAssignedTechnician && (request.status === "Accepted" || request.status === "In Progress");
  const canHandover = hasPermission("fill_corrective_maintenance") && isAssignedTechnician && (request.status === "In Progress" || request.status === "Completed");

  function submitPreliminary(event: FormEvent) {
    event.preventDefault();
    savePreliminary.mutate();
  }

  function submitActions(event: FormEvent) {
    event.preventDefault();
    saveActions.mutate();
  }

  function submitHandover(event: FormEvent) {
    event.preventDefault();
    saveHandover.mutate();
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/maintenance-requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{request.requestReportNumber}</h1>
          <p className="text-muted-foreground">Maintenance Request and Corrective Maintenance Report (FORM-10-0975)</p>
        </div>
        <Badge variant="secondary">{request.status}</Badge>
        <PrintButton />
        <Button asChild variant="outline">
          <Link href={`/print/maintenance-request/${requestId}`}>Official Print</Link>
        </Button>
      </div>

      <div className="rounded-md border bg-white p-6 text-black shadow-sm print:border-none print:p-0 print:shadow-none">
        <OfficialFormHeader
          documentName="Maintenance Request / Corrective Maintenance Report"
          documentNumber="FORM-10-0975 / LOG-00-0102-3"
          effectiveOrExecutionDate={request.requestDate}
          machineName={request.machineName}
          machineNumber={request.machineNumber}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Section 1 - Request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Request / Report Number</Label>
            <Button asChild variant="outline" className="justify-start font-mono">
              <Link href={`/machines/${request.machineId}/corrective-maintenance`}>{request.requestReportNumber}</Link>
            </Button>
          </div>
          <div><Label>Department / Section</Label><Input value={request.departmentSection ?? ""} readOnly /></div>
          <div><Label>Priority</Label><Input value={request.priority} readOnly /></div>
          <div><Label>Machine name / machine number</Label><Input value={`${request.machineName} / ${request.machineNumber}`} readOnly /></div>
          <div><Label>Date</Label><Input value={request.requestDate} readOnly /></div>
          <div className="md:col-span-2"><Label>Failure description</Label><Textarea value={request.failureDescription} readOnly /></div>
          <div><Label>Person reporting failure</Label><Input value={data.reportingPersonName ?? ""} readOnly /></div>
          <div><Label>Person reporting failure signature placeholder</Label><Input value={data.reportingPersonSignature ?? ""} readOnly /></div>
          <div><Label>Department supervisor</Label><Input value={data.departmentSupervisorName ?? ""} readOnly /></div>
          <div><Label>Department supervisor signature placeholder</Label><Input value={data.departmentSupervisorSignature ?? ""} readOnly /></div>
          <div><Label>QA decision</Label><Input value={data.qaDecision ?? ""} readOnly /></div>
          <div><Label>QA review date</Label><Input value={data.qaReviewDate ?? ""} readOnly /></div>
          <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="qa_supervisor_approval" label="QA Supervisor Electronic Signature" />
          <div><Label>QA notes</Label><Input value={data.qaReviewNotes ?? ""} readOnly /></div>
        </CardContent>
      </Card>

      {canQaReview && (
        <Card>
          <CardHeader><CardTitle>QA Supervisor Review</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>QA Supervisor name</Label><Input value={qaSignature} onChange={(event) => setQaSignature(event.target.value)} /></div>
            <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="qa_supervisor_approval" label="QA Supervisor Electronic Signature" />
            <div><Label>Review notes</Label><Input value={qaNotes} onChange={(event) => setQaNotes(event.target.value)} /></div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => qaReview.mutate("approve")}><Check className="mr-2 h-4 w-4" />Approve</Button>
              <Button type="button" variant="destructive" onClick={() => qaReview.mutate("reject")}><X className="mr-2 h-4 w-4" />Reject</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Section 2 - Engineering Review</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Engineering decision</Label><Input value={data.engineeringDecision ?? ""} readOnly /></div>
          <div><Label>Assigned technician</Label><Input value={technicians.find((item) => item.id === data.assignedTechnicianUserId)?.fullName ?? ""} readOnly /></div>
          <div><Label>Expected work time From</Label><Input value={data.expectedWorkTimeFrom ?? ""} readOnly /></div>
          <div><Label>Expected work time To</Label><Input value={data.expectedWorkTimeTo ?? ""} readOnly /></div>
          <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="engineering_supervisor_approval" label="Engineering Supervisor Electronic Signature" />
          <div><Label>Engineering notes</Label><Input value={data.engineeringReviewNotes ?? ""} readOnly /></div>
        </CardContent>
      </Card>

      {canEngineeringReview && (
        <Card>
          <CardHeader><CardTitle>Engineering / Maintenance Supervisor Action</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Assigned technician</Label>
              <Select value={assignedTechnicianId || "unassigned"} onValueChange={(value) => setAssignedTechnicianId(value === "unassigned" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {technicians.map((technician) => (
                    <SelectItem key={technician.id} value={String(technician.id)}>
                      {technician.fullName || technician.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Engineering supervisor name</Label><Input value={engineeringReviewSignature} onChange={(event) => setEngineeringReviewSignature(event.target.value)} /></div>
            <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="engineering_supervisor_approval" label="Engineering Supervisor Electronic Signature" />
            <div><Label>Expected work time From</Label><Input value={workFrom} onChange={(event) => setWorkFrom(event.target.value)} /></div>
            <div><Label>Expected work time To</Label><Input value={workTo} onChange={(event) => setWorkTo(event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Review notes</Label><Input value={engineeringNotes} onChange={(event) => setEngineeringNotes(event.target.value)} /></div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => engineeringReview.mutate("accept")}><Check className="mr-2 h-4 w-4" />Accept</Button>
              <Button type="button" variant="destructive" onClick={() => engineeringReview.mutate("reject")}><X className="mr-2 h-4 w-4" />Reject</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canStartWork && (
        <Button type="button" onClick={() => startWork.mutate()}>
          <Play className="mr-2 h-4 w-4" />
          Start Corrective Maintenance
        </Button>
      )}

      <form onSubmit={submitPreliminary}>
        <Card>
          <CardHeader><CardTitle>Section 3 - Preliminary Findings</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Preliminary check results</Label><Textarea value={preliminary} readOnly={!canTechnicianWork} onChange={(event) => setPreliminary(event.target.value)} /></div>
            <div><Label>Expected work time From</Label><Input value={workFrom} readOnly={!canTechnicianWork} onChange={(event) => setWorkFrom(event.target.value)} /></div>
            <div><Label>Expected work time To</Label><Input value={workTo} readOnly={!canTechnicianWork} onChange={(event) => setWorkTo(event.target.value)} /></div>
            <div><Label>Maintenance technician name</Label><Input value={technicianName} readOnly={!canTechnicianWork} onChange={(event) => setTechnicianName(event.target.value)} /></div>
            <div><Label>Maintenance technician name/signature reference</Label><Input value={techSignature} readOnly={!canTechnicianWork} onChange={(event) => setTechSignature(event.target.value)} /></div>
            <div><Label>Concerned section supervisor name/reference</Label><Input value={sectionSupervisorSignature} readOnly={!canTechnicianWork} onChange={(event) => setSectionSupervisorSignature(event.target.value)} /></div>
            <ElectronicSignatureField documentType="CORRECTIVE_MAINTENANCE" documentId={requestId} fieldName="maintenance_technician" label="Maintenance Technician Electronic Signature" />
            <ElectronicSignatureField documentType="CORRECTIVE_MAINTENANCE" documentId={requestId} fieldName="concerned_section_supervisor" label="Concerned Section Supervisor Electronic Signature" />
            {canTechnicianWork && <Button type="submit" className="w-fit"><Save className="mr-2 h-4 w-4" />Save Preliminary Findings</Button>}
          </CardContent>
        </Card>
      </form>

      <form onSubmit={submitActions}>
        <Card>
          <CardHeader><CardTitle>Section 4 - Actions Taken</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Actions taken</Label><Textarea value={actionsTaken} readOnly={!canTechnicianWork} onChange={(event) => setActionsTaken(event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Remarks and recommendations</Label><Textarea value={remarks} readOnly={!canTechnicianWork} onChange={(event) => setRemarks(event.target.value)} /></div>
            <div className="md:col-span-2 space-y-2">
              <Label>Performing staff - No. / Name / Signature reference</Label>
              {staff.map((item, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[80px_1fr_1fr]">
                  <Input value={item.no ?? ""} readOnly={!canTechnicianWork} onChange={(event) => setStaff((current) => current.map((row, i) => i === index ? { ...row, no: event.target.value } : row))} />
                  <Input value={item.name ?? ""} readOnly={!canTechnicianWork} onChange={(event) => setStaff((current) => current.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} />
                  <Input value={item.signature ?? ""} readOnly={!canTechnicianWork} onChange={(event) => setStaff((current) => current.map((row, i) => i === index ? { ...row, signature: event.target.value } : row))} />
                </div>
              ))}
              {canTechnicianWork && <Button type="button" variant="outline" onClick={() => setStaff((current) => [...current, { no: String(current.length + 1), name: "", signature: "" }])}>Add Staff Row</Button>}
            </div>
            {canTechnicianWork && <Button type="submit" className="w-fit"><Save className="mr-2 h-4 w-4" />Save Actions Taken</Button>}
          </CardContent>
        </Card>
      </form>

      <form onSubmit={submitHandover}>
        <Card>
          <CardHeader><CardTitle>Section 4 - Hand-over Confirmation</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Receiver name</Label><Input value={receiverName} readOnly={!canHandover} onChange={(event) => setReceiverName(event.target.value)} /></div>
            <div><Label>Receiver signature reference</Label><Input value={receiverSignature} readOnly={!canHandover} onChange={(event) => setReceiverSignature(event.target.value)} /></div>
            <div><Label>Handover date</Label><Input type="date" value={handoverDate} readOnly={!canHandover} onChange={(event) => setHandoverDate(event.target.value)} /></div>
            <div><Label>Engineering final confirmation reference</Label><Input value={engineeringSignature} readOnly={!canHandover} onChange={(event) => setEngineeringSignature(event.target.value)} /></div>
            <ElectronicSignatureField documentType="CORRECTIVE_MAINTENANCE" documentId={requestId} fieldName="receiver" label="Receiver Electronic Signature" />
            <ElectronicSignatureField documentType="CORRECTIVE_MAINTENANCE" documentId={requestId} fieldName="engineering_final" label="Engineering Final Electronic Signature" />
            {canHandover && <Button type="submit" className="w-fit"><Save className="mr-2 h-4 w-4" />Close Request</Button>}
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader><CardTitle>Status History</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.statusHistory.map((item) => (
            <div key={item.id} className="rounded-md border p-3 text-sm">
              <span className="font-medium">{item.fromStatus || "Created"} - {item.toStatus}</span>
              <span className="text-muted-foreground"> | {new Date(item.createdAt).toLocaleString()}</span>
              {item.notes && <div className="text-muted-foreground mt-1">{item.notes}</div>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
