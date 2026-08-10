import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { apiRequest } from "@/lib/api";
import { DottedLine, PrintLayout, PrintPage } from "./print-layout";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type MonthlyPlan = {
  id: number;
  year: number;
  month: number;
  preparedByName: string | null;
  preparedByDate: string | null;
  maintenanceSupervisorName: string | null;
  maintenanceSupervisorDate: string | null;
  departmentManagerName: string | null;
  departmentManagerDate: string | null;
  approvedByName: string | null;
  approvedByDate: string | null;
  rows: Array<{
    rowNumber: number;
    departmentName: string | null;
    sectionName: string | null;
    machineName: string;
    identificationNumber: string | null;
    plannedDateFrom: string | null;
    plannedDateTo: string | null;
    actualDate: string | null;
    amendments: string | null;
  }>;
};

type MonthlyPlanHeader = { companyName: string; documentName: string; documentNumber: string; effectiveOrExecutionDate: string | null; pageNumber: number; totalPages: number };

type ElectronicSignature = {
  fieldName: string;
  signatureData: string | null;
  userName: string;
  signedAt: string;
};

function signatureDate(savedDate: string | null | undefined, signedAt: string | undefined) {
  return savedDate || signedAt?.slice(0, 10) || "";
}

export default function MonthlyPlanPrintPage({ params }: { params: { year: string; month: string } }) {
  const year = Number(params.year);
  const month = Number(params.month);
  const { data } = useQuery({
    queryKey: ["print-monthly-plan", year, month],
    queryFn: () => apiRequest<MonthlyPlan>(`/maintenance-plans/monthly/${year}/${month}`),
  });
  const { data: header } = useQuery({ queryKey: ["monthly-pm-header"], queryFn: () => apiRequest<MonthlyPlanHeader>("/maintenance-plans/monthly/header") });
  const planId = data?.id ?? 0;
  const { data: signatures = [] } = useQuery({
    queryKey: ["print-monthly-plan-signatures", planId],
    queryFn: () => apiRequest<ElectronicSignature[]>(`/signatures?documentType=MONTHLY_PLAN&documentId=${planId}`),
    enabled: planId > 0,
  });
  const signature = (fieldName: string) => signatures.find((item) => item.fieldName === fieldName);
  const preparedBySignature = signature("prepared_by");
  const supervisorSignature = signature("maintenance_supervisor");
  const managerSignature = signature("department_manager");
  // The official form starts with twelve slots, but generated plans can have
  // more machines. Keep the minimum form capacity while allowing every real
  // row to print, and let CSS distribute the available page height evenly.
  const printRows = Array.from({ length: Math.max(12, data?.rows.length ?? 0) }, (_, index) => data?.rows[index]);

  return (
    <PrintLayout title="Monthly PM Program - Official Print" landscape>
      <PrintPage landscape>
        <table className="official-print-table official-print-header-table monthly-pm-print-header">
          <tbody>
            <tr>
              <td className="w-[30%] text-left font-semibold leading-tight">{header?.companyName ?? "Beit Jala Pharmaceutical Co."}<br />Beit Jala<br />Palestine</td>
              <td className="w-[40%] text-center font-semibold">{header?.documentName ?? "Monthly Preventive Maintenance Program"}</td>
              <td className="monthly-pm-document-cell w-[30%] text-left font-semibold">
                <div className="monthly-pm-document-line">Doc. No: {header?.documentNumber ?? "FORM-10-0117-3"}</div>
                <div className="monthly-pm-document-line">Effective date: {header?.effectiveOrExecutionDate ?? "18/3/2023"}</div>
                <div className="monthly-pm-document-line monthly-pm-document-line-last">Pages: {header?.pageNumber ?? 1} of {header?.totalPages ?? 1}</div>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="my-3 text-[12px] font-semibold">Month/Year: <DottedLine text={data ? `${monthNames[month - 1]} / ${year}` : ""} /></div>
        <table
          className="official-print-table monthly-pm-print-table"
          style={{ "--monthly-row-count": String(printRows.length) } as CSSProperties}
        >
          <thead>
            <tr>
              <th rowSpan={2} className="w-[6%]">No.</th>
              <th rowSpan={2} className="w-[12%]">Department<br />Name</th>
              <th rowSpan={2} className="w-[14%]">Section Name</th>
              <th rowSpan={2} className="w-[22%]">Machine Name/ Identification<br />Number</th>
              <th colSpan={2} className="w-[14%]">Planned date</th>
              <th rowSpan={2} className="w-[17%]">Actual Date</th>
              <th rowSpan={2} className="w-[15%]">Amendments</th>
            </tr>
            <tr><th>From</th><th>To</th></tr>
          </thead>
          <tbody>
            {printRows.map((row, index) => {
              return (
                <tr key={index} className="official-print-row-tall text-[11px]">
                  <td>{row?.rowNumber || index + 1}.</td>
                  <td>{row?.departmentName}</td>
                  <td>{row?.sectionName}</td>
                  <td>{row ? `${row.machineName} ${row.identificationNumber || ""}` : ""}</td>
                  <td>{row?.plannedDateFrom}</td>
                  <td>{row?.plannedDateTo}</td>
                  <td>{row?.actualDate}</td>
                  <td>{row?.amendments}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-6 grid grid-cols-[1fr_0.55fr] gap-12 text-[12px]">
          <div>
            Prepared by: {preparedBySignature?.signatureData ? <img src={preparedBySignature.signatureData} alt="Prepared by signature" className="monthly-pm-print-signature" /> : <DottedLine />}
            <br />
            Maintenance Section Supervisor Signature: {supervisorSignature?.signatureData ? <img src={supervisorSignature.signatureData} alt="Maintenance supervisor signature" className="monthly-pm-print-signature" /> : <DottedLine />}
            <br />
            Department Manager Sign: {managerSignature?.signatureData ? <img src={managerSignature.signatureData} alt="Department manager signature" className="monthly-pm-print-signature" /> : <DottedLine />}
          </div>
          <div>
            Date: <DottedLine text={signatureDate(data?.preparedByDate, preparedBySignature?.signedAt)} />
            <br />
            Date: <DottedLine text={signatureDate(data?.maintenanceSupervisorDate, supervisorSignature?.signedAt)} />
            <br />
            Date: <DottedLine text={signatureDate(data?.departmentManagerDate, managerSignature?.signedAt)} />
          </div>
        </div>
      </PrintPage>
    </PrintLayout>
  );
}
