import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/language-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authFetch, BASE } from "@/lib/api";
import { MessageSquare, RefreshCw, Send, CheckCheck } from "lucide-react";
import { format } from "date-fns";

export function TiktokDmTab() {
  const { language } = useLanguage();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["tiktok-messages"],
    queryFn: async () => {
      const res = await authFetch(`${BASE}/api/tiktok/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    }
  });

  if (isLoading) return <div className="flex justify-center p-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{language === "ar" ? "الرسائل الخاصة" : "Direct Messages"}</h2>
          <p className="text-muted-foreground text-sm">
            {language === "ar" 
              ? "إدارة جميع رسائل TikTok الخاصة (DMs) والرد عليها."
              : "Manage and reply to all TikTok DMs."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[500px]">
        {/* Placeholder for Conversation List */}
        <Card className="col-span-1 h-full overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">{language === "ar" ? "المحادثات الأخيرة" : "Recent Conversations"}</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-0">
            {messages?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
                <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
                {language === "ar" ? "لا توجد رسائل واردة." : "No incoming messages."}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {/* We are just mocking the view since the data model gives individual messages, 
                    we would normally group by conversationId or receiverId.
                    For now, list them out. */}
                {messages?.map((msg: any) => (
                  <button key={msg.id} className="w-full text-start p-3 hover:bg-muted/50 transition-colors flex gap-3 items-start border-l-2 border-transparent">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold shrink-0">
                      {(msg.senderId || "U").substring(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm truncate">{msg.senderId}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(msg.timestamp), "HH:mm")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{msg.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Placeholder for Chat View */}
        <Card className="col-span-1 md:col-span-2 h-full flex flex-col overflow-hidden bg-card">
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
            <p>{language === "ar" ? "حدد محادثة للبدء في المراسلة" : "Select a conversation to start messaging"}</p>
            <p className="text-xs opacity-60 mt-2 text-center max-w-sm">
              {language === "ar" 
                ? "سيتم عرض المحادثات المباشرة هنا عندما يبدأ شخص ما بمراسلة حساب TikTok الخاص بك." 
                : "Direct messages will appear here when someone messages your TikTok account."}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
