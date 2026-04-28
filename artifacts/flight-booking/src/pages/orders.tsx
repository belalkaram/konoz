import { useListOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";

function statusVariant(status: string) {
  if (status === "confirmed") return "default";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

export default function Orders() {
  const { data, isLoading, isError } = useListOrders({ limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Manage all flight bookings and reservations.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Bookings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError || !data ? (
            <div className="text-destructive py-8 text-center p-6">Failed to load orders</div>
          ) : data.orders.length === 0 ? (
            <div className="text-center py-16 px-6">
              <Plane className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
              <p className="font-medium">No orders yet</p>
              <p className="text-sm text-muted-foreground mt-1">Book a flight to get started.</p>
              <Link href="/search">
                <Button className="mt-4" size="sm">Search Flights</Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Passenger</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.map((order) => {
                      const passenger = order.passengers?.[0] as Record<string, string> | undefined;
                      const paxName = passenger
                        ? `${passenger.givenName ?? ""} ${passenger.familyName ?? ""}`.trim()
                        : "Unknown";
                      const slice = order.slices?.[0];

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.bookingReference}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(order.createdAt)}
                          </TableCell>
                          <TableCell>
                            {slice
                              ? `${slice.origin.iataCode} → ${slice.destination.iataCode}`
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-sm">{paxName}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(order.status ?? "")}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(order.totalAmount, order.totalCurrency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/orders/${order.id}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {data.orders.map((order) => {
                  const passenger = order.passengers?.[0] as Record<string, string> | undefined;
                  const paxName = passenger
                    ? `${passenger.givenName ?? ""} ${passenger.familyName ?? ""}`.trim()
                    : "Unknown";
                  const slice = order.slices?.[0];

                  return (
                    <Link key={order.id} href={`/orders/${order.id}`}>
                      <div className="flex items-center justify-between px-4 py-4 hover:bg-accent/30 transition-colors active:bg-accent/50">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{order.bookingReference}</span>
                            <Badge variant={statusVariant(order.status ?? "")} className="text-xs">
                              {order.status}
                            </Badge>
                          </div>
                          {slice && (
                            <div className="flex items-center gap-1 text-sm font-medium">
                              <span>{slice.origin.iataCode}</span>
                              <Plane className="h-3 w-3 text-muted-foreground" />
                              <span>{slice.destination.iataCode}</span>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">{paxName}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                          <div className="font-bold text-primary">
                            {formatCurrency(order.totalAmount, order.totalCurrency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(order.createdAt)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
