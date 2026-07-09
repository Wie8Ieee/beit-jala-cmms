import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { DottedLine, OfficialPrintHeader, PrintLayout, PrintPage } from "./print-layout";

type EquipmentInformation = Record<string, string | number | null>;

function value(record: EquipmentInformation | undefined, key: string) {
  const item = record?.[key];
  return item === null || item === undefined ? "" : String(item);
}

export default function EquipmentInformationPrintPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const { data } = useQuery({
    queryKey: ["print-equipment-information", machineId],
    queryFn: () => apiRequest<EquipmentInformation>(`/machines/${machineId}/equipment-information`),
  });

  return (
    <PrintLayout title="Equipment Information Record - Official Print">
      <PrintPage>
        <OfficialPrintHeader
          title="Equipment Information Record"
          documentNumber="FORM-10-0118-1"
          effectiveDate="18/3/2023"
        />
        <table className="official-print-table mt-4">
          <tbody>
            {[
              ["1. Name of equipment", value(data, "nameOfEquipment")],
              ["2. Model number", value(data, "modelNumber")],
              ["3. Serial number", value(data, "serialNumber")],
              ["4. Identification number", value(data, "identificationNumber")],
              ["5. Date equipment purchased", value(data, "datePurchased")],
            ].map(([label, field]) => (
              <tr key={label}>
                <td className="w-[48%] font-semibold">{label}</td>
                <td>{field}</td>
              </tr>
            ))}
            <tr className="official-print-row-tall">
              <td className="font-semibold">6. Company purchased from<br />a. Name<br />b. Address</td>
              <td>{value(data, "purchasedFromName")}<br />{value(data, "purchasedFromAddress")}</td>
            </tr>
            <tr className="official-print-row-tall">
              <td className="font-semibold">7. Manufacturing company<br />a. Name<br />b. Address</td>
              <td>{value(data, "manufacturingCompanyName")}<br />{value(data, "manufacturingCompanyAddress")}</td>
            </tr>
            <tr>
              <td className="font-semibold">8. Equipment Dimensions (in cm):<br />Width (W) x Height (H) x Depth (D)</td>
              <td>{value(data, "dimensionWidthCm")} x {value(data, "dimensionHeightCm")} x {value(data, "dimensionDepthCm")}</td>
            </tr>
            <tr>
              <td className="font-semibold">9. Weight (kg)</td>
              <td>{value(data, "weightKg")}</td>
            </tr>
          </tbody>
        </table>
        <div className="official-print-section-title">10. Utilities</div>
        <table className="official-print-table">
          <tbody>
            {[
              ["10.1. Power supply", value(data, "utilitiesPowerSupply")],
              ["10.2. Air", value(data, "utilitiesAir")],
              ["10.3. Water", value(data, "utilitiesWater")],
              ["10.4. Other Utilities", value(data, "utilitiesOther")],
            ].map(([label, field]) => (
              <tr key={label} className="official-print-row-tall">
                <td className="w-[48%] font-semibold">{label}</td>
                <td>{field}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="official-print-section-title">11. Others</div>
        <table className="official-print-table"><tbody><tr className="official-print-row-tall"><td>{value(data, "others")}</td></tr></tbody></table>
        <div className="official-print-section-title">12. Safety issues</div>
        <table className="official-print-table"><tbody><tr className="official-print-row-xl"><td>{value(data, "safetyIssues")}</td></tr></tbody></table>
        <div className="mt-4">
          Prepared by: <DottedLine text={value(data, "preparedByName")} /> Date: <DottedLine text={value(data, "preparedByDate")} />
          <br />
          Approved by: <DottedLine text={value(data, "approvedByName")} /> Date: <DottedLine text={value(data, "approvedByDate")} />
        </div>
      </PrintPage>
    </PrintLayout>
  );
}
