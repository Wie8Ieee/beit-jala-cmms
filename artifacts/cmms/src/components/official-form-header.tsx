type OfficialFormHeaderProps = {
  documentName: string;
  documentNumber: string;
  effectiveOrExecutionDate?: string | null;
  page?: string;
  machineName?: string | null;
  machineNumber?: string | null;
  machineLocation?: string | null;
  startupDate?: string | null;
};

export function OfficialFormHeader({
  documentName,
  documentNumber,
  effectiveOrExecutionDate,
  page = "Page 1 of 1",
  machineName,
  machineNumber,
  machineLocation,
  startupDate,
}: OfficialFormHeaderProps) {
  const hasMachineBlock = machineName || machineNumber || machineLocation || startupDate;

  return (
    <div className="official-form-header mb-6 border-2 border-black text-black">
      <div className="grid grid-cols-[1fr_2fr_1fr] divide-x-2 divide-black">
        <div className="flex items-center justify-center p-3 text-center font-bold">
          Beit Jala Pharmaceutical Co.
        </div>
        <div className="p-3 text-center">
          <div className="text-lg font-bold uppercase">{documentName}</div>
          {effectiveOrExecutionDate && (
            <div className="mt-1 text-xs font-medium">Effective / Execution Date: {effectiveOrExecutionDate}</div>
          )}
        </div>
        <div className="p-3 text-sm">
          <div><span className="font-semibold">Doc No:</span> {documentNumber}</div>
          <div><span className="font-semibold">Page:</span> {page}</div>
        </div>
      </div>
      {hasMachineBlock && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t-2 border-black p-3 text-sm">
          {machineName && <div><span className="font-semibold">Machine name:</span> {machineName}</div>}
          {machineNumber && <div><span className="font-semibold">Machine number:</span> {machineNumber}</div>}
          {machineLocation && <div><span className="font-semibold">Machine location:</span> {machineLocation}</div>}
          {startupDate && <div><span className="font-semibold">Start-up date:</span> {startupDate}</div>}
        </div>
      )}
    </div>
  );
}
