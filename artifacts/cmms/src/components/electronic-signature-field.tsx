import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Lock, UserPlus, X } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Signature = {
  id: number;
  documentType: string;
  documentId: number;
  fieldName: string;
  signatureType: string;
  userId: number;
  userName: string;
  signedAt: string;
};

type EligibleSignerAssignment = {
  id: number;
  documentType: string;
  documentId: number;
  fieldName: string;
  eligibleUserId: number;
  eligibleUserName: string | null;
  revokedAt: string | null;
};

type ElectronicSignatureFieldProps = {
  documentType: string;
  documentId: number;
  fieldName: string;
  label: string;
  signatureType?: string;
};

export function ElectronicSignatureField({
  documentType,
  documentId,
  fieldName,
  label,
  signatureType = "electronic",
}: ElectronicSignatureFieldProps) {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [eligibleUserId, setEligibleUserId] = useState("");
  const normalizedDocumentType = documentType.toUpperCase();
  const query = `documentType=${encodeURIComponent(normalizedDocumentType)}&documentId=${documentId}`;
  const signaturesKey = ["signatures", normalizedDocumentType, documentId];
  const eligibleKey = ["eligible-signers", normalizedDocumentType, documentId];

  const { data: signatures = [] } = useQuery({
    queryKey: signaturesKey,
    queryFn: () => apiRequest<Signature[]>(`/signatures?${query}`),
    enabled: Number.isFinite(documentId) && documentId > 0,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: eligibleKey,
    queryFn: () => apiRequest<EligibleSignerAssignment[]>(`/signatures/eligible?${query}`),
    enabled: Number.isFinite(documentId) && documentId > 0,
  });

  const signature = signatures.find((item) => item.fieldName === fieldName);
  const activeAssignments = assignments.filter((item) => item.fieldName === fieldName && !item.revokedAt);
  const canManage = hasPermission("manage_signatures");
  const canSign = useMemo(
    () =>
      !signature &&
      hasPermission("sign_assigned_fields") &&
      activeAssignments.some((item) => item.eligibleUserId === user?.id),
    [activeAssignments, hasPermission, signature, user?.id],
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: signaturesKey }),
      queryClient.invalidateQueries({ queryKey: eligibleKey }),
    ]);
  };

  const signMutation = useMutation({
    mutationFn: () =>
      apiRequest<Signature>("/signatures/sign", {
        method: "POST",
        body: JSON.stringify({
          documentType: normalizedDocumentType,
          documentId,
          fieldName,
          signatureType,
        }),
      }),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Signed", description: `${label} was signed electronically.` });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Signature failed", description: error instanceof Error ? error.message : "Unable to sign field." });
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      apiRequest<EligibleSignerAssignment>("/signatures/eligible", {
        method: "POST",
        body: JSON.stringify({
          documentType: normalizedDocumentType,
          documentId,
          fieldName,
          eligibleUserId: Number(eligibleUserId),
        }),
      }),
    onSuccess: async () => {
      setEligibleUserId("");
      await invalidate();
      toast({ title: "Eligible signer assigned", description: "The user can now sign this field." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Assignment failed", description: error instanceof Error ? error.message : "Unable to assign signer." });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (assignmentId: number) =>
      apiRequest<EligibleSignerAssignment>(`/signatures/eligible/${assignmentId}/revoke`, {
        method: "PATCH",
      }),
    onSuccess: invalidate,
  });

  return (
    <div className="rounded-md border border-black/20 bg-white p-3 text-black print:border-black">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="font-semibold">{label}</Label>
          {signature ? (
            <div className="mt-2 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-700" />
                {signature.userName}
              </div>
              <div className="mt-1 text-xs text-muted-foreground print:text-black">
                Signed {new Date(signature.signedAt).toLocaleString()} · Immutable
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground print:text-black">
              <Lock className="h-4 w-4" />
              Awaiting eligible electronic signature
            </div>
          )}
        </div>
        {signature && <Badge variant="secondary">Signed</Badge>}
        {!signature && canSign && (
          <Button type="button" size="sm" onClick={() => signMutation.mutate()} disabled={signMutation.isPending} className="print:hidden">
            <KeyRound className="mr-2 h-4 w-4" />
            Sign
          </Button>
        )}
      </div>

      {canManage && !signature && (
        <div className="mt-3 space-y-2 border-t pt-3 print:hidden">
          <div className="flex gap-2">
            <Input
              value={eligibleUserId}
              onChange={(event) => setEligibleUserId(event.target.value)}
              placeholder="Eligible user ID"
              inputMode="numeric"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => assignMutation.mutate()}
              disabled={!Number(eligibleUserId) || assignMutation.isPending}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Assign
            </Button>
          </div>
          {activeAssignments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeAssignments.map((assignment) => (
                <Badge key={assignment.id} variant="outline" className="gap-1">
                  {assignment.eligibleUserName ?? `User #${assignment.eligibleUserId}`}
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate(assignment.id)}
                    aria-label="Revoke eligible signer"
                    className="ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
