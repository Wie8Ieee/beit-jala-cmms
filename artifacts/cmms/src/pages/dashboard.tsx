import { useAuth } from "../contexts/AuthContext";
import { useGetDashboardStats } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  Users,
  Server,
  Building2,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useGetDashboardStats({
    query: {
      enabled: !!user && (user.permissions.includes("view_dashboard") || user.roleName === "Admin" || user.roleName === "Supervisor" || user.roleName === "QA Supervisor"),
    }
  });

  const isAdminOrSupervisor = user?.roleName === "Admin" || user?.roleName === "Supervisor";
  const isTechnician = user?.roleName === "Technician";
  const isEmployee = user?.roleName === "Department Employee";
  const isQA = user?.roleName === "QA Supervisor";

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Colors for charts
  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
  const STATUS_COLORS = {
    'Active': 'hsl(var(--chart-3))', // green-ish
    'Maintenance': 'hsl(var(--chart-4))', // yellow-ish
    'Inactive': 'hsl(var(--chart-2))' // gray-ish
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.fullName || user?.username}. Here's what's happening today.
        </p>
      </div>

      {/* ADMIN & SUPERVISOR VIEW */}
      {(isAdminOrSupervisor || isQA) && stats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-elevate transition-all border-l-4 border-l-primary">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Machines</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalMachines}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-emerald-500 font-medium">{stats.activeMachines} active</span> across {stats.totalDepartments} departments
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.activeUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Out of {stats.totalUsers} total registered
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Departments</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalDepartments}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Monitored facilities
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending PMs</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">12</div>
                <p className="text-xs text-amber-500 font-medium mt-1">
                  Scheduled for this week
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Equipment by Department</CardTitle>
                <CardDescription>
                  Distribution of machines across company facilities
                </CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.machinesByDepartment} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <XAxis 
                        dataKey="label" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <RechartsTooltip 
                        cursor={{fill: 'hsl(var(--muted)/0.5)'}}
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {stats.machinesByDepartment.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Equipment Status</CardTitle>
                <CardDescription>
                  Current operational state of all machines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.machinesByStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="count"
                        nameKey="label"
                        label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {stats.machinesByStatus.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={STATUS_COLORS[entry.label as keyof typeof STATUS_COLORS] || COLORS[index % COLORS.length]} 
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                         contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {stats.machinesByStatus.map((status) => (
                    <div key={status.label} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status.label as keyof typeof STATUS_COLORS] || COLORS[0] }} />
                      <span className="text-muted-foreground">{status.label} ({status.count})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  Maintenance Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <p>Module coming in phase 2</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-amber-500" />
                  This Week's PMs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Activity className="h-6 w-6" />
                  </div>
                  <p>Module coming in phase 2</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p>Module coming in phase 2</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* TECHNICIAN VIEW */}
      {isTechnician && (
        <div className="grid gap-4 md:grid-cols-2">
           <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4 text-primary" />
                  Assigned Work Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg border-muted">
                  <AlertTriangle className="h-8 w-8 mb-3 text-muted-foreground/50" />
                  <p>Work order assignment coming in phase 2.</p>
                  <p className="text-sm mt-1">Please refer to paper assignments for now.</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Preventive Maintenance (This Week)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg border-muted">
                  <Activity className="h-8 w-8 mb-3 text-muted-foreground/50" />
                  <p>PM Scheduling coming in phase 2.</p>
                </div>
              </CardContent>
            </Card>
        </div>
      )}

      {/* DEPARTMENT EMPLOYEE VIEW */}
      {isEmployee && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-primary/5 border-primary/20 shadow-sm col-span-full md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Report Equipment Issue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-muted-foreground">
                  Submit a new corrective maintenance request if you notice equipment malfunction.
                </p>
                <div className="w-full p-4 border rounded bg-background text-sm text-center text-muted-foreground">
                  Form module coming in phase 2
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                My Recent Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg border-muted">
                <p>Request tracking coming in phase 2</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
