import { createRoot } from "react-dom/client";
import { LanguageProvider } from "./contexts/language-context";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
