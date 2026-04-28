import { useListOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Orders() {
  const { data, isLoading, isError } = useListOrders({ limit: 50 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">Manage all flight bookings and reservations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : isError || !data ? (
            <div className="text-destructive py-4 text-center">Failed to load orders</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((order) => {
                  const passenger = order.passengers?.[0] as any;
                  const paxName = passenger ? `${passenger.givenName} ${passenger.familyName}` : 'Unknown';
                  const slice = order.slices?.[0];
                  
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.bookingReference}</TableCell>
                      <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                      <TableCell>
                        {slice ? `${slice.origin.iataCode} - ${slice.destination.iataCode}` : 'N/A'}
                      </TableCell>
                      <TableCell>{paxName}</TableCell>
                      <TableCell>
                        <Badge variant={
                          order.status === 'CONFIRMED' ? 'default' :
                          order.status === 'CANCELLED' ? 'destructive' :
                          'secondary'
                        }>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(order.totalAmount, order.totalCurrency)}</TableCell>
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
                {data.orders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No orders found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
