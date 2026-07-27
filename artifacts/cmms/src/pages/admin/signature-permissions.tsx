import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const formFields = {
  MAINTENANCE_REQUEST: [
    ["reporting_person", "Person reporting failure"],
    ["department_supervisor", "Department supervisor"],
    ["qa_supervisor_approval", "QA supervisor approval"],
    ["engineering_supervisor_approval", "Engineering supervisor approval"],
  ],
  CORRECTIVE_MAINTENANCE: [
    ["maintenance_technician", "Maintenance technician"],
    ["concerned_section_supervisor", "Concerned section supervisor"],
    ["receiver", "Machine receiver"],
    ["engineering_final", "Engineering final approval"],
  ],
  PM_RECORD: [
    ["examiner", "Examiner"],
    ["machine_receiver", "Machine receiver"],
  ],
  EQUIPMENT_INFORMATION: [
    ["prepared_by", "Prepared by"],
    ["approved_by", "Approved by"],
  ],
  MONTHLY_PLAN: [
    ["prepared_by", "Prepared by"],
    ["maintenance_supervisor", "Maintenance supervisor"],
    ["department_manager", "Department manager"],
    ["approved_by", "Approved by"],
  ],
  ANNUAL_PLAN: [
    ["prepared_by", "Prepared by"],
    ["engineering_manager", "Engineering manager"],
    ["production_manager", "Production manager"],
    ["qc_manager", "QC manager"],
    ["rd_manager", "R&D manager"],
    ["qa_manager", "QA manager"],
  ],
} as const;

type FormType = keyof typeof formFields;
type Permission = { id: number; documentType: FormType; fieldName: string; eligibleUserId: number; eligibleUserName: string | null };

export default function SignaturePermissionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [documentType, setDocumentType] = useState<FormType>("MAINTENANCE_REQUEST");
  const [fieldName, setFieldName] = useState<string>(formFields.MAINTENANCE_REQUEST[0][0]);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const { data: permissions = [] } = useQuery({ queryKey: ["signature-field-permissions-admin"], queryFn: () => apiRequest<Permission[]>("/signatures/field-permissions") });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["signature-field-permissions-admin"] });
  const add = useMutation({
    mutationFn: () => apiRequest<Permission>("/signatures/field-permissions", { method: "POST", body: JSON.stringify({ documentType, fieldName, employeeNumber }) }),
    onSuccess: () => { setEmployeeNumber(""); invalidate(); toast({ title: "Signer permission saved", description: "This user can now sign this field on every new and existing matching form." }); },
    onError: (error) => toast({ variant: "destructive", title: "Could not save permission", description: error instanceof Error ? error.message : "Try again." }),
  });
  const revoke = useMutation({ mutationFn: (id: number) => apiRequest(`/signatures/field-permissions/${id}/revoke`, { method: "PATCH" }), onSuccess: invalidate });
  const selectForm = (value: FormType) => { setDocumentType(value); setFieldName(formFields[value][0][0]); };
  const labelFor = (type: FormType, field: string) => formFields[type].find(([key]) => key === field)?.[1] ?? field;

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
    <div><Link href="/admin/users"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back to users</Button></Link><h1 className="mt-2 text-3xl font-bold">Signature Permissions</h1><p className="text-muted-foreground">Configure once which employees may sign each form field. These permissions apply automatically to all matching documents.</p></div>
    <section className="rounded-lg border bg-card p-5"><h2 className="mb-4 text-lg font-semibold">Allow a signer</h2><div className="grid gap-4 md:grid-cols-4"><div><Label>Form</Label><Select value={documentType} onValueChange={(value) => selectForm(value as FormType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.keys(formFields).map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div><div><Label>Signature field</Label><Select value={fieldName} onValueChange={setFieldName}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{formFields[documentType].map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div><div><Label>Employee number</Label><Input value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} placeholder="EMP-0001" /></div><div className="flex items-end"><Button onClick={() => add.mutate()} disabled={!employeeNumber.trim() || add.isPending}><Plus className="mr-2 h-4 w-4" />Allow signature</Button></div></div></section>
    <section className="overflow-hidden rounded-lg border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">Form</th><th className="p-3">Signature field</th><th className="p-3">Allowed employee</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{permissions.map((permission) => <tr key={permission.id} className="border-t"><td className="p-3">{permission.documentType.replaceAll("_", " ")}</td><td className="p-3">{labelFor(permission.documentType, permission.fieldName)}</td><td className="p-3">{permission.eligibleUserName ?? `User #${permission.eligibleUserId}`}</td><td className="p-3 text-right"><Button size="icon" variant="ghost" onClick={() => revoke.mutate(permission.id)} title="Remove permission"><Trash2 className="h-4 w-4 text-destructive" /></Button></td></tr>)}{permissions.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No permanent signature permissions have been configured yet.</td></tr>}</tbody></table></section>
  </div>;
}
