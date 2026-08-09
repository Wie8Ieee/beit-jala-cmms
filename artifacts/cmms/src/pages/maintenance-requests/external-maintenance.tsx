import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Save, Undo2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ElectronicSignatureField } from "@/components/electronic-signature-field";
import type { ExternalMaintenanceRequestDetail } from "./types";

export default function ExternalMaintenanceRequestPage({ params }: { params: { id: string } }) {
  const requestId = Number(params.id);
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["external-maintenance-request", requestId],
    queryFn: () => apiRequest<ExternalMaintenanceRequestDetail>(`/maintenance-requests/${requestId}/external-maintenance`),
  });
  const [preliminaryFindings, setPreliminaryFindings] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [technicianSignature, setTechnicianSignature] = useState("");
  const [technicianDate, setTechnicianDate] = useState("");
  const [departmentSignature, setDepartmentSignature] = useState("");
  const [departmentDate, setDepartmentDate] = useState("");
  const [generalSignature, setGeneralSignature] = useState("");
  const [generalDate, setGeneralDate] = useState("");

  useEffect(() => {
    if (!data) return;
    const form = data.externalRequest;
    setPreliminaryFindings(form.preliminaryFindings ?? "");
    setSuggestions(form.technicianSuggestions ?? "");
    setTechnicianSignature(form.maintenanceTechnicianSignature ?? "");
    setTechnicianDate(form.maintenanceTechnicianDate ?? "");
    setDepartmentSignature(form.departmentManagerSignature ?? "");
    setDepartmentDate(form.departmentManagerDate ?? "");
    setGeneralSignature(form.generalManagerSignature ?? "");
    setGeneralDate(form.generalManagerDate ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiRequest<ExternalMaintenanceRequestDetail>(`/maintenance-requests/${requestId}/external-maintenance`, {
      method: "PATCH",
      body: JSON.stringify({
        preliminaryFindings,
        technicianSuggestions: suggestions,
        maintenanceTechnicianSignature: technicianSignature,
        maintenanceTechnicianDate: technicianDate,
        departmentManagerSignature: departmentSignature,
        departmentManagerDate: departmentDate,
        generalManagerSignature: generalSignature,
        generalManagerDate: generalDate,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-maintenance-request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-request", requestId] });
    },
  });
  const createReceipt = useMutation({
    mutationFn: () => apiRequest(`/maintenance-requests/${requestId}/external-maintenance-receipt`, { method: "POST" }),
    onSuccess: () => setLocation(`/maintenance-requests/${requestId}/external-maintenance-receipt`),
  });
  const cancelExternal = useMutation({
    mutationFn: () => apiRequest(`/maintenance-requests/${requestId}/external-maintenance`, { method: "DELETE" }),
    onSuccess: () => setLocation(`/maintenance-requests/${requestId}`),
  });

  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading external maintenance request…</div>;
  const { request, externalRequest } = data;
  const canEdit = hasPermission("edit_external_maintenance");

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link href={`/maintenance-requests/${requestId}`}><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1"><h1 className="text-3xl font-bold">طلب صيانة خارجية</h1><p className="text-muted-foreground">FORM-00-0077-1 — رقم طلب الصيانة: {request.requestReportNumber}</p></div>
        <Button variant="outline" asChild><Link href={`/print/external-maintenance/${requestId}`}><Printer className="ms-2 h-4 w-4" />طباعة</Link></Button>
        {canEdit && <Button variant="destructive" onClick={() => cancelExternal.mutate()} disabled={cancelExternal.isPending}><Undo2 className="ms-2 h-4 w-4" />إلغاء التحويل الخارجي</Button>}
        {canEdit && <Button onClick={() => createReceipt.mutate()} disabled={createReceipt.isPending}>استلام أعمال الصيانة الخارجية</Button>}
      </div>

      <Card>
        <CardHeader><CardTitle>بيانات التحويل التلقائية</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>رقم طلب الصيانة الخارجية</Label><Input dir="ltr" value={externalRequest.externalRequestNumber} readOnly /></div>
          <div><Label>القسم الطالب للصيانة</Label><Input value={externalRequest.departmentSection ?? ""} readOnly /></div>
          <div><Label>اسم ورقم الجهاز</Label><Input dir="ltr" value={`${request.machineName} / ${request.machineNumber}`} readOnly /></div>
          <div className="md:col-span-2"><Label>الصيانة / النشاطات المطلوبة</Label><Textarea value={externalRequest.requiredMaintenance ?? ""} readOnly /></div>
          <div className="md:col-span-2"><Label>نتائج الكشف الأولي</Label><Textarea value={preliminaryFindings} readOnly={!canEdit} onChange={(event) => setPreliminaryFindings(event.target.value)} /></div>
        </CardContent>
      </Card>

      <form onSubmit={submit}>
        <Card>
          <CardHeader><CardTitle>اعتمادات طلب الصيانة الخارجية</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>مقترحات فني الصيانة</Label><Textarea value={suggestions} readOnly={!canEdit} onChange={(event) => setSuggestions(event.target.value)} /></div>
            <div><Label>التاريخ</Label><Input type="date" value={technicianDate} readOnly={!canEdit} onChange={(event) => setTechnicianDate(event.target.value)} /></div>
            <div className="md:col-span-2"><ElectronicSignatureField documentType="EXTERNAL_MAINTENANCE_REQUEST" documentId={requestId} fieldName="maintenance_technician" label="التوقيع الإلكتروني لفني الصيانة" /></div>
            <div><Label>التاريخ</Label><Input type="date" value={departmentDate} readOnly={!canEdit} onChange={(event) => setDepartmentDate(event.target.value)} /></div>
            <div className="md:col-span-2"><ElectronicSignatureField documentType="EXTERNAL_MAINTENANCE_REQUEST" documentId={requestId} fieldName="department_manager" label="التوقيع الإلكتروني لمدير دائرة الصيانة" /></div>
            <div><Label>التاريخ</Label><Input type="date" value={generalDate} readOnly={!canEdit} onChange={(event) => setGeneralDate(event.target.value)} /></div>
            <div className="md:col-span-2"><ElectronicSignatureField documentType="EXTERNAL_MAINTENANCE_REQUEST" documentId={requestId} fieldName="general_manager" label="التوقيع الإلكتروني للمدير العام" /></div>
            {canEdit && <Button type="submit" className="w-fit"><Save className="ms-2 h-4 w-4" />حفظ الطلب الخارجي</Button>}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
