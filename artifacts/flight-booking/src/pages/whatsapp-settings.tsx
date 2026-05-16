import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, LogOut, CheckCircle2 } from "lucide-react";
import { authFetch, BASE } from "@/lib/api";

export default function WhatsappSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-instance"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance`);
      if (!res.ok) throw new Error("Failed to fetch instance");
      return res.json() as Promise<{ instanceName: string; status: string; qrCode: string | null }>;
    },
    refetchInterval: isPolling ? 3000 : false,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance/connect`, { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to connect");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsPolling(true);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
    },
    onError: (err: any) => {
      toast({
        title: "Connection Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to logout");
      }
    },
    onSuccess: () => {
      setIsPolling(false);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });
      toast({ title: "Logged out successfully" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // Stop polling if connected
  if (isPolling && data?.status === "open") {
    setIsPolling(false);
    toast({ title: "Connected to WhatsApp successfully!" });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = data?.status === "open";
  const isConnecting = data?.status === "connecting";

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl text-foreground">
            <QrCode className="h-6 w-6 text-primary" />
            WhatsApp Settings
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Link your WhatsApp number to reply to customers and send notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
            <div>
              <p className="text-sm font-medium text-foreground">Connection Status</p>
              <div className="flex items-center gap-2 mt-1">
                {isConnected ? (
                  <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" /> Connected
                  </span>
                ) : isConnecting ? (
                  <span className="flex items-center gap-1.5 text-yellow-600 text-sm font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" /> Pending / Connecting
                  </span>
                ) : (
                  <span className="text-destructive text-sm font-medium">Disconnected</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">Session ID</p>
              <p className="text-sm text-muted-foreground mt-1">{data?.instanceName}</p>
            </div>
          </div>

          {!isConnected && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-lg bg-muted/10">
              {data?.qrCode ? (
                <div className="space-y-4 text-center">
                  <div className="bg-white p-4 rounded-xl inline-block border border-border">
                    <img src={data.qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Open WhatsApp on your phone, go to Linked Devices, and scan the code above.
                  </p>
                  {!isPolling && (
                    <Button
                      variant="outline"
                      className="mt-4 border-primary text-primary hover:bg-primary/10"
                      onClick={() => setIsPolling(true)}
                    >
                      Start Connection Check
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <QrCode className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">No QR code generated yet.</p>
                  <Button
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {connectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generate QR Code
                  </Button>
                </div>
              )}
            </div>
          )}

          {isConnected && (
            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                Logout and Disconnect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
