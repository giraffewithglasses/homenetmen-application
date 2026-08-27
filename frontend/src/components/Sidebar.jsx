import React, { useState } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, Newspaper, Mail, Building2, Compass, CalendarDays,
  Award, TrendingUp, Users, ClipboardCheck, Folder, Bell, Settings,
  UserCircle, LogOut, Menu, X, Flame, Trash2, Home,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const ALL_ROLES = ["national_admin", "chapter_admin", "chapter_leader", "scout_leader", "cubs_leader", "patrol_leader", "patrol_co_leader", "scout", "parent"];
const LEADER_TIER = ["national_admin", "chapter_admin", "chapter_leader", "scout_leader", "cubs_leader", "patrol_leader", "patrol_co_leader"];
const NON_SCOUT = [...LEADER_TIER];

const ALL_ITEMS = [
  { to: "/dashboard", label: "Dashboard", labelHy: "Վահանակ", icon: LayoutDashboard, roles: ALL_ROLES },
  { to: "/announcements", label: "News", labelHy: "Նորություններ", icon: Newspaper, roles: ALL_ROLES },
  { to: "/newsletters", label: "Newsletters", labelHy: "Տեղեկագիր", icon: Mail, roles: ALL_ROLES },
  { to: "/chapters", label: "Chapters", labelHy: "Մասնաճյուղեր", icon: Building2, roles: ALL_ROLES },
  { to: "/programs", label: "Programs", labelHy: "Ծրագրեր", icon: Compass, roles: ALL_ROLES },
  { to: "/calendar", label: "Calendar", labelHy: "Օրացույց", icon: CalendarDays, roles: ALL_ROLES },
  { to: "/badges", label: "Progress Badges", labelHy: "Կրծքանշաններ", icon: Award, roles: ALL_ROLES },
  { to: "/my-progress", label: "My Progress", labelHy: "Իմ առաջընթացը", icon: TrendingUp, roles: ["scout"] },
  { to: "/members", label: "Members", labelHy: "Անդամներ", icon: Users, roles: NON_SCOUT },
  { to: "/attendance", label: "Attendance", labelHy: "Հաճախում", icon: ClipboardCheck, roles: NON_SCOUT },
  { to: "/resources", label: "Resources", labelHy: "Ռեսուրսներ", icon: Folder, roles: ALL_ROLES },
  { to: "/notifications", label: "Notifications", labelHy: "Ծանուցումներ", icon: Bell, roles: ALL_ROLES },
  { to: "/administration", label: "Administration", labelHy: "Կառավարում", icon: Settings, roles: LEADER_TIER },
  { to: "/trash", label: "Trash Bin", labelHy: "Աղբարկղ", icon: Trash2, roles: ["national_admin", "chapter_admin"] },
  { to: "/profile", label: "Profile", labelHy: "Պրոֆիլ", icon: UserCircle, roles: ALL_ROLES },
];

export default function Sidebar({ mobileOpen, setMobileOpen, lang }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = ALL_ITEMS.filter((i) => i.roles.includes(user?.role));

  const doLogout = async () => { await logout(); nav("/login"); };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 flex-shrink-0 z-50 transition-transform lg:transition-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{ background: "hsl(152 43% 15%)", color: "hsl(42 30% 94%)" }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-6">
            <Link to="/" className="flex items-center gap-3 group" title={lang === "hy" ? "Հիմնական էջ" : "Public homepage"} data-testid="sidebar-logo-home">
              <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[hsl(12,65%,63%)] text-white shadow-inner border-2 border-[#F4F1EA]/30 group-hover:scale-105 transition-transform">
                <Flame size={22} strokeWidth={2.2} />
              </div>
              <div>
                <div className="font-display font-black text-lg leading-none flex items-center gap-1.5">SCOUTS <Home size={11} className="opacity-40 group-hover:opacity-90 transition-opacity"/></div>
                <div className="text-[10px] tracking-[0.28em] uppercase opacity-70">Armenia · Հայաստան</div>
              </div>
            </Link>
            <button className="lg:hidden" onClick={() => setMobileOpen(false)} data-testid="close-sidebar-btn">
              <X size={22} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 space-y-1 pb-6">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/dashboard"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""}`}
                data-testid={`nav-${it.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <it.icon size={18} strokeWidth={2.2} />
                <span className="text-sm font-medium">{lang === "hy" ? it.labelHy : it.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-4 pb-6">
            <div className="rounded-2xl p-4 mb-3 flex items-center gap-3" style={{ background: "rgba(244,241,234,0.06)" }}>
              {user?.picture ? (
                <img src={user.picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0"/>
              ) : (
                <div className="w-10 h-10 rounded-full bg-[hsl(12,65%,63%)] text-white flex items-center justify-center font-bold flex-shrink-0">{user?.name?.[0]}</div>
              )}
              <div className="min-w-0">
                <div className="text-xs opacity-70">{user?.role?.replace("_", " ").toUpperCase()}</div>
                <div className="font-semibold truncate text-sm">{user?.name}</div>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={doLogout}
              className="w-full btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)] text-white border-0"
              data-testid="logout-btn"
            >
              <LogOut size={16} className="mr-2" /> {lang === "hy" ? "Ելք" : "Log out"}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileTopbar({ setMobileOpen, lang, setLang }) {
  return (
    <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-border sticky top-0 z-30">
      <button onClick={() => setMobileOpen(true)} data-testid="open-sidebar-btn">
        <Menu size={22} />
      </button>
      <div className="font-display font-black text-sm">SCOUTS</div>
      <button
        onClick={() => setLang(lang === "hy" ? "en" : "hy")}
        className="text-xs font-bold uppercase tracking-wider"
        data-testid="lang-toggle-mobile"
      >
        {lang === "hy" ? "EN" : "ՀԱՅ"}
      </button>
    </div>
  );
}
