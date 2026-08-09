import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  useCreateUser, 
  useUpdateUser, 
  useGetUser, 
  useGetRoles,
  useGetDepartments,
  useGetPermissions,
  useUpdateUserPermissions,
  useDeactivateUser,
  getGetUserQueryKey 
} from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-message";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ArrowLeft, Loader2, Save, UserX, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignaturePad } from "@/components/signature-pad";
import { apiRequest } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";

// Base schema for both create and edit
const baseUserSchema = z.object({
  employeeNumber: z.string().min(1, "Employee number is required"),
  fullName: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  roleId: z.coerce.number().min(1, "Role is required"),
  departmentId: z.coerce.number().optional().nullable(),
});

// Create requires username and password
const createUserSchema = baseUserSchema.extend({
  username: z.string().min(2, "Username must be at least 2 characters"),
  password: z.string().min(4, "Password must be at least 4 characters"),
});

// Edit has optional password and username is fixed
const editUserSchema = baseUserSchema.extend({
  password: z.string().min(4, "Password must be at least 4 characters").optional().or(z.literal("")),
});

type CreateUserValues = z.infer<typeof createUserSchema>;
type EditUserValues = z.infer<typeof editUserSchema>;

export default function UserForm({ params }: { params?: { id: string } }) {
  const { isArabic } = useLang();
  const tr = (english: string, arabic: string) => isArabic ? arabic : english;
  const isEditing = !!params?.id && params.id !== "new";
  const userId = isEditing ? parseInt(params.id as string, 10) : undefined;
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Data fetching
  const { data: roles } = useGetRoles({ query: { queryKey: ["roles"] } });
  const { data: departments } = useGetDepartments({ query: { queryKey: ["departments"] } });
  const { data: allPermissions } = useGetPermissions({ query: { queryKey: ["permissions"] } });
  
  const { data: userData, isLoading: isLoadingUser } = useGetUser(
    userId!, 
    { query: { enabled: isEditing, queryKey: getGetUserQueryKey(userId!) } }
  );

  // Mutations
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const permissionsMutation = useUpdateUserPermissions();
  const deactivateMutation = useDeactivateUser();
  const reactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}/reactivate`, { method: "PATCH", credentials: "include" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Request failed"); }
      return res.json();
    },
  });

  // Selected permissions state for the edit form
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [signatureData, setSignatureData] = useState("");
  const formSchema = isEditing ? editUserSchema : createUserSchema;
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: isEditing ? {
      fullName: "",
      employeeNumber: "",
      email: "",
      roleId: "",
      departmentId: null,
      password: "",
    } : {
      username: "",
      fullName: "",
      employeeNumber: "",
      email: "",
      roleId: "",
      departmentId: null,
      password: "",
    },
  });

  useEffect(() => {
    if (isEditing && userData) {
      form.reset({
        fullName: userData.fullName || "",
        employeeNumber: userData.employeeNumber || "",
        email: userData.email || "",
        roleId: userData.roleId,
        departmentId: userData.departmentId,
        password: "", // don't prefill password
      });
      setSelectedPermissions(userData.permissions || []);
      setSignatureData(userData.signatureData || "");
    }
  }, [isEditing, userData, form]);

  const onSubmit = (values: any) => {
    // Clean up payload
    const payload = {
      ...values,
      departmentId: values.departmentId || null,
      email: values.email || undefined,
    };
    if (payload.password === "") delete payload.password;

    if (isEditing && userId) {
      updateMutation.mutate(
        { id: userId, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
            toast({
              title: "User updated",
              description: `Successfully updated user details.`,
            });
            // Don't navigate away, let them edit permissions
          },
          onError: (error) => {
            toast({
              variant: "destructive",
              title: "Failed to update user",
              description: getErrorMessage(error, "An unexpected error occurred."),
            });
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            toast({
              title: "User created",
              description: `Successfully created ${data.username}.`,
            });
            setLocation(`/admin/users/${data.id}/edit`);
          },
          onError: (error) => {
            toast({
              variant: "destructive",
              title: "Failed to create user",
              description: getErrorMessage(error, "An unexpected error occurred."),
            });
          }
        }
      );
    }
  };

  const savePermissions = () => {
    if (!userId) return;
    permissionsMutation.mutate(
      { id: userId, data: { permissionNames: [...new Set(selectedPermissions)] } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
          toast({
            title: "Permissions updated",
            description: "User access rights have been saved.",
          });
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Failed to update permissions",
            description: getErrorMessage(error, "An unexpected error occurred."),
          });
        }
      }
    );
  };

  const handleDeactivate = () => {
    if (!userId) return;
    const isCurrentlyActive = userData?.isActive ?? true;
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      toast({
        title: isCurrentlyActive ? "User deactivated" : "User reactivated",
        description: `User access has been ${isCurrentlyActive ? "revoked" : "restored"}.`,
      });
    };
    if (isCurrentlyActive) {
      deactivateMutation.mutate({ id: userId }, { onSuccess });
    } else {
      reactivateMutation.mutate(userId, { onSuccess });
    }
  };

  const togglePermission = (permissionName: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionName) 
        ? prev.filter(p => p !== permissionName)
        : [...prev, permissionName]
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const signatureMutation = useMutation({
    mutationFn: () => apiRequest(`/signatures/users/${userId}/profile`, { method: "PUT", body: JSON.stringify({ signatureData }) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId!) }),
        queryClient.invalidateQueries({ queryKey: ["signatures"] }),
        queryClient.invalidateQueries({ queryKey: ["signature-profile"] }),
      ]);
      toast({ title: "Signature saved", description: "The user's saved signature was updated everywhere." });
    },
    onError: (error) => toast({ variant: "destructive", title: "Signature failed", description: getErrorMessage(error, "Unable to save signature.") }),
  });

  if (isEditing && isLoadingUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  // Group permissions for UI
  const groupedPermissions = allPermissions?.reduce((acc, perm) => {
    const category = perm.name.split('_')[1] || "general";
    if (!acc[category]) acc[category] = [];
    acc[category].push(perm);
    return acc;
  }, {} as Record<string, typeof allPermissions>) || {};
  const maintenancePermissionLabels: Record<string, string> = {
    submit_maintenance_request: "تعبئة وإرسال طلب صيانة",
    review_department_requests: "اعتماد طلب الصيانة كمشرف القسم",
    review_qa_requests: "الموافقة على طلب الصيانة من QA",
    review_engineering_requests: "الموافقة على طلب الصيانة من الهندسة والصيانة",
    fill_preliminary_findings: "تعبئة وتعديل نتائج الفحص الأولي ووقت العمل",
    fill_corrective_maintenance: "تعبئة وتعديل الإجراءات المتخذة والملاحظات والقائمين بالعمل",
    delete_corrective_maintenance: "حذف صفوف سجل الصيانة العلاجية",
    view_external_maintenance: "عرض طلب الصيانة الخارجية ونموذج الاستلام",
    edit_external_maintenance: "تعديل طلب الصيانة الخارجية ونموذج الاستلام",
    sign_assigned_fields: "التوقيع الإلكتروني في الحقول الممنوحة للحساب",
    archive_maintenance_requests: "أرشفة طلبات الصيانة وإعادتها من الأرشيف",
    set_maintenance_request_number_start: "تحديد رقم بدء تسلسل طلبات الصيانة",
    edit_closed_corrective_maintenance_log: "تعديل سجل طلبات الصيانة العلاجية المغلقة",
  };
  const maintenancePermissions = (allPermissions ?? []).filter((permission) => permission.name in maintenancePermissionLabels);
  const dashboardPermissionLabels: Record<string, string> = {
    view_dashboard: "الدخول إلى لوحة المعلومات",
    view_dashboard_notifications: "عرض التنبيهات",
    view_dashboard_machines: "عرض إحصائيات الماكينات",
    view_dashboard_users: "عرض إحصائيات المستخدمين",
    view_dashboard_departments: "عرض إحصائيات الأقسام",
    view_dashboard_preventive_maintenance: "عرض الصيانة الوقائية",
    view_dashboard_maintenance_requests: "عرض طلبات الصيانة",
    view_dashboard_corrective_maintenance: "عرض الصيانة العلاجية",
    view_dashboard_spare_parts: "عرض تنبيهات قطع الغيار",
  };
  const dashboardPermissions = (allPermissions ?? []).filter((permission) => permission.name in dashboardPermissionLabels);
  const categoryLabels: Record<string, string> = {
    general: "عام",
    users: "المستخدمون",
    machines: "الماكينات",
    equipment: "معلومات المعدات",
    pm: "الصيانة الوقائية",
    maintenance: "الصيانة",
    monthly: "جدول الصيانة الوقائية الشهري",
    spare: "قطع الغيار",
    signatures: "التوقيعات",
    reports: "التقارير",
    header: "رؤوس النماذج",
    machine: "الماكينات",
    delete: "الحذف والأرشفة",
    technician: "الفنيون",
    forms: "النماذج والطباعة",
  };
  const generalPermissionLabels: Record<string, string> = {
    view_reports: "عرض التقارير",
    manage_users: "إدارة المستخدمين",
    view_machines: "عرض الماكينات",
    create_machine: "إضافة ماكينة",
    edit_machine: "تعديل الماكينات",
    soft_delete_machine: "أرشفة الماكينات واستعادتها",
    view_equipment_information: "عرض معلومات المعدات",
    view_machine_maintenance_history: "عرض سجل صيانة الماكينة",
    edit_equipment_information: "تعديل معلومات المعدات",
    manage_pm_checklist: "إدارة نقاط فحص الصيانة الوقائية",
    fill_pm_record: "تعبئة سجل الصيانة الوقائية",
    view_pm_records: "عرض سجلات الصيانة الوقائية",
    view_annual_maintenance_plan: "عرض خطة الصيانة السنوية",
    edit_annual_maintenance_plan: "تعديل خطة الصيانة السنوية",
    view_monthly_maintenance_plan: "عرض خطة الصيانة الشهرية",
    edit_monthly_maintenance_plan: "تعديل خطة الصيانة الشهرية",
    delete_monthly_pm_plan_rows: "حذف صفوف من جدول الصيانة الوقائية الشهري",
    assign_technician: "تعيين فني الصيانة",
    view_spare_parts: "عرض قطع الغيار",
    manage_spare_parts: "إدارة قطع الغيار",
    record_spare_part_usage: "تسجيل استخدام قطع الغيار",
    adjust_spare_parts: "تسوية كميات قطع الغيار",
    edit_header: "تعديل رؤوس النماذج",
    print_forms: "طباعة النماذج",
    manage_signatures: "إدارة التوقيعات",
  };
  const pmPermissionLabels: Record<string, string> = {
    manage_pm_checklist: tr("Manage PM checklist points", "إدارة نقاط فحص الصيانة الوقائية"),
    fill_pm_record: tr("Add preventive-maintenance inspections", "إضافة فحوصات الصيانة الوقائية"),
    edit_pm_inspection: tr("Edit preventive-maintenance inspections", "تعديل فحوصات الصيانة الوقائية"),
    delete_pm_inspection: tr("Delete preventive-maintenance inspections", "حذف فحوصات الصيانة الوقائية"),
    view_pm_records: tr("View preventive-maintenance records", "عرض سجلات الصيانة الوقائية"),
  };
  const pmPermissions = (allPermissions ?? []).filter((permission) => permission.name in pmPermissionLabels);
  const featuredPermissionNames = new Set([
    ...Object.keys(dashboardPermissionLabels),
    ...Object.keys(maintenancePermissionLabels),
    "view_audit_logs",
    ...Object.keys(pmPermissionLabels),
  ]);
  const fineGrainedPermissionGroups = Object.fromEntries(
    Object.entries(groupedPermissions)
      .map(([category, permissions]) => [category, permissions.filter((permission) => !featuredPermissionNames.has(permission.name))])
      .filter(([, permissions]) => permissions.length > 0),
  ) as typeof groupedPermissions;

  return (
    <div data-permissions-page={isEditing ? "true" : undefined} dir={isArabic ? "rtl" : "ltr"} className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className={`h-4 w-4 ${isArabic ? "rotate-180" : ""}`} />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? `${tr("Edit User", "تعديل المستخدم")}: ${userData?.username}` : tr("Create New User", "إنشاء مستخدم جديد")}
            </h1>
            {isEditing && userData && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${userData.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                {userData.isActive ? tr("Active", "نشط") : tr("Inactive", "غير نشط")}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {isEditing ? tr("Update identity and system access.", "تحديث بيانات المستخدم وصلاحيات الدخول.") : tr("Provision a new account for the CMMS.", "إنشاء حساب جديد في النظام.")}
          </p>
        </div>

        {isEditing && userData && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={userData.isActive ? "destructive" : "secondary"}>
                <UserX className="mr-2 h-4 w-4" />
                {userData.isActive ? tr("Deactivate", "تعطيل الحساب") : tr("Reactivate", "إعادة تفعيل الحساب")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tr("Are you sure?", "هل أنت متأكد؟")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {userData.isActive 
                    ? tr("This will prevent the user from logging in. Their existing records will remain.", "سيتم منع المستخدم من تسجيل الدخول مع الاحتفاظ بسجلاته الحالية.")
                    : tr("This will restore the user's ability to log in with their previous permissions.", "سيتمكن المستخدم من تسجيل الدخول بصلاحياته السابقة.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tr("Cancel", "إلغاء")}</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeactivate}
                  className={userData.isActive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                >
                  {deactivateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Confirm", "تأكيد")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className={isEditing ? "lg:col-span-1" : "lg:col-span-2 lg:col-start-1"}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{tr("Profile Details", "بيانات الحساب")}</CardTitle>
                  <CardDescription>{tr("Identity and contact information", "بيانات الهوية والتواصل")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isEditing && (
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{tr("Username", "اسم المستخدم")} <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="jsmith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr("Full Name", "الاسم الكامل")}</FormLabel>
                        <FormControl>
                          <Input placeholder="John Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField control={form.control} name="employeeNumber" render={({ field }) => (
                    <FormItem><FormLabel>{tr("Employee Number", "رقم الموظف")} <span className="text-destructive">*</span></FormLabel><FormControl><Input placeholder="EMP-0001" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr("Email Address", "البريد الإلكتروني")}</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isEditing && <div className="space-y-3 rounded-md border p-3"><p className="text-sm font-medium leading-none">{tr("Saved drawn signature", "التوقيع المحفوظ")}</p><SignaturePad value={signatureData} onChange={setSignatureData} /><Button type="button" variant="outline" onClick={() => signatureMutation.mutate()} disabled={!signatureData || signatureMutation.isPending}>{tr("Save / Replace Signature", "حفظ / استبدال التوقيع")}</Button></div>}

                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr("Primary Role", "الدور الأساسي")} <span className="text-destructive">*</span></FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(parseInt(val, 10))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={tr("Select a role", "اختر الدور")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles?.map((role) => (
                              <SelectItem key={role.id} value={role.id.toString()}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tr("Department", "القسم")}</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val, 10))}
                          value={field.value?.toString() || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={tr("Select a department", "اختر القسم")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">{tr("None (Global)", "بدون قسم (عام)")}</SelectItem>
                            {departments?.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id.toString()}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{isEditing ? tr("Reset Password", "إعادة تعيين كلمة المرور") : tr("Password", "كلمة المرور")} {(!isEditing) && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={isEditing ? tr("Leave blank to keep current", "اتركها فارغة للإبقاء على الحالية") : tr("Minimum 4 characters", "4 أحرف على الأقل")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isEditing ? tr("Update Profile", "تحديث البيانات") : tr("Create User", "إنشاء المستخدم")}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>

        {isEditing && (
          <div className="lg:col-span-2 space-y-6">
            <div className="sticky top-2 z-20 flex justify-end rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
              <Button onClick={savePermissions} disabled={permissionsMutation.isPending}>
                {permissionsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {tr("Save Permissions", "حفظ الصلاحيات")}
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>صلاحيات لوحة المعلومات</CardTitle>
                <CardDescription>حدّد الوحدات التي تظهر لهذا المستخدم في الداشبورد.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {dashboardPermissions.map((permission) => (
                  <label key={permission.id} htmlFor={`dashboard-perm-${permission.id}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                    <Checkbox id={`dashboard-perm-${permission.id}`} checked={selectedPermissions.includes(permission.name)} onCheckedChange={() => togglePermission(permission.name)} />
                    <span className="text-sm font-medium">{dashboardPermissionLabels[permission.name]}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>صلاحيات طلبات الصيانة</CardTitle>
                <CardDescription>اختَر الصلاحيات المطلوبة لهذا الحساب ثم اضغط حفظ الصلاحيات.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {maintenancePermissions.map((permission) => (
                  <label key={permission.id} htmlFor={`maintenance-perm-${permission.id}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                    <Checkbox id={`maintenance-perm-${permission.id}`} checked={selectedPermissions.includes(permission.name)} onCheckedChange={() => togglePermission(permission.name)} />
                    <span className="text-sm font-medium">{maintenancePermissionLabels[permission.name]}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{tr("Preventive Maintenance Permissions", "صلاحيات الصيانة الوقائية")}</CardTitle>
                <CardDescription>{tr("Control inspection creation, editing, deletion, and viewing.", "التحكم في إضافة الفحوصات وتعديلها وحذفها وعرضها.")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {pmPermissions.map((permission) => (
                  <label key={permission.id} htmlFor={`pm-perm-${permission.id}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                    <Checkbox id={`pm-perm-${permission.id}`} checked={selectedPermissions.includes(permission.name)} onCheckedChange={() => togglePermission(permission.name)} />
                    <span className="text-sm font-medium">{pmPermissionLabels[permission.name]}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    {tr("Fine-grained Permissions", "الصلاحيات التفصيلية")}
                  </CardTitle>
                  <CardDescription>
                    {tr(`Base role is ${userData?.roleName}. Toggle extra permissions below.`, `الدور الأساسي هو ${userData?.roleName}. حدّد الصلاحيات الإضافية أدناه.`)}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
                  {Object.entries(fineGrainedPermissionGroups).map(([category, perms]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground border-b pb-1">
                        {isArabic ? categoryLabels[category] ?? category.replaceAll("_", " ") : category.replaceAll("_", " ")}
                      </h4>
                      <div className="space-y-2.5">
                        {perms.map(perm => (
                          <div key={perm.id} className="flex items-start space-x-3">
                            <Checkbox 
                              id={`perm-${perm.id}`} 
                              checked={selectedPermissions.includes(perm.name)}
                              onCheckedChange={() => togglePermission(perm.name)}
                              className="mt-0.5"
                            />
                            <div className="grid leading-none gap-1">
                              <label
                                htmlFor={`perm-${perm.id}`}
                                className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {isArabic ? generalPermissionLabels[perm.name] ?? perm.name.replaceAll("_", " ") : perm.name.replaceAll("_", " ")}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {!isArabic && perm.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
