import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { DottedLine, OfficialPrintHeader, PrintLayout, PrintPage } from "./print-layout";

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

export default function MonthlyPlanPrintPage({ params }: { params: { year: string; month: string } }) {
  const year = Number(params.year);
  const month = Number(params.month);
  const { data } = useQuery({
    queryKey: ["print-monthly-plan", year, month],
    queryFn: () => apiRequest<MonthlyPlan>(`/maintenance-plans/monthly/${year}/${month}`),
  });

  return (
    <PrintLayout title="Monthly PM Program - Official Print">
      <PrintPage landscape>
        <OfficialPrintHeader
          title="Monthly Preventive Maintenance Program"
          documentNumber="FORM-10-0117-3"
          effectiveDate="18/3/2023"
        />
        <div className="my-3">Month / Year: <DottedLine text={data ? `${monthNames[month - 1]} / ${year}` : ""} /></div>
        <table className="official-print-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Department Name</th>
              <th>Section Name</th>
              <th>Machine Name / Identification Number</th>
              <th colSpan={2}>Planned date<br />From / To</th>
              <th>Actual Date</th>
              <th>Amendments</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }).map((_, index) => {
              const row = data?.rows[index];
              return (
                <tr key={index} className="official-print-row-tall">
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
        <div className="mt-6 grid grid-cols-2 gap-12">
          <div>
            Prepared by: <DottedLine text={data?.preparedByName} />
            <br />
            Maintenance Section Supervisor Signature: <DottedLine text={data?.maintenanceSupervisorName} />
            <br />
            Department Manager Sign: <DottedLine text={data?.departmentManagerName} />
          </div>
          <div>
            Date: <DottedLine text={data?.preparedByDate} />
            <br />
            Date: <DottedLine text={data?.maintenanceSupervisorDate} />
            <br />
            Date: <DottedLine text={data?.departmentManagerDate} />
          </div>
        </div>
      </PrintPage>
    </PrintLayout>
  );
}
