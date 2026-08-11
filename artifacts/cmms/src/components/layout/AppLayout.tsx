import { Link, useLocation } from "wouter";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { ComponentPropsWithoutRef, ComponentType, ReactNode } from "react";
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
  useSidebar,
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
  BarChart3,
  LayoutDashboard,
  Package,
  Settings,
  LogOut,
  TestTube,
  Languages,
  ScrollText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type SidebarNavLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

const StyledLink = Link as unknown as ComponentType<SidebarNavLinkProps>;

function SidebarNavLink({
  href,
  children,
  className,
  onClick,
  ...props
}: SidebarNavLinkProps) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <StyledLink
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && isMobile) setOpenMobile(false);
      }}
      {...props}
    >
      {children}
    </StyledLink>
  );
}

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
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white p-1">
                <img src="/beit-jala-logo.svg" alt="Beit Jala Pharmaceutical logo" className="h-full w-full object-contain" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight text-sidebar-foreground">
                  Beit Jala Pharma
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4">
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/dashboard" || location === "/"}
                >
                  <SidebarNavLink href="/dashboard">
                    <LayoutDashboard className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">{t("nav.dashboard")}</span>
                  </SidebarNavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {hasPermission("view_machines") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/machines")}
                  >
                    <SidebarNavLink href="/machines">
                      <Activity className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">{t("nav.equipment")}</span>
                    </SidebarNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {(hasPermission("view_annual_maintenance_plan") || hasPermission("view_monthly_maintenance_plan")) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/maintenance-plans")}
                  >
                    <SidebarNavLink href="/maintenance-plans">
                      <CalendarDays className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">{t("nav.maintenancePlans")}</span>
                    </SidebarNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {(hasPermission("submit_maintenance_request") ||
                hasPermission("view_own_requests") ||
                hasPermission("review_qa_requests") ||
                hasPermission("review_engineering_requests") ||
                hasPermission("approve_reject_requests") ||
                hasPermission("sign_assigned_fields")) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/maintenance-requests")}
                  >
                    <SidebarNavLink href="/maintenance-requests">
                      <ClipboardList className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">{t("nav.maintenanceRequests")}</span>
                    </SidebarNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {hasPermission("view_reports") && <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.startsWith("/reports")}>
                  <SidebarNavLink href="/reports">
                    <BarChart3 className="size-4 shrink-0" />
                    <span className="min-w-0 truncate">Reports</span>
                  </SidebarNavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>}

              {hasPermission("view_spare_parts") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/spare-parts")}
                  >
                    <SidebarNavLink href="/spare-parts">
                      <Package className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">{t("nav.spareParts")}</span>
                    </SidebarNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {hasPermission("manage_users") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/admin")}
                  >
                    <SidebarNavLink href="/admin/users">
                      <Settings className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">{t("nav.admin")}</span>
                    </SidebarNavLink>
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

        <main className="app-main-scroll min-w-0 flex-1 flex flex-col min-h-[100dvh] overflow-x-auto overscroll-x-contain">
          <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b bg-card/95 px-3 shadow-sm backdrop-blur z-20 sm:px-4">
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
          <div className="app-content min-w-0 flex-1 p-3 sm:p-5 lg:p-8 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
