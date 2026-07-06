import { Link, useLocation } from "wouter";
import { 
  useGetMachine, 
  getGetMachineQueryKey 
} from "@workspace/api-client-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, FileText, Settings2, Wrench, History, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MachineProfile({ params }: { params: { id: string } }) {
  const machineId = parseInt(params.id, 10);
  const { hasPermission } = useAuth();
  
  const { data: machine, isLoading, isError } = useGetMachine(machineId, {
    query: {
      enabled: !!machineId,
      queryKey: getGetMachineQueryKey(machineId)
    }
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
      </div>

      <Card className="border-t-4 border-t-primary shadow-md">
        <CardContent className="p-6 md:p-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-6 md:col-span-2">
              <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                <div>
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-1">Department</h3>
                  <p className="font-medium text-lg">{machine.departmentName || "Unassigned"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-1">Location</h3>
                  <p className="font-medium text-lg">{machine.location || "—"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-1">PM Frequency</h3>
                  <p className="font-medium text-lg">{machine.pmFrequencyMonths ? `Every ${machine.pmFrequencyMonths} Months` : "Not scheduled"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-1">PM Start Date</h3>
                  <p className="font-medium text-lg">
                    {machine.pmStartDate ? new Date(machine.pmStartDate).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-muted/30 p-6 rounded-xl border flex flex-col justify-center">
               <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-4">Quick Stats</h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-center border-b pb-2">
                   <span className="text-muted-foreground">Uptime</span>
                   <span className="font-mono font-medium">98.2%</span>
                 </div>
                 <div className="flex justify-between items-center border-b pb-2">
                   <span className="text-muted-foreground">Open WOs</span>
                   <span className="font-mono font-medium text-amber-600">0</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-muted-foreground">Next PM</span>
                   <span className="font-mono font-medium text-primary">In 14 days</span>
                 </div>
               </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="equipment-info" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
          <TabsTrigger 
            value="equipment-info" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-3 px-1 data-[state=active]:bg-transparent"
          >
            <FileText className="mr-2 h-4 w-4" />
            Equipment Information Record
          </TabsTrigger>
          <TabsTrigger 
            value="pm" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-3 px-1 data-[state=active]:bg-transparent"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Preventive Maintenance
          </TabsTrigger>
          <TabsTrigger 
            value="cm" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-3 px-1 data-[state=active]:bg-transparent"
          >
            <Wrench className="mr-2 h-4 w-4" />
            Corrective Maintenance
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none py-3 px-1 data-[state=active]:bg-transparent"
          >
            <History className="mr-2 h-4 w-4" />
            Maintenance History
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="equipment-info" className="m-0 focus-visible:outline-none focus-visible:ring-0">
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
          </TabsContent>

          <TabsContent value="pm" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <Card>
<<<<<<< HEAD
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
=======
              <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <Settings2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">Preventive Maintenance</h3>
                <p className="text-muted-foreground mt-1">PM scheduling and checklists coming in a later phase.</p>
>>>>>>> e104d08dacfdefa360f88cd205b4f478d084c939
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cm" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <Card>
<<<<<<< HEAD
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
=======
              <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">Corrective Maintenance</h3>
                <p className="text-muted-foreground mt-1">Work orders and break-fix tracking coming in a later phase.</p>
>>>>>>> e104d08dacfdefa360f88cd205b4f478d084c939
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="m-0 focus-visible:outline-none focus-visible:ring-0">
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 text-center">
                <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">Maintenance History</h3>
                <p className="text-muted-foreground mt-1">Historical logs and reporting coming in a later phase.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
