import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Phone, User, Clock, CheckCircle2, MessageSquare, AlertCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { authFetch, BASE } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Contact = {
  phone: string;
  lastMessageAt: string;
  messageBody: string;
};

type Message = {
  id: number;
  messageId: string;
  messageBody: string;
  messageType: string;
  isFromMe: boolean;
  timestamp: string;
};

export default function Chat() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch Connection Status
  const { data: instanceStatus } = useQuery({
    queryKey: ["whatsapp-instance"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance`);
      if (!res.ok) throw new Error("Failed to fetch instance status");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Fetch Contacts
  const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
    queryKey: ["whatsapp-contacts"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/contacts`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const data = await res.json();
      return data.contacts as Contact[];
    },
    refetchInterval: 5000,
  });

  // Fetch Messages for selected contact
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["whatsapp-messages", selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return [];
      const res = await authFetch(`${BASE}/api/whatsapp/messages/${selectedPhone}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      return data.messages as Message[];
    },
    enabled: !!selectedPhone,
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!selectedPhone) return;
      const res = await authFetch(`${BASE}/api/whatsapp/messages/${selectedPhone}`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedPhone] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
    },
    onError: (err: any) => {
      toast({
        title: "فشل الإرسال",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesData]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedPhone) return;
    sendMessageMutation.mutate(messageText.trim());
  };

  const handleNewChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) return;
    setSelectedPhone(newPhone.trim());
    setIsNewChatOpen(false);
    setNewPhone("");
  };

  const isConnected = instanceStatus?.status === "open";

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-slate-900/50 border border-emerald-900/30 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 backdrop-blur-sm">
      
      {/* Contacts Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-slate-800 bg-slate-950/50 flex flex-col">
        <div className="p-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-emerald-50 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-400" />
              المحادثات
            </h2>
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-emerald-50">محادثة جديدة</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleNewChat} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">رقم الهاتف (مع رمز الدولة، بدون +)</Label>
                    <Input 
                      placeholder="مثال: 201012345678" 
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-emerald-500"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
                    بدء المحادثة
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium">
            {isConnected ? (
              <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-emerald-400">متصل بالواتساب</span></>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-400">غير متصل - يرجى مراجعة الإعدادات</span></>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingContacts ? (
              <p className="text-sm text-slate-400 text-center py-4">جاري التحميل...</p>
            ) : contactsData?.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">لا توجد محادثات سابقة</p>
            ) : (
              contactsData?.map((contact) => (
                <button
                  key={contact.phone}
                  onClick={() => setSelectedPhone(contact.phone)}
                  className={`w-full text-left p-3 rounded-lg flex gap-3 transition-colors ${selectedPhone === contact.phone ? "bg-emerald-900/30 border border-emerald-800/50" : "hover:bg-slate-800/50 border border-transparent"}`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-emerald-400/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-medium text-emerald-100 truncate" dir="ltr">{contact.phone}</h3>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {format(new Date(contact.lastMessageAt), "h:mm a", { locale: ar })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate pr-2">
                      {contact.messageBody}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900/20">
        {selectedPhone ? (
          <>
            <div className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-6 gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center">
                <Phone className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-50" dir="ltr">+{selectedPhone}</h3>
                <p className="text-xs text-slate-400">محادثة عميل</p>
              </div>
            </div>

            <div 
              className="flex-1 overflow-y-auto p-6 space-y-4"
              ref={scrollRef}
            >
              {isLoadingMessages ? (
                <p className="text-center text-slate-400 text-sm">جاري تحميل الرسائل...</p>
              ) : messagesData?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
                  <MessageSquare className="h-12 w-12 opacity-20" />
                  <p>لا توجد رسائل سابقة. أرسل رسالة للبدء.</p>
                </div>
              ) : (
                messagesData?.map((msg) => {
                  const isMe = msg.isFromMe;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-start" : "items-end"} max-w-[80%] ${isMe ? "mr-auto" : "ml-auto"}`}>
                      <div className={`px-4 py-2 rounded-2xl ${isMe ? "bg-emerald-600 text-white rounded-tr-sm" : "bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700"}`}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.messageBody}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[10px] text-slate-500">
                          {format(new Date(msg.timestamp), "h:mm a", { locale: ar })}
                        </span>
                        {isMe && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-slate-900/80 border-t border-slate-800">
              {!isConnected && (
                <div className="mb-3 px-4 py-2 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  يجب ربط الواتساب الخاص بك لإرسال واستقبال الرسائل.
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  placeholder="اكتب رسالة..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={!isConnected || sendMessageMutation.isPending}
                  className="flex-1 bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-emerald-500"
                />
                <Button 
                  type="submit" 
                  size="icon"
                  disabled={!messageText.trim() || !isConnected || sendMessageMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-emerald-900" />
            </div>
            <h3 className="text-xl font-medium text-slate-400">نظام محادثات الواتساب</h3>
            <p className="text-sm max-w-md text-center leading-relaxed">
              اختر محادثة من القائمة الجانبية أو ابدأ محادثة جديدة مع عميل للتواصل المباشر.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
