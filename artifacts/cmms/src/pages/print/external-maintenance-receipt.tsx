import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { PrintLayout, PrintPage } from "./print-layout";
import type { ExternalMaintenanceReceiptDetail } from "../maintenance-requests/types";

type ElectronicSignature = {
  fieldName: string;
  signatureData: string | null;
  userName: string;
};

function formatDate(value: string | null) { if (!value) return ""; const [y, m, d] = value.slice(0, 10).split("-"); return y && m && d ? `${d}/${m}/${y}` : value; }
function Fill({ children, className = "" }: { children?: React.ReactNode; className?: string }) { return <span className={`official-print-receipt-fill ${className}`}>{children}</span>; }
function DottedWritingLines({ value, count }: { value?: string | null; count: number }) {
  const entries = (value ?? "").split(/\r?\n/);
  return <div className="official-print-receipt-ruled">{
    Array.from({ length: count }, (_, index) => <div className="official-print-receipt-writing-line" key={index}>{entries[index] ?? ""}</div>)
  }</div>;
}

export default function ExternalMaintenanceReceiptPrintPage({ params }: { params: { id: string } }) {
  const requestId = Number(params.id);
  const { data } = useQuery({ queryKey: ["external-maintenance-receipt", requestId], queryFn: () => apiRequest<ExternalMaintenanceReceiptDetail>(`/maintenance-requests/${requestId}/external-maintenance-receipt`) });
  const { data: signatures = [] } = useQuery({
    queryKey: ["signatures", "EXTERNAL_MAINTENANCE_RECEIPT", requestId],
    queryFn: () => apiRequest<ElectronicSignature[]>(`/signatures?documentType=EXTERNAL_MAINTENANCE_RECEIPT&documentId=${requestId}`),
    enabled: Number.isFinite(requestId) && requestId > 0,
  });
  if (!data) return null;
  const { request, receipt } = data;
  const examinerElectronicSignature = signatures.find((signature) => signature.fieldName === "examiner");
  return <PrintLayout title="External Maintenance Work Receipt — Official Print"><PrintPage><div dir="rtl" className="official-print-external-receipt"><div className="official-print-external-receipt-sheet">
    <table dir="ltr" className="official-print-table official-print-external-receipt-header"><tbody><tr>
      <td dir="rtl" className="w-[33%] text-center font-bold"><div>رقم الوثيقة: <bdi dir="ltr">FORM-10-0240-1</bdi></div><div>تاريخ التنفيذ: <bdi dir="ltr">18/03/2023</bdi></div><div>صفحة 1 من 1</div></td>
      <td dir="rtl" className="w-[38%] text-center font-bold">نموذج استلام أعمال صيانة خارجية</td>
      <td dir="rtl" className="w-[29%] text-center font-bold">شركة بيت جالا لصناعة الأدوية<br />بيت جالا<br />فلسطين</td>
    </tr></tbody></table>
    <div className="official-print-external-receipt-content">
      <div className="official-print-receipt-top-row"><span><b className="official-print-receipt-static-label">طلب صيانة رقم:</b> <Fill><bdi dir="ltr">{request.requestReportNumber}</bdi></Fill></span><span><b className="official-print-receipt-static-label">نوع أعمال الصيانة:</b> <Fill>{receipt.maintenanceType}</Fill></span></div>
      <div className="official-print-receipt-top-row"><span><b className="official-print-receipt-static-label">القسم الطالب للصيانة:</b> <Fill>{receipt.requestingDepartment}</Fill></span><span><b className="official-print-receipt-static-label">التاريخ:</b> <Fill><bdi dir="ltr">{formatDate(receipt.receiptDate)}</bdi></Fill></span></div>
      <div className="official-print-receipt-performer"><b className="official-print-receipt-static-label">الجهة المنفذة للعمل:</b> <Fill>{receipt.performingEntity}</Fill></div>
      <section className="official-print-receipt-ruled-section"><div className="official-print-receipt-static-label">تقرير استلام أعمال الصيانة:</div><DottedWritingLines value={receipt.workAcceptanceReport} count={6} /></section>
      <section className="official-print-receipt-ruled-section official-print-receipt-rejection"><div className="official-print-receipt-static-label">سبب الرفض في حالة وجود خطأ في العمل:</div><DottedWritingLines value={receipt.workFailureCause} count={5} /></section>
      <div className="official-print-receipt-examiner"><div><b className="official-print-receipt-static-label">اسم الفاحص:</b> <Fill>{receipt.examinerName}</Fill></div><div><b className="official-print-receipt-static-label">توقيع الفاحص:</b> <Fill>{examinerElectronicSignature?.signatureData ? <img src={examinerElectronicSignature.signatureData} alt={`توقيع ${examinerElectronicSignature.userName}`} className="official-print-receipt-signature-image" /> : receipt.examinerSignature}</Fill></div></div>
    </div>
  </div></div></PrintPage></PrintLayout>;
}
