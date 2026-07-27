import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { PrintLayout, PrintPage } from "./print-layout";
import type { ExternalMaintenanceRequestDetail } from "../maintenance-requests/types";

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
  const { data } = useQuery({ queryKey: ["external-maintenance-request", requestId], queryFn: () => apiRequest<ExternalMaintenanceRequestDetail>(`/maintenance-requests/${requestId}/external-maintenance`) });
  if (!data) return null;
  const { request, externalRequest: form } = data;
  return <PrintLayout title="External Maintenance Request — Official Print"><PrintPage><div dir="rtl" className="official-print-external-maintenance"><div className="official-print-external-sheet">
    <table dir="ltr" className="official-print-table official-print-external-header"><tbody><tr>
      <td dir="rtl" className="w-[34%] text-center font-bold"><div>رقم الوثيقة: <bdi dir="ltr">FORM-00-0077-1</bdi></div><div>تاريخ التنفيذ: <bdi dir="ltr">18/03/2023</bdi></div><div>صفحة 1 من 1</div></td>
      <td dir="rtl" className="w-[38%] text-center font-bold">طلب صيانة خارجية</td>
      <td dir="rtl" className="w-[28%] text-center font-bold">شركة بيت جالا لصناعة الأدوية<br />بيت جالا<br />فلسطين</td>
    </tr></tbody></table>
    <div className="official-print-external-content">
      <div className="official-print-external-field official-print-external-order">أمر صيانة رقم: <FillLine><bdi dir="ltr">{request.requestReportNumber}</bdi></FillLine></div>
      <div className="official-print-external-field official-print-external-department">القسم الطالب للصيانة: <FillLine>{form.departmentSection}</FillLine></div>
      <div className="official-print-external-field">الصيانة/النشاطات المطلوبة: <FillLine className="official-print-external-wide">{form.requiredMaintenance}</FillLine></div>
      <section className="official-print-external-notes"><div>نتائج الكشف الأولي:</div><WritingLines value={form.preliminaryFindings} count={4} /></section>
      <section className="official-print-external-notes official-print-external-suggestions-section"><div>مقترحات فني الصيانة:</div><WritingLines value={form.technicianSuggestions} count={5} /></section>
      <div className="official-print-external-signatures">
        <div><span className="official-print-external-signature-label">توقيع فني الصيانة:</span><FillLine>{form.maintenanceTechnicianSignature}</FillLine><span className="official-print-external-date-label">التاريخ:</span><FillLine>{formatDate(form.maintenanceTechnicianDate)}</FillLine></div>
        <div><span className="official-print-external-signature-label">توقيع مدير دائرة الصيانة:</span><FillLine>{form.departmentManagerSignature}</FillLine><span className="official-print-external-date-label">التاريخ:</span><FillLine>{formatDate(form.departmentManagerDate)}</FillLine></div>
        <div><span className="official-print-external-signature-label">توقيع المدير العام:</span><FillLine>{form.generalManagerSignature}</FillLine><span className="official-print-external-date-label">التاريخ:</span><FillLine>{formatDate(form.generalManagerDate)}</FillLine></div>
      </div>
    </div>
  </div></div></PrintPage></PrintLayout>;
}
