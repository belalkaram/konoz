import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Phone, User, Clock, CheckCircle2, MessageSquare, AlertCircle, Plus, ArrowLeft, Mic, Square } from "lucide-react";
import { format } from "date-fns";
import { authFetch, BASE } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/language-context";

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
  const { t, language, isRtl } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

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
    mutationFn: async (payload: { text?: string; audio?: string }) => {
      if (!selectedPhone) return;
      const res = await authFetch(`http://localhost:3000/api/whatsapp/messages/${selectedPhone}`, {
        method: "POST",
        body: JSON.stringify(payload),
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
        title: language === "ar" ? "فشل الإرسال" : "Failed to send",
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
    sendMessageMutation.mutate({ text: messageText.trim() });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          sendMessageMutation.mutate({ audio: base64data });
        };
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      toast({
        title: language === "ar" ? "تم رفض الإذن" : "Permission Denied",
        description: language === "ar" ? "لا يمكن الوصول إلى الميكروفون." : "Cannot access microphone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
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
    <div className="flex h-[calc(100vh-8rem)] bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      
      {/* Contacts Sidebar */}
      <div className={`w-full md:w-80 flex-shrink-0 border-e border-border bg-muted/20 flex flex-col ${selectedPhone ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border bg-background text-start">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {t("chat.title")}
            </h2>
            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader className="text-start">
                  <DialogTitle className="text-foreground">{t("chat.newChat")}</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    {t("chat.enterPhone")}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleNewChat} className="space-y-4 text-start">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t("chat.phoneLabel")}</Label>
                    <Input 
                      placeholder={t("chat.phonePlaceholder")} 
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="bg-background border-border text-foreground focus-visible:ring-primary"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                    {t("chat.startChatBtn")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border text-xs font-medium">
            {isConnected ? (
              <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-emerald-600">{t("chat.connectedText")}</span></>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-destructive" /><span className="text-destructive">{t("chat.disconnectedText")}</span></>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingContacts ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("common.loading")}</p>
            ) : contactsData?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("chat.noConversations")}</p>
            ) : (
              contactsData?.map((contact) => (
                <button
                  key={contact.phone}
                  onClick={() => setSelectedPhone(contact.phone)}
                  className={`w-full text-start p-3 rounded-lg flex gap-3 transition-colors ${selectedPhone === contact.phone ? "bg-primary/10 border border-primary/20" : "hover:bg-accent border border-transparent"}`}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-medium text-foreground truncate" dir="ltr">+{contact.phone}</h3>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {format(new Date(contact.lastMessageAt), "h:mm a")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate pe-2">
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
      <div className={`flex-1 flex flex-col min-w-0 bg-background ${selectedPhone ? "flex" : "hidden md:flex"}`}>
        {selectedPhone ? (
          <>
            <div className="h-16 border-b border-border bg-card flex items-center px-4 md:px-6 gap-2 md:gap-4 text-start">
              <Button 
                size="icon" 
                variant="ghost" 
                className="md:hidden h-8 w-8 text-muted-foreground" 
                onClick={() => setSelectedPhone(null)}
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground" dir="ltr">+{selectedPhone}</h3>
                <p className="text-xs text-muted-foreground">{t("chat.customerChat")}</p>
              </div>
            </div>

            <div 
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
              ref={scrollRef}
            >
              {isLoadingMessages ? (
                <p className="text-center text-muted-foreground text-sm">{t("chat.loadingMessages")}</p>
              ) : messagesData?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3">
                  <MessageSquare className="h-12 w-12 opacity-20" />
                  <p>{t("chat.noMessagesYet")}</p>
                </div>
              ) : (
                messagesData?.map((msg) => {
                  const isMe = msg.isFromMe;
                  const isAudio = msg.messageType === "audio";
                  
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end ms-auto" : "items-start me-auto"} max-w-[85%] md:max-w-[80%]`}>
                      <div className={`px-4 py-2 rounded-2xl ${isMe ? "bg-primary text-primary-foreground rounded-se-sm" : "bg-muted text-foreground rounded-ss-sm border border-border"}`}>
                        {isAudio ? (
                          <audio src={msg.messageBody} controls className="max-w-full" />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.messageBody}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(msg.timestamp), "h:mm a")}
                        </span>
                        {isMe && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-card border-t border-border">
              {!isConnected && (
                <div className="mb-3 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm text-start">
                  <AlertCircle className="h-4 w-4" />
                  {t("chat.linkRequired")}
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  placeholder={t("chat.inputPlaceholder")}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={!isConnected || sendMessageMutation.isPending || isRecording}
                  className="flex-1 bg-background border-border text-foreground focus-visible:ring-primary"
                />
                
                {isRecording ? (
                  <Button 
                    type="button" 
                    size="icon"
                    variant="destructive"
                    onClick={stopRecording}
                    className="flex-shrink-0 animate-pulse"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    size="icon"
                    variant="ghost"
                    onClick={startRecording}
                    disabled={!isConnected || sendMessageMutation.isPending}
                    className="text-muted-foreground hover:text-primary flex-shrink-0"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}

                <Button 
                  type="submit" 
                  size="icon"
                  disabled={!messageText.trim() || !isConnected || sendMessageMutation.isPending || isRecording}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0 rtl:rotate-180"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="text-xl font-medium text-foreground">{t("chat.chatSystemTitle")}</h3>
            <p className="text-sm max-w-md text-center leading-relaxed">
              {t("chat.chatSystemDesc")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
