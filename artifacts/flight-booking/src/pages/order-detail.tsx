import { useRoute } from "wouter";
import { useGetOrder, getGetOrderQueryKey, useCancelOrder } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { FileText, XCircle, AlertTriangle } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:orderId");
  const orderId = params?.orderId;
  const { t, language, isRtl } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: order, isLoading, isError } = useGetOrder(orderId || "", {
    query: {
      enabled: !!orderId,
      queryKey: getGetOrderQueryKey(orderId || "")
    }
  });

  const cancelOrder = useCancelOrder();

  const handleCancel = () => {
    if (!orderId) return;
    cancelOrder.mutate({ orderId } as any, {
      onSuccess: () => {
        toast({
          title: language === "ar" ? "تم إلغاء الطلب" : "Order Cancelled",
          description: language === "ar" ? "تم إلغاء حجز الطيران بنجاح." : "The booking has been successfully cancelled."
        });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
      },
      onError: (err) => {
        toast({
          title: language === "ar" ? "فشل إلغاء الحجز" : "Cancellation Failed",
          description: err.message,
          variant: "destructive"
        });
      }
    });
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !order) return <div className="text-center py-12 text-muted-foreground">{language === "ar" ? "فشل تحميل تفاصيل الطلب" : "Failed to load order details"}</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-start">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {language === "ar" ? `طلب ${order.bookingReference}` : `Order ${order.bookingReference}`}
            </h1>
            <Badge variant={
              order.status === 'CONFIRMED' ? 'default' :
              order.status === 'CANCELLED' ? 'destructive' :
              'secondary'
            } className="text-sm">
              {language === "ar" ? t("statuses." + order.status.toLowerCase()) : order.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {language === "ar" ? `تم الحجز في ${formatDateTime(order.createdAt)}` : `Booked on ${formatDateTime(order.createdAt)}`}
          </p>
        </div>
        
        {order.status !== 'CANCELLED' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <XCircle className="w-4 h-4 me-2" />
                {language === "ar" ? "إلغاء الحجز" : "Cancel Booking"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="text-start">
              <AlertDialogHeader>
                <AlertDialogTitle>{language === "ar" ? "هل أنت متأكد تماماً؟" : "Are you absolutely sure?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {language === "ar"
                    ? `هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى إلغاء حجز الطيران ذو المرجع ${order.bookingReference} بشكل نهائي.`
                    : `This action cannot be undone. This will permanently cancel the booking reference ${order.bookingReference}.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel>{language === "ar" ? "الاحتفاظ بالحجز" : "Keep Booking"}</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {language === "ar" ? "نعم، إلغاء الحجز" : "Yes, cancel booking"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3 text-start">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "خط سير الرحلة" : "Itinerary"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.slices?.map((slice, i) => (
                <div key={slice.id || i} className="p-4 border rounded-lg bg-muted/20">
                  <div className="font-medium mb-2 flex flex-wrap items-center gap-1.5">
                    <span>{slice.origin.name} ({slice.origin.iataCode})</span>
                    <span>{isRtl ? "←" : "→"}</span>
                    <span>{slice.destination.name} ({slice.destination.iataCode})</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ar" ? "المغادرة" : "Departure"}</span>
                      <span>{formatDateTime(slice.departureDateTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ar" ? "الوصول" : "Arrival"}</span>
                      <span>{formatDateTime(slice.arrivalDateTime)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "المسافرين" : "Passengers"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.passengers?.map((p: any, i) => (
                  <div key={p.id || i} className="flex justify-between items-center p-3 border-b last:border-0">
                    <div>
                      <div className="font-medium">{p.title} {p.givenName} {p.familyName}</div>
                      <div className="text-sm text-muted-foreground">{p.email} &bull; {p.phoneNumber}</div>
                    </div>
                    <Badge variant="outline" className="uppercase">
                      {p.type === "CHILD" ? (language === "ar" ? "طفل" : "CHILD") : p.type === "INFANT" ? (language === "ar" ? "رضيع" : "INFANT") : (language === "ar" ? "بالغ" : "ADULT")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "تفاصيل الدفع" : "Payment Details"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">{language === "ar" ? "الحالة" : "Status"}</span>
                <Badge variant={order.paymentStatus?.awaitingPayment ? "outline" : "default"}>
                  {order.paymentStatus?.awaitingPayment ? (language === "ar" ? "بانتظار الدفع" : "Awaiting Payment") : (language === "ar" ? "مدفوع" : "Paid")}
                </Badge>
              </div>
              <div className="flex justify-between font-bold pt-2">
                <span>{language === "ar" ? "المبلغ الإجمالي" : "Total Amount"}</span>
                <span className="text-primary text-xl">{formatCurrency(order.totalAmount, order.totalCurrency)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "المستندات" : "Documents"}</CardTitle>
            </CardHeader>
            <CardContent>
              {order.documents && order.documents.length > 0 ? (
                <div className="space-y-2">
                  {order.documents.map((doc: any, i) => (
                    <Button key={i} variant="outline" className="w-full justify-start" asChild>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        <span>{language === "ar" ? `مستند ${doc.type}` : `${doc.type} Document`}</span>
                      </a>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4 flex flex-col items-center">
                  <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
                  {language === "ar" ? "لا تتوفر مستندات حالياً" : "No documents available yet"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
