import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { MaintenanceRequestDetail } from "../maintenance-requests/types";
import { DottedLine, PrintLayout, PrintPage } from "./print-layout";

type DrawnSignature = { fieldName: string; signatureData: string | null; userName: string };

function formatDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function SignatureLine({ label, signature, fallback }: { label: string; signature?: DrawnSignature; fallback?: string | null }) {
  return <span className="official-print-mr-signature-line">{label}: {signature?.signatureData ? <img src={signature.signatureData} className="official-print-form-signature" alt={label} /> : <DottedLine text={fallback} />}</span>;
}

function RuledWritingArea({ text, lines, className = "", solid = false }: { text?: string | null; lines: number; className?: string; solid?: boolean }) {
  return (
    <div className={`official-print-mr-ruled-area ${solid ? "official-print-mr-solid-lines" : ""} ${className}`}>
      <div className="official-print-mr-ruled-value">{text}</div>
      {Array.from({ length: lines }).map((_, index) => <div key={index} className="official-print-mr-writing-line" />)}
    </div>
  );
}

export default function MaintenanceRequestPrintPage({ params }: { params: { id: string } }) {
  const requestId = Number(params.id);
  const { data } = useQuery({ queryKey: ["print-maintenance-request", requestId], queryFn: () => apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}`) });
  const { data: requestSignatures = [] } = useQuery({ queryKey: ["print-maintenance-request-signatures", requestId], queryFn: () => apiRequest<DrawnSignature[]>(`/signatures?documentType=MAINTENANCE_REQUEST&documentId=${requestId}`) });
  const { data: correctiveSignatures = [] } = useQuery({ queryKey: ["print-corrective-request-signatures", requestId], queryFn: () => apiRequest<DrawnSignature[]>(`/signatures?documentType=CORRECTIVE_MAINTENANCE&documentId=${requestId}`) });

  const request = data?.request;
  const event = data?.correctiveEvent;
  const priority = request?.priority?.toLowerCase();
  const signature = (field: string, type: "request" | "corrective" = "request") => (type === "request" ? requestSignatures : correctiveSignatures).find((item) => item.fieldName === field);
  const staff = Array.from({ length: 4 }, (_, index) => event?.performingStaff[index]);

  return <PrintLayout title="Maintenance Request - Official Print"><PrintPage><div dir="rtl" className="official-print-maintenance-request"><div className="official-print-maintenance-request-content">
    <table dir="ltr" className="official-print-table official-print-maintenance-request-header"><tbody><tr>
      <td dir="rtl" className="w-[34%] text-center font-bold">رقم الطريقة: <bdi dir="ltr">FORM-10-0975-1</bdi><hr />تاريخ التنفيذ: <bdi dir="ltr">18/3/2023</bdi><hr />صفحة 1 من 1</td>
      <td dir="rtl" className="w-[40%] text-center font-bold">طلب / تقرير صيانة علاجية<br /><span dir="ltr">(Maintenance Request &amp; Corrective<br />Maintenance Report)</span></td>
      <td dir="rtl" className="w-[26%] text-center font-bold">شركة بيت جالا لصناعة الأدوية<br />بيت جالا<br />فلسطين</td>
    </tr></tbody></table>

    <div className="official-print-maintenance-request-number">طلب / تقرير صيانة رقم: <DottedLine text={request?.requestReportNumber} /></div>
    <section className="official-print-mr-box">
      <div className="official-print-mr-fields-row official-print-mr-first-row"><span>الدائرة / القسم: <DottedLine text={request?.departmentSection} /></span><span className="official-print-priority"><span className="official-print-priority-box">{priority === "urgent" ? "☑" : "☐"}</span> مستعجل &nbsp;&nbsp; <span className="official-print-priority-box">{priority === "normal" ? "☑" : "☐"}</span> عادي</span></div>
      <div className="official-print-mr-fields-row official-print-mr-machine-row"><span>اسم الماكينة (المنطقة) / رقمها: <DottedLine text={request ? `${request.machineName} / ${request.machineNumber}` : ""} /></span><span>التاريخ: <DottedLine text={formatDate(request?.requestDate)} /></span></div>
      <div className="official-print-mr-text-area"><strong>وصف العطل:</strong><RuledWritingArea text={request?.failureDescription} lines={2} solid className="official-print-mr-failure-lines" /></div>
      <div className="official-print-mr-signature-row"><SignatureLine label="توقيع الشخص المبلغ" signature={signature("reporting_person")} fallback={data?.reportingPersonSignature} /><SignatureLine label="توقيع مشرف القسم" signature={signature("department_supervisor")} fallback={data?.departmentSupervisorSignature} /><SignatureLine label="توقيع مشرف QA" signature={signature("qa_supervisor_approval")} fallback={data?.qaSupervisorSignature} /></div>
    </section>

    <section className="official-print-mr-section"><h3>نتائج الكشف الأولي (خاص بالصيانة)</h3><RuledWritingArea text={event?.preliminaryCheckResults} lines={3} className="official-print-mr-findings" /><div className="official-print-mr-worktime"><span>وقت بدء العمل المتوقع: من <DottedLine text={event?.expectedWorkTimeFrom || data?.expectedWorkTimeFrom} /> إلى: <DottedLine text={event?.expectedWorkTimeTo || data?.expectedWorkTimeTo} /></span></div><div className="official-print-mr-signature-row official-print-mr-technician-signatures"><SignatureLine label="توقيع فني الصيانة" signature={signature("maintenance_technician", "corrective")} fallback={event?.maintenanceTechnicianSignature} /><SignatureLine label="توقيع مشرف القسم المعني" signature={signature("concerned_section_supervisor", "corrective")} fallback={event?.concernedSectionSupervisorSignature} /></div></section>

    <section className="official-print-mr-section"><h3>الإجراءات المتخذة</h3><RuledWritingArea text={event?.actionsTaken} lines={9} className="official-print-mr-actions" /><div className="official-print-mr-remarks">ملاحظات وتوصيات: {event?.remarksRecommendations}</div></section>

    <table className="official-print-table official-print-mr-staff-table"><thead><tr><th className="w-[8%]">الرقم</th><th>القائم بالعمل</th><th>التوقيع</th></tr></thead><tbody>{staff.map((person, index) => { const staffSignature = signature(`performing_staff_${index + 1}`, "corrective"); return <tr key={index}><td>{person?.no || index + 1}</td><td>{person?.name}</td><td>{staffSignature?.signatureData ? <img src={staffSignature.signatureData} className="official-print-form-signature" alt={`توقيع ${person?.name || index + 1}`} /> : person?.signature}</td></tr>; })}</tbody></table>
    <section className="official-print-mr-closing"><h3>تسليم الماكينة / العمل المنجز</h3><div><SignatureLine label="توقيع مستلم الماكينة/ العمل المنجز" signature={signature("receiver", "corrective")} fallback={event?.receiverSignature} /><span>التاريخ: <DottedLine text={formatDate(event?.handoverDate)} /></span></div><div><SignatureLine label="توقيع الهندسة" signature={signature("engineering_final", "corrective")} fallback={event?.engineeringSignature} /><span>التاريخ: <DottedLine text={formatDate(event?.handoverDate)} /></span></div></section>
  </div></div></PrintPage></PrintLayout>;
}
