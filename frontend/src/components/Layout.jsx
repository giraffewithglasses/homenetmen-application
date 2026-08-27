import React, { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar, { MobileTopbar } from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { Languages } from "lucide-react";

export default function Layout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("scout_lang") || "en");

  const setLangPersist = (l) => { setLang(l); localStorage.setItem("scout_lang", l); };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} lang={lang} />
      <div className="flex-1 min-w-0">
        <MobileTopbar setMobileOpen={setMobileOpen} lang={lang} setLang={setLangPersist} />
        <div className="hidden lg:flex items-center justify-end px-8 pt-6">
          <button
            onClick={() => setLangPersist(lang === "hy" ? "en" : "hy")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-white/60 hover:bg-white text-xs font-bold uppercase tracking-wider"
            data-testid="lang-toggle"
          >
            <Languages size={14} /> {lang === "hy" ? "English" : "Հայերեն"}
          </button>
        </div>
        <main className="p-4 lg:p-8 max-w-[1400px] mx-auto">
          <Outlet context={{ lang }} />
        </main>
      </div>
    </div>
  );
}
