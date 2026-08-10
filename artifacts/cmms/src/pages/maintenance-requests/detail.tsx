import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Archive, ArchiveRestore, ArrowLeft, Check, Play, Save, Wrench, X } from "lucide-react";
import type { ExternalMaintenanceRequestDetail, MaintenanceRequestDetail, PerformingStaff } from "./types";
import { OfficialFormHeader } from "@/components/official-form-header";
import { ElectronicSignatureField } from "@/components/electronic-signature-field";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-message";

type TechnicianOption = { id: number; username: string; fullName: string | null };
type HandoverSignature = { fieldName: string; userId: number };

export default function MaintenanceRequestDetailPage({ params }: { params: { id: string } }) {
  const requestId = Number(params.id);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [assignedTechnicianUserId, setAssignedTechnicianUserId] = useState("");
  const [departmentSection, setDepartmentSection] = useState("");
  const [priority, setPriority] = useState("normal");
  const [requestDate, setRequestDate] = useState("");
  const [failureDescription, setFailureDescription] = useState("");
  const [reportingPersonName, setReportingPersonName] = useState("");
  const [departmentSupervisorName, setDepartmentSupervisorName] = useState("");
  const [workFrom, setWorkFrom] = useState("");
  const [workTo, setWorkTo] = useState("");
  const [preliminary, setPreliminary] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [remarks, setRemarks] = useState("");
  const [staff, setStaff] = useState<PerformingStaff[]>([{ no: "1", name: "", signature: "" }]);
  const [receiverName, setReceiverName] = useState("");
  const [handoverDate, setHandoverDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [engineeringDate, setEngineeringDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [externalDialogOpen, setExternalDialogOpen] = useState(false);
  const [manualRequestReportNumber, setManualRequestReportNumber] = useState("");
  const [approvedRequestReportNumber, setApprovedRequestReportNumber] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance-request", requestId],
    queryFn: () => apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}`),
  });
  const { data: technicians = [] } = useQuery({
    queryKey: ["maintenance-request-technicians"],
    queryFn: () => apiRequest<TechnicianOption[]>("/maintenance-requests/technicians"),
    enabled: hasPermission("review_engineering_requests"),
  });
  const { data: numberingPreview } = useQuery({
    queryKey: ["maintenance-request-numbering-next", data?.request.requestDate],
    queryFn: () => apiRequest<{ nextNumber: string | null }>(`/maintenance-requests/numbering-next?requestDate=${encodeURIComponent(data!.request.requestDate)}`),
    enabled: hasPermission("review_engineering_requests") && data?.request.status === "QA Approved",
  });
  const { data: handoverSignatures = [] } = useQuery({
    queryKey: ["signatures", "MAINTENANCE_REQUEST", requestId],
    queryFn: () => apiRequest<HandoverSignature[]>(`/signatures?documentType=MAINTENANCE_REQUEST&documentId=${requestId}`),
  });

  useEffect(() => {
    if (!data) return;
    const event = data.correctiveEvent;
    setAssignedTechnicianUserId(data.assignedTechnicianUserId ? String(data.assignedTechnicianUserId) : "");
    setDepartmentSection(data.request.departmentSection ?? "");
    setPriority(data.request.priority);
    setRequestDate(data.request.requestDate);
    setFailureDescription(data.request.failureDescription);
    setReportingPersonName(data.reportingPersonName ?? "");
    setDepartmentSupervisorName(data.departmentSupervisorName ?? "");
    setWorkFrom(event?.expectedWorkTimeFrom ?? data.expectedWorkTimeFrom ?? "");
    setWorkTo(event?.expectedWorkTimeTo ?? data.expectedWorkTimeTo ?? "");
    setPreliminary(event?.preliminaryCheckResults ?? "");
    setTechnicianName(event?.technicianName ?? "");
    setActionsTaken(event?.actionsTaken ?? "");
    setRemarks(event?.remarksRecommendations ?? "");
    setStaff(event?.performingStaff.length ? event.performingStaff : [{ no: "1", name: "", signature: "" }]);
    setReceiverName(event?.receiverName ?? "");
    setHandoverDate(event?.handoverDate ?? new Date().toISOString().slice(0, 10));
    setEngineeringDate(event?.engineeringDate ?? new Date().toISOString().slice(0, 10));
    setApprovedRequestReportNumber(data.request.requestReportNumber ?? "");
  }, [data]);

  useEffect(() => {
    if (numberingPreview?.nextNumber) setManualRequestReportNumber(numberingPreview.nextNumber);
  }, [numberingPreview]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["maintenance-request", requestId] });
    queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] });
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["machine-cm-record"] });
    queryClient.invalidateQueries({ queryKey: ["closed-corrective-maintenance-log"] });
  }

  const qaReview = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/qa-review`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: () => { refresh(); toast({ title: "تمت مراجعة QA" }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذرت مراجعة QA", description: getErrorMessage(error, "تعذرت مراجعة الطلب.") }),
  });

  const supervisorReview = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/supervisor-review`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: () => { refresh(); toast({ title: "تم اعتماد مشرف القسم وإرسال الطلب إلى QA" }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر اعتماد مشرف القسم", description: getErrorMessage(error, "تعذرت مراجعة الطلب.") }),
  });

  const engineeringReview = useMutation({
    mutationFn: (decision: "accept" | "reject") =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/engineering-review`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          assignedTechnicianUserId: assignedTechnicianUserId ? Number(assignedTechnicianUserId) : null,
          requestReportNumber: decision === "accept" ? manualRequestReportNumber.trim() || undefined : undefined,
        }),
      }),
    onSuccess: () => { refresh(); toast({ title: "تمت مراجعة الهندسة" }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذرت مراجعة الهندسة", description: getErrorMessage(error, "تعذرت مراجعة الطلب.") }),
  });

  const updateApprovedNumber = useMutation({
    mutationFn: () => apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/request-number`, {
      method: "PATCH",
      body: JSON.stringify({ requestReportNumber: approvedRequestReportNumber }),
    }),
    onSuccess: () => { refresh(); toast({ title: "تم تعديل رقم طلب الصيانة المعتمد" }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر تعديل الرقم", description: getErrorMessage(error, "تحقق من الرقم وأنه غير مستخدم.") }),
  });

  const startWork = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/start-work`, {
        method: "PATCH",
      }),
    onSuccess: () => { refresh(); toast({ title: "بدأ العمل" }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر بدء العمل", description: getErrorMessage(error, "تعذر بدء أعمال الصيانة.") }),
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
        }),
      }),
    onSuccess: () => { refresh(); toast({ title: "تم الحفظ", description: "تم حفظ نتائج الكشف الأولي." }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر الحفظ", description: getErrorMessage(error, "تعذر حفظ نتائج الكشف الأولي.") }),
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
    onSuccess: () => { refresh(); toast({ title: "تم الحفظ", description: "تم حفظ الإجراءات المتخذة." }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر الحفظ", description: getErrorMessage(error, "تعذر حفظ الإجراءات المتخذة.") }),
  });

  const saveHandover = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/handover`, {
        method: "PATCH",
        body: JSON.stringify({
          receiverName,
          handoverDate,
        }),
      }),
    onSuccess: () => { refresh(); toast({ title: "تم التسليم", description: "تم حفظ التسليم وإغلاق الطلب." }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر التسليم", description: getErrorMessage(error, "تعذر حفظ التسليم.") }),
  });
  const saveReceiverHandover = useMutation({
    mutationFn: () => apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/receiver-handover`, {
      method: "PATCH",
      body: JSON.stringify({ receiverName, handoverDate }),
    }),
    onSuccess: () => { refresh(); toast({ title: "تم الحفظ", description: "تم حفظ اسم وتاريخ مستلم الماكينة." }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر الحفظ", description: getErrorMessage(error, "تعذر حفظ بيانات المستلم.") }),
  });
  const saveEngineeringHandover = useMutation({
    mutationFn: () => apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/engineering-handover`, {
      method: "PATCH",
      body: JSON.stringify({ engineeringDate }),
    }),
    onSuccess: () => { refresh(); toast({ title: "تم الحفظ", description: "تم حفظ تاريخ اعتماد الهندسة." }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر الحفظ", description: getErrorMessage(error, "تعذر حفظ تاريخ الهندسة.") }),
  });

  const saveRequestDetails = useMutation({
    mutationFn: () =>
      apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/request-details`, {
        method: "PATCH",
        body: JSON.stringify({ departmentSection, priority, requestDate, failureDescription, reportingPersonName, departmentSupervisorName }),
      }),
    onSuccess: () => { refresh(); toast({ title: "تم الحفظ", description: "تم تحديث تفاصيل طلب الصيانة." }); },
    onError: (error) => toast({ variant: "destructive", title: "تعذر الحفظ", description: getErrorMessage(error, "تعذر تحديث تفاصيل الطلب.") }),
  });

  const convertToExternalMaintenance = useMutation({
    mutationFn: () => apiRequest<ExternalMaintenanceRequestDetail>(`/maintenance-requests/${requestId}/external-maintenance`, {
      method: "POST",
    }),
    onSuccess: () => {
      refresh();
      setExternalDialogOpen(false);
      setLocation(`/maintenance-requests/${requestId}/external-maintenance`);
    },
  });
  const setArchived = useMutation({
    mutationFn: (archive: boolean) => apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}/${archive ? "archive" : "restore"}`, { method: "PATCH" }),
    onSuccess: (_result, archive) => {
      refresh();
      toast({ title: archive ? "تمت أرشفة الطلب" : "تمت إعادة الطلب من الأرشيف" });
      setLocation(archive ? "/maintenance-requests/archive" : "/maintenance-requests");
    },
    onError: (error) => toast({ variant: "destructive", title: "تعذر تحديث الأرشيف", description: getErrorMessage(error, "تعذر تحديث حالة الأرشفة.") }),
  });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading request...</div>;

  const request = data.request;
  const canManageCorrectiveWork = hasPermission("fill_corrective_maintenance") || hasPermission("manage_maintenance_requests");
  const canFillPreliminary = canManageCorrectiveWork || hasPermission("fill_preliminary_findings");
  const canSupervisorReview = hasPermission("review_department_requests") && request.status === "Submitted";
  const canQaReview = hasPermission("review_qa_requests") && request.status === "Pending QA Approval";
  const canEngineeringReview = hasPermission("review_engineering_requests") && request.status === "QA Approved";
  const canEditApprovedNumber = hasPermission("edit_approved_maintenance_request_number") && Boolean(request.requestReportNumber);
  const canStartWork = canManageCorrectiveWork && request.status === "Accepted";
  // Approval is required only to receive the request initially. Once engineering
  // accepted it (or a corrective event was already created), later status changes
  // must not lock previously entered maintenance data.
  const correctiveRequestReceived = data.engineeringDecision === "Accepted" || Boolean(data.correctiveEvent);
  const canPreliminaryWork = canFillPreliminary && correctiveRequestReceived;
  const canTechnicianWork = canManageCorrectiveWork && correctiveRequestReceived;
  const canHandover = canManageCorrectiveWork && (request.status === "In Progress" || request.status === "Completed");
  const receiverSignedByCurrentUser = handoverSignatures.some((signature) => signature.fieldName === "receiver" && signature.userId === user?.id);
  const engineeringSignedByCurrentUser = handoverSignatures.some((signature) => signature.fieldName === "engineering_final" && signature.userId === user?.id);
  const canViewExternal = hasPermission("view_external_maintenance");
  const canConvertToExternal = canViewExternal && hasPermission("edit_external_maintenance") && !["Closed", "Rejected", "QA Rejected", "External Maintenance"].includes(request.status);
  const canEditRequestDetails = data.requestedByUserId === user?.id && ["Submitted", "Pending Department Supervisor Approval", "Pending QA Approval", "QA Rejected"].includes(request.status);

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

  function submitRequestDetails(event: FormEvent) {
    event.preventDefault();
    saveRequestDetails.mutate();
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
        {hasPermission("archive_maintenance_requests") && (
          <Button type="button" variant="outline" onClick={() => setArchived.mutate(!request.archivedAt)} disabled={setArchived.isPending}>
            {request.archivedAt ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}
            {request.archivedAt ? "إعادة من الأرشيف" : "أرشفة الطلب"}
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href={`/print/maintenance-request/${requestId}`}>Official Print</Link>
        </Button>
        {request.status === "External Maintenance" && canViewExternal ? (
          <Button asChild variant="outline"><Link href={`/maintenance-requests/${requestId}/external-maintenance`}>External Maintenance Request</Link></Button>
        ) : canConvertToExternal ? (
          <Button variant="outline" onClick={() => setExternalDialogOpen(true)}>Convert to External Maintenance</Button>
        ) : null}
      </div>

      <Dialog open={externalDialogOpen} onOpenChange={setExternalDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تحويل إلى صيانة خارجية</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">سيُستخدم رقم طلب الصيانة نفسه: <span dir="ltr">{request.requestReportNumber}</span></p>
          <Button type="button" onClick={() => convertToExternalMaintenance.mutate()} disabled={convertToExternalMaintenance.isPending}><Save className="ml-2 h-4 w-4" />حفظ وتحويل الطلب</Button>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border bg-white p-6 text-black shadow-sm print:border-none print:p-0 print:shadow-none">
        <OfficialFormHeader
          documentName="Maintenance Request / Corrective Maintenance Report"
          documentNumber="FORM-10-0975 / LOG-00-0102-3"
          effectiveOrExecutionDate={request.requestDate}
          machineName={request.machineName}
          machineNumber={request.machineNumber}
        />
      </div>

      <form onSubmit={submitRequestDetails}>
      <Card>
        <CardHeader>
          <CardTitle>Section 1 - Request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Request / Report Number</Label>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="justify-start font-mono">
                <Link href={`/maintenance-requests/${requestId}`}>{request.requestReportNumber}</Link>
              </Button>
              {data.correctiveEvent && (
                <Button asChild variant="outline">
                  <Link href={`/machines/${request.machineId}/corrective-maintenance/history/${data.correctiveEvent.recordId}`}><Wrench className="mr-2 h-4 w-4" />سجل الصيانة العلاجية</Link>
                </Button>
              )}
            </div>
          </div>
          <div><Label>Department / Section</Label><Input value={departmentSection} readOnly={!canEditRequestDetails} onChange={(event) => setDepartmentSection(event.target.value)} /></div>
          <div><Label>Priority</Label><Input value={priority} readOnly={!canEditRequestDetails} onChange={(event) => setPriority(event.target.value)} /></div>
          <div><Label>Machine name / machine number</Label><Input value={`${request.machineName} / ${request.machineNumber}`} readOnly /></div>
          <div><Label>Date</Label><Input type="date" value={requestDate} readOnly={!canEditRequestDetails} onChange={(event) => setRequestDate(event.target.value)} /></div>
          <div className="md:col-span-2"><Label>Failure description</Label><Textarea value={failureDescription} readOnly={!canEditRequestDetails} onChange={(event) => setFailureDescription(event.target.value)} /></div>
          <div><Label>Person reporting failure</Label><Input value={reportingPersonName} readOnly={!canEditRequestDetails} onChange={(event) => setReportingPersonName(event.target.value)} /></div>
          <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="reporting_person" label="Person Reporting Failure Electronic Signature" />
          <div><Label>Department supervisor</Label><Input value={departmentSupervisorName} readOnly={!canEditRequestDetails} onChange={(event) => setDepartmentSupervisorName(event.target.value)} /></div>
          {data.qaDecision === "Approved" && <div className="rounded-md border border-green-700/30 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">تم قبول الطلب من قبل QA</div>}
          {data.qaReviewerName && <div><Label>اعتماد QA بواسطة</Label><Input value={data.qaReviewerName} readOnly /></div>}
          {data.engineeringReviewerName && <div><Label>اعتماد الهندسة بواسطة</Label><Input value={data.engineeringReviewerName} readOnly /></div>}
          {canEditRequestDetails && <Button type="submit" className="w-fit" disabled={saveRequestDetails.isPending}><Save className="mr-2 h-4 w-4" />Save Request Details</Button>}
        </CardContent>
      </Card>
      </form>

      {canSupervisorReview && (
        <Card>
          <CardHeader><CardTitle>اعتماد مشرف القسم المعني</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <p className="md:col-span-2 text-sm text-muted-foreground">عند الاعتماد يُسجّل توقيع حسابك تلقائياً ويُرسل الطلب إلى QA.</p>
            <div className="flex gap-2"><Button type="button" onClick={() => supervisorReview.mutate("approve")}>اعتماد وإرسال إلى QA</Button><Button type="button" variant="destructive" onClick={() => supervisorReview.mutate("reject")}>رفض</Button></div>
          </CardContent>
        </Card>
      )}

      {canQaReview && (
        <Card>
          <CardHeader><CardTitle>QA Supervisor Review</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <p className="md:col-span-2 text-sm text-muted-foreground">عند قبول QA يُسجّل توقيع حسابك تلقائياً ويُرسل الطلب إلى الهندسة.</p>
            <div className="flex gap-2">
              <Button type="button" onClick={() => qaReview.mutate("approve")}><Check className="mr-2 h-4 w-4" />Approve</Button>
              <Button type="button" variant="destructive" onClick={() => qaReview.mutate("reject")}><X className="mr-2 h-4 w-4" />Reject</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canEngineeringReview && (
        <Card>
          <CardHeader><CardTitle>مراجعة قسم الهندسة والصيانة</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>فني الصيانة المكلّف</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={assignedTechnicianUserId} onChange={(event) => setAssignedTechnicianUserId(event.target.value)}><option value="">غير محدد</option>{technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName || technician.username}</option>)}</select></div>
            <div><Label>رقم طلب الصيانة المقترح تلقائياً</Label><Input dir="ltr" value={manualRequestReportNumber} onChange={(event) => setManualRequestReportNumber(event.target.value)} placeholder="مثال: 401/08/2026" /></div>
            <p className="md:col-span-2 text-sm text-muted-foreground">يظهر الرقم التالي في التسلسل تلقائياً، ويمكن تعديله قبل الاعتماد. بعد الاعتماد يحتاج تعديله إلى صلاحية خاصة.</p>
            <div className="flex gap-2"><Button type="button" onClick={() => engineeringReview.mutate("accept")}>قبول وإرسال للصيانة</Button><Button type="button" variant="destructive" onClick={() => engineeringReview.mutate("reject")}>رفض</Button></div>
          </CardContent>
        </Card>
      )}

      {canEditApprovedNumber && (
        <Card>
          <CardHeader><CardTitle>تعديل رقم طلب الصيانة المعتمد</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-2"><Label>الرقم المعتمد</Label><Input dir="ltr" className="w-56" value={approvedRequestReportNumber} onChange={(event) => setApprovedRequestReportNumber(event.target.value)} /></div>
            <Button type="button" onClick={() => updateApprovedNumber.mutate()} disabled={!approvedRequestReportNumber.trim() || updateApprovedNumber.isPending}><Save className="mr-2 h-4 w-4" />حفظ الرقم</Button>
            <p className="text-sm text-muted-foreground">يُحدّث الرقم أيضاً في سجل الصيانة العلاجية المرتبط.</p>
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
          <CardHeader><CardTitle>Section 2 - Preliminary Findings</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {!canPreliminaryWork && <p className="md:col-span-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{canFillPreliminary ? "بانتظار اعتماد مشرف القسم وQA وقبول الهندسة قبل فتح نتائج الفحص الأولي للفني." : "لا تملك صلاحية تعبئة نتائج الفحص الأولي. يضيفها المسؤول من صلاحيات طلبات الصيانة."}</p>}
            <div className="md:col-span-2"><Label>Preliminary check results</Label><Textarea value={preliminary} readOnly={!canPreliminaryWork} onChange={(event) => setPreliminary(event.target.value)} /></div>
            <div><Label>Expected work time From</Label><Input value={workFrom} readOnly={!canPreliminaryWork} onChange={(event) => setWorkFrom(event.target.value)} /></div>
            <div><Label>Expected work time To</Label><Input value={workTo} readOnly={!canPreliminaryWork} onChange={(event) => setWorkTo(event.target.value)} /></div>
            <div><Label>Maintenance technician name</Label><Input value={technicianName} readOnly={!canPreliminaryWork} onChange={(event) => setTechnicianName(event.target.value)} /></div>
            <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="maintenance_technician" label="التوقيع الإلكتروني لفني الصيانة" />
            {data.correctiveEvent?.preliminaryCheckResults && <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="concerned_section_supervisor" label="التوقيع الإلكتروني لمشرف القسم المعني" />}
            {canPreliminaryWork && <Button type="submit" className="w-fit"><Save className="mr-2 h-4 w-4" />Save Preliminary Findings</Button>}
          </CardContent>
        </Card>
      </form>

      <form onSubmit={submitActions}>
        <Card>
          <CardHeader><CardTitle>Section 3 - Actions Taken</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {!canTechnicianWork && <p className="md:col-span-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{canManageCorrectiveWork ? "بانتظار اعتماد مشرف القسم وQA وقبول الهندسة قبل فتح الإجراءات المتخذة للفني." : "لا تملك صلاحية تعبئة الإجراءات المتخذة. يضيفها المسؤول من صلاحيات طلبات الصيانة."}</p>}
            <div className="md:col-span-2"><Label>Actions taken</Label><Textarea value={actionsTaken} readOnly={!canTechnicianWork} onChange={(event) => setActionsTaken(event.target.value)} /></div>
            <div className="md:col-span-2"><Label>Remarks and recommendations</Label><Textarea value={remarks} readOnly={!canTechnicianWork} onChange={(event) => setRemarks(event.target.value)} /></div>
            <div className="md:col-span-2 space-y-2">
              <Label>Performing staff - No. / Name / Electronic signature</Label>
              {staff.map((item, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-[80px_1fr]">
                  <Input value={item.no ?? ""} readOnly={!canTechnicianWork} onChange={(event) => setStaff((current) => current.map((row, i) => i === index ? { ...row, no: event.target.value } : row))} />
                  <Input value={item.name ?? ""} readOnly={!canTechnicianWork} onChange={(event) => setStaff((current) => current.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} />
                  <div className="md:col-span-2"><ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName={`performing_staff_${index + 1}`} permissionFieldName="performing_staff" label={`التوقيع الإلكتروني للقائم بالعمل ${index + 1}`} /></div>
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
            <div><Label>Receiver name</Label><Input value={receiverName} readOnly={!receiverSignedByCurrentUser} onChange={(event) => setReceiverName(event.target.value)} /></div>
            <div><Label>Receiver date</Label><Input type="date" value={handoverDate} readOnly={!receiverSignedByCurrentUser} onChange={(event) => setHandoverDate(event.target.value)} /></div>
            <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="receiver" label="التوقيع الإلكتروني لمستلم الماكنة" />
            <ElectronicSignatureField documentType="MAINTENANCE_REQUEST" documentId={requestId} fieldName="engineering_final" label="التوقيع الإلكتروني للهندسة" />
            {receiverSignedByCurrentUser && <Button type="button" variant="outline" onClick={() => saveReceiverHandover.mutate()} disabled={saveReceiverHandover.isPending}>Save Receiver Details</Button>}
            <div><Label>Engineering date</Label><Input type="date" value={engineeringDate} readOnly={!engineeringSignedByCurrentUser} onChange={(event) => setEngineeringDate(event.target.value)} /></div>
            {engineeringSignedByCurrentUser && <Button type="button" variant="outline" onClick={() => saveEngineeringHandover.mutate()} disabled={saveEngineeringHandover.isPending}>Save Engineering Date</Button>}
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
