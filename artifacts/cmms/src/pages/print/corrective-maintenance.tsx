import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { CorrectiveMaintenanceRecord } from "../maintenance-requests/types";
import { PrintLayout, PrintPage } from "./print-layout";

export default function CorrectiveMaintenancePrintPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const { data = [] } = useQuery({
    queryKey: ["print-cm-history", machineId],
    queryFn: () => apiRequest<CorrectiveMaintenanceRecord[]>(`/machines/${machineId}/corrective-maintenance/history`),
  });
  const record = data[data.length - 1];

  return (
    <PrintLayout title="Corrective Maintenance Log - Official Print">
      <PrintPage landscape>
        {record && (
          <>
            <table className="official-print-table official-print-header-table">
              <tbody>
                <tr>
                  <td className="w-[25%]">Document No.: {record.documentNumber}<br />Execution date: {record.executionDate}<br />Page: {record.pageCount}</td>
                  <td className="text-center font-semibold">سجل أعمال الصيانة العلاجية للماكينة<br />(Equipment Corrective Maintenance Record)</td>
                  <td className="w-[25%] text-center">شركة بيت جالا لصناعة الادوية<br />بيت جالا<br />فلسطين</td>
                </tr>
              </tbody>
            </table>
            <div className="my-3 grid grid-cols-4 gap-4 text-right">
              <div>اسم الماكينة: {record.machineName}</div>
              <div>رقم الماكينة: {record.machineNumber}</div>
              <div>مكان وجود الماكينة: {record.machineLocation}</div>
              <div>تاريخ بدء التشغيل: {record.startupDate}</div>
            </div>
            <table className="official-print-table">
              <thead>
                <tr>
                  <th>تاريخ طلب الصيانة</th>
                  <th>رقم طلب الصيانة</th>
                  <th>نتائج الفحص المبدئي/ ملاحظات المستقبل</th>
                  <th>أعمال الصيانة</th>
                  <th>القائم بالعمل</th>
                  <th>القطع الغيار المستبدلة و عددها</th>
                  <th>تاريخ الانتهاء</th>
                  <th>توقيع الفني</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: record.maxRows }).map((_, index) => {
                  const event = record.events[index];
                  return (
                    <tr key={index} className="official-print-row-tall">
                      <td>{event?.handoverDate}</td>
                      <td>{event?.requestReportNumber}</td>
                      <td>{event?.preliminaryCheckResults}</td>
                      <td>{event?.actionsTaken}</td>
                      <td>{event?.technicianName}</td>
                      <td></td>
                      <td>{event?.completedAt ? new Date(event.completedAt).toLocaleDateString() : ""}</td>
                      <td>{event?.maintenanceTechnicianSignature}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </PrintPage>
    </PrintLayout>
  );
}
