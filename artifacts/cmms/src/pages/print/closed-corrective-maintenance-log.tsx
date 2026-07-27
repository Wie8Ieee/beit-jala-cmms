import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { PrintLayout, PrintPage } from "./print-layout";
import type { ClosedCorrectiveMaintenanceLogRow } from "../maintenance-requests/closed-log";

const ROWS_PER_PAGE = 16;

function chunk<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages.length ? pages : [[]];
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function maintenanceType(priority: string) {
  return priority.toLowerCase() === "urgent" ? "مستعجل" : "عادي";
}

export default function ClosedCorrectiveMaintenanceLogPrintPage() {
  const { data = [] } = useQuery({
    queryKey: ["closed-corrective-maintenance-log"],
    queryFn: () => apiRequest<ClosedCorrectiveMaintenanceLogRow[]>("/maintenance-requests/closed-log"),
  });
  const pages = chunk(data, ROWS_PER_PAGE);

  return (
    <PrintLayout title="Closed Corrective Maintenance Requests Log — Official Print">
      {pages.map((rows, pageIndex) => (
        <PrintPage key={pageIndex}>
          <div dir="rtl" className="official-print-closed-cm-log">
            <table dir="ltr" className="official-print-table official-print-header-table official-print-closed-cm-log-header">
              <tbody><tr>
                <td dir="rtl" className="w-[34%] text-center font-semibold">
                  <div>رقم الوثيقة: <bdi dir="ltr">LOG-10-0659-0</bdi></div>
                  <div>تاريخ التنفيذ: <bdi dir="ltr">18/03/2023</bdi></div>
                  <div>صفحة {pageIndex + 1} من {pages.length}</div>
                </td>
                <td dir="rtl" className="w-[38%] text-center font-semibold">سجل طلبات الصيانة العلاجية للأجهزة / الماكينات</td>
                <td dir="rtl" className="w-[28%] text-center font-semibold">شركة بيت جالا لصناعة الأدوية<br />بيت جالا<br />فلسطين</td>
              </tr></tbody>
            </table>

            <table className="official-print-table official-print-closed-cm-log-table mt-4">
              <colgroup>
                <col className="w-[20%]" /><col className="w-[13%]" /><col className="w-[10%]" />
                <col className="w-[14%]" /><col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[20%]" />
              </colgroup>
              <thead><tr>
                <th>اسم الجهاز</th><th>رقم الجهاز</th><th>التاريخ</th><th>رقم طلب الصيانة العلاجية</th>
                <th>عادي / مستعجل</th><th>تاريخ إغلاق الطلب</th><th>ملاحظات</th>
              </tr></thead>
              <tbody>
                {Array.from({ length: ROWS_PER_PAGE }, (_, index) => {
                  const row = rows[index];
                  return <tr key={row?.id ?? `empty-${index}`}>
                    <td>{row?.machineName}</td><td dir="ltr">{row?.machineNumber}</td><td dir="ltr">{row ? formatDate(row.requestDate) : ""}</td>
                    <td dir="ltr">{row?.requestReportNumber}</td><td>{row ? maintenanceType(row.priority) : ""}</td>
                    <td dir="ltr">{row ? formatDate(row.closedDate) : ""}</td><td>{row?.remarks}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </PrintPage>
      ))}
    </PrintLayout>
  );
}
