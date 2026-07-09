import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { MaintenanceRequestDetail } from "../maintenance-requests/types";
import { DottedLine, PrintLayout, PrintPage } from "./print-layout";

export default function MaintenanceRequestPrintPage({ params }: { params: { id: string } }) {
  const requestId = Number(params.id);
  const { data } = useQuery({
    queryKey: ["print-maintenance-request", requestId],
    queryFn: () => apiRequest<MaintenanceRequestDetail>(`/maintenance-requests/${requestId}`),
  });

  const request = data?.request;
  const event = data?.correctiveEvent;

  return (
    <PrintLayout title="Maintenance Request - Official Print">
      <PrintPage>
        <table className="official-print-table official-print-header-table">
          <tbody>
            <tr>
              <td className="text-center">FORM-10-0975-1<br />Effective date: 18/3/2023<br />Page 1 of 1</td>
              <td className="text-center font-semibold">طلب صيانة / تقرير صيانة علاجية<br />(Maintenance Request & Corrective Maintenance Report)</td>
              <td className="text-center">شركة بيت جالا لصناعة الادوية<br />بيت جالا<br />فلسطين</td>
            </tr>
          </tbody>
        </table>

        <table className="official-print-table mt-4">
          <tbody>
            <tr>
              <td>رقم الطلب / التقرير: <DottedLine text={request?.requestReportNumber} /></td>
              <td>التاريخ: <DottedLine text={request?.requestDate} /></td>
            </tr>
            <tr>
              <td>اسم الالة / رقمها: <DottedLine text={request ? `${request.machineName} / ${request.machineNumber}` : ""} /></td>
              <td>الدائرة / القسم: <DottedLine text={request?.departmentSection} /></td>
            </tr>
            <tr>
              <td>الاولوية: <DottedLine text={request?.priority} /></td>
              <td>توقيع مقدم الطلب: <DottedLine text={data?.reportingPersonSignature} /></td>
            </tr>
            <tr>
              <td>توقيع مسؤول القسم: <DottedLine text={data?.departmentSupervisorSignature} /></td>
              <td>توقيع مشرف QA: <DottedLine text={data?.qaSupervisorSignature} /></td>
            </tr>
            <tr className="official-print-row-xl">
              <td colSpan={2}><strong>وصف العطل:</strong><br />{request?.failureDescription}</td>
            </tr>
          </tbody>
        </table>

        <div className="official-print-section-title">نتائج الفحص الاولي / Preliminary Findings</div>
        <table className="official-print-table">
          <tbody>
            <tr className="official-print-row-xl"><td colSpan={2}>{event?.preliminaryCheckResults}</td></tr>
            <tr>
              <td>وقت العمل المتوقع من: <DottedLine text={event?.expectedWorkTimeFrom || data?.expectedWorkTimeFrom} /></td>
              <td>الى: <DottedLine text={event?.expectedWorkTimeTo || data?.expectedWorkTimeTo} /></td>
            </tr>
            <tr>
              <td>توقيع فني الصيانة: <DottedLine text={event?.maintenanceTechnicianSignature} /></td>
              <td>توقيع مسؤول القسم المعني: <DottedLine text={event?.concernedSectionSupervisorSignature} /></td>
            </tr>
          </tbody>
        </table>

        <div className="official-print-section-title">الاجراءات المتخذة / Actions Taken</div>
        <table className="official-print-table">
          <tbody>
            <tr className="official-print-row-xl"><td>{event?.actionsTaken}</td></tr>
            <tr className="official-print-row-tall"><td>ملاحظات وتوصيات: {event?.remarksRecommendations}</td></tr>
          </tbody>
        </table>

        <table className="official-print-table mt-2">
          <thead><tr><th className="w-[12%]">الرقم</th><th>القائم بالعمل</th><th>التوقيع</th></tr></thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, index) => {
              const staff = event?.performingStaff[index];
              return <tr key={index}><td>{staff?.no || index + 1}</td><td>{staff?.name}</td><td>{staff?.signature}</td></tr>;
            })}
          </tbody>
        </table>

        <table className="official-print-table mt-2">
          <tbody>
            <tr><td>اسم المستلم / القسم: <DottedLine text={event?.receiverName} /></td></tr>
            <tr>
              <td>
                توقيع مستلم الالة / القسم: <DottedLine text={event?.receiverSignature} />
                &nbsp;&nbsp; التاريخ: <DottedLine text={event?.handoverDate} />
              </td>
            </tr>
            <tr><td>توقيع الهندسة: <DottedLine text={event?.engineeringSignature} /></td></tr>
          </tbody>
        </table>
      </PrintPage>
    </PrintLayout>
  );
}
