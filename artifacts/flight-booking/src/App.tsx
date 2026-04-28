import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { EmployeeProvider, useEmployee } from "@/contexts/employee-context";
import Login from "@/pages/login";

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

const queryClient = new QueryClient();

function AdminRoute({ component: Component }: { component: () => JSX.Element }) {
  const { currentEmployee } = useEmployee();
  if (!currentEmployee || currentEmployee.role !== "Administrator") {
    return <Redirect to="/" />;
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
        <Route path="/employees">{() => <AdminRoute component={EmployeesPage} />}</Route>
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
    <QueryClientProvider client={queryClient}>
      <EmployeeProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </EmployeeProvider>
    </QueryClientProvider>
  );
}

export default App;
