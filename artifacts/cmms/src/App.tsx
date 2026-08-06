import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';

import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import ReportsPage from './pages/reports';
import MonthlyMaintenanceEvaluationPage from './pages/reports/monthly-maintenance-evaluation';
import CorrectiveMaintenanceTimePage from './pages/reports/corrective-maintenance-time';
import MachinesList from './pages/machines/list';
import MachineForm from './pages/machines/form';
import MachineProfile from './pages/machines/profile';
import EquipmentInformationForm from './pages/machines/equipment-info';
import PmRecordPage from './pages/machines/pm-record';
import PmChecklistPage from './pages/machines/pm-checklist';
import PmHeaderPage from './pages/machines/pm-header';
import PmHistoryPage from './pages/machines/pm-history';
import MachineCorrectiveMaintenancePage from './pages/machines/corrective-maintenance';
import CmHistoryPage from './pages/machines/cm-history';
import MaintenancePlansPage from './pages/maintenance-plans';
import AnnualPlanPage from './pages/maintenance-plans/annual';
import MonthlyPlansIndexPage from './pages/maintenance-plans/monthly-index';
import MonthlyPlanPage from './pages/maintenance-plans/monthly';
import MaintenanceRequestsListPage from './pages/maintenance-requests/list';
import NewMaintenanceRequestPage from './pages/maintenance-requests/new';
import MaintenanceRequestDetailPage from './pages/maintenance-requests/detail';
import ClosedCorrectiveMaintenanceLogPage from './pages/maintenance-requests/closed-log';
import ExternalMaintenanceRequestPage from './pages/maintenance-requests/external-maintenance';
import ExternalMaintenanceReceiptPage from './pages/maintenance-requests/external-maintenance-receipt';
import SparePartsListPage from './pages/spare-parts/list';
import SparePartDetailPage from './pages/spare-parts/detail';
import SparePartFormPage from './pages/spare-parts/form';
import SparePartMovementFormPage from './pages/spare-parts/movement-form';
import UsersList from './pages/admin/users/list';
import UserForm from './pages/admin/users/form';
import SignaturePermissionsPage from './pages/admin/signature-permissions';
import DepartmentsPage from './pages/admin/departments';
import RolesPage from './pages/admin/roles';
import EquipmentInformationPrintPage from './pages/print/equipment-information';
import MaintenanceRequestPrintPage from './pages/print/maintenance-request';
import ClosedCorrectiveMaintenanceLogPrintPage from './pages/print/closed-corrective-maintenance-log';
import ExternalMaintenancePrintPage from './pages/print/external-maintenance';
import ExternalMaintenanceReceiptPrintPage from './pages/print/external-maintenance-receipt';
import CorrectiveMaintenancePrintPage from './pages/print/corrective-maintenance';
import PmRecordPrintPage from './pages/print/pm-record';
import AnnualPlanPrintPage from './pages/print/annual-plan';
import MonthlyPlanPrintPage from './pages/print/monthly-plan';
import MonthlyMaintenanceEvaluationPrintPage from './pages/print/monthly-maintenance-evaluation';
import AnnualMaintenanceSummaryPrintPage from './pages/print/annual-maintenance-summary';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />

      <Route path="/print/equipment-information/:id">
        {(params) => (
          <ProtectedRoute permission="print_forms">
            <EquipmentInformationPrintPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/print/maintenance-request/:id">
        {(params) => (
          <ProtectedRoute permission="print_forms">
            <MaintenanceRequestPrintPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/print/corrective-maintenance/:id">
        {(params) => (
          <ProtectedRoute permission="print_forms">
            <CorrectiveMaintenancePrintPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/print/pm-record/:id">
        {(params) => (
          <ProtectedRoute permission="print_forms">
            <PmRecordPrintPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/print/annual-plan/:year">
        {(params) => (
          <ProtectedRoute permission="print_forms">
            <AnnualPlanPrintPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/print/monthly-plan/:year/:month">
        {(params) => (
          <ProtectedRoute permission="print_forms">
            <MonthlyPlanPrintPage params={params} />
          </ProtectedRoute>
        )}
      </Route>
      
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

      <Route path="/machines/:id/edit">
        {(params) => (
          <ProtectedRoute permission="edit_machine">
            <MachineForm params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/equipment-information">
        {(params) => (
          <ProtectedRoute permission="view_equipment_information">
            <EquipmentInformationForm params={params} />
          </ProtectedRoute>
        )}
      </Route>

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
          <ProtectedRoute permission="view_pm_records">
            <PmHistoryPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/print/monthly-maintenance-evaluation/:year/:month">
        {(params) => <ProtectedRoute permission="print_forms"><MonthlyMaintenanceEvaluationPrintPage params={params} /></ProtectedRoute>}
      </Route>

      <Route path="/print/annual-maintenance-summary/:type/:year">
        {(params) => <ProtectedRoute permission="print_forms"><AnnualMaintenanceSummaryPrintPage params={params} /></ProtectedRoute>}
      </Route>

      <Route path="/reports/monthly-maintenance-evaluation">
        <ProtectedRoute permission="view_reports">
          <MonthlyMaintenanceEvaluationPage />
        </ProtectedRoute>
      </Route>

      <Route path="/reports/corrective-maintenance-time">
        <ProtectedRoute permission="view_reports">
          <CorrectiveMaintenanceTimePage />
        </ProtectedRoute>
      </Route>

      <Route path="/reports">
        <ProtectedRoute permission="view_reports">
          <ReportsPage />
        </ProtectedRoute>
      </Route>

      <Route path="/print/closed-corrective-maintenance-log">
        <ProtectedRoute permission="print_forms">
          <ClosedCorrectiveMaintenanceLogPrintPage />
        </ProtectedRoute>
      </Route>

      <Route path="/print/external-maintenance/:id">
        {(params) => <ProtectedRoute permission="print_forms"><ExternalMaintenancePrintPage params={params} /></ProtectedRoute>}
      </Route>

      <Route path="/print/external-maintenance-receipt/:id">
        {(params) => <ProtectedRoute permission="print_forms"><ExternalMaintenanceReceiptPrintPage params={params} /></ProtectedRoute>}
      </Route>

      <Route path="/print/corrective-maintenance/:id/history/:recordId">
        {(params) => <ProtectedRoute permission="print_forms"><CorrectiveMaintenancePrintPage params={params} /></ProtectedRoute>}
      </Route>

      <Route path="/print/annual-plan/:year/schedule">
        {(params) => (
          <ProtectedRoute permission="print_forms">
            <AnnualPlanPrintPage params={{ ...params, schedule: "true" }} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/print/pm-record/:id/history/:recordId">
        {(params) => (
          <ProtectedRoute permission="print_forms">
            <PmRecordPrintPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/pm/history/:recordId">
        {(params) => (
          <ProtectedRoute permission="view_pm_records">
            <PmRecordPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/pm">
        {(params) => (
          <ProtectedRoute permission="view_pm_records">
            <PmRecordPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/machines/:id/corrective-maintenance">
        {(params) => (
          <ProtectedRoute permission="view_corrective_maintenance">
            <MachineCorrectiveMaintenancePage params={params} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/machines/:id/corrective-maintenance/history">
        {(params) => <ProtectedRoute permission="view_corrective_maintenance"><CmHistoryPage params={params} /></ProtectedRoute>}
      </Route>
      <Route path="/machines/:id/corrective-maintenance/history/:recordId">
        {(params) => <ProtectedRoute permission="view_corrective_maintenance"><MachineCorrectiveMaintenancePage params={params} /></ProtectedRoute>}
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

      <Route path="/maintenance-requests/closed-log">
        <ProtectedRoute permission="manage_maintenance_requests">
          <ClosedCorrectiveMaintenanceLogPage />
        </ProtectedRoute>
      </Route>

      <Route path="/maintenance-requests/archive">
        <ProtectedRoute permission="archive_maintenance_requests">
          <MaintenanceRequestsListPage scope="archived" />
        </ProtectedRoute>
      </Route>

      <Route path="/maintenance-requests/:id/external-maintenance">
        {(params) => <ProtectedRoute><ExternalMaintenanceRequestPage params={params} /></ProtectedRoute>}
      </Route>

      <Route path="/maintenance-requests/:id/external-maintenance-receipt">
        {(params) => <ProtectedRoute><ExternalMaintenanceReceiptPage params={params} /></ProtectedRoute>}
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

      <Route path="/spare-parts/new">
        <ProtectedRoute permission="manage_spare_parts">
          <SparePartFormPage />
        </ProtectedRoute>
      </Route>

      <Route path="/spare-parts/:id/edit">
        {(params) => (
          <ProtectedRoute permission="manage_spare_parts">
            <SparePartFormPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/spare-parts/:id/movements/new">
        {(params) => (
          <ProtectedRoute permission="view_spare_parts">
            <SparePartMovementFormPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/spare-parts/:id">
        {(params) => (
          <ProtectedRoute permission="view_spare_parts">
            <SparePartDetailPage params={params} />
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/spare-parts">
        <ProtectedRoute permission="view_spare_parts">
          <SparePartsListPage />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/users">
        <ProtectedRoute permission="manage_users">
          <UsersList />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/signature-permissions">
        <ProtectedRoute permission="manage_signatures">
          <SignaturePermissionsPage />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/departments">
        <ProtectedRoute permission="manage_users">
          <DepartmentsPage />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/roles">
        <ProtectedRoute permission="manage_users">
          <RolesPage />
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
            <LanguageProvider>
              <Router />
            </LanguageProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
