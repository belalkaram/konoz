import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import { useGetOffer, getGetOfferQueryKey, useCreateOrder } from "@workspace/api-client-react";
import type { PassengerDetails, PassengerDetailsGender, PassengerDetailsTitle } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const offerId = searchParams.get("offerId");
  const { toast } = useToast();

  function getSessionOffer(offerId: string) {
    try {
      const raw = sessionStorage.getItem(`offer_${offerId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  const cachedOffer = getSessionOffer(offerId || "");

  const { data: offer, isLoading: isOfferLoading, isError, error } = useGetOffer(offerId || "", {
    query: {
      enabled: !!offerId && !cachedOffer,
      initialData: cachedOffer,
      staleTime: Infinity,
      queryKey: getGetOfferQueryKey(offerId || ""),
      retry: false,
    }
  });

  const createOrder = useCreateOrder();

  const [passenger, setPassenger] = useState<Partial<PassengerDetails>>({
    title: "mr",
    givenName: "",
    familyName: "",
    gender: "m",
    bornOn: "1990-01-01",
    email: "",
    phoneNumber: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerId || !offer) return;

    if (!passenger.givenName || !passenger.familyName || !passenger.email || !passenger.phoneNumber) {
      toast({
        title: "Missing fields",
        description: "Please complete all required passenger details.",
        variant: "destructive"
      });
      return;
    }

    const passengerData: PassengerDetails = {
      id: (offer as any).passengers?.[0]?.id || "pass_1",
      title: passenger.title as PassengerDetailsTitle,
      givenName: passenger.givenName,
      familyName: passenger.familyName,
      gender: passenger.gender as PassengerDetailsGender,
      bornOn: passenger.bornOn || "1990-01-01",
      email: passenger.email,
      phoneNumber: passenger.phoneNumber
    };

    createOrder.mutate({
      data: {
        selectedOfferId: offerId,
        passengers: [passengerData],
        type: "instant"
      }
    }, {
      onSuccess: (order) => {
        toast({ title: "Booking Confirmed!", description: `Reference: ${order.bookingReference}` });
        setLocation(`/orders/${order.id}`);
      },
      onError: (err) => {
        toast({
          title: "Booking Failed",
          description: err.message || "Could not complete booking.",
          variant: "destructive"
        });
      }
    });
  };

  if (!offerId) {
    return <div>No offer selected.</div>;
  }

  if (isOfferLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError) {
    const apiError = error as { status?: number; message?: string } | null;
    const isAirlineError = apiError?.status === 502;
    const isExpired = apiError?.status === 404;
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-md shadow-sm">
          <h2 className="text-xl font-bold mb-2">{isAirlineError ? "Airline System Error" : isExpired ? "Offer Expired" : "Error Loading Offer"}</h2>
          <p>
            {isAirlineError
              ? "The airline's system returned an error. This is a temporary issue on the airline's side. Please go back and search again."
              : isExpired
              ? "This offer is no longer available. It may have expired. Please search again for updated results."
              : apiError?.message || "Failed to load offer details. It may be invalid or expired."}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/search")}>
            ← Back to Search
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        <p className="text-muted-foreground mt-1">Enter passenger details to confirm your booking.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Passenger Information</CardTitle>
              <CardDescription>Names must exactly match government-issued photo ID.</CardDescription>
            </CardHeader>
            <CardContent>
              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2 col-span-1">
                    <Label>Title</Label>
                    <Select value={passenger.title} onValueChange={(v) => setPassenger({...passenger, title: v as PassengerDetailsTitle})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mr">Mr</SelectItem>
                        <SelectItem value="mrs">Mrs</SelectItem>
                        <SelectItem value="ms">Ms</SelectItem>
                        <SelectItem value="miss">Miss</SelectItem>
                        <SelectItem value="dr">Dr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-3 text-red">
                    <Label>Gender</Label>
                    <Select value={passenger.gender} onValueChange={(v) => setPassenger({...passenger, gender: v as PassengerDetailsGender})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">Male</SelectItem>
                        <SelectItem value="f">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="givenName">First Name</Label>
                    <Input 
                      id="givenName" 
                      required 
                      value={passenger.givenName} 
                      onChange={e => setPassenger({...passenger, givenName: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="familyName">Last Name</Label>
                    <Input 
                      id="familyName" 
                      required 
                      value={passenger.familyName} 
                      onChange={e => setPassenger({...passenger, familyName: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input 
                      id="dob" 
                      type="date" 
                      required 
                      value={passenger.bornOn} 
                      onChange={e => setPassenger({...passenger, bornOn: e.target.value})} 
                    />
                  </div>
                </div>

                <h3 className="text-md font-medium mt-6 mb-2">Contact Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      required 
                      value={passenger.email} 
                      onChange={e => setPassenger({...passenger, email: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      type="tel" 
                      required 
                      value={passenger.phoneNumber} 
                      onChange={e => setPassenger({...passenger, phoneNumber: e.target.value})}
                      placeholder="+1234567890" 
                    />
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm font-medium">
                {offer?.slices[0]?.origin.iataCode} &rarr; {offer?.slices[0]?.destination.iataCode}
              </div>
              <div className="pt-4 border-t border-border flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{offer ? formatCurrency(offer.totalAmount, offer.totalCurrency) : ''}</span>
              </div>
            </CardContent>
            <div className="p-6 pt-0">
              <Button form="checkout-form" type="submit" className="w-full" disabled={createOrder.isPending}>
                {createOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Booking
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
