import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, BriefcaseBusiness, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Role = { id: number; name: string; description: string | null };

export default function RolesPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roles = [], isLoading } = useQuery({ queryKey: ["roles"], queryFn: () => apiRequest<Role[]>("/roles") });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["roles"] });
  const create = useMutation({
    mutationFn: () => apiRequest<Role>("/roles", { method: "POST", body: JSON.stringify({ name: name.trim(), description: description.trim() }) }),
    onSuccess: (role) => { setName(""); setDescription(""); invalidate(); toast({ title: "Role added", description: `${role.name} is now available when creating a user.` }); },
    onError: (error) => toast({ variant: "destructive", title: "Could not add role", description: error instanceof Error ? error.message : "Try again." }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiRequest<{ id: number }>(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Role deleted" }); },
    onError: (error) => toast({ variant: "destructive", title: "Could not delete role", description: error instanceof Error ? error.message : "Try again." }),
  });

  return <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
    <div><Link href="/admin/users"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back to users</Button></Link><h1 className="mt-2 text-3xl font-bold">Job Roles</h1><p className="text-muted-foreground">Add job titles here, then choose the employee's department separately when creating their account.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5" />Add job role</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Production Engineer" /><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" /><Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}><Plus className="mr-2 h-4 w-4" />Add</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Saved roles</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-muted-foreground">Loading...</p> : <div className="divide-y rounded-md border">{roles.map((role) => <div key={role.id} className="flex items-center justify-between gap-3 p-3"><div><p className="font-medium">{role.name}</p>{role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}</div><Button variant="ghost" size="icon" onClick={() => remove.mutate(role.id)} disabled={remove.isPending} title="Delete role"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}</CardContent></Card>
  </div>;
}
