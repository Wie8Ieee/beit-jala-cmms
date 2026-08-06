import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Building2, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Department = { id: number; name: string };

export default function DepartmentsPage() {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: departments = [], isLoading } = useQuery({ queryKey: ["departments"], queryFn: () => apiRequest<Department[]>("/departments") });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["departments"] });
  const create = useMutation({
    mutationFn: () => apiRequest<Department>("/departments", { method: "POST", body: JSON.stringify({ name: name.trim() }) }),
    onSuccess: (department) => { setName(""); invalidate(); toast({ title: "Department added", description: `${department.name} can now be selected for users and machines.` }); },
    onError: (error) => toast({ variant: "destructive", title: "Could not add department", description: error instanceof Error ? error.message : "Try again." }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiRequest<{ id: number }>(`/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast({ title: "Department deleted" }); },
    onError: (error) => toast({ variant: "destructive", title: "Could not delete department", description: error instanceof Error ? error.message : "Try again." }),
  });

  return <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
    <div><Link href="/admin/users"><Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Back to users</Button></Link><h1 className="mt-2 text-3xl font-bold">Departments</h1><p className="text-muted-foreground">Add department names once, then select them for users and machines.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Add department</CardTitle></CardHeader><CardContent><div className="flex gap-2"><Input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); create.mutate(); } }} placeholder="e.g. Engineering & Maintenance" /><Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}><Plus className="mr-2 h-4 w-4" />Add</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Saved departments</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-muted-foreground">Loading...</p> : departments.length === 0 ? <p className="text-muted-foreground">No departments yet.</p> : <div className="divide-y rounded-md border">{departments.map((department) => <div key={department.id} className="flex items-center justify-between p-3"><span>{department.name}</span><Button variant="ghost" size="icon" onClick={() => remove.mutate(department.id)} disabled={remove.isPending} title="Delete department"><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}</CardContent></Card>
  </div>;
}
