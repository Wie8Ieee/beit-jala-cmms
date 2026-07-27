import { createContext, useContext, useEffect, ReactNode } from "react";
import { AuthUser } from "@workspace/api-client-react";
import { getGetMeQueryKey, useGetMe, useLogout } from "@workspace/api-client-react";
import { useLocation } from "wouter";

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// During Vite Fast Refresh, a route can briefly render while this provider is
// being replaced. Treat that transition as an unauthenticated loading state
// instead of throwing a runtime error or rendering protected content.
const loadingAuthContext: AuthContextType = {
  user: null,
  isLoading: true,
  hasPermission: () => false,
  logout: () => undefined,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const logoutMutation = useLogout();

  useEffect(() => {
    if (isError && error?.status === 401) {
      setLocation("/login");
    }
  }, [isError, error, setLocation]);

  const hasPermission = (permission: string) => {
    if (!user) return false;
    return user.roleName === "Admin" || user.permissions.includes(permission);
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
  return context ?? loadingAuthContext;
}
