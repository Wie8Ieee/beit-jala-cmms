import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { DottedLine, OfficialPrintHeader, PrintLayout, PrintPage } from "./print-layout";

type AnnualPlan = {
  id: number;
  year: number;
  preparedByName: string | null;
  preparedByDate: string | null;
  approvedEngineeringName: string | null;
  approvedEngineeringDate: string | null;
  approvedProductionName: string | null;
  approvedProductionDate: string | null;
  approvedQcName: string | null;
  approvedQcDate: string | null;
  approvedRdName: string | null;
  approvedRdDate: string | null;
  approvedQaName: string | null;
  approvedQaDate: string | null;
  rows: Array<{ id: number; department: string | null; machineName: string; machineCode: string | null; frequencyMonths: number | null; duration: string | null; startDate: string | null; scheduledMonths: number[] }>;
};

type AnnualPlanHeader = {
  companyName: string;
  documentName: string;
  documentNumber: string;
  effectiveOrExecutionDate: string | null;
  pageNumber: number;
  totalPages: number;
};

function formatSignatureDate(date: string | null | undefined) {
  if (!date) return "     /     /     ";
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day} / ${month} / ${year}` : date;
}

export default function AnnualPlanPrintPage({ params }: { params: { year: string; schedule?: string } }) {
  const year = Number(params.year);
  const { data } = useQuery({
    queryKey: ["print-annual-plan", year],
    queryFn: () => apiRequest<AnnualPlan>(`/maintenance-plans/annual/${year}`),
  });
  const { data: header } = useQuery({
    queryKey: ["annual-pm-header"],
    queryFn: () => apiRequest<AnnualPlanHeader>("/maintenance-plans/annual/header"),
  });

  const approvals = [
    ["Prepared By", "Maintenance Supervisor", data?.preparedByName, data?.preparedByDate],
    ["Approved By", "Eng. Department Manager", data?.approvedEngineeringName, data?.approvedEngineeringDate],
    ["Approved By", "Production Department Manager", data?.approvedProductionName, data?.approvedProductionDate],
    ["Approved By", "QC Department Manager", data?.approvedQcName, data?.approvedQcDate],
    ["Approved By", "R & D Department Manager", data?.approvedRdName, data?.approvedRdDate],
    ["Approved By", "QA Department Manager", data?.approvedQaName, data?.approvedQaDate],
  ];

  if (params.schedule) {
    return (
      <PrintLayout title="Machine Schedule - Print">
        <PrintPage>
          <OfficialPrintHeader title="Machine Schedule" documentNumber={header?.documentNumber ?? "FORM-10-1025-0"} effectiveDate={header?.effectiveOrExecutionDate ?? String(year)} />
          <table className="official-print-table mt-8">
            <thead><tr><th>Department</th><th>Machine / Code</th><th>Frequency</th><th>Duration</th><th>Start</th><th>Months</th></tr></thead>
            <tbody>{data?.rows.map((row) => <tr key={row.id}><td>{row.department ?? ""}</td><td>{row.machineName}<br />{row.machineCode ?? ""}</td><td>{row.frequencyMonths ? `Every ${row.frequencyMonths} months` : ""}</td><td>{row.duration ?? ""}</td><td>{row.startDate ?? ""}</td><td>{row.scheduledMonths.join(", ")}</td></tr>)}</tbody>
          </table>
        </PrintPage>
      </PrintLayout>
    );
  }

  return (
    <PrintLayout title="Annual PM Plan - Official Print">
      <PrintPage className="official-print-annual-plan-page">
        <div className="official-print-annual-plan-content">
          <div className="official-print-annual-header-frame">
          <table className="official-print-table official-print-header-table official-print-annual-header">
            <tbody>
              <tr>
                <td className="w-[34%] text-left">
                  <div>{header?.companyName ?? "Beit Jala Pharmaceutical Co."}</div>
                  <div>Beit Jala</div>
                  <div>Palestine</div>
                </td>
                <td className="w-[36%] text-center">
                  <div>{header?.documentName ?? "Preventive Maintenance Plan"}</div>
                  <div>For Year: {data?.year ?? year}</div>
                </td>
                <td className="w-[30%] text-left">
                  <div className="official-print-annual-document-number"><strong>Doc. No:</strong> {header?.documentNumber ?? "FORM-10-1025-0"}</div>
                  <div><strong>Effective date:</strong> {header?.effectiveOrExecutionDate ?? "18/3/2023"}</div>
                  <div><strong>Pages:</strong> {header?.pageNumber ?? 1} of {header?.totalPages ?? 1}</div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <div className="official-print-annual-approvals">
          {approvals.map(([role, jobTitle, name, date], index) => (
            <div key={index} className="official-print-annual-approval grid grid-cols-2 gap-12">
              <div>
                <strong>{role}:</strong> {name}
                <br />
                <div className="official-print-annual-job-line"><strong>Job title:</strong> <em className="official-print-annual-job-title">{jobTitle}</em></div>
              </div>
              <div>
                <strong>Signature:</strong> <DottedLine />
                <br />
                <strong>Date:</strong> <span className="official-print-annual-date">{formatSignatureDate(date as string | null | undefined)}</span>
              </div>
            </div>
          ))}
          </div>
        </div>
      </PrintPage>
    </PrintLayout>
  );
}
