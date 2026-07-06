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
<<<<<<< HEAD
import PmRecordPage from './pages/machines/pm-record';
import PmChecklistPage from './pages/machines/pm-checklist';
import PmHeaderPage from './pages/machines/pm-header';
import PmHistoryPage from './pages/machines/pm-history';
import MachineCorrectiveMaintenancePage from './pages/machines/corrective-maintenance';
import MaintenancePlansPage from './pages/maintenance-plans';
import AnnualPlanPage from './pages/maintenance-plans/annual';
import MonthlyPlansIndexPage from './pages/maintenance-plans/monthly-index';
import MonthlyPlanPage from './pages/maintenance-plans/monthly';
import MaintenanceRequestsListPage from './pages/maintenance-requests/list';
import NewMaintenanceRequestPage from './pages/maintenance-requests/new';
import MaintenanceRequestDetailPage from './pages/maintenance-requests/detail';
=======
>>>>>>> e104d08dacfdefa360f88cd205b4f478d084c939
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

<<<<<<< HEAD
=======
      <Route path="/machines/:id">
        {(params) => (
          <ProtectedRoute permission="view_machines">
            <MachineProfile params={params} />
          </ProtectedRoute>
        )}
      </Route>

>>>>>>> e104d08dacfdefa360f88cd205b4f478d084c939
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

<<<<<<< HEAD
      <Route path="/machines/:id/pm/checklist">
        {(params) => (
          <ProtectedRoute permission="manage_pm_checklist">
            <PmChecklistPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/pm/header">
        {(params) => (
          <ProtectedRoute permission="edit_header">
            <PmHeaderPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/pm/history">
        {(params) => (
          <ProtectedRoute permission="view_machines">
            <PmHistoryPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/pm">
        {(params) => (
          <ProtectedRoute permission="view_machines">
            <PmRecordPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/corrective-maintenance">
        {(params) => (
          <ProtectedRoute permission="view_machines">
            <MachineCorrectiveMaintenancePage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/maintenance-plans/annual/:year">
        {(params) => (
          <ProtectedRoute permission="view_maintenance_plans">
            <AnnualPlanPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/maintenance-plans/monthly/:year/:month">
        {(params) => (
          <ProtectedRoute permission="view_maintenance_plans">
            <MonthlyPlanPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/maintenance-plans/monthly/:year">
        {(params) => (
          <ProtectedRoute permission="view_maintenance_plans">
            <MonthlyPlansIndexPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id">
        {(params) => (
          <ProtectedRoute permission="view_machines">
            <MachineProfile params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/maintenance-plans">
        <ProtectedRoute permission="view_maintenance_plans">
          <MaintenancePlansPage />
        </ProtectedRoute>
      </Route>

      <Route path="/maintenance-requests/new">
        <ProtectedRoute permission="submit_maintenance_request">
          <NewMaintenanceRequestPage />
        </ProtectedRoute>
      </Route>

      <Route path="/maintenance-requests/my">
        <ProtectedRoute permission="view_own_requests">
          <MaintenanceRequestsListPage scope="own" />
        </ProtectedRoute>
      </Route>

      <Route path="/maintenance-requests/qa">
        <ProtectedRoute permission="review_qa_requests">
          <MaintenanceRequestsListPage scope="qa" />
        </ProtectedRoute>
      </Route>

      <Route path="/maintenance-requests/engineering">
        <ProtectedRoute permission="review_engineering_requests">
          <MaintenanceRequestsListPage scope="engineering" />
        </ProtectedRoute>
      </Route>

      <Route path="/maintenance-requests/technician">
        <ProtectedRoute permission="fill_corrective_maintenance">
          <MaintenanceRequestsListPage scope="technician" />
        </ProtectedRoute>
      </Route>

      <Route path="/maintenance-requests/:id">
        {(params) => (
          <ProtectedRoute>
            <MaintenanceRequestDetailPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/maintenance-requests">
        <ProtectedRoute>
          <MaintenanceRequestsListPage />
        </ProtectedRoute>
      </Route>

=======
>>>>>>> e104d08dacfdefa360f88cd205b4f478d084c939
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
