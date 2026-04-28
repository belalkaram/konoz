import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

import Dashboard from "@/pages/dashboard";
import Search from "@/pages/search";
import OfferDetail from "@/pages/offer-detail";
import Orders from "@/pages/orders";
import Checkout from "@/pages/checkout";
import OrderDetail from "@/pages/order-detail";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/search" component={Search} />
        <Route path="/search/:offerRequestId" component={Search} />
        <Route path="/offers/:offerId" component={OfferDetail} />
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
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
