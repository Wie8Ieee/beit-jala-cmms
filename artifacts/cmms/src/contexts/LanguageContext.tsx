import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";

type Lang = "en" | "ar";

interface LanguageContextType {
  lang: Lang;
  toggle: () => void;
  isArabic: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  toggle: () => {},
  isArabic: false,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<Lang>((localStorage.getItem("cmms-lang") as Lang) ?? "en");

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  const toggle = () => {
    const next: Lang = lang === "en" ? "ar" : "en";
    setLang(next);
    i18n.changeLanguage(next);
    localStorage.setItem("cmms-lang", next);
  };

  return (
    <LanguageContext.Provider value={{ lang, toggle, isArabic: lang === "ar" }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
