import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  useGetMachine, 
  getGetMachineQueryKey 
} from "@workspace/api-client-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, FileText, Settings2, Wrench, History, AlertCircle, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import type { MaintenanceRequestSummary } from "../maintenance-requests/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type MachineHistoryEntry = {
  id: number;
  action: string;
  details: unknown;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  userName: string;
};

function historyDetails(entry: MachineHistoryEntry) {
  const value = entry.details ?? entry.newValue ?? entry.oldValue;
  return value ? JSON.stringify(value) : "-";
}

export default function MachineProfile({ params }: { params: { id: string } }) {
  const machineId = parseInt(params.id, 10);
  const { hasPermission } = useAuth();
  const canViewEquipment = hasPermission("view_equipment_information");
  const canViewPm = hasPermission("view_pm_records") || hasPermission("fill_pm_record");
  const canViewCm = hasPermission("view_corrective_maintenance");
  const canViewHistory = hasPermission("view_machine_maintenance_history");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: machine, isLoading, isError } = useGetMachine(machineId, {
    query: {
      enabled: !!machineId,
      queryKey: getGetMachineQueryKey(machineId)
    }
  });
  const { data: nextPm } = useQuery({
    queryKey: ["machine-next-pm", machineId],
    queryFn: () => apiRequest<{ nextPmDate: string | null; source: "monthly" | "annual" | null; isDue?: boolean }>(`/machines/${machineId}/next-pm`),
    enabled: !!machineId && canViewPm,
  });
  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ["machine-maintenance-requests", machineId],
    queryFn: () => apiRequest<MaintenanceRequestSummary[]>("/maintenance-requests?scope=all"),
    enabled: !!machineId && canViewCm,
  });
  const { data: machineHistory = [], isLoading: isHistoryLoading } = useQuery({
    queryKey: ["machine-history", machineId],
    queryFn: () => apiRequest<MachineHistoryEntry[]>(`/machines/${machineId}/history`),
    enabled: !!machineId && canViewHistory,
  });
  const softDeleteMachine = useMutation({
    mutationFn: () => apiRequest(`/machines/${machineId}/soft-delete`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/machines"] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      setLocation("/machines");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-8">
              <Skeleton className="h-32 w-32 rounded-lg" />
              <div className="space-y-4 flex-1">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <div className="flex gap-4">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !machine) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive opacity-50" />
        <h2 className="text-2xl font-bold tracking-tight">Machine Not Found</h2>
        <p className="text-muted-foreground">The requested machine could not be loaded.</p>
        <Button asChild variant="outline">
          <Link href="/machines">Return to Machines</Link>
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 px-3 py-1 text-sm">Active</Badge>;
      case "Maintenance":
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20 px-3 py-1 text-sm">Maintenance</Badge>;
      case "Inactive":
        return <Badge variant="secondary" className="px-3 py-1 text-sm">Inactive</Badge>;
      default:
        return <Badge variant="outline" className="px-3 py-1 text-sm">{status}</Badge>;
    }
  };

  const nextPmDisplay = (() => {
    if (!nextPm?.nextPmDate) return null;
    const target = new Date(`${nextPm.nextPmDate}T00:00:00`);
    const today = new Date();
    const sameMonth = target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
    const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const days = Math.max(0, Math.ceil((monthStart.getTime() - todayStart.getTime()) / 86_400_000));
    return {
      date: target.toLocaleDateString(),
      status: nextPm.isDue || sameMonth ? "Due" : `${days} days until month start`,
    };
  })();

  const openMaintenanceRequests = maintenanceRequests.filter((request) =>
    request.machineId === machineId &&
    !["closed", "completed"].includes(request.status.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/machines">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{machine.machineName}</h1>
            {getStatusBadge(machine.status)}
          </div>
          <p className="text-muted-foreground font-mono mt-1">ID: {machine.machineNumber}</p>
        </div>
        
        {hasPermission("edit_machine") && (
          <Button asChild variant="outline" className="shadow-sm">
            <Link href={`/machines/${machine.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Details
            </Link>
          </Button>
        )}
        {hasPermission("soft_delete_machine") && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="shadow-sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Machine
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this machine?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will archive {machine.machineName} ({machine.machineNumber}) and remove it from the active machine list. Its historical records will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => softDeleteMachine.mutate()}
                  disabled={softDeleteMachine.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {softDeleteMachine.isPending ? "Deleting…" : "Delete Machine"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card className="overflow-hidden border-primary/20 border-t-4 border-t-primary shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</h3>
                <p className="text-lg font-semibold leading-snug">{machine.departmentName || "Unassigned"}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</h3>
                <p className="text-lg font-semibold leading-snug">{machine.location || "—"}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 sm:col-span-2 lg:col-span-1">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">PM Frequency</h3>
                <p className="text-lg font-semibold leading-snug">{machine.pmFrequencyMonths ? `Every ${machine.pmFrequencyMonths} Months` : "Not scheduled"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-5">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Quick Stats</h3>
              <div className="space-y-3">
                {openMaintenanceRequests.length > 0 && (
                  <Link
                    href="/maintenance-requests"
                    className="group flex items-center justify-between border-b border-primary/10 pb-3 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-primary">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                      Maintenance requests
                    </span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                      View
                      <Badge className="min-w-6 justify-center bg-red-500 px-1.5 text-white hover:bg-red-500">{openMaintenanceRequests.length}</Badge>
                    </span>
                  </Link>
                )}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-muted-foreground">Next PM</span>
                  {nextPmDisplay ? <span className="text-right"><span className="block font-mono text-xl font-bold leading-tight text-primary">{nextPmDisplay.date}</span><span className={`mt-1 block text-sm font-medium ${nextPmDisplay.status === "Due" ? "text-amber-600" : "text-muted-foreground"}`}>{nextPmDisplay.status}</span></span> : <span className="font-mono text-sm font-medium text-muted-foreground">Not scheduled</span>}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={canViewEquipment ? "equipment-info" : canViewPm ? "pm" : canViewCm ? "cm" : canViewHistory ? "history" : "equipment-info"} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
          {canViewEquipment && <TabsTrigger 
            value="equipment-info" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-3 px-1 data-[state=active]:bg-transparent"
          >
            <FileText className="mr-2 h-4 w-4" />
            Equipment Information Record
          </TabsTrigger>}
          {canViewPm && <TabsTrigger 
            value="pm" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-3 px-1 data-[state=active]:bg-transparent"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Preventive Maintenance
          </TabsTrigger>}
          {canViewCm && <TabsTrigger 
            value="cm" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-3 px-1 data-[state=active]:bg-transparent"
          >
            <Wrench className="mr-2 h-4 w-4" />
            Corrective Maintenance
          </TabsTrigger>}
          {canViewHistory && <TabsTrigger 
            value="history" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-3 px-1 data-[state=active]:bg-transparent"
          >
            <History className="mr-2 h-4 w-4" />
            Maintenance History
          </TabsTrigger>}
        </TabsList>

        <div className="mt-6">
          {canViewEquipment && <TabsContent value="equipment-info" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>Equipment Information Record (FORM-10-0118)</CardTitle>
                  <CardDescription>Official master record of machine specifications and manufacturer details.</CardDescription>
                </div>
                <Button asChild className="shrink-0">
                  <Link href={`/machines/${machine.id}/equipment-information`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Open Form
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="p-8 border-2 border-dashed rounded-lg bg-muted/20 text-center flex flex-col items-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h4 className="text-lg font-medium text-foreground mb-1">Equipment Master Record</h4>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Click "Open Form" to view or edit the full FORM-10-0118 specification sheet for this machine.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>}

          {canViewPm && <TabsContent value="pm" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <Card>
              <CardHeader>
                <CardTitle>Preventive Maintenance</CardTitle>
                <CardDescription>Machine PM record, checklist points, and preserved record history.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <Button asChild>
                  <Link href={`/machines/${machine.id}/pm`}>
                    <Settings2 className="mr-2 h-4 w-4" />
                    Open PM Record
                  </Link>
                </Button>
                {hasPermission("manage_pm_checklist") && (
                  <Button asChild variant="outline">
                    <Link href={`/machines/${machine.id}/pm/checklist`}>Manage Checklist</Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link href={`/machines/${machine.id}/pm/history`}>View PM History</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>}

          {canViewCm && <TabsContent value="cm" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <Card>
              <CardHeader>
                <CardTitle>Corrective Maintenance</CardTitle>
                <CardDescription>Linked Maintenance Requests and LOG-00-0102-3 corrective maintenance history.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Button asChild>
                  <Link href={`/machines/${machine.id}/corrective-maintenance`}>
                    <Wrench className="mr-2 h-4 w-4" />
                    Open CM Record
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/maintenance-requests">Maintenance Requests</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>}

          {canViewHistory && <TabsContent value="history" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance History</CardTitle>
                <CardDescription>All recorded changes and updates for this machine.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {isHistoryLoading ? <p className="text-muted-foreground">Loading history...</p> : machineHistory.length === 0 ? <p className="text-muted-foreground">No changes have been recorded for this machine yet.</p> : (
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b text-left text-muted-foreground">
                      <tr><th className="px-3 py-2 font-medium">Date and time</th><th className="px-3 py-2 font-medium">User</th><th className="px-3 py-2 font-medium">Change</th><th className="px-3 py-2 font-medium">Details</th></tr>
                    </thead>
                    <tbody>
                      {machineHistory.map((entry) => <tr key={entry.id} className="border-b align-top">
                        <td className="whitespace-nowrap px-3 py-3">{new Date(entry.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-3">{entry.userName}</td>
                        <td className="px-3 py-3 font-medium">{entry.action.replaceAll("_", " ")}</td>
                        <td className="max-w-xl break-words px-3 py-3 text-muted-foreground">{historyDetails(entry)}</td>
                      </tr>)}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>}
        </div>
      </Tabs>
    </div>
  );
}
