export type MaintenanceRequestSummary = {
  id: number;
  requestReportNumber: string;
  machineId: number;
  machineName: string;
  machineNumber: string;
  departmentSection: string | null;
  priority: string;
  requestDate: string;
  failureDescription: string;
  status: string;
  assignedTechnicianUserId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PerformingStaff = {
  no?: string;
  name?: string;
  signature?: string;
};

export type CorrectiveMaintenanceEvent = {
  id: number;
  recordId: number;
  requestId: number;
  machineId: number;
  requestReportNumber: string;
  rowNumber: number;
  preliminaryCheckResults: string | null;
  technicianName: string | null;
  maintenanceTechnicianSignature: string | null;
  concernedSectionSupervisorSignature: string | null;
  actionsTaken: string | null;
  remarksRecommendations: string | null;
  performingStaff: PerformingStaff[];
  receiverName: string | null;
  receiverSignature: string | null;
  handoverDate: string | null;
  engineeringSignature: string | null;
  completedAt: string | null;
};

export type MaintenanceRequestDetail = {
  request: MaintenanceRequestSummary;
  requestedByUserId: number;
  departmentId: number | null;
  reportingPersonName: string | null;
  reportingPersonSignature: string | null;
  departmentSupervisorName: string | null;
  departmentSupervisorSignature: string | null;
  qaDecision: string | null;
  qaSupervisorSignature: string | null;
  qaReviewDate: string | null;
  qaReviewNotes: string | null;
  engineeringDecision: string | null;
  assignedTechnicianUserId: number | null;
  engineeringSupervisorSignature: string | null;
  engineeringReviewNotes: string | null;
  expectedWorkTimeFrom: string | null;
  expectedWorkTimeTo: string | null;
  correctiveEvent: CorrectiveMaintenanceEvent | null;
  statusHistory: Array<{
    id: number;
    fromStatus: string | null;
    toStatus: string;
    notes: string | null;
    createdAt: string;
  }>;
};

export type CorrectiveMaintenanceRecord = {
  id: number;
  machineId: number;
  sequenceNumber: number;
  documentNumber: string;
  executionDate: string | null;
  pageCount: string;
  machineName: string;
  machineNumber: string;
  machineLocation: string | null;
  startupDate: string | null;
  maxRows: number;
  status: string;
  events: CorrectiveMaintenanceEvent[];
};
