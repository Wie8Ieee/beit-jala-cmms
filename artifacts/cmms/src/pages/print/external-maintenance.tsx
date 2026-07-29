import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Languages } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { PrintLayout, PrintPage } from "./print-layout";
import { Button } from "@/components/ui/button";
import type { ExternalMaintenanceRequestDetail } from "../maintenance-requests/types";

type ElectronicSignature = {
  fieldName: string;
  signatureData: string | null;
  userName: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}
function FillLine({ children, className = "" }: { children?: React.ReactNode; className?: string }) { return <span className={`official-print-external-fill ${className}`}>{children}</span>; }

function WritingLines({ value, count }: { value?: string | null; count: number }) {
  const entries = (value ?? "").split(/\r?\n/);
  return <div className="official-print-external-ruled">{
    Array.from({ length: count }, (_, index) => <div className="official-print-external-writing-line" key={index}>{entries[index] ?? ""}</div>)
  }</div>;
}

export default function ExternalMaintenancePrintPage({ params }: { params: { id: string } }) {
  const requestId = Number(params.id);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const { data } = useQuery({ queryKey: ["external-maintenance-request", requestId], queryFn: () => apiRequest<ExternalMaintenanceRequestDetail>(`/maintenance-requests/${requestId}/external-maintenance`) });
  const { data: signatures = [] } = useQuery({
    queryKey: ["signatures", "EXTERNAL_MAINTENANCE_REQUEST", requestId],
    queryFn: () => apiRequest<ElectronicSignature[]>(`/signatures?documentType=EXTERNAL_MAINTENANCE_REQUEST&documentId=${requestId}`),
    enabled: Number.isFinite(requestId) && requestId > 0,
  });
  if (!data) return null;
  const { request, externalRequest: form } = data;
  const signatureFor = (fieldName: string) => signatures.find((signature) => signature.fieldName === fieldName);
  const signatureImage = (fieldName: string, fallback: string | null) => {
    const signature = signatureFor(fieldName);
    return signature?.signatureData ? <img src={signature.signatureData} alt={`توقيع ${signature.userName}`} className="official-print-external-signature-image" /> : fallback;
  };
  const isEnglish = language === "en";
  const labels = isEnglish ? {
    title: "External Maintenance Request Form",
    documentNumber: "Doc. No:", effectiveDate: "Effective date:", page: "Page 1 of 1",
    order: "Maintenance order #:", department: "The area in which maintenance is needed:", required: "Activities required:",
    findings: "Primary report results:", suggestions: "Maintenance technician suggestions:",
    technician: "Maintenance Technician Signature:", manager: "Engineering Department Manager Signature:", general: "General Manager Signature:", date: "Date:",
  } : {
    title: "طلب صيانة خارجية",
    documentNumber: "رقم الوثيقة:", effectiveDate: "تاريخ التنفيذ:", page: "صفحة 1 من 1",
    order: "أمر صيانة رقم:", department: "القسم الطالب للصيانة:", required: "الصيانة/النشاطات المطلوبة:",
    findings: "نتائج الكشف الأولي:", suggestions: "مقترحات فني الصيانة:",
    technician: "توقيع فني الصيانة:", manager: "توقيع مدير دائرة الصيانة:", general: "توقيع المدير العام:", date: "التاريخ:",
  };
  return <PrintLayout
    title="External Maintenance Request — Official Print"
    toolbarActions={<Button variant="outline" onClick={() => setLanguage((current) => current === "ar" ? "en" : "ar")}><Languages className="mr-2 h-4 w-4" />{isEnglish ? "العربية" : "English"}</Button>}
  ><PrintPage><div dir={isEnglish ? "ltr" : "rtl"} className={`official-print-external-maintenance${isEnglish ? " official-print-external-english" : ""}`}><div className="official-print-external-sheet">
    <table dir="ltr" className="official-print-table official-print-external-header"><tbody><tr>{isEnglish ? <>
      <td dir="ltr" className="w-[34%] text-center font-bold">Beit Jala Pharmaceutical Co.<br />Beit Jala<br />Palestine</td>
      <td dir="ltr" className="w-[38%] text-center font-bold">{labels.title}</td>
      <td dir="ltr" className="w-[28%] text-center font-bold"><div>{labels.documentNumber} <bdi dir="ltr">FORM-00-0077-1</bdi></div><div>{labels.effectiveDate} <bdi dir="ltr">18/03/2023</bdi></div><div>{labels.page}</div></td>
    </> : <>
      <td dir="rtl" className="w-[34%] text-center font-bold"><div>{labels.documentNumber} <bdi dir="ltr">FORM-00-0077-1</bdi></div><div>{labels.effectiveDate} <bdi dir="ltr">18/03/2023</bdi></div><div>{labels.page}</div></td>
      <td dir="rtl" className="w-[38%] text-center font-bold">{labels.title}</td>
      <td dir="rtl" className="w-[28%] text-center font-bold">شركة بيت جالا لصناعة الأدوية<br />بيت جالا<br />فلسطين</td>
    </>}</tr></tbody></table>
    <div className="official-print-external-content">
      <div className="official-print-external-field official-print-external-order"><span className="official-print-external-static-label">{labels.order}</span><FillLine><bdi dir="ltr">{request.requestReportNumber}</bdi></FillLine></div>
      <div className="official-print-external-field official-print-external-department"><span className="official-print-external-static-label">{labels.department}</span><FillLine>{form.departmentSection}</FillLine></div>
      <div className="official-print-external-field"><span className="official-print-external-static-label">{labels.required}</span><FillLine className="official-print-external-wide">{form.requiredMaintenance}</FillLine></div>
      <section className="official-print-external-notes"><div className="official-print-external-static-label">{labels.findings}</div><WritingLines value={form.preliminaryFindings} count={4} /></section>
      <section className="official-print-external-notes official-print-external-suggestions-section"><div className="official-print-external-static-label">{labels.suggestions}</div><WritingLines value={form.technicianSuggestions} count={5} /></section>
      <div className="official-print-external-signatures">
        <div><span className="official-print-external-signature-label">{labels.technician}</span><FillLine>{signatureImage("maintenance_technician", form.maintenanceTechnicianSignature)}</FillLine><span className="official-print-external-date-label">{labels.date}</span><FillLine>{formatDate(form.maintenanceTechnicianDate)}</FillLine></div>
        <div><span className="official-print-external-signature-label">{labels.manager}</span><FillLine>{signatureImage("department_manager", form.departmentManagerSignature)}</FillLine><span className="official-print-external-date-label">{labels.date}</span><FillLine>{formatDate(form.departmentManagerDate)}</FillLine></div>
        <div><span className="official-print-external-signature-label">{labels.general}</span><FillLine>{signatureImage("general_manager", form.generalManagerSignature)}</FillLine><span className="official-print-external-date-label">{labels.date}</span><FillLine>{formatDate(form.generalManagerDate)}</FillLine></div>
      </div>
    </div>
  </div></div></PrintPage></PrintLayout>;
}
