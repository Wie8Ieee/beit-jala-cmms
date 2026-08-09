import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Lock } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/signature-pad";

type Signature = {
  id: number;
  documentType: string;
  documentId: number;
  fieldName: string;
  signatureType: string;
  userId: number;
  userName: string;
  signedAt: string;
  signatureData: string | null;
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

type SignatureFieldPermission = {
  id: number;
  documentType: string;
  fieldName: string;
  eligibleUserId: number;
  eligibleUserName: string | null;
};

type ElectronicSignatureFieldProps = {
  documentType: string;
  documentId: number;
  fieldName: string;
  permissionFieldName?: string;
  label: string;
  signatureType?: string;
};

export function ElectronicSignatureField({
  documentType,
  documentId,
  fieldName,
  permissionFieldName,
  label,
  signatureType = "electronic",
}: ElectronicSignatureFieldProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawnSignature, setDrawnSignature] = useState("");
  const normalizedDocumentType = documentType.toUpperCase();
  const authorizationFieldName = permissionFieldName ?? fieldName;
  const query = `documentType=${encodeURIComponent(normalizedDocumentType)}&documentId=${documentId}`;
  const signaturesKey = ["signatures", normalizedDocumentType, documentId];
  const eligibleKey = ["eligible-signers", normalizedDocumentType, documentId];
  const permanentKey = ["signature-field-permissions", normalizedDocumentType, authorizationFieldName];

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
  const { data: permanentPermissions = [] } = useQuery({
    queryKey: permanentKey,
    queryFn: () => apiRequest<SignatureFieldPermission[]>(`/signatures/field-permissions?documentType=${encodeURIComponent(normalizedDocumentType)}&fieldName=${encodeURIComponent(authorizationFieldName)}`),
    enabled: Number.isFinite(documentId) && documentId > 0,
  });
  const { data: profile } = useQuery({ queryKey: ["signature-profile"], queryFn: () => apiRequest<{ signatureData: string | null }>("/signatures/profile") });

  const signature = signatures.find((item) => item.fieldName === fieldName);
  const activeAssignments = assignments.filter((item) => (item.fieldName === fieldName || item.fieldName === authorizationFieldName) && !item.revokedAt);
  const canSign = useMemo(
    () =>
      !signature &&
      (activeAssignments.some((item) => item.eligibleUserId === user?.id) || permanentPermissions.some((item) => item.eligibleUserId === user?.id)),
    [activeAssignments, permanentPermissions, signature, user?.id],
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: signaturesKey }),
      queryClient.invalidateQueries({ queryKey: eligibleKey }),
      queryClient.invalidateQueries({ queryKey: permanentKey }),
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
          authorizationFieldName,
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
  const saveProfileMutation = useMutation({
    mutationFn: () => apiRequest<{ signatureData: string }>("/signatures/profile", { method: "PUT", body: JSON.stringify({ signatureData: drawnSignature }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["signature-profile"] }); setProfileOpen(false); signMutation.mutate(); },
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
            <div className="mt-2 space-y-1 text-sm text-muted-foreground print:text-black">
              <div className="flex items-center gap-2"><Lock className="h-4 w-4" />Awaiting eligible electronic signature</div>
              {!canSign && <p className="text-xs print:hidden">يجب أن يمنح المسؤول هذا المستخدم صلاحية هذا التوقيع من صفحة صلاحيات التواقيع.</p>}
            </div>
          )}
        </div>
        {signature && <Badge variant="secondary">Signed</Badge>}
        {!signature && canSign && (
          <Button type="button" size="sm" onClick={() => profile?.signatureData ? signMutation.mutate() : setProfileOpen(true)} disabled={signMutation.isPending} className="print:hidden">
            <KeyRound className="mr-2 h-4 w-4" />
            Sign
          </Button>
        )}
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}><DialogContent><DialogHeader><DialogTitle>ارسم توقيعك الإلكتروني</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">يُحفظ التوقيع في حسابك ويُستخدم عند اعتماد التوقيعات الإلكترونية.</p><SignaturePad onChange={setDrawnSignature} /><Button onClick={() => saveProfileMutation.mutate()} disabled={!drawnSignature || saveProfileMutation.isPending}>حفظ التوقيع والاعتماد</Button></DialogContent></Dialog>
    </div>
  );
}
