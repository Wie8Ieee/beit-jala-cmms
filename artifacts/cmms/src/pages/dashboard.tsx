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
  const { user, hasPermission } = useAuth();
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
    completedCorrectiveThisMonth?: Array<{ id: number; requestReportNumber: string; machineId: number; machineName: string; machineNumber: string; completedDate: string }>;
  };
  const canViewSpareParts = !!user?.permissions.includes("view_spare_parts");
  const canViewNotifications = hasPermission("view_dashboard_notifications");
  const canViewMachines = hasPermission("view_dashboard_machines");
  const canViewUsers = hasPermission("view_dashboard_users");
  const canViewDepartments = hasPermission("view_dashboard_departments");
  const canViewPm = hasPermission("view_dashboard_preventive_maintenance");
  const canViewRequests = hasPermission("view_dashboard_maintenance_requests");
  const canViewCorrective = hasPermission("view_dashboard_corrective_maintenance");
  const canViewDashboardSpareParts = hasPermission("view_dashboard_spare_parts");

  const notifications = pmStats?.maintenanceRequestNotifications ?? [];
  const notificationIcon = (type: string) => {
    if (type === "overdue_pm") return <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
    if (type === "qa") return <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />;
    return <Activity className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.fullName || user?.username}. Here's what's happening today.
        </p>
      </div>

      {stats && canViewNotifications && !isAdminOrSupervisor && !isQA && notifications.length > 0 && (
        <Card className="overflow-hidden border-primary/20 border-l-4 border-l-primary bg-card shadow-sm">
          <CardHeader className="pb-2 pt-4"><CardTitle className="flex items-center gap-2 text-base"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Bell className="h-4 w-4" /></span>{t('dashboard.notifications')}<span className="ml-auto rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{notifications.length}</span></CardTitle></CardHeader>
          <CardContent className="pb-4"><div className="grid gap-2 md:grid-cols-2">{notifications.map((n, i) => <Link key={i} href={n.href}><div className="flex h-full items-start gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5 cursor-pointer">{notificationIcon(n.type)}<span className="text-sm font-medium leading-5">{n.message}</span></div></Link>)}</div></CardContent>
        </Card>
      )}

      {/* ADMIN & SUPERVISOR VIEW */}
      {!isTechnician && !isEmployee && stats && (
        <>
          {/* NOTIFICATIONS PANEL — FR-2.8, FR-2.9, FR-2.10 */}
          {canViewNotifications && (isAdminOrSupervisor || isQA) && notifications.length > 0 && (
            <Card className="overflow-hidden border-primary/20 border-l-4 border-l-primary bg-card shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bell className="h-4 w-4" />
                  </span>
                  {t('dashboard.notifications')}
                  <span className="ml-auto rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">{notifications.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="grid gap-2 md:grid-cols-2">
                  {notifications.map((n, i) => (
                    <Link key={i} href={n.href}>
                      <div className="flex h-full items-start gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5 cursor-pointer">
                        {notificationIcon(n.type)}
                        <span className="text-sm font-medium leading-5">{n.message}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <Card className={`${canViewMachines ? "" : "hidden"} h-full border-l-4 border-l-primary shadow-sm transition-shadow hover:shadow-md`}>
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
            
            <Card className={`${canViewUsers ? "" : "hidden"} h-full shadow-sm transition-shadow hover:shadow-md`}>
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

            <Card className={`${canViewDepartments ? "" : "hidden"} h-full shadow-sm transition-shadow hover:shadow-md`}>
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

            <Card className={`${canViewPm ? "" : "hidden"} h-full shadow-sm transition-shadow hover:shadow-md`}>
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

          <div className="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Card className={`${canViewMachines ? "" : "hidden"} md:col-span-2 lg:col-span-2 lg:order-5 overflow-hidden shadow-sm`}>
              <CardHeader className="pb-3">
                <CardTitle>{t('dashboard.equipByDept')}</CardTitle>
                <CardDescription>
                  {t('dashboard.equipByDeptDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
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

            {canViewSpareParts && canViewDashboardSpareParts && (
              <Card className="h-full lg:order-4 shadow-sm">
                <CardHeader className="pb-3">
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
            <Card className={`${canViewRequests ? "" : "hidden"} h-full lg:order-2 shadow-sm`}>
              <CardHeader className="pb-3">
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
            <Card className={`${canViewCorrective ? "" : "hidden"} lg:col-span-3 lg:order-6 shadow-sm`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Corrective Maintenance Completed This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pmStats?.completedCorrectiveThisMonth?.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {pmStats.completedCorrectiveThisMonth.map((item) => <Link key={item.id} href={`/maintenance-requests/${item.id}`}><div className="rounded-md border p-3 hover:bg-muted/50"><div className="font-medium">{item.machineName}</div><div className="text-xs text-muted-foreground">{item.requestReportNumber} · {item.machineNumber} · {item.completedDate}</div></div></Link>)}
                </div> : <p className="py-8 text-center text-sm text-muted-foreground">No corrective maintenance was completed this month.</p>}
              </CardContent>
            </Card>
            <Card className={`${canViewPm ? "" : "hidden"} h-full lg:order-3 shadow-sm`}>
              <CardHeader className="pb-3">
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
            <Card className={`${canViewPm ? "" : "hidden"} h-full lg:order-1 shadow-sm`}>
              <CardHeader className="pb-3">
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
                <div className="mt-2 text-right text-sm text-muted-foreground">
                  Total PM this month: <span className="font-semibold text-foreground">{(pmStats?.monthlyPmCompletion ?? []).reduce((total, item) => total + item.count, 0)}</span>
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
      {isTechnician && (canViewRequests || canViewPm) && (
        <div className="grid gap-4 md:grid-cols-2">
           <Card className={canViewRequests ? "" : "hidden"}>
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
            <Card className={canViewPm ? "" : "hidden"}>
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
      {isEmployee && canViewRequests && (
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
