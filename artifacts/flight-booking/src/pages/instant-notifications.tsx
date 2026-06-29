import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmployee } from "@/contexts/employee-context";
import { useLanguage } from "@/contexts/language-context";
import { authFetch, BASE } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/page-header";
import { Bell, Send, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";

interface NotificationHistoryItem {
  id: number;
  senderId: number;
  receiverId: number;
  message: string;
  button1Label: string;
  button2Label: string;
  clickedButton: string | null;
  status: "pending" | "responded" | "dismissed";
  createdAt: string;
  respondedAt: string | null;
  senderName: string;
  receiverName: string;
}

export default function InstantNotifications() {
  const { employees } = useEmployee();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [receiverId, setReceiverId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [button1Label, setButton1Label] = useState<string>(language === "ar" ? "موافق" : "Accept");
  const [button2Label, setButton2Label] = useState<string>(language === "ar" ? "مرفوض" : "Decline");

  // Fetch history with 3 seconds polling interval to see responses in real-time
  const { data: history = [], isLoading, refetch, isFetching } = useQuery<NotificationHistoryItem[]>({
    queryKey: ["notifications-history"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/notifications/history`);
      if (!res.ok) throw new Error("Failed to fetch notification history");
      const data = await res.json();
      return data.history;
    },
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/notifications`, {
        method: "POST",
        body: JSON.stringify({
          receiverId: Number(receiverId),
          message,
          button1Label,
          button2Label,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send notification");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: language === "ar" ? "تم إرسال التنبيه بنجاح" : "Notification sent successfully",
        description: data.isOnline
          ? (language === "ar" ? "الموظف متصل الآن وسيظهر له التنبيه فوراً" : "Employee is online and will see it instantly")
          : (language === "ar" ? "الموظف غير متصل حالياً، سيظهر له التنبيه عند فتح السيستم" : "Employee is offline, they will see it when they open the system"),
      });
      setMessage("");
      // Keep button labels or reset to defaults
      queryClient.invalidateQueries({ queryKey: ["notifications-history"] });
    },
    onError: (err: Error) => {
      toast({
        title: language === "ar" ? "خطأ في الإرسال" : "Failed to send",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId) {
      toast({
        title: language === "ar" ? "تنبيه" : "Warning",
        description: language === "ar" ? "من فضلك اختر الموظف" : "Please select an employee",
        variant: "destructive",
      });
      return;
    }
    if (!message.trim()) {
      toast({
        title: language === "ar" ? "تنبيه" : "Warning",
        description: language === "ar" ? "من فضلك اكتب نص الرسالة" : "Please write the message text",
        variant: "destructive",
      });
      return;
    }
    sendMutation.mutate();
  };

  const getStatusBadge = (item: NotificationHistoryItem) => {
    switch (item.status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
            <Clock className="h-3.5 w-3.5 animate-pulse" />
            {language === "ar" ? "في الانتظار" : "Pending"}
          </span>
        );
      case "responded":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {language === "ar" ? "تم الرد" : "Responded"}
          </span>
        );
      case "dismissed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
            <XCircle className="h-3.5 w-3.5" />
            {language === "ar" ? "تم الإغلاق" : "Dismissed"}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={language === "ar" ? "التنبيهات اللحظية للموظفين" : "Instant Employee Alerts"}
        description={
          language === "ar"
            ? "أرسل رسائل وتنبيهات فورية تظهر كـ نافذة منبثقة للموظفين أثناء عملهم على النظام، مع زرار خيارات مخصصة."
            : "Send instant popup notifications with custom action buttons to employees working in the system."
        }
        icon={Bell}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث السجل" : "Refresh History"}
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Send Notification Form */}
        <Card className="lg:col-span-1 shadow-sm border-slate-100 dark:border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              {language === "ar" ? "إرسال تنبيه جديد" : "Send New Alert"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="employee-select">{language === "ar" ? "الموظف المستلم" : "Target Employee"}</Label>
                <Select value={receiverId} onValueChange={setReceiverId}>
                  <SelectTrigger id="employee-select">
                    <SelectValue placeholder={language === "ar" ? "اختر موظف..." : "Select employee..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.name} ({emp.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="message-input">{language === "ar" ? "نص التنبيه" : "Message Text"}</Label>
                <Textarea
                  id="message-input"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    language === "ar"
                      ? "اكتب الرسالة التي ستظهر للموظف هنا..."
                      : "Type the message that will appear to the employee..."
                  }
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="btn1-input">{language === "ar" ? "الزر الأول (الأساسي)" : "Button 1 (Primary)"}</Label>
                  <Input
                    id="btn1-input"
                    value={button1Label}
                    onChange={(e) => setButton1Label(e.target.value)}
                    maxLength={30}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="btn2-input">{language === "ar" ? "الزر الثاني (الفرعي)" : "Button 2 (Secondary)"}</Label>
                  <Input
                    id="btn2-input"
                    value={button2Label}
                    onChange={(e) => setButton2Label(e.target.value)}
                    maxLength={30}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-4 flex items-center justify-center gap-2"
                disabled={sendMutation.isPending}
              >
                <Send className="h-4 w-4" />
                {sendMutation.isPending
                  ? (language === "ar" ? "جاري الإرسال..." : "Sending...")
                  : (language === "ar" ? "إرسال التنبيه الآن" : "Send Alert Now")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sent History List */}
        <Card className="lg:col-span-2 shadow-sm border-slate-100 dark:border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              {language === "ar" ? "سجل التنبيهات والردود اللحظية" : "Alerts & Real-time Responses History"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span>{language === "ar" ? "جاري تحميل السجل..." : "Loading history..."}</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-25 text-slate-400" />
                <p className="text-sm">
                  {language === "ar" ? "لم يتم إرسال أي تنبيهات بعد." : "No alerts have been sent yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "المستلم" : "Receiver"}</TableHead>
                      <TableHead>{language === "ar" ? "الرسالة" : "Message"}</TableHead>
                      <TableHead>{language === "ar" ? "الخيارات المتاحة" : "Options"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{language === "ar" ? "استجابة الموظف" : "Response"}</TableHead>
                      <TableHead className="text-end">{language === "ar" ? "التوقيت" : "Time"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <TableCell className="font-semibold text-sm whitespace-nowrap">
                          {item.receiverName}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate" title={item.message}>
                          {item.message}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 mr-1">
                            {item.button1Label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                            {item.button2Label}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(item)}</TableCell>
                        <TableCell>
                          {item.status === "responded" && item.clickedButton ? (
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/30">
                              {item.clickedButton}
                            </span>
                          ) : item.status === "dismissed" ? (
                            <span className="text-xs text-muted-foreground italic">
                              {language === "ar" ? "تجاهل الرسالة" : "Dismissed"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              {language === "ar" ? "في انتظار الرد..." : "Awaiting response..."}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-end text-xs text-muted-foreground whitespace-nowrap">
                          <div>{formatDateTime(item.createdAt)}</div>
                          {item.respondedAt && (
                            <div className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">
                              {language === "ar" ? "تم الرد خلال دقيقة" : "Responded"}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
