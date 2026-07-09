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
};

export default function AnnualPlanPrintPage({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  const { data } = useQuery({
    queryKey: ["print-annual-plan", year],
    queryFn: () => apiRequest<AnnualPlan>(`/maintenance-plans/annual/${year}`),
  });

  const approvals = [
    ["Prepared By", "Maintenance Supervisor", data?.preparedByName, data?.preparedByDate],
    ["Approved By", "Engineering Department Manager", data?.approvedEngineeringName, data?.approvedEngineeringDate],
    ["Approved By", "Production Department Manager", data?.approvedProductionName, data?.approvedProductionDate],
    ["Approved By", "QC Department Manager", data?.approvedQcName, data?.approvedQcDate],
    ["Approved By", "R & D Department Manager", data?.approvedRdName, data?.approvedRdDate],
    ["Approved By", "QA Department Manager", data?.approvedQaName, data?.approvedQaDate],
  ];

  return (
    <PrintLayout title="Annual PM Plan - Official Print">
      <PrintPage>
        <OfficialPrintHeader
          title="Preventive Maintenance Plan For Year"
          documentNumber="FORM-10-1025-0"
          effectiveDate="18/3/2023"
        />
        <div className="mt-10 space-y-8">
          {approvals.map(([role, jobTitle, name, date], index) => (
            <div key={index} className="grid grid-cols-2 gap-12">
              <div>
                <strong>{role}:</strong> {name}
                <br />
                <strong>Job title:</strong> <em>{jobTitle}</em>
              </div>
              <div>
                <strong>Signature:</strong> <DottedLine />
                <br />
                <strong>Date:</strong> <DottedLine text={date} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-20 grid grid-cols-2 gap-12">
          <div>Revised by: <DottedLine /> Date: <DottedLine /></div>
          <div>Approved by: <DottedLine /> Date: <DottedLine /></div>
        </div>
      </PrintPage>
    </PrintLayout>
  );
}
