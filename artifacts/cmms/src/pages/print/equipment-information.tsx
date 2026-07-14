import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { DottedLine, OfficialPrintHeader, PrintLayout, PrintPage } from "./print-layout";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

type EquipmentInformation = Record<string, string | number | null>;

function value(record: EquipmentInformation | undefined, key: string) {
  const item = record?.[key];
  return item === null || item === undefined ? "" : String(item);
}

const labels = {
  en: {
    title: "Equipment Information Record",
    docNumber: "FORM-10-0118-1",
    effectiveDate: "18/3/2023",
    company: "Beit Jala Pharmaceutical Co.",
    address: "Beit Jala, Palestine",
    page: "Page 1 of 1",
    docNo: "Doc. No.:",
    effectiveDateLabel: "Effective Date:",
    f1: "1. Name of equipment",
    f2: "2. Model number",
    f3: "3. Serial number",
    f4: "4. Identification number",
    f5: "5. Date equipment purchased",
    f6a: "6. Company purchased from",
    f6b: "a. Name",
    f6c: "b. Address",
    f7a: "7. Manufacturing company",
    f7b: "a. Name",
    f7c: "b. Address",
    f8: "8. Equipment Dimensions (in cm): Width (W) × Height (H) × Depth (D)",
    f9: "9. Weight (kg)",
    f10: "10. Utilities",
    f10_1: "10.1. Power supply",
    f10_2: "10.2. Air",
    f10_3: "10.3. Water",
    f10_4: "10.4. Other Utilities",
    f11: "11. Others",
    f12: "12. Safety issues",
    preparedBy: "Prepared by:",
    approvedBy: "Approved by:",
    date: "Date:",
    toggleBtn: "عربي",
  },
  ar: {
    title: "سجل معلومات المعدة",
    docNumber: "FORM-10-0118-1",
    effectiveDate: "18/3/2023",
    company: "شركة بيت جالا للصناعات الدوائية",
    address: "بيت جالا، فلسطين",
    page: "صفحة 1 من 1",
    docNo: "رقم الوثيقة:",
    effectiveDateLabel: "تاريخ النفاذ:",
    f1: "1. اسم المعدة",
    f2: "2. رقم الطراز",
    f3: "3. الرقم التسلسلي",
    f4: "4. رقم التعريف",
    f5: "5. تاريخ الشراء",
    f6a: "6. الشركة التي تم الشراء منها",
    f6b: "أ. الاسم",
    f6c: "ب. العنوان",
    f7a: "7. الشركة المصنّعة",
    f7b: "أ. الاسم",
    f7c: "ب. العنوان",
    f8: "8. أبعاد المعدة (بالسم): العرض × الارتفاع × العمق",
    f9: "9. الوزن (كغ)",
    f10: "10. المرافق",
    f10_1: "10.1. مصدر الطاقة",
    f10_2: "10.2. الهواء",
    f10_3: "10.3. الماء",
    f10_4: "10.4. مرافق أخرى",
    f11: "11. أخرى",
    f12: "12. مسائل السلامة",
    preparedBy: "أعدّه:",
    approvedBy: "اعتمده:",
    date: "التاريخ:",
    toggleBtn: "English",
  },
};

export default function EquipmentInformationPrintPage({ params }: { params: { id: string } }) {
  const machineId = Number(params.id);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const L = labels[lang];
  const isAr = lang === "ar";

  const { data } = useQuery({
    queryKey: ["print-equipment-information", machineId],
    queryFn: () => apiRequest<EquipmentInformation>(`/machines/${machineId}/equipment-information`),
  });

  return (
    <div dir={isAr ? "rtl" : "ltr"}>
      {/* Language toggle — hidden when printing */}
      <div className="mx-auto mb-2 flex max-w-[210mm] justify-end print:hidden px-2">
        <Button variant="outline" size="sm" onClick={() => setLang(l => l === "en" ? "ar" : "en")} className="gap-2">
          <Languages className="h-4 w-4" />
          {L.toggleBtn}
        </Button>
      </div>

      <PrintLayout title={L.title}>
        <PrintPage>
          {/* Custom bilingual header */}
          <table className="official-print-table official-print-header-table">
            <tbody>
              <tr>
                <td className={`w-[34%] font-semibold ${isAr ? "text-right" : "text-left"}`}>
                  {L.company}
                  <br />
                  {L.address}
                </td>
                <td className="w-[33%] text-center font-semibold">{L.title}</td>
                <td className={`w-[33%] ${isAr ? "text-right" : "text-left"}`}>
                  <div><strong>{L.docNo}</strong> {L.docNumber}</div>
                  <div><strong>{L.effectiveDateLabel}</strong> {L.effectiveDate}</div>
                  <div><strong>{L.page}</strong></div>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="official-print-table mt-4">
            <tbody>
              {[
                [L.f1, value(data, "nameOfEquipment")],
                [L.f2, value(data, "modelNumber")],
                [L.f3, value(data, "serialNumber")],
                [L.f4, value(data, "identificationNumber")],
                [L.f5, value(data, "datePurchased")],
              ].map(([label, field]) => (
                <tr key={label}>
                  <td className="w-[48%] font-semibold">{label}</td>
                  <td>{field}</td>
                </tr>
              ))}
              <tr className="official-print-row-tall">
                <td className="font-semibold">
                  {L.f6a}<br />{L.f6b}<br />{L.f6c}
                </td>
                <td>
                  {value(data, "purchasedFromName")}<br />{value(data, "purchasedFromAddress")}
                </td>
              </tr>
              <tr className="official-print-row-tall">
                <td className="font-semibold">
                  {L.f7a}<br />{L.f7b}<br />{L.f7c}
                </td>
                <td>
                  {value(data, "manufacturingCompanyName")}<br />{value(data, "manufacturingCompanyAddress")}
                </td>
              </tr>
              <tr>
                <td className="font-semibold">{L.f8}</td>
                <td>
                  {value(data, "dimensionWidthCm")} × {value(data, "dimensionHeightCm")} × {value(data, "dimensionDepthCm")}
                </td>
              </tr>
              <tr>
                <td className="font-semibold">{L.f9}</td>
                <td>{value(data, "weightKg")}</td>
              </tr>
            </tbody>
          </table>

          <div className="official-print-section-title">{L.f10}</div>
          <table className="official-print-table">
            <tbody>
              {[
                [L.f10_1, value(data, "utilitiesPowerSupply")],
                [L.f10_2, value(data, "utilitiesAir")],
                [L.f10_3, value(data, "utilitiesWater")],
                [L.f10_4, value(data, "utilitiesOther")],
              ].map(([label, field]) => (
                <tr key={label} className="official-print-row-tall">
                  <td className="w-[48%] font-semibold">{label}</td>
                  <td>{field}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="official-print-section-title">{L.f11}</div>
          <table className="official-print-table">
            <tbody>
              <tr className="official-print-row-tall">
                <td>{value(data, "others")}</td>
              </tr>
            </tbody>
          </table>

          <div className="official-print-section-title">{L.f12}</div>
          <table className="official-print-table">
            <tbody>
              <tr className="official-print-row-xl">
                <td>{value(data, "safetyIssues")}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4">
            {L.preparedBy} <DottedLine text={value(data, "preparedByName")} /> {L.date} <DottedLine text={value(data, "preparedByDate")} />
            <br />
            {L.approvedBy} <DottedLine text={value(data, "approvedByName")} /> {L.date} <DottedLine text={value(data, "approvedByDate")} />
          </div>
        </PrintPage>
      </PrintLayout>
    </div>
  );
}
