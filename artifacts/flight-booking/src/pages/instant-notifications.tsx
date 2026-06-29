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
import { Bell, Send, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Users, Wifi, WifiOff } from "lucide-react";
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

interface EmployeeOnlineStatus {
  id: number;
  name: string;
  role: string;
  isOnline: boolean;
  lastSeenAt: string | null;
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

  // Fetch online status with 5-second polling
  const { data: onlineStatuses = [] } = useQuery<EmployeeOnlineStatus[]>({
    queryKey: ["notifications-online-status"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/notifications/online-status`);
      if (!res.ok) throw new Error("Failed to fetch online status");
      const data = await res.json();
      return data.employees;
    },
    refetchInterval: 5000,
  });

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

  const onlineCount = onlineStatuses.filter(e => e.isOnline).length;

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
      queryClient.invalidateQueries({ queryKey: ["notifications-history"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-online-status"] });
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

  const getLastSeenText = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return language === "ar" ? "لم يتصل من قبل" : "Never connected";
    const diff = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 1000);
    if (diff < 60) return language === "ar" ? "منذ ثوان" : "Just now";
    if (diff < 3600) return language === "ar" ? `منذ ${Math.floor(diff / 60)} دقيقة` : `${Math.floor(diff / 60)}m ago`;
    return formatDateTime(lastSeenAt);
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

      {/* Online Status Panel */}
      <Card className="shadow-sm border-slate-100 dark:border-slate-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            {language === "ar" ? "حالة الموظفين الآن" : "Live Employee Status"}
            <span className="ms-auto text-xs font-normal text-muted-foreground">
              {language === "ar"
                ? `${onlineCount} متصل من ${onlineStatuses.length}`
                : `${onlineCount} of ${onlineStatuses.length} online`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {onlineStatuses.map((emp) => (
              <div
                key={emp.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                  emp.isOnline
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                    : "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/20"
                }`}
              >
                {/* Online indicator dot */}
                <div className="relative flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    emp.isOnline ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600"
                  }`}>
                    {emp.name.substring(0, 2).toUpperCase()}
                  </div>
                  {emp.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate leading-tight">{emp.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {emp.isOnline
                      ? (language === "ar" ? "متصل الآن" : "Online now")
                      : getLastSeenText(emp.lastSeenAt)}
                  </p>
                </div>
                {emp.isOnline
                  ? <Wifi className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  : <WifiOff className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                }
              </div>
            ))}
            {onlineStatuses.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                {language === "ar" ? "جاري تحميل حالة الموظفين..." : "Loading employee statuses..."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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
                    {employees.map((emp) => {
                      const status = onlineStatuses.find(s => s.id === emp.id);
                      return (
                        <SelectItem key={emp.id} value={emp.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status?.isOnline ? "bg-emerald-500" : "bg-slate-300"}`} />
                            {emp.name} ({emp.role})
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {receiverId && (() => {
                  const status = onlineStatuses.find(s => s.id === Number(receiverId));
                  return status ? (
                    <p className={`text-xs flex items-center gap-1.5 mt-1 ${status.isOnline ? "text-emerald-600" : "text-slate-400"}`}>
                      {status.isOnline
                        ? <><Wifi className="h-3 w-3" />{language === "ar" ? "متصل الآن - التنبيه سيظهر فوراً" : "Online now — alert will appear instantly"}</>
                        : <><WifiOff className="h-3 w-3" />{language === "ar" ? "غير متصل - سيظهر عند دخوله" : "Offline — will appear when they log in"}</>
                      }
                    </p>
                  ) : null;
                })()}
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
                          <div className="flex items-center gap-2">
                            {(() => {
                              const empStatus = onlineStatuses.find(s => s.id === item.receiverId);
                              return empStatus ? (
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${empStatus.isOnline ? "bg-emerald-500" : "bg-slate-300"}`} />
                              ) : null;
                            })()}
                            {item.receiverName}
                          </div>
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
                              {language === "ar" ? "تم الرد" : "Responded"}
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
