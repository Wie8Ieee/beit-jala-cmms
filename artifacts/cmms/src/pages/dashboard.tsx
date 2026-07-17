import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getGetDashboardStatsQueryKey, useGetDashboardStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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
  Clock,
  Package,
  Bell,
  X,
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
  const { t } = useTranslation();
  const [selectedPmSegment, setSelectedPmSegment] = useState<"Completed" | "Overdue / Not Completed" | null>(null);
  const { data: stats, isLoading } = useGetDashboardStats({
    query: {
      queryKey: getGetDashboardStatsQueryKey(),
      enabled: !!user && (user.permissions.includes("view_dashboard") || user.roleName === "Admin" || user.roleName === "Maintenance Supervisor" || user.roleName === "Maintenance Technician" || user.roleName === "QA Supervisor"),
    }
  });

  const isAdminOrSupervisor = user?.roleName === "Admin" || user?.roleName === "Maintenance Supervisor";
  const isTechnician = user?.roleName === "Maintenance Technician";
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

  type MachineRef = { id: number; machineId: number; machineName: string; machineNumber: string };
  const pmStats = stats as typeof stats & {
    thisWeekPm?: Array<{
      id: number;
      machineId: number;
      machineName: string;
      machineNumber: string;
      plannedDateFrom: string | null;
      plannedDateTo: string | null;
      status: string;
    }>;
    monthlyPmCompletion?: Array<{ label: string; count: number }>;
    monthlyPmCompletionMachines?: { completed: MachineRef[]; overdue: MachineRef[] };
    maintenanceRequests?: {
      total: number;
      completed: number;
      pendingQa: number;
      pendingEngineering: number;
      acceptedOrInProgress: number;
      own: number;
    };
    maintenanceRequestNotifications?: Array<{ type: string; message: string; href: string }>;
    recentMaintenanceRequests?: Array<{
      id: number;
      requestReportNumber: string;
      machineName: string;
      machineNumber: string;
      status: string;
      requestDate: string;
    }>;
    lowStockSpareParts?: Array<{
      id: number;
      partName: string;
      partCode: string;
      currentQuantity: number;
      minimumQuantity: number;
      unit: string;
    }>;
  };
  const canViewSpareParts = !!user?.permissions.includes("view_spare_parts");

  const notifications = pmStats?.maintenanceRequestNotifications ?? [];
  const notificationIcon = (type: string) => {
    if (type === "overdue_pm") return <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
    if (type === "qa") return <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />;
    return <Activity className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
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
                <CardTitle className="text-sm font-medium">{t('dashboard.totalMachines')}</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalMachines}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-emerald-500 font-medium">{stats.activeMachines} {t('dashboard.activeMachines')}</span> {t('dashboard.acrossDepts', { count: stats.totalDepartments })}
                </p>
              </CardContent>
            </Card>
            
            <Card className="hover-elevate transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.activeUsers')}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.activeUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('dashboard.outOfTotal', { total: stats.totalUsers })}
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.departments')}</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalDepartments}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('dashboard.monitoredFacilities')}
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.pendingPM')}</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{pmStats?.thisWeekPm?.length ?? 0}</div>
                <p className="text-xs text-amber-500 font-medium mt-1">
                  {t('dashboard.scheduledThisWeek')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* NOTIFICATIONS PANEL — FR-2.8, FR-2.9, FR-2.10 */}
          {notifications.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-amber-800 dark:text-amber-300">
                  <Bell className="h-4 w-4" />
                  {t('dashboard.notifications')}
                  <span className="ml-auto rounded-full bg-amber-500 text-white text-xs px-2 py-0.5">{notifications.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {notifications.map((n, i) => (
                    <Link key={i} href={n.href}>
                      <div className="flex items-start gap-3 rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-background p-3 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer">
                        {notificationIcon(n.type)}
                        <span className="text-sm">{n.message}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>{t('dashboard.equipByDept')}</CardTitle>
                <CardDescription>
                  {t('dashboard.equipByDeptDesc')}
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
                <CardTitle>{t('dashboard.equipStatus')}</CardTitle>
                <CardDescription>
                  {t('dashboard.equipStatusDesc')}
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
            {canViewSpareParts && isAdminOrSupervisor && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-primary" />
                    {t('dashboard.lowStockParts')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pmStats?.lowStockSpareParts?.length ? (
                    <div className="space-y-3">
                      {pmStats.lowStockSpareParts.map((part) => (
                        <div key={part.id} className="rounded-md border p-3">
                          <div className="font-medium">{part.partName}</div>
                          <div className="text-xs text-muted-foreground">{part.partCode}</div>
                          <div className="text-sm mt-1">{part.currentQuantity}/{part.minimumQuantity} {part.unit}</div>
                        </div>
                      ))}
                      <Button asChild variant="outline" size="sm">
                        <Link href="/spare-parts">Open Spare Parts</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <Package className="h-8 w-8 mb-3 text-muted-foreground/50" />
                      <p>{t('dashboard.noLowStock')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  {t('dashboard.maintenanceRequests')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* FR-2.5 / FR-2.6 — Total Submitted + Total Completed */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border p-3 bg-muted/30">
                      <div className="text-2xl font-bold">{pmStats?.maintenanceRequests?.total ?? 0}</div>
                      <div className="text-muted-foreground">{t('dashboard.totalSubmitted')}</div>
                    </div>
                    <div className="rounded-md border p-3 bg-emerald-50 dark:bg-emerald-950/20">
                      <div className="text-2xl font-bold text-emerald-600">{pmStats?.maintenanceRequests?.completed ?? 0}</div>
                      <div className="text-muted-foreground">{t('dashboard.completed')}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-2xl font-bold text-orange-500">{pmStats?.maintenanceRequests?.pendingQa ?? 0}</div>
                      <div className="text-muted-foreground">{t('dashboard.pendingQA')}</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-2xl font-bold text-blue-500">{pmStats?.maintenanceRequests?.pendingEngineering ?? 0}</div>
                      <div className="text-muted-foreground">{t('dashboard.engineeringReview')}</div>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/maintenance-requests">{t('dashboard.openRequests')}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-amber-500" />
                  {t('dashboard.thisWeekPMs')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pmStats?.thisWeekPm?.length ? (
                  <div className="space-y-3">
                    {pmStats.thisWeekPm.map((item) => (
                      <Link key={item.id} href={`/machines/${item.machineId}/pm`}>
                        <div className="rounded-md border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="font-medium">{item.machineName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.machineNumber} · {item.plannedDateFrom || "-"} → {item.plannedDateTo || "-"}
                          </div>
                          <div className={`text-xs mt-1 font-medium ${item.status === "Completed" ? "text-emerald-600" : item.status === "Overdue" ? "text-red-500" : "text-amber-500"}`}>
                            {item.status}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <Activity className="h-8 w-8 mb-3 text-muted-foreground/50" />
                    <p>{t('dashboard.noPMThisWeek')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {t('dashboard.monthlyPMCompletion')}
                </CardTitle>
                <CardDescription>{t('dashboard.clickSegment')}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* FR-2.13 — Clickable pie chart */}
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pmStats?.monthlyPmCompletion ?? []}
                        dataKey="count"
                        nameKey="label"
                        innerRadius={40}
                        outerRadius={70}
                        cursor="pointer"
                        onClick={(entry) => {
                          const label = entry.label as "Completed" | "Overdue / Not Completed";
                          setSelectedPmSegment(selectedPmSegment === label ? null : label);
                        }}
                      >
                        {(pmStats?.monthlyPmCompletion ?? []).map((entry, index) => (
                          <Cell
                            key={entry.label}
                            fill={COLORS[index % COLORS.length]}
                            opacity={!selectedPmSegment || selectedPmSegment === entry.label ? 1 : 0.35}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {selectedPmSegment && (
                  <div className="mt-2 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{selectedPmSegment}</span>
                      <button onClick={() => setSelectedPmSegment(null)}>
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                    {(() => {
                      const list = selectedPmSegment === "Completed"
                        ? (pmStats?.monthlyPmCompletionMachines?.completed ?? [])
                        : (pmStats?.monthlyPmCompletionMachines?.overdue ?? []);
                      return list.length ? (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {list.map((m) => (
                            <Link key={m.id} href={`/machines/${m.machineId}/pm`}>
                              <div className="text-sm py-1 px-2 rounded hover:bg-muted cursor-pointer">
                                {m.machineName} <span className="text-muted-foreground">#{m.machineNumber}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted-foreground">{t('dashboard.noMachinesInGroup')}</p>;
                    })()}
                  </div>
                )}
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
                  {t('dashboard.acceptedCMWork')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg border-muted gap-3">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
                  <p>{pmStats?.maintenanceRequests?.acceptedOrInProgress ?? 0} accepted or in-progress requests.</p>
                  <Button asChild size="sm">
                    <Link href="/maintenance-requests/technician">{t('dashboard.openCMWork')}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-amber-500" />
                  {t('dashboard.pmThisWeek')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pmStats?.thisWeekPm?.length ? (
                  <div className="space-y-2">
                    {pmStats.thisWeekPm.map((item) => (
                      <Link key={item.id} href={`/machines/${item.machineId}/pm`}>
                        <div className="rounded-md border p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="font-medium">{item.machineName}</div>
                          <div className="text-xs text-muted-foreground">{item.machineNumber} · {item.plannedDateFrom || "-"} → {item.plannedDateTo || "-"}</div>
                          <div className={`text-xs mt-1 font-medium ${item.status === "Completed" ? "text-emerald-600" : item.status === "Overdue" ? "text-red-500" : "text-amber-500"}`}>{item.status}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg border-muted">
                    <Activity className="h-8 w-8 mb-3 text-muted-foreground/50" />
                    <p>{t('dashboard.noPMThisWeek')}</p>
                  </div>
                )}
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
                  {t('dashboard.reportIssue')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-muted-foreground">
                  {t('dashboard.reportIssueDesc')}
                </p>
                <Button asChild className="w-full">
                  <Link href="/maintenance-requests/new">{t('dashboard.submitRequest')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                  {t('dashboard.myRequests')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg border-muted gap-3">
                <p>{pmStats?.maintenanceRequests?.own ?? 0} submitted requests.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/maintenance-requests/my">View My Requests</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
