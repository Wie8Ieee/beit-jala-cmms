import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';

import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import MachinesList from './pages/machines/list';
import MachineForm from './pages/machines/form';
import MachineProfile from './pages/machines/profile';
import EquipmentInformationForm from './pages/machines/equipment-info';
import UsersList from './pages/admin/users/list';
import UserForm from './pages/admin/users/form';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </Route>

      <Route path="/machines">
        <ProtectedRoute permission="view_machines">
          <MachinesList />
        </ProtectedRoute>
      </Route>

      <Route path="/machines/new">
        <ProtectedRoute permission="create_machine">
          <MachineForm />
        </ProtectedRoute>
      </Route>

      <Route path="/machines/:id">
        {(params) => (
          <ProtectedRoute permission="view_machines">
            <MachineProfile params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/edit">
        {(params) => (
          <ProtectedRoute permission="edit_machine">
            <MachineForm params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/equipment-information">
        {(params) => (
          <ProtectedRoute permission="view_machines">
            <EquipmentInformationForm params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/admin/users">
        <ProtectedRoute permission="manage_users">
          <UsersList />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/users/new">
        <ProtectedRoute permission="manage_users">
          <UserForm />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/users/:id/edit">
        {(params) => (
          <ProtectedRoute permission="manage_users">
            <UserForm params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
