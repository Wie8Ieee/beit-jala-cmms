import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { OfficialPrintHeader, PrintLayout, PrintPage } from "./print-layout";

type PmRecordDetail = {
  record: { sequenceNumber: number; inspectionCount: number };
  header: { procedureFormNumber: string; effectiveDate: string | null; department: string | null };
  checklistPoints: Array<{ id: number; pointText: string }>;
  inspections: Array<{
    id: number;
    columnNumber: number;
    inspectionDate: string;
    inspectionTime: string;
    actionTaken: string | null;
    examinerName: string | null;
    machineReceiverName: string | null;
    results: Array<{ checklistPointId: number; value: string | null }>;
  }>;
  pageCount: number;
};

export default function PmRecordPrintPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const { data } = useQuery({
    queryKey: ["print-pm-current", machineId],
    queryFn: () => apiRequest<PmRecordDetail>(`/machines/${machineId}/pm/current`),
  });
  const resultMap = useMemo(() => {
    const map = new Map<string, string | null>();
    data?.inspections.forEach((inspection) => {
      inspection.results.forEach((result) => map.set(`${inspection.id}-${result.checklistPointId}`, result.value));
    });
    return map;
  }, [data]);

  return (
    <PrintLayout title="Preventive Maintenance Record - Official Print">
      <PrintPage>
        {data && (
          <>
            <OfficialPrintHeader
              title="Preventive Maintenance Record"
              documentNumber={data.header.procedureFormNumber}
              effectiveDate={data.header.effectiveDate}
              page={`Page 1 of ${data.pageCount}`}
            />
            <table className="official-print-table mt-4">
              <tbody>
                <tr><td className="w-[30%] font-semibold">Procedure / form number</td><td>{data.header.procedureFormNumber}</td></tr>
                <tr><td className="font-semibold">Effective date</td><td>{data.header.effectiveDate}</td></tr>
                <tr><td className="font-semibold">Department</td><td>{data.header.department}</td></tr>
                <tr><td className="font-semibold">Page X of Y</td><td>Page 1 of {data.pageCount}</td></tr>
              </tbody>
            </table>
            <table className="official-print-table mt-4">
              <thead>
                <tr>
                  <th className="w-[8%]">#</th>
                  <th>نقاط الفحص / Checklist points</th>
                  {data.inspections.map((inspection) => (
                    <th key={inspection.id}>تم الفحص بنجاح<br />نعم / لا<br />{inspection.inspectionDate}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.checklistPoints.map((point, index) => (
                  <tr key={point.id} className="official-print-row-tall">
                    <td>{index + 1}.</td>
                    <td>{point.pointText}</td>
                    {data.inspections.map((inspection) => (
                      <td key={inspection.id}>{resultMap.get(`${inspection.id}-${point.id}`) ?? ""}</td>
                    ))}
                  </tr>
                ))}
                <tr className="official-print-row-xl">
                  <td colSpan={2 + data.inspections.length}>الاجراء المتخذ في حال وجود خطأ/انحراف: {data.inspections.map((item) => item.actionTaken).filter(Boolean).join(" | ")}</td>
                </tr>
                <tr>
                  <td colSpan={2 + data.inspections.length}>اسم الفاحص وتوقيعه: {data.inspections.map((item) => item.examinerName).filter(Boolean).join(" | ")}</td>
                </tr>
                <tr>
                  <td colSpan={2 + data.inspections.length}>اسم مستلم الماكينة وتوقيعه: {data.inspections.map((item) => item.machineReceiverName).filter(Boolean).join(" | ")}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </PrintPage>
    </PrintLayout>
  );
}
