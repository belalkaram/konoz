import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Send, Phone, User, Clock, Check, CheckCheck, XCircle, 
  MessageSquare, AlertCircle, Plus, ArrowLeft, Mic, Square,
  Image as ImageIcon, FileText, Video, MapPin, Trash2, Forward, Paperclip, MoreVertical, CheckSquare, ListX, Trash, RefreshCw, Expand, Shrink
} from "lucide-react";
import { format } from "date-fns";
import { authFetch, BASE } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/language-context";

type Contact = {
  phone: string;
  name?: string | null;
  profilePictureUrl?: string | null;
  pushName?: string | null;
  lastSeen?: string | null;
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
  status: string;
  isForwarded: boolean;
  mediaUrl: string | null;
  mediaBase64: string | null;
  mimeType: string | null;
  fileName: string | null;
  caption: string | null;
  contactInfo: string | null;
  locationData: string | null;
};

export default function Chat() {
  const { toast } = useToast();
  const { t, language, isRtl } = useLanguage();
  const queryClient = useQueryClient();
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Selection state
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk Delete State
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);

  // Forwarding State
  const [isForwardMode, setIsForwardMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<number[]>([]);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardRecipients, setForwardRecipients] = useState<string[]>([]);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Queries
  const { data: instanceStatus } = useQuery({
    queryKey: ["whatsapp-instance"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/instance`);
      if (!res.ok) throw new Error("Failed to fetch instance status");
      return res.json();
    },
    refetchInterval: 10000,
  });

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

  const { data: quickReplies } = useQuery({
    queryKey: ["whatsapp-quick-replies"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/quick-replies`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: crmCustomer } = useQuery({
    queryKey: ["whatsapp-crm-customer", selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return null;
      const res = await authFetch(`${BASE}/api/whatsapp/customers/${selectedPhone}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedPhone
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesData]);

  const isConnected = instanceStatus?.status === "open";
  const selectedContact = contactsData?.find(c => c.phone === selectedPhone);

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async (payload: { text?: string; audio?: string }) => {
      if (!selectedPhone) return;
      const res = await authFetch(`${BASE}/api/whatsapp/messages/${selectedPhone}`, {
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
      toast({ title: language === "ar" ? "فشل الإرسال" : "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: { phone: string, status: string }) => {
      const res = await authFetch(`${BASE}/api/whatsapp/customers/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم التحديث" : "✅ Status updated" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const sendMediaMutation = useMutation({
    mutationFn: async (payload: { mediatype: string, media: string, caption?: string, fileName?: string, mimetype?: string }) => {
      if (!selectedPhone) return;
      const res = await authFetch(`${BASE}/api/whatsapp/messages/${selectedPhone}/media`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to send media");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", selectedPhone] });
    },
  });

  const forwardMessagesMutation = useMutation({
    mutationFn: async (payload: { messageIds: number[], recipientPhones: string[] }) => {
      const res = await authFetch(`${BASE}/api/whatsapp/messages/forward`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to forward");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "✅ تم إعادة التوجيه" : "✅ Forwarded successfully" });
      setForwardDialogOpen(false);
      setIsForwardMode(false);
      setSelectedMessageIds([]);
      setForwardRecipients([]);
    },
  });

  const deleteSingleChatMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await authFetch(`${BASE}/api/whatsapp/chats/${phone}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete chat");
      return res.json();
    },
    onSuccess: (_, phone) => {
      if (selectedPhone === phone) setSelectedPhone(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Chat deleted" });
    },
  });

  const deleteBulkChatsMutation = useMutation({
    mutationFn: async (phones: string[]) => {
      const res = await authFetch(`${BASE}/api/whatsapp/chats/delete-bulk`, {
        method: "POST",
        body: JSON.stringify({ phones }),
      });
      if (!res.ok) throw new Error("Failed to bulk delete");
      return res.json();
    },
    onSuccess: () => {
      setSelectedChats([]);
      setIsBulkDeleteMode(false);
      if (selectedPhone && selectedChats.includes(selectedPhone)) setSelectedPhone(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Chats deleted" });
    },
  });

  const deleteAllChatsMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/chats`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete all");
      return res.json();
    },
    onSuccess: () => {
      setSelectedPhone(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
      toast({ title: language === "ar" ? "تم حذف الكل" : "All chats deleted" });
    },
  });

  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${BASE}/api/whatsapp/contacts/sync`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to sync contacts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-contacts"] });
      toast({ title: language === "ar" ? "تم المزامنة" : "Contacts Synced" });
    },
  });

  // Action Handlers
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedPhone) return;
    sendMessageMutation.mutate({ text: messageText.trim() });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      const base64Data = base64.split(',')[1]; // Remove data URL prefix
      
      let mediatype = "document";
      if (file.type.startsWith("image/")) mediatype = "image";
      else if (file.type.startsWith("video/")) mediatype = "video";
      else if (file.type.startsWith("audio/")) mediatype = "audio";

      sendMediaMutation.mutate({
        mediatype,
        media: base64Data,
        caption: messageText || file.name,
        fileName: file.name,
        mimetype: file.type,
      });
      setMessageText("");
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          sendMessageMutation.mutate({ audio: reader.result as string });
        };
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      toast({ title: "Permission Denied", description: "Cannot access microphone.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setIsRecording(false);
  };

  const toggleBulkChat = (phone: string) => {
    setSelectedChats(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]);
  };

  const toggleForwardMessage = (id: number) => {
    setSelectedMessageIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const executeForward = () => {
    if (forwardRecipients.length === 0 || selectedMessageIds.length === 0) return;
    forwardMessagesMutation.mutate({ messageIds: selectedMessageIds, recipientPhones: forwardRecipients });
  };

  // Renderers
  const renderMessageStatus = (status: string, isFromMe: boolean) => {
    if (!isFromMe) return null;
    switch (status) {
      case "read": return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case "delivered": return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "sent": return <Check className="h-3 w-3 text-muted-foreground" />;
      case "failed": return <XCircle className="h-3 w-3 text-destructive" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const renderMessageContent = (msg: Message) => {
    switch (msg.messageType) {
      case "image":
        return (
          <div className="space-y-2">
            <img src={msg.mediaBase64 ? `data:${msg.mimeType};base64,${msg.mediaBase64}` : (msg.mediaUrl || "")} alt={msg.caption || "Image"} className="rounded-lg max-w-full h-auto max-h-64 object-cover" />
            {msg.caption && <p className="text-sm">{msg.caption}</p>}
          </div>
        );
      case "video":
        return (
          <div className="space-y-2">
            <video src={msg.mediaBase64 ? `data:${msg.mimeType};base64,${msg.mediaBase64}` : (msg.mediaUrl || "")} controls className="rounded-lg max-w-full max-h-64" />
            {msg.caption && <p className="text-sm">{msg.caption}</p>}
          </div>
        );
      case "audio":
        return <audio src={msg.mediaBase64 ? `data:${msg.mimeType};base64,${msg.mediaBase64}` : (msg.mediaUrl || "")} controls className="max-w-full w-64" />;
      case "document":
        return (
          <a href={msg.mediaBase64 ? `data:${msg.mimeType};base64,${msg.mediaBase64}` : (msg.mediaUrl || "")} download={msg.fileName || "document"} className="flex items-center gap-2 p-2 rounded-md bg-background/20 hover:bg-background/40 transition-colors">
            <FileText className="h-6 w-6" />
            <span className="text-sm font-medium underline truncate max-w-[200px]">{msg.fileName || "Document"}</span>
          </a>
        );
      case "sticker":
        return <img src={msg.mediaBase64 ? `data:${msg.mimeType};base64,${msg.mediaBase64}` : (msg.mediaUrl || "")} alt="Sticker" className="w-24 h-24" />;
      case "location":
        const loc = msg.locationData ? JSON.parse(msg.locationData) : null;
        return loc ? (
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-1 font-semibold"><MapPin className="h-4 w-4 text-rose-500" /> {loc.name || "Location"}</div>
            <p className="text-xs opacity-90">{loc.address}</p>
            <a href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer" className="text-xs underline mt-1 text-blue-200">View on Map</a>
          </div>
        ) : <p>[Location]</p>;
      case "contact":
        const ctc = msg.contactInfo ? JSON.parse(msg.contactInfo) : null;
        return ctc ? (
          <div className="flex items-center gap-2 p-2 bg-background/20 rounded-md">
            <User className="h-6 w-6" />
            <span className="text-sm font-medium">{ctc.name || "Contact"}</span>
          </div>
        ) : <p>[Contact]</p>;
      default:
        return <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.messageBody}</p>;
    }
  };

  return (
    <div className={`flex ${isFullscreen ? "fixed inset-0 z-50 bg-background" : "h-[calc(100vh-8rem)] rounded-xl"} border border-border shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-500`}>
      
      {/* ── Contacts Sidebar ── */}
      <div className={`w-full md:w-80 flex-shrink-0 border-e border-border bg-muted/20 flex flex-col ${selectedPhone ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b border-border bg-background text-start space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {t("chat.title")}
            </h2>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRtl ? "start" : "end"}>
                  <DropdownMenuItem onClick={() => syncContactsMutation.mutate()}>
                    <RefreshCw className={`me-2 h-4 w-4 ${syncContactsMutation.isPending ? "animate-spin" : ""}`} /> {language === "ar" ? "مزامنة جهات الاتصال" : "Sync Contacts"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setIsBulkDeleteMode(!isBulkDeleteMode); setSelectedChats([]); }}>
                    <CheckSquare className="me-2 h-4 w-4" /> {isBulkDeleteMode ? "Cancel Selection" : "Select Chats"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => {
                    if (confirm(language === "ar" ? "هل أنت متأكد من حذف جميع المحادثات نهائياً؟" : "Are you sure you want to delete ALL chats permanently?")) {
                      deleteAllChatsMutation.mutate();
                    }
                  }}>
                    <Trash className="me-2 h-4 w-4" /> {language === "ar" ? "حذف كل المحادثات" : "Delete All Chats"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-primary/10"><Plus className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("chat.newChat")}</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); if (newPhone.trim()) { setSelectedPhone(newPhone.trim()); setIsNewChatOpen(false); setNewPhone(""); } }} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("chat.phoneLabel")}</Label>
                      <Input placeholder={t("chat.phonePlaceholder")} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full">{t("chat.startChatBtn")}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border text-xs font-medium">
              {isConnected ? (
                <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-emerald-600">{t("chat.connectedText")}</span></>
              ) : (
                <><span className="w-2 h-2 rounded-full bg-destructive" /><span className="text-destructive">{t("chat.disconnectedText")}</span></>
              )}
            </div>
            {isBulkDeleteMode && selectedChats.length > 0 && (
              <Button size="sm" variant="destructive" onClick={() => deleteBulkChatsMutation.mutate(selectedChats)}>
                <Trash2 className="me-2 h-4 w-4" /> {selectedChats.length}
              </Button>
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
                <div key={contact.phone} className={`group flex items-center p-2 rounded-lg transition-colors ${selectedPhone === contact.phone && !isBulkDeleteMode ? "bg-primary/10 border border-primary/20" : "hover:bg-accent border border-transparent"}`}>
                  {isBulkDeleteMode && (
                    <div className="pe-3">
                      <Checkbox checked={selectedChats.includes(contact.phone)} onCheckedChange={() => toggleBulkChat(contact.phone)} />
                    </div>
                  )}
                  <button
                    onClick={() => !isBulkDeleteMode && setSelectedPhone(contact.phone)}
                    className="flex-1 flex gap-3 text-start items-center min-w-0"
                  >
                    {contact.profilePictureUrl ? (
                       <img src={contact.profilePictureUrl} alt={contact.name || contact.phone} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                       <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><User className="h-5 w-5 text-primary/70" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-medium text-foreground truncate" dir="ltr">
                          {contact.name ? contact.name : `+${contact.phone}`}
                        </h3>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">{format(new Date(contact.lastMessageAt), "h:mm a")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate pe-2">{contact.messageBody}</p>
                    </div>
                  </button>
                  {!isBulkDeleteMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-8 w-8 flex-shrink-0 text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteSingleChatMutation.mutate(contact.phone)}>
                          <Trash2 className="me-2 h-4 w-4" /> Delete Chat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Main Chat Area ── */}
      <div className={`flex-1 flex flex-col min-w-0 bg-background ${selectedPhone ? "flex" : "hidden md:flex"}`}>
        {selectedPhone ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-border bg-card flex items-center px-4 md:px-6 gap-2 text-start justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <Button size="icon" variant="ghost" className="md:hidden h-8 w-8 text-muted-foreground" onClick={() => setSelectedPhone(null)}>
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Phone className="h-5 w-5 text-primary" /></div>
                <div>
                  <h3 className="font-semibold text-foreground" dir="ltr">+{selectedPhone}</h3>
                  <p className="text-xs text-muted-foreground">{t("chat.customerChat")}</p>
                </div>
                {crmCustomer && (
                  <div className="ms-4 border-s border-border ps-4">
                    <Select 
                      value={crmCustomer.status || "new"} 
                      onValueChange={(val) => updateStatusMutation.mutate({ phone: selectedPhone!, status: val })}
                      disabled={updateStatusMutation.isPending}
                    >
                      <SelectTrigger className="h-8 text-xs font-semibold w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="replied">Replied</SelectItem>
                        <SelectItem value="no_response">No Response</SelectItem>
                        <SelectItem value="interested">Interested</SelectItem>
                        <SelectItem value="not_interested">Not Interested</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                  {isFullscreen ? <Shrink className="h-5 w-5 text-muted-foreground" /> : <Expand className="h-5 w-5 text-muted-foreground" />}
                </Button>
                {isForwardMode ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => { setIsForwardMode(false); setSelectedMessageIds([]); }}>Cancel</Button>
                    {selectedMessageIds.length > 0 && (
                      <Button size="sm" onClick={() => setForwardDialogOpen(true)}>Forward ({selectedMessageIds.length})</Button>
                    )}
                  </>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setIsForwardMode(true)} title="Forward Messages">
                    <Forward className="h-5 w-5 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" ref={scrollRef}>
              {isLoadingMessages ? (
                <p className="text-center text-muted-foreground text-sm">{t("chat.loadingMessages")}</p>
              ) : messagesData?.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3">
                  <MessageSquare className="h-12 w-12 opacity-20" /><p>{t("chat.noMessagesYet")}</p>
                </div>
              ) : (
                messagesData?.map((msg) => {
                  const isMe = msg.isFromMe;
                  const isSelected = selectedMessageIds.includes(msg.id);
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"} group`}>
                      {isForwardMode && !isMe && (
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleForwardMessage(msg.id)} className="mb-2" />
                      )}
                      <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                        {msg.isForwarded && <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Forward className="h-3 w-3" /> Forwarded</p>}
                        <div className={`px-4 py-2 rounded-2xl relative ${isMe ? "bg-primary text-primary-foreground rounded-se-sm" : "bg-muted text-foreground rounded-ss-sm border border-border"}`}>
                          {renderMessageContent(msg)}
                        </div>
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[10px] text-muted-foreground">{format(new Date(msg.timestamp), "h:mm a")}</span>
                          {renderMessageStatus(msg.status, isMe)}
                        </div>
                      </div>
                      {isForwardMode && isMe && (
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleForwardMessage(msg.id)} className="mb-2" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-card border-t border-border relative">
              {!isConnected && (
                <div className="mb-3 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm text-start">
                  <AlertCircle className="h-4 w-4" /> {t("chat.linkRequired")}
                </div>
              )}
              
              {/* Quick Replies Autocomplete */}
              {messageText.startsWith("/") && quickReplies && quickReplies.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-popover border border-border shadow-lg rounded-lg overflow-hidden z-50">
                  <div className="max-h-48 overflow-y-auto p-1">
                    {quickReplies
                      .filter((qr: any) => `/${qr.shortcut}`.startsWith(messageText.toLowerCase()))
                      .map((qr: any) => (
                        <button
                          key={qr.id}
                          type="button"
                          className="w-full text-start px-3 py-2 text-sm hover:bg-muted rounded-md flex flex-col gap-1 transition-colors"
                          onClick={() => {
                            let text = qr.messageBody;
                            // Replace variables
                            text = text.replace(/\{\{customer_name\}\}/g, selectedContact?.name || selectedPhone);
                            text = text.replace(/\{\{phone\}\}/g, selectedPhone);
                            setMessageText(text);
                          }}
                        >
                          <span className="font-bold text-primary">/{qr.shortcut}</span>
                          <span className="text-muted-foreground truncate">{qr.messageBody}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSend} className="flex gap-2 items-center">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,video/*,audio/*,application/pdf" />
                <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={!isConnected || isRecording || sendMediaMutation.isPending} className="text-muted-foreground flex-shrink-0">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  placeholder={t("chat.inputPlaceholder")}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  disabled={!isConnected || sendMessageMutation.isPending || isRecording || sendMediaMutation.isPending}
                  className="flex-1 bg-background"
                />
                {isRecording ? (
                  <Button type="button" size="icon" variant="destructive" onClick={stopRecording} className="flex-shrink-0 animate-pulse"><Square className="h-4 w-4" /></Button>
                ) : (
                  <Button type="button" size="icon" variant="ghost" onClick={startRecording} disabled={!isConnected || sendMessageMutation.isPending} className="text-muted-foreground flex-shrink-0"><Mic className="h-5 w-5" /></Button>
                )}
                <Button type="submit" size="icon" disabled={!messageText.trim() || !isConnected || sendMessageMutation.isPending || isRecording} className="bg-primary hover:bg-primary/90 flex-shrink-0 rtl:rotate-180">
                  {sendMediaMutation.isPending || sendMessageMutation.isPending ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center"><MessageSquare className="h-10 w-10 text-primary/40" /></div>
            <h3 className="text-xl font-medium text-foreground">{t("chat.chatSystemTitle")}</h3>
            <p className="text-sm max-w-md text-center leading-relaxed">{t("chat.chatSystemDesc")}</p>
          </div>
        )}
      </div>

      {/* Forward Dialog */}
      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent className="max-w-md h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>{language === "ar" ? "إعادة توجيه الرسائل" : "Forward Messages"}</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <p className="text-sm text-muted-foreground mb-4">
              {language === "ar" ? `إعادة توجيه ${selectedMessageIds.length} رسالة إلى:` : `Forward ${selectedMessageIds.length} message(s) to:`}
            </p>
            <ScrollArea className="flex-1 border rounded-md p-2">
              <div className="space-y-1">
                {contactsData?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{language === "ar" ? "لا توجد محادثات" : "No chats available"}</p>
                ) : (
                  contactsData?.map((contact) => (
                    <div 
                      key={contact.phone} 
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${forwardRecipients.includes(contact.phone) ? "bg-primary/10 border border-primary/30" : "hover:bg-accent border border-transparent"}`}
                      onClick={() => {
                        setForwardRecipients(prev => 
                          prev.includes(contact.phone) ? prev.filter(p => p !== contact.phone) : [...prev, contact.phone]
                        );
                      }}
                    >
                      <Checkbox 
                        checked={forwardRecipients.includes(contact.phone)} 
                        onCheckedChange={() => {
                          setForwardRecipients(prev => 
                            prev.includes(contact.phone) ? prev.filter(p => p !== contact.phone) : [...prev, contact.phone]
                          );
                        }} 
                      />
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-primary/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-foreground truncate" dir="ltr">+{contact.phone}</h4>
                        <p className="text-xs text-muted-foreground truncate">{contact.messageBody}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setForwardDialogOpen(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={executeForward} disabled={forwardRecipients.length === 0 || forwardMessagesMutation.isPending}>
              {forwardMessagesMutation.isPending ? (language === "ar" ? "جاري الإرسال..." : "Forwarding...") : (language === "ar" ? `إرسال (${forwardRecipients.length})` : `Forward (${forwardRecipients.length})`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
