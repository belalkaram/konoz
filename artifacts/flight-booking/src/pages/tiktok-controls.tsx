import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useLocation, useRoute } from "wouter";
import { useLanguage } from "@/contexts/language-context";
import { PageHeader } from "@/components/page-header";
import { MessageCircle, MessageSquare, Settings, Activity } from "lucide-react";

import { TiktokSettingsTab } from "./tiktok-settings-tab";
import { TiktokDmTab } from "./tiktok-dm-tab";
import { TiktokCommentsTab } from "./tiktok-comments-tab";
import { TiktokAutomationsTab } from "./tiktok-automations-tab";

export default function TiktokControls() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/tiktok-controls/:tab");
  const currentTab = match && params?.tab ? params.tab : "settings";

  const { t, language } = useLanguage();

  const navItems = [
    {
      value: "settings",
      labelAr: "الإعدادات والربط",
      labelEn: "Settings & Link",
      icon: Settings,
      color: "text-slate-500 bg-slate-500/10",
      activeColor: "bg-slate-500 text-white",
      descAr: "ربط حساب TikTok الرسمي.",
      descEn: "Link official TikTok account."
    },
    {
      value: "dms",
      labelAr: "الرسائل الخاصة",
      labelEn: "Direct Messages",
      icon: MessageSquare,
      color: "text-blue-500 bg-blue-500/10",
      activeColor: "bg-blue-500 text-white",
      descAr: "إدارة الرسائل والرد عليها.",
      descEn: "Manage and reply to DMs."
    },
    {
      value: "comments",
      labelAr: "التعليقات",
      labelEn: "Comments",
      icon: MessageCircle,
      color: "text-pink-500 bg-pink-500/10",
      activeColor: "bg-pink-500 text-white",
      descAr: "تتبع التعليقات والرد عليها.",
      descEn: "Track and reply to comments."
    },
    {
      value: "automations",
      labelAr: "الردود التلقائية",
      labelEn: "Automations",
      icon: Activity,
      color: "text-emerald-500 bg-emerald-500/10",
      activeColor: "bg-emerald-500 text-white",
      descAr: "الرد الآلي على الرسائل والتعليقات.",
      descEn: "Auto-reply to messages & comments."
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <PageHeader
        title={language === "ar" ? "إدارة تيك توك" : "TikTok Controls"}
        description={language === "ar" ? "أدوات متقدمة لإدارة رسائل وتعليقات تيك توك." : "Advanced tools for managing TikTok DMs and comments."}
        icon={MessageCircle}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Navigation Sidebar */}
        <aside className="hidden lg:block lg:col-span-1 space-y-3 sticky top-6">
          <Card className="bg-card border-border shadow-sm overflow-hidden p-3 space-y-2">
            <div className="px-3 py-2 border-b border-border/60">
              <h3 className="font-semibold text-sm text-foreground/80 uppercase tracking-wider">
                {language === "ar" ? "لوحة التحكم" : "Control Menu"}
              </h3>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setLocation(`/tiktok-controls/${item.value}`)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-start transition-all duration-200 border ${
                      isActive 
                        ? "bg-primary/5 border-primary/20 text-primary shadow-sm" 
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className={`p-2 rounded-md transition-colors ${isActive ? item.activeColor : item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold ${isActive ? "text-primary" : ""}`}>
                        {language === "ar" ? item.labelAr : item.labelEn}
                      </span>
                      <span className="text-xs mt-0.5 opacity-80 hidden xl:block">
                        {language === "ar" ? item.descAr : item.descEn}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        {/* Content Area */}
        <main className="lg:col-span-3 min-w-0">
          <div className="bg-card border border-border shadow-sm rounded-xl p-6 min-h-[500px]">
            {currentTab === "settings" && <TiktokSettingsTab />}
            {currentTab === "dms" && <TiktokDmTab />}
            {currentTab === "comments" && <TiktokCommentsTab />}
            {currentTab === "automations" && <TiktokAutomationsTab />}
          </div>
        </main>
      </div>
    </div>
  );
}
