import { Link, useLocation } from "wouter";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  LogOut,
  TestTube,
  Languages,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, hasPermission, logout } = useAuth();
  const { lang, toggle, isArabic } = useLang();
  const { t } = useTranslation();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <TestTube className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Initializing CMMS...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar side={isArabic ? "right" : "left"}>
          <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <TestTube className="size-5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight text-sidebar-foreground">
                  Beit Jala Pharma
                </span>
                <span className="truncate text-xs text-sidebar-foreground/70 font-mono">
                  CMMS v1.0
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/dashboard" || location === "/"}
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" />
                    <span>{t("nav.dashboard")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {hasPermission("view_machines") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/machines")}
                  >
                    <Link href="/machines">
                      <Activity className="size-4" />
                      <span>{t("nav.equipment")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {hasPermission("view_maintenance_plans") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/maintenance-plans")}
                  >
                    <Link href="/maintenance-plans">
                      <CalendarDays className="size-4" />
                      <span>{t("nav.maintenancePlans")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {(hasPermission("submit_maintenance_request") ||
                hasPermission("view_own_requests") ||
                hasPermission("review_qa_requests") ||
                hasPermission("review_engineering_requests") ||
                hasPermission("approve_reject_requests")) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/maintenance-requests")}
                  >
                    <Link href="/maintenance-requests">
                      <ClipboardList className="size-4" />
                      <span>{t("nav.maintenanceRequests")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {hasPermission("view_spare_parts") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/spare-parts")}
                  >
                    <Link href="/spare-parts">
                      <Package className="size-4" />
                      <span>{t("nav.spareParts")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {hasPermission("manage_users") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/admin")}
                  >
                    <Link href="/admin/users">
                      <Settings className="size-4" />
                      <span>{t("nav.admin")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                          {user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user.fullName || user.username}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.roleName}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                    side="right"
                    align="end"
                    sideOffset={4}
                  >
                    <DropdownMenuLabel className="p-0 font-normal">
                      <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8 rounded-lg">
                          <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                            {user.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">
                            {user.fullName || user.username}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {user.roleName}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="text-destructive focus:bg-destructive/10 cursor-pointer"
                    >
                      <LogOut className="mr-2 size-4" />
                      {t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-h-[100dvh] overflow-x-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4 shadow-sm z-10">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
            {/* Language toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              className="gap-2 font-medium"
              title={t("common.language")}
            >
              <Languages className="h-4 w-4" />
              {lang === "en" ? "العربية" : "English"}
            </Button>
          </header>
          <div className="flex-1 p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
