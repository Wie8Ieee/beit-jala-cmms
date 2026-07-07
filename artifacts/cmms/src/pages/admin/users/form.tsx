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

// Base schema for both create and edit
const baseUserSchema = z.object({
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

  // Selected permissions state for the edit form
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const formSchema = isEditing ? editUserSchema : createUserSchema;
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: isEditing ? {
      fullName: "",
      email: "",
      roleId: "",
      departmentId: null,
      password: "",
    } : {
      username: "",
      fullName: "",
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
        email: userData.email || "",
        roleId: userData.roleId,
        departmentId: userData.departmentId,
        password: "", // don't prefill password
      });
      setSelectedPermissions(userData.permissions || []);
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
      { id: userId, data: { permissionNames: selectedPermissions } },
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
    deactivateMutation.mutate(
      { id: userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["users"] });
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
          toast({
            title: userData?.isActive ? "User deactivated" : "User reactivated",
            description: `User status has been toggled.`,
          });
        }
      }
    );
  };

  const togglePermission = (permissionName: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionName) 
        ? prev.filter(p => p !== permissionName)
        : [...prev, permissionName]
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

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

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? `Edit User: ${userData?.username}` : "Create New User"}
            </h1>
            {isEditing && userData && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${userData.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                {userData.isActive ? "Active" : "Inactive"}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {isEditing ? "Update identity and system access." : "Provision a new account for the CMMS."}
          </p>
        </div>

        {isEditing && userData && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant={userData.isActive ? "destructive" : "secondary"}>
                <UserX className="mr-2 h-4 w-4" />
                {userData.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  {userData.isActive 
                    ? "This will prevent the user from logging in. Their existing records will remain." 
                    : "This will restore the user's ability to log in with their previous permissions."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeactivate}
                  className={userData.isActive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                >
                  {deactivateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
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
                  <CardTitle>Profile Details</CardTitle>
                  <CardDescription>Identity and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isEditing && (
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username <span className="text-destructive">*</span></FormLabel>
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
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Role <span className="text-destructive">*</span></FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(parseInt(val, 10))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
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
                        <FormLabel>Department</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val, 10))}
                          value={field.value?.toString() || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None (Global)</SelectItem>
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
                        <FormLabel>{isEditing ? "Reset Password" : "Password"} {(!isEditing) && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={isEditing ? "Leave blank to keep current" : "Minimum 4 characters"} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isEditing ? "Update Profile" : "Create User"}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>

        {isEditing && (
          <div className="lg:col-span-2 space-y-6">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Fine-grained Permissions
                  </CardTitle>
                  <CardDescription>
                    Base role is {userData?.roleName}. Toggle extra permissions below.
                  </CardDescription>
                </div>
                <Button 
                  onClick={savePermissions} 
                  variant="outline" 
                  disabled={permissionsMutation.isPending}
                >
                  {permissionsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Permissions"}
                </Button>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category} className="space-y-3">
                      <h4 className="font-semibold text-sm tracking-wide uppercase text-muted-foreground border-b pb-1">
                        {category}
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
                                {perm.name}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {perm.description}
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
