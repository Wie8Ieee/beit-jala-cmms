import { createContext, useContext, useEffect, ReactNode } from "react";
import { AuthUser } from "@workspace/api-client-react";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError, error } = useGetMe({
    query: {
      queryKey: ["me"],
      retry: false,
    }
  });

  const logoutMutation = useLogout();

  useEffect(() => {
    if (isError && error?.status === 401) {
      setLocation("/login");
    }
  }, [isError, error, setLocation]);

  const hasPermission = (permission: string) => {
    if (!user) return false;
    return user.permissions.includes(permission);
  };

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/login"; // Force reload to clear cache
      }
    });
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading, hasPermission, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
