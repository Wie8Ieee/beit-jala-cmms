import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Save } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExternalMaintenanceReceiptDetail } from "./types";

export default function ExternalMaintenanceReceiptPage({ params }: { params: { id: string } }) {
  const requestId = Number(params.id);
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["external-maintenance-receipt", requestId], queryFn: () => apiRequest<ExternalMaintenanceReceiptDetail>(`/maintenance-requests/${requestId}/external-maintenance-receipt`) });
  const [type, setType] = useState("صيانة خارجية");
  const [date, setDate] = useState("");
  const [entity, setEntity] = useState("");
  const [report, setReport] = useState("");
  const [failureCause, setFailureCause] = useState("");
  const [examinerName, setExaminerName] = useState("");
  const [examinerSignature, setExaminerSignature] = useState("");

  useEffect(() => {
    if (!data) return;
    const receipt = data.receipt;
    setType(receipt.maintenanceType || "صيانة خارجية"); setDate(receipt.receiptDate ?? ""); setEntity(receipt.performingEntity ?? "");
    setReport(receipt.workAcceptanceReport ?? ""); setFailureCause(receipt.workFailureCause ?? ""); setExaminerName(receipt.examinerName ?? ""); setExaminerSignature(receipt.examinerSignature ?? "");
  }, [data]);
  const save = useMutation({
    mutationFn: () => apiRequest<ExternalMaintenanceReceiptDetail>(`/maintenance-requests/${requestId}/external-maintenance-receipt`, { method: "PATCH", body: JSON.stringify({ maintenanceType: type, receiptDate: date, performingEntity: entity, workAcceptanceReport: report, workFailureCause: failureCause, examinerName, examinerSignature }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["external-maintenance-receipt", requestId] }),
  });
  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading external maintenance receipt…</div>;
  const canEdit = hasPermission("manage_maintenance_requests");
  function submit(event: FormEvent) { event.preventDefault(); save.mutate(); }

  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
    <div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href={`/maintenance-requests/${requestId}/external-maintenance`}><ArrowLeft className="h-4 w-4" /></Link></Button><div className="flex-1"><h1 className="text-3xl font-bold">نموذج استلام أعمال صيانة خارجية</h1><p className="text-muted-foreground">FORM-10-0240-1 — طلب الصيانة رقم {data.request.requestReportNumber}</p></div><Button variant="outline" asChild><Link href={`/print/external-maintenance-receipt/${requestId}`}><Printer className="ms-2 h-4 w-4" />طباعة</Link></Button></div>
    <form onSubmit={submit}><Card><CardHeader><CardTitle>استلام أعمال الشركة الخارجية</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <div><Label>طلب صيانة رقم</Label><Input dir="ltr" value={data.request.requestReportNumber} readOnly /></div><div><Label>نوع الصيانة</Label><Input value={type} readOnly={!canEdit} onChange={(event) => setType(event.target.value)} /></div>
      <div><Label>القسم الطالب للصيانة</Label><Input value={data.receipt.requestingDepartment ?? ""} readOnly /></div><div><Label>التاريخ</Label><Input type="date" value={date} readOnly={!canEdit} onChange={(event) => setDate(event.target.value)} /></div>
      <div className="md:col-span-2"><Label>الجهة المنفذة للعمل</Label><Input value={entity} readOnly={!canEdit} onChange={(event) => setEntity(event.target.value)} /></div>
      <div className="md:col-span-2"><Label>تقرير استلام أعمال الصيانة</Label><Textarea value={report} readOnly={!canEdit} onChange={(event) => setReport(event.target.value)} /></div>
      <div className="md:col-span-2"><Label>سبب الرفض في حالة وجود خطأ في العمل</Label><Textarea value={failureCause} readOnly={!canEdit} onChange={(event) => setFailureCause(event.target.value)} /></div>
      <div><Label>اسم الفاحص</Label><Input value={examinerName} readOnly={!canEdit} onChange={(event) => setExaminerName(event.target.value)} /></div><div><Label>توقيع الفاحص</Label><Input value={examinerSignature} readOnly={!canEdit} onChange={(event) => setExaminerSignature(event.target.value)} /></div>
      {canEdit && <Button type="submit" className="w-fit"><Save className="ms-2 h-4 w-4" />حفظ نموذج الاستلام</Button>}
    </CardContent></Card></form>
  </div>;
}
