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
import { Search, Plus, UserCircle, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function UsersList() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: users, isLoading } = useGetUsers({
    query: { queryKey: ["users"] }
  });

  const filteredUsers = users?.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (user.fullName && user.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('users.systemTitle')}</h1>
          <p className="text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 h-4 w-4" />
            {t('users.addUser')}
          </Link>
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('users.searchPlaceholder')}
            className="pl-9 bg-background"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>{t('users.username')}</TableHead>
              <TableHead>{t('users.fullName')}</TableHead>
              <TableHead>{t('users.role')}</TableHead>
              <TableHead>{t('users.department')}</TableHead>
              <TableHead>{t('users.status')}</TableHead>
              <TableHead className="text-right">{t('users.actions')}</TableHead>
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
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
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
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.fullName || "—"}</TableCell>
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
                  <TableCell className="text-right">
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
