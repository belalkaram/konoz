import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { EmployeeProvider, useEmployee } from "@/contexts/employee-context";
import Login from "@/pages/login";
import { ErrorBoundary } from "@/components/error-boundary";

import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import OfferDetail from "@/pages/offer-detail";
import Orders from "@/pages/orders";
import Checkout from "@/pages/checkout";
import OrderDetail from "@/pages/order-detail";
import Customers from "@/pages/customers";
import CustomerProfile from "@/pages/customer-profile";
import Tickets from "@/pages/tickets";
import TicketForm from "@/pages/ticket-form";
import TicketDetail from "@/pages/ticket-detail";
import Reminders from "@/pages/reminders";
import EmployeesPage from "@/pages/employees";
import CompaniesPage from "@/pages/companies";
import HRManagement from "@/pages/hr";
import Reports from "@/pages/reports";
import NotAuthorized from "@/pages/not-authorized";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Retry more for network errors, less for API errors
        if (error?.message === "Network Error" || error?.name === "TypeError") return failureCount < 5;
        return failureCount < 2;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5000,
    },
  },
});

function SupervisorOrAdminRoute({ component: Component }: { component: any }) {
  const { currentEmployee } = useEmployee();
  const role = currentEmployee?.role;
  if (!currentEmployee || (role !== "Administrator" && role !== "Supervisor")) {
    return <NotAuthorized />;
  }
  return <Component />;
}

function AdminRoute({ component: Component }: { component: any }) {
  const { currentEmployee } = useEmployee();
  if (!currentEmployee || currentEmployee.role !== "Administrator") {
    return <NotAuthorized />;
  }
  return <Component />;
}

function HRRoute({ component: Component }: { component: any }) {
  const { currentEmployee } = useEmployee();
  const role = currentEmployee?.role;
  if (!currentEmployee || (role !== "Administrator" && role !== "HR")) {
    return <NotAuthorized />;
  }
  return <Component />;
}

function Router() {
  const { currentEmployee, isLoading } = useEmployee();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#011a13" }}>
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentEmployee) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/search" component={Search} />
        <Route path="/search/:offerRequestId" component={Search} />
        <Route path="/offers/:offerId" component={OfferDetail} />
        <Route path="/customers" component={Customers} />
        <Route path="/customers/:id" component={CustomerProfile} />
        <Route path="/tickets/new" component={TicketForm} />
        <Route path="/tickets/:id/edit" component={TicketForm} />
        <Route path="/tickets/:id" component={TicketDetail} />
        <Route path="/tickets" component={Tickets} />
        <Route path="/reminders" component={Reminders} />
        <Route path="/reports" component={Reports} />
        <Route path="/hr">{() => <HRRoute component={HRManagement} />}</Route>
        <Route path="/employees">{() => <SupervisorOrAdminRoute component={EmployeesPage} />}</Route>
        <Route path="/companies">{() => <AdminRoute component={CompaniesPage} />}</Route>
        <Route path="/orders" component={Orders} />
        <Route path="/orders/new" component={Checkout} />
        <Route path="/orders/:orderId" component={OrderDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <EmployeeProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </EmployeeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
