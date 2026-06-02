import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../lib/translations";

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app-lang");
      return (saved === "ar" || saved === "en" ? saved : "en") as Language;
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLangState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("app-lang", lang);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = document.documentElement;
      if (language === "ar") {
        root.setAttribute("dir", "rtl");
        root.lang = "ar";
      } else {
        root.setAttribute("dir", "ltr");
        root.lang = "en";
      }
    }
  }, [language]);

  const t = (key: string): string => {
    const keys = key.split(".");
    let current: any = translations[language];
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        // Fallback to English translation
        let engFallback: any = translations["en"];
        for (const fk of keys) {
          if (engFallback && typeof engFallback === "object" && fk in engFallback) {
            engFallback = engFallback[fk];
          } else {
            return key;
          }
        }
        return typeof engFallback === "string" ? engFallback : key;
      }
    }
    return typeof current === "string" ? current : key;
  };

  const isRtl = language === "ar";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
