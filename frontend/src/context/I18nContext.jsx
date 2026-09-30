import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const I18nContext = createContext(null);

/**
 * Global bilingual context. `t(en, hy?)` looks up the English string in the
 * DB-managed translation dictionary first, then falls back to the JSX-provided
 * Armenian, then to the English original.
 */
export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("scout_lang") || "en");
  const [dict, setDict] = useState({});
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    api.get("/public/translations")
      .then(r => setDict(r.data || {}))
      .catch(err => console.warn("translations load failed:", err?.message))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("translations-updated", onUpdate);
    return () => window.removeEventListener("translations-updated", onUpdate);
  }, [refresh]);

  const setLangPersist = (l) => {
    setLang(l);
    try { localStorage.setItem("scout_lang", l); } catch (err) { /* noop */ }
  };

  const t = (en, hy) => {
    if (lang !== "hy") return en;
    return dict[en] || hy || en;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang: setLangPersist, t, dict, ready, refresh }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback when used outside the provider (e.g. Guest.jsx has its own)
    return { lang: "en", setLang: () => {}, t: (en) => en, dict: {}, ready: true, refresh: () => {} };
  }
  return ctx;
}
