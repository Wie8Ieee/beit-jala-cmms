import { useState } from "react";
import { Link } from "wouter";
import { useGetUsers } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, UserCircle, Edit, PenLine, Building2, BriefcaseBusiness } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function UsersList() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: users, isLoading } = useGetUsers({
    query: { queryKey: ["users"] }
  });

  const filteredUsers = users?.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (user.fullName && user.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className={`space-y-6 animate-in fade-in duration-500 ${isArabic ? "text-right" : "text-left"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('users.systemTitle')}</h1>
          <p className="text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/signature-permissions"><PenLine className={`${isArabic ? "ml-2" : "mr-2"} h-4 w-4`} />{isArabic ? "صلاحيات التوقيع" : "Signature Permissions"}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/departments"><Building2 className={`${isArabic ? "ml-2" : "mr-2"} h-4 w-4`} />{isArabic ? "الأقسام" : "Departments"}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/roles"><BriefcaseBusiness className={`${isArabic ? "ml-2" : "mr-2"} h-4 w-4`} />{isArabic ? "الأدوار الوظيفية" : "Job Roles"}</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/users/new">
              <Plus className={`${isArabic ? "ml-2" : "mr-2"} h-4 w-4`} />
              {t('users.addUser')}
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className={`absolute ${isArabic ? "right-2.5" : "left-2.5"} top-2.5 h-4 w-4 text-muted-foreground`} />
          <Input
            type="search"
            placeholder={t('users.searchPlaceholder')}
            className={`${isArabic ? "pr-9 text-right" : "pl-9 text-left"} bg-background`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <Table dir={isArabic ? "rtl" : "ltr"}>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className={isArabic ? "text-right" : "text-left"}>{isArabic ? "المستخدم" : "User"}</TableHead>
              <TableHead className={isArabic ? "text-right" : "text-left"}>{isArabic ? "رقم الموظف" : "Employee number"}</TableHead>
              <TableHead className={isArabic ? "text-right" : "text-left"}>{t('users.role')}</TableHead>
              <TableHead className={isArabic ? "text-right" : "text-left"}>{t('users.department')}</TableHead>
              <TableHead className={isArabic ? "text-right" : "text-left"}>{t('users.status')}</TableHead>
              <TableHead className={isArabic ? "text-left" : "text-right"}>{t('users.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className={isArabic ? "text-left" : "text-right"}><Skeleton className={`h-8 w-8 rounded-md ${isArabic ? "" : "ml-auto"}`} /></TableCell>
                </TableRow>
              ))
            ) : filteredUsers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <UserCircle className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-lg font-medium text-foreground">{t('users.noUsersFound')}</p>
                    <p className="text-sm">{t('users.adjustSearch')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers?.map((user) => (
                <TableRow key={user.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="font-medium">{user.username}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{user.fullName || "—"}</div>
                  </TableCell>
                  <TableCell className="font-mono">{user.employeeNumber || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                      {user.roleName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.departmentName || "—"}</TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 shadow-none">{t('common.active')}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground shadow-none">{t('common.inactive')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className={isArabic ? "text-left" : "text-right"}>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/users/${user.id}/edit`}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit user</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
