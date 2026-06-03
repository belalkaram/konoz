import { useState, useEffect } from "react";

const EYE_STATE_KEY = "konoz-security-eye-visible";
const CHANGE_EVENT = "konoz-security-eye-change";

export function useSecurityEye() {
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(EYE_STATE_KEY);
      return saved !== "false"; // default to true (visible)
    }
    return true;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(EYE_STATE_KEY);
      setIsVisible(saved !== "false");
    };

    window.addEventListener(CHANGE_EVENT, handleStorageChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleStorageChange);
    };
  }, []);

  const toggleVisibility = () => {
    const newVal = !isVisible;
    localStorage.setItem(EYE_STATE_KEY, String(newVal));
    setIsVisible(newVal);
    // Dispatch custom event to notify other components/pages
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return { isVisible, toggleVisibility };
}
