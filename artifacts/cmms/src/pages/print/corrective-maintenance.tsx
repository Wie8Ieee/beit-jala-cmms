import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { CorrectiveMaintenanceRecord } from "../maintenance-requests/types";
import { PrintLayout, PrintPage } from "./print-layout";

function maintenanceType(priority?: string | null) {
  if (priority === "عادي" || priority === "مستعجل") return priority;
  return priority === "urgent" ? "مستعجل" : priority ? "عادي" : "";
}

function formatExecutionDate(date: string | null) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}/${month}/${year}` : date.replaceAll("-", "/");
}

function dateRowSpan(slots: Array<{ date?: string }>, index: number) {
  const date = slots[index]?.date;
  if (!date) return 1;
  let span = 1;
  while (slots[index + span]?.date === date) span += 1;
  return span;
}

export default function CorrectiveMaintenancePrintPage({ params }: { params: { id: string; recordId?: string } }) {
  const machineId = Number(params.id);
  const historicalRecordId = params.recordId ? Number(params.recordId) : undefined;
  const { data = [] } = useQuery({
    queryKey: ["print-cm-history", machineId],
    queryFn: () => apiRequest<CorrectiveMaintenanceRecord[]>(`/machines/${machineId}/corrective-maintenance/history`),
  });
  const record = historicalRecordId ? data.find((item) => item.id === historicalRecordId) : data[data.length - 1];
  // A corrective-maintenance record is one official print page. Records are
  // chained by the API as they fill, so this template never paginates one
  // record into a second physical page.
  const events = record?.events ?? [];

  return (
    <PrintLayout title="Corrective Maintenance Log - Official Print">
      {record && (
        <PrintPage landscape>
          <div dir="rtl">
            <table dir="ltr" className="official-print-table official-print-header-table official-print-cm-header">
              <tbody>
                <tr>
                  <td dir="rtl" className="w-[28%] text-right">
                    <div>رقم الوثيقة: <bdi dir="ltr">{record.documentNumber}</bdi></div>
                    <div>تاريخ التنفيذ: <bdi dir="ltr">{formatExecutionDate(record.executionDate)}</bdi></div>
                    <div>صفحة 1 من 1</div>
                  </td>
                  <td dir="rtl" className="w-[44%] text-center font-semibold">
                    <div>سجل أعمال الصيانة العلاجية للماكينة</div>
                    <div dir="ltr">(Equipment Corrective Maintenance Record)</div>
                  </td>
                  <td dir="rtl" className="w-[28%] text-right">
                    <div>شركة بيت جالا لصناعة الأدوية</div>
                    <div>بيت جالا</div>
                    <div>فلسطين</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="my-4 grid grid-cols-4 gap-4 text-right font-semibold">
              <div>اسم الماكينة: <bdi dir="ltr">{record.machineName}</bdi></div>
              <div>رقم الماكينة: <bdi dir="ltr">{record.machineNumber}</bdi></div>
              <div>مكان وجود الماكينة: <bdi dir="ltr">{record.machineLocation}</bdi></div>
              <div>تاريخ بدء التشغيل: <bdi dir="ltr">{record.startupDate}</bdi></div>
            </div>

            <table className="official-print-table text-right">
              <colgroup>
                <col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[13%]" />
                <col className="w-[20%]" /><col className="w-[10%]" /><col className="w-[18%]" />
                <col className="w-[8%]" /><col className="w-[7%]" /><col className="w-[7%]" />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2}>تاريخ طلب<br />الصيانة</th>
                  <th rowSpan={2}>رقم طلب<br />الصيانة</th>
                  <th rowSpan={2}>نوع الصيانة العلاجية<br />عادي/مستعجل</th>
                  <th rowSpan={2}>أعمال الصيانة</th>
                  <th rowSpan={2}>القائم بالعمل</th>
                  <th rowSpan={2}>قطع الغيار المستبدلة و عددها</th>
                  <th rowSpan={2}>تاريخ التصليح</th>
                  <th colSpan={2}>وقت التصليح</th>
                </tr>
                <tr><th>من</th><th>إلى</th></tr>
              </thead>
              <tbody>
                {[...events, ...Array.from({ length: Math.max(0, 3 - events.length) })].map((event, eventIndex) => {
                  const repairSlots = Array.from({ length: 5 }, (_, index) => event?.repairTimeSlots?.[index] ?? { date: "", from: "", to: "" });
                  return <Fragment key={`event-${eventIndex}`}>
                    <tr key={`event-${eventIndex}-start`} className="h-[18px]">
                      <td rowSpan={5}>{event?.requestDate ?? ""}</td>
                      <td rowSpan={5}>{event?.requestReportNumber ?? ""}</td>
                      <td rowSpan={5}>{maintenanceType(event?.maintenanceType ?? event?.priority)}</td>
                      <td rowSpan={5}>{event?.actionsTaken ?? ""}</td>
                      <td rowSpan={5}>{event?.technicianName ?? ""}</td>
                      <td rowSpan={5}>{event?.sparePartsUsed ?? ""}</td>
                      <td className={`cm-repair-date ${dateRowSpan(repairSlots, 0) === 5 ? "cm-repair-date-final" : ""}`} rowSpan={dateRowSpan(repairSlots, 0)}>{repairSlots[0].date || event?.handoverDate || (event?.completedAt ? new Date(event.completedAt).toLocaleDateString() : "")}</td>
                      <td>{repairSlots[0].from || event?.expectedWorkTimeFrom || ""}</td>
                      <td>{repairSlots[0].to || event?.expectedWorkTimeTo || ""}</td>
                    </tr>
                    {Array.from({ length: 4 }).map((_, rowIndex) => {
                      const slotIndex = rowIndex + 1;
                      const slot = repairSlots[slotIndex];
                      const startsDate = !slot.date || slot.date !== repairSlots[slotIndex - 1].date;
                      return <tr key={`event-${eventIndex}-time-${rowIndex}`} className="h-[18px]">{startsDate && <td className={`cm-repair-date ${slotIndex + dateRowSpan(repairSlots, slotIndex) === 5 ? "cm-repair-date-final" : ""}`} rowSpan={dateRowSpan(repairSlots, slotIndex)}>{slot.date}</td>}<td>{slot.from}</td><td>{slot.to}</td></tr>;
                    })}
                  </Fragment>
                })}
              </tbody>
            </table>
          </div>
        </PrintPage>
      )}
    </PrintLayout>
  );
}
