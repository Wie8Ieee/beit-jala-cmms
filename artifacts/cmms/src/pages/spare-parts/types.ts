export type SparePart = {
  id: number;
  partName: string;
  partCode: string;
  description: string | null;
  category: string | null;
  unit: string;
  minimumQuantity: number;
  currentQuantity: number;
  location: string | null;
  status: string;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type SparePartMovement = {
  id: number;
  sparePartId: number;
  movementType: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  movementDate: string;
  reason: string | null;
  referenceType: "PM_RECORD" | "CM_REQUEST" | "MANUAL" | "OTHER";
  referenceId: number | null;
  recordedByUserId: number | null;
  notes: string | null;
  createdAt: string;
};
