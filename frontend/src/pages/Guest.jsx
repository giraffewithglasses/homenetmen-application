import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BadgePatch from "@/components/BadgePatch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  Flame, Users, Building2, Award, Compass, CalendarDays, MapPin, Clock,
  Mail, ChevronRight, Mountain, Tent, Heart, ArrowRight, Sparkles, Megaphone,
  Phone, Pencil, FileText, Download,
} from "lucide-react";

export default function Guest() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [badges, setBadges] = useState([]);
  const [newsletters, setNewsletters] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [galleries, setGalleries] = useState([]);
  const [resources, setResources] = useState([]);
  const [settings, setSettings] = useState(null);
  const [lang, setLang] = useState(() => localStorage.getItem("scout_lang") || "en");
  const [activeLeader, setActiveLeader] = useState(null);
  const [leaderEdit, setLeaderEdit] = useState(false);
  const [leaderForm, setLeaderForm] = useState({});
  const [savingLeader, setSavingLeader] = useState(false);

  useEffect(() => {
    api.get("/public/overview").then(r => setOverview(r.data)).catch(() => {});
    api.get("/public/badges").then(r => setBadges(r.data)).catch(() => {});
    api.get("/public/newsletters").then(r => setNewsletters(r.data)).catch(() => {});
    api.get("/public/programs/upcoming").then(r => setUpcoming(r.data)).catch(() => {});
    api.get("/public/announcements").then(r => setAnnouncements(r.data)).catch(() => {});
    api.get("/public/leaders").then(r => setLeaders(r.data)).catch(() => {});
    api.get("/public/galleries").then(r => setGalleries(r.data)).catch(() => {});
    api.get("/public/resources").then(r => setResources(r.data)).catch(() => {});
    api.get("/public/homepage-settings").then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const defaultOrder = ["chapters", "events", "badges", "newsletters", "leaders", "galleries", "resources"];
  const order = settings?.section_order?.length ? settings.section_order : defaultOrder;
  const orderIdx = (k) => { const i = order.indexOf(k); return i === -1 ? 999 : i; };
  const footer = settings?.footer || {};

  const setLangPersist = (l) => { setLang(l); localStorage.setItem("scout_lang", l); };
  const t = (en, hy) => (lang === "hy" ? hy : en);

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-[hsl(42,30%,94%)]/85 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center bg-white shadow-inner border-2 border-border p-1">
              <img src="/brand/homenetmen-logo.webp" alt="HASK" className="w-full h-full object-contain"/>
            </div>
            <div>
              <div className="font-display font-black text-base leading-none">HOMENETMEN HASK</div>
              <div className="text-[9px] tracking-[0.24em] uppercase text-muted-foreground">ՀՄԸՄ-ՀԱՍԿ · Est. 1989</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            <a href="#chapters" className="hover:text-[hsl(12,65%,63%)]">{t("Chapters", "Մասնաճյուղեր")}</a>
            <a href="#badges" className="hover:text-[hsl(12,65%,63%)]">{t("Badges", "Կրծքանշաններ")}</a>
            <a href="#events" className="hover:text-[hsl(12,65%,63%)]">{t("Events", "Ծրագրեր")}</a>
            <a href="#newsletters" className="hover:text-[hsl(12,65%,63%)]">{t("News", "Նորություններ")}</a>
            <a href="#resources" className="hover:text-[hsl(12,65%,63%)]">{t("Resources", "Ձեռնարկներ")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLangPersist(lang === "hy" ? "en" : "hy")}
              className="px-3 py-1.5 rounded-full border border-border bg-white/60 hover:bg-white text-[11px] font-bold uppercase tracking-widest"
              data-testid="guest-lang-toggle"
            >{lang === "hy" ? "EN" : "ՀԱՅ"}</button>
            <Link to={user ? "/dashboard" : "/login"}>
              <Button className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)] h-9" data-testid="guest-signin-btn">
                {user ? t("Dashboard", "Վահանակ") : t("Sign in", "Մուտք")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(115deg, hsl(152 43% 15% / 0.88), hsl(149 40% 30% / 0.5)), url('/brand/home-hero.webp')",
            backgroundSize: "cover", backgroundPosition: "center",
          }}
        />
        <div className="relative max-w-[1400px] mx-auto px-4 lg:px-8 py-24 lg:py-32 text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur text-xs uppercase tracking-[0.28em]">
            <Sparkles size={12}/> {t("A movement, not a club", "Շարժում է, ոչ ակումբ")}
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] mt-6 max-w-4xl">
            {t("Prepared.", "Պատրաստ։")}<br/>
            {t("Together.", "Միասին։")}<br/>
            <span className="text-[hsl(32,87%,67%)]">{t("Outdoors.", "Բնության մեջ։")}</span>
          </h1>
          <p className="mt-6 text-white/85 text-lg max-w-2xl">
            {t(
              "Explore our chapters, meet the badges scouts pursue, and see what's happening next on the trail.",
              "Բացահայտեք մեր մասնաճյուղերը, ծանոթացեք սկաուտների ձեռք բերած կրծքանշաններին և տեսեք, թե ինչ է սպասվում առջևում։"
            )}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#events">
              <Button className="btn-pill h-12 px-6 bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="hero-events-btn">
                {t("See upcoming events", "Դիտել առաջիկա ծրագրերը")} <ArrowRight size={16} className="ml-2"/>
              </Button>
            </a>
            <a href="#badges">
              <Button variant="outline" className="btn-pill h-12 px-6 bg-white/10 border-white/40 text-white hover:bg-white/20">
                {t("Explore badges", "Դիտել կրծքանշանները")}
              </Button>
            </a>
          </div>

          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-14 max-w-4xl">
              {[
                { n: overview.stats.chapters, l: t("Chapters", "Մասնաճյուղ"), i: Building2 },
                { n: overview.stats.members, l: t("Scouts", "Սկաուտ"), i: Users },
                { n: overview.stats.badges, l: t("Badges", "Կրծքանշան"), i: Award },
                { n: overview.stats.programs, l: t("Programs", "Ծրագիր"), i: Compass },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-5">
                  <s.i size={18} className="opacity-70"/>
                  <div className="text-4xl font-black font-display mt-2">{s.n}</div>
                  <div className="text-[10px] uppercase tracking-[0.28em] opacity-75 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* National announcements strip */}
      {announcements[0] && (
        <section className="max-w-[1400px] mx-auto px-4 lg:px-8 -mt-8 relative z-10">
          <Card className="clay-card p-5 flex items-center gap-4 border-l-4 border-l-[hsl(12,65%,63%)]">
            <div className="w-11 h-11 rounded-full bg-[hsl(12,65%,63%)] text-white flex items-center justify-center flex-shrink-0">
              <Megaphone size={18}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="uppercase-label">{t("National announcement", "Ազգային ծանուցում")}</div>
              <div className="font-display font-bold text-lg">{announcements[0].title}</div>
              <div className="text-sm text-muted-foreground line-clamp-1">{announcements[0].message}</div>
            </div>
          </Card>
        </section>
      )}

      {/* About / What we do */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
        <div className="grid lg:grid-cols-3 gap-6">
          {[
            { i: Tent, en: "Camp Craft", hy: "Ճամբարային գործ", de: "Pitch a tent, build a fire, and cook under the stars — the fundamentals of the outdoors." },
            { i: Compass, en: "Navigation", hy: "Կողմնորոշում", de: "Read maps, use a compass, plan a route — never get lost again." },
            { i: Heart, en: "Service", hy: "Ծառայություն", de: "Ten hours a season serving neighbors, forests, and the country we love." },
          ].map((f) => (
            <Card key={f.en} className="clay-card p-8 hover-lift">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(149,40%,30%)] text-white flex items-center justify-center">
                <f.i size={22}/>
              </div>
              <div className="font-display font-bold text-2xl mt-5">{t(f.en, f.hy)}</div>
              <p className="text-sm text-muted-foreground mt-2">{f.de}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Chapters */}
      <section id="chapters" className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-20">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="uppercase-label">{t("Local hubs", "Մասնաճյուղեր")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">
              {t("Chapters across Armenia", "Մասնաճյուղեր ամբողջ Հայաստանում")}
            </h2>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(overview?.chapters || []).map((c) => (
            <Card key={c.chapter_id} className="clay-card p-6 hover-lift">
              <div className="w-11 h-11 rounded-2xl bg-[hsl(149,40%,30%)] text-white flex items-center justify-center">
                <Building2 size={20}/>
              </div>
              <div className="font-display font-bold text-lg mt-4">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.name_hy}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <MapPin size={12}/>{c.location}
              </div>
              <p className="text-sm mt-3 line-clamp-2">{c.description}</p>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 font-bold"><Users size={12}/> {c.member_count} {t("members", "անդամ")}</span>
                <span className="uppercase tracking-widest text-[hsl(12,65%,63%)] font-bold">
                  {t("Join", "Միանալ")} →
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Badges */}
      <section id="badges" className="py-20" style={{ background: "hsl(152 43% 15%)", color: "hsl(42 30% 94%)" }}>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
          <div className="uppercase-label" style={{ color: "hsl(32 87% 75%)" }}>{t("Adventures", "Արկածներ")}</div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight max-w-3xl">
            {t("Every badge is a story earned outdoors.", "Ամեն կրծքանշանը պատմություն է՝ վաստակած բնության մեջ։")}
          </h2>
          <p className="text-white/70 mt-3 max-w-2xl">
            {t(
              "From First Aid to Astronomy, from Pioneering knots to Cold-weather craft — pick a trail, chase a skill.",
              "Առաջին օգնությունից մինչև աստղագիտություն, հանգույցներից մինչև ձմեռային հմտություններ։"
            )}
          </p>

          <div className="mt-10 grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-6">
            {badges.map((b) => (
              <div key={b.badge_id} className="text-center">
                <BadgePatch badge={b} awarded size={80}/>
                <div className="text-xs font-semibold mt-2">{lang === "hy" ? b.name_hy || b.name : b.name}</div>
                <div className="text-[10px] uppercase tracking-widest opacity-60">{b.difficulty}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming events */}
      <section id="events" className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="uppercase-label">{t("On the horizon", "Առաջիկա")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">
              {t("Upcoming events", "Առաջիկա ծրագրեր")}
            </h2>
          </div>
          <Link to="/login" className="text-sm font-bold uppercase tracking-widest text-[hsl(12,65%,63%)] hidden md:inline-flex items-center gap-1">
            {t("Sign in for the full calendar", "Մուտք գործիր՝ ամբողջ օրացույցի համար")} <ChevronRight size={14}/>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcoming.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-10">
              {t("No upcoming events published yet — check back soon.", "Դեռ չկան առաջիկա ծրագրեր։")}
            </div>
          )}
          {upcoming.map((p) => {
            const d = new Date(p.date);
            const day = d.getDate();
            const mon = d.toLocaleString(lang === "hy" ? "hy-AM" : "en-US", { month: "short" });
            return (
              <Card key={p.program_id} className="clay-card p-6 hover-lift flex gap-5">
                <div className="w-16 flex-shrink-0 text-center">
                  <div className="rounded-2xl bg-[hsl(12,65%,63%)] text-white py-3 shadow-inner">
                    <div className="text-[10px] uppercase tracking-widest font-bold">{mon}</div>
                    <div className="text-3xl font-black font-display leading-none mt-1">{day}</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <Badge className="rounded-full bg-[hsl(149,40%,30%)]">{p.section}</Badge>
                  {!p.chapter_id && <Badge className="rounded-full ml-1 bg-[hsl(32,87%,67%)] text-[hsl(155,60%,8%)]">{t("National", "Ազգային")}</Badge>}
                  <div className="font-display font-bold text-lg mt-2">{lang === "hy" ? p.title_hy || p.title : p.title}</div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><Clock size={12}/>{p.start_time} – {p.end_time}</div>
                    <div className="flex items-center gap-2"><MapPin size={12}/>{p.location}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Newsletters */}
      <section id="newsletters" className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-20">
        <div className="mb-6">
          <div className="uppercase-label">{t("From HQ", "Կենտրոնից")}</div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">
            {t("Latest newsletters", "Վերջին տեղեկագրերը")}
          </h2>
        </div>

        {newsletters[0] && (
          <Card className="clay-card overflow-hidden mb-6">
            <div className="grid md:grid-cols-2">
              <div
                className="h-56 md:h-auto"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1597120590849-a1d5a743d155?crop=entropy&cs=srgb&fm=jpg&q=85')",
                  backgroundSize: "cover", backgroundPosition: "center",
                }}
              />
              <div className="p-8">
                <div className="uppercase-label">
                  {t("Latest issue", "Վերջին համար")} · {new Date(newsletters[0].created_at).toLocaleDateString()}
                </div>
                <h3 className="font-display text-3xl font-black mt-2">
                  {lang === "hy" ? newsletters[0].title_hy || newsletters[0].title : newsletters[0].title}
                </h3>
                <p className="mt-4 text-sm">{newsletters[0].short_description}</p>
                <p className="mt-4 text-sm text-muted-foreground line-clamp-4">{newsletters[0].content}</p>
                <div className="uppercase-label mt-6">{t("By", "Հեղինակ")} {newsletters[0].author}</div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {newsletters.slice(1).map((n) => (
            <Card key={n.newsletter_id} className="clay-card p-6 hover-lift">
              <div className="w-10 h-10 rounded-full bg-[hsl(32,87%,67%)]/25 text-[hsl(32,87%,55%)] flex items-center justify-center">
                <Mail size={18}/>
              </div>
              <div className="uppercase-label mt-3">{new Date(n.created_at).toLocaleDateString()}</div>
              <div className="font-display font-bold text-lg mt-1">
                {lang === "hy" ? n.title_hy || n.title : n.title}
              </div>
              <p className="text-sm mt-3 line-clamp-3">{n.short_description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Leaders */}
      <section id="leaders" className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
        <div className="mb-6">
          <div className="uppercase-label">{t("Meet the team", "Ղեկավարներ")}</div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">
            {t("Our leaders", "Մեր ղեկավարները")}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {t("The volunteers who guide every patrol, run every camp, and champion every scout.", "Կամավորները, ովքեր առաջնորդում են ամեն ջոկատ, ամեն ճամբար, ամեն սկաուտ։")}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {leaders.map(l => (
            <button
              key={l.user_id}
              type="button"
              onClick={() => { setActiveLeader(l); setLeaderEdit(false); setLeaderForm({ name: l.name || "", position_title: l.position_title || "", bio: l.bio || "", phone: l.phone || "", picture: l.picture || "" }); }}
              className="text-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(12,65%,63%)] rounded-2xl p-2 hover:bg-white/50 transition"
              data-testid={`leader-${l.user_id}`}
            >
              <div className="w-24 h-24 mx-auto rounded-full border-4 border-[hsl(12,65%,63%)]/40 group-hover:border-[hsl(12,65%,63%)] bg-[hsl(149,40%,30%)] text-white flex items-center justify-center font-display font-black text-3xl overflow-hidden transition">
                {l.picture ? <img src={l.picture} alt="" className="w-full h-full object-cover"/> : l.name?.[0]}
              </div>
              <div className="font-semibold text-sm mt-3">{l.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{l.position_title || (l.role || "").replace(/_/g, " ")}</div>
              {l.chapter_name && <div className="text-xs text-[hsl(12,65%,63%)] font-semibold mt-0.5">{l.chapter_name}</div>}
            </button>
          ))}
          {!leaders.length && <div className="col-span-full text-center text-muted-foreground">{t("Leaders roster coming soon.", "Ղեկավարների ցանկը շուտով։")}</div>}
        </div>
      </section>

      {/* Leader profile dialog */}
      <Dialog open={!!activeLeader} onOpenChange={(o) => { if (!o) { setActiveLeader(null); setLeaderEdit(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="leader-dialog">
          <DialogHeader>
            <DialogTitle>{leaderEdit ? t("Edit leader profile", "Խմբագրել ղեկավարի պրոֆիլը") : (activeLeader?.name || "")}</DialogTitle>
          </DialogHeader>

          {activeLeader && !leaderEdit && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full border-4 border-[hsl(12,65%,63%)]/40 bg-[hsl(149,40%,30%)] text-white flex items-center justify-center font-display font-black text-2xl overflow-hidden">
                  {activeLeader.picture ? <img src={activeLeader.picture} alt="" className="w-full h-full object-cover"/> : activeLeader.name?.[0]}
                </div>
                <div>
                  <div className="font-display font-bold text-lg">{activeLeader.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{activeLeader.position_title || (activeLeader.role || "").replace(/_/g, " ")}</div>
                  {activeLeader.chapter_name && <div className="text-xs text-[hsl(12,65%,63%)] font-semibold mt-0.5">{activeLeader.chapter_name}</div>}
                </div>
              </div>
              {activeLeader.bio && <p className="text-sm text-muted-foreground whitespace-pre-line">{activeLeader.bio}</p>}
              <div className="space-y-1 text-sm">
                {activeLeader.email && <div className="flex items-center gap-2"><Mail size={14} className="text-muted-foreground"/> {activeLeader.email}</div>}
                {activeLeader.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-muted-foreground"/> {activeLeader.phone}</div>}
              </div>
              {user?.role === "national_admin" && (
                <Button onClick={() => setLeaderEdit(true)} className="btn-pill w-full bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="leader-edit-btn">
                  <Pencil size={14} className="mr-2"/> {t("Edit profile", "Խմբագրել")}
                </Button>
              )}
            </div>
          )}

          {activeLeader && leaderEdit && (
            <div className="space-y-3">
              <div>
                <Label>{t("Name", "Անուն")}</Label>
                <Input value={leaderForm.name} onChange={e => setLeaderForm({ ...leaderForm, name: e.target.value })} data-testid="leader-form-name"/>
              </div>
              <div>
                <Label>{t("Position", "Պաշտոն")}</Label>
                <Input value={leaderForm.position_title} onChange={e => setLeaderForm({ ...leaderForm, position_title: e.target.value })} placeholder="e.g. Scout Leader" data-testid="leader-form-position"/>
              </div>
              <div>
                <Label>{t("Phone", "Հեռախոս")}</Label>
                <Input value={leaderForm.phone} onChange={e => setLeaderForm({ ...leaderForm, phone: e.target.value })} data-testid="leader-form-phone"/>
              </div>
              <div>
                <Label>{t("About", "Մասին")}</Label>
                <Textarea rows={4} value={leaderForm.bio} onChange={e => setLeaderForm({ ...leaderForm, bio: e.target.value })} data-testid="leader-form-bio"/>
              </div>
              <div>
                <Label>{t("Profile picture", "Լուսանկար")}</Label>
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full text-sm mt-1"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => setLeaderForm({ ...leaderForm, picture: r.result });
                    r.readAsDataURL(f);
                  }}
                  data-testid="leader-form-picture"
                />
                {leaderForm.picture && <img src={leaderForm.picture} alt="" className="mt-2 w-20 h-20 rounded-full object-cover"/>}
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="btn-pill flex-1" onClick={() => setLeaderEdit(false)}>{t("Cancel", "Չեղարկել")}</Button>
                <Button
                  disabled={savingLeader}
                  onClick={async () => {
                    setSavingLeader(true);
                    try {
                      const payload = {
                        name: leaderForm.name,
                        position_title: leaderForm.position_title,
                        phone: leaderForm.phone,
                        bio: leaderForm.bio,
                        picture: leaderForm.picture,
                      };
                      const { data: updated } = await api.put(`/users/${activeLeader.user_id}/public-profile`, payload);
                      toast.success(t("Profile updated", "Պրոֆիլը թարմացվեց"));
                      // refresh list
                      const { data: fresh } = await api.get("/public/leaders");
                      setLeaders(fresh);
                      const refreshed = fresh.find(x => x.user_id === activeLeader.user_id) || { ...activeLeader, ...updated };
                      setActiveLeader(refreshed);
                      setLeaderEdit(false);
                    } catch (err) {
                      toast.error(err.response?.data?.detail || t("Update failed", "Չհաջողվեց թարմացնել"));
                    } finally {
                      setSavingLeader(false);
                    }
                  }}
                  className="btn-pill flex-1 bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]"
                  data-testid="leader-form-save"
                >
                  {t("Save", "Պահպանել")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Galleries */}
      {galleries.length > 0 && (
        <section id="galleries" className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-20">
          <div className="mb-6">
            <div className="uppercase-label">{t("Snapshots", "Պահեր")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">
              {t("From the field", "Դաշտից")}
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleries.slice(0, 6).map(g => (
              <Card key={g.gallery_id} className="clay-card overflow-hidden hover-lift" data-testid={`guest-gallery-${g.gallery_id}`}>
                <div className="h-52 relative bg-muted">
                  {g.cover
                    ? <img src={g.cover} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }}/>
                    : (g.images?.[0]?.data ? <img src={g.images[0].data} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }}/> : null)}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <div className="font-display font-bold">{g.title}</div>
                    <div className="text-xs opacity-80">{g.images?.length || 0} photos</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Resources */}
      {resources.length > 0 && (
        <section id="resources" className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-20">
          <div className="mb-6">
            <div className="uppercase-label">{t("Downloads", "Ներբեռնումներ")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">
              {t("Resources & manuals", "Ձեռնարկներ և նյութեր")}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              {t("Handbooks, forms, and guides — open to scouts, parents, and the curious.", "Ձեռնարկներ, ձևաթղթեր և ուղեցույցներ՝ բաց սկաուտների, ծնողների և բոլորի համար։")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.slice(0, 9).map(r => (
              <Card key={r.resource_id} className="clay-card p-5 hover-lift" data-testid={`guest-resource-${r.resource_id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[hsl(149,40%,30%)] text-white flex items-center justify-center flex-shrink-0">
                    <FileText size={18}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge className="rounded-full bg-[hsl(32,87%,67%)] text-[hsl(155,60%,8%)] text-[10px]">{r.category || "Manuals"}</Badge>
                    <div className="font-display font-bold text-base mt-2 truncate">{r.title}</div>
                    {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { data } = await api.get(`/public/resources/${r.resource_id}`);
                          if (!data?.file_data) return;
                          const href = data.file_data.startsWith("data:")
                            ? data.file_data
                            : `data:${data.file_type || "application/octet-stream"};base64,${data.file_data}`;
                          const a = document.createElement("a");
                          a.href = href;
                          a.download = data.file_name || `${r.title || "resource"}`;
                          document.body.appendChild(a); a.click(); a.remove();
                        } catch {}
                      }}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[hsl(12,65%,63%)] hover:text-[hsl(12,70%,55%)]"
                      data-testid={`guest-resource-dl-${r.resource_id}`}
                    >
                      <Download size={12}/> {t("Download", "Ներբեռնել")}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-20">
        <Card className="clay-card p-10 md:p-14 relative overflow-hidden text-white" style={{ border: "none", background: "linear-gradient(120deg, hsl(12 65% 55%), hsl(32 87% 60%))" }}>
          <div className="absolute -right-8 -bottom-8 opacity-15">
            <Mountain size={260} strokeWidth={1.4}/>
          </div>
          <div className="relative">
            <div className="uppercase-label" style={{ color: "rgba(255,255,255,0.75)" }}>{t("Ready?", "Պատրա՞ստ եք")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-black max-w-2xl mt-3">
              {t("Join a chapter, earn a badge, share the trail.", "Միացիր մասնաճյուղին, վաստակիր կրծքանշան, կիսվիր արահետով։")}
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login">
                <Button className="btn-pill h-12 px-6 bg-white text-[hsl(155,60%,8%)] hover:bg-white/90" data-testid="cta-signin">
                  {t("Sign in", "Մուտք")} <ArrowRight size={16} className="ml-2"/>
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="btn-pill h-12 px-6 border-white/60 bg-white/10 text-white hover:bg-white/20">
                  {t("Register", "Գրանցվել")}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-[hsl(155,60%,8%)] text-white">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-14 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white shadow-inner p-1">
                <img src="/brand/homenetmen-logo.webp" alt="HASK" className="w-full h-full object-contain"/>
              </div>
              <div>
                <div className="font-display font-black text-base">HOMENETMEN HASK</div>
                <div className="text-[10px] tracking-[0.24em] uppercase text-white/60">Est. 1989</div>
              </div>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              {t(
                "The scouting movement of HOMENETMEN — building character through the outdoors, community, and service.",
                "ՀՄԸՄ-ի սկաուտական շարժումը՝ բնության, համայնքի և ծառայության միջոցով բնավորության կրթություն։"
              )}
            </p>
          </div>

          <div>
            <div className="uppercase-label text-[hsl(32,87%,67%)] mb-3">{t("Headquarters", "Կենտրոն")}</div>
            <div className="text-sm space-y-2 text-white/80">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 flex-shrink-0"/>
                <div>
                  Yervand Kochar 17/6<br/>
                  Yerevan, Armenia
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14}/> <a href="mailto:hq@homenetmen-hask.am" className="hover:text-[hsl(12,65%,63%)]">hq@homenetmen-hask.am</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14}/> <a href="tel:+37410000000" className="hover:text-[hsl(12,65%,63%)]">+374 10 000 000</a>
              </div>
            </div>
          </div>

          <div>
            <div className="uppercase-label text-[hsl(32,87%,67%)] mb-3">{t("Explore", "Դիտել")}</div>
            <div className="grid grid-cols-2 gap-y-2 text-sm text-white/80">
              <a href="#chapters" className="hover:text-[hsl(12,65%,63%)]">{t("Chapters", "Մասնաճյուղեր")}</a>
              <a href="#badges" className="hover:text-[hsl(12,65%,63%)]">{t("Badges", "Կրծքանշաններ")}</a>
              <a href="#events" className="hover:text-[hsl(12,65%,63%)]">{t("Events", "Ծրագրեր")}</a>
              <a href="#newsletters" className="hover:text-[hsl(12,65%,63%)]">{t("News", "Նորություններ")}</a>
              <a href="#leaders" className="hover:text-[hsl(12,65%,63%)]">{t("Leaders", "Ղեկավարներ")}</a>
              <a href="#resources" className="hover:text-[hsl(12,65%,63%)]">{t("Resources", "Ձեռնարկներ")}</a>
              <Link to="/login" className="hover:text-[hsl(12,65%,63%)]">{t("Sign in", "Մուտք")}</Link>
              {user && <Link to="/dashboard" className="hover:text-[hsl(12,65%,63%)]">{t("Dashboard", "Վահանակ")}</Link>}
            </div>
          </div>

          <div>
            <div className="uppercase-label text-[hsl(32,87%,67%)] mb-3">{t("Find us", "Գտնել մեզ")}</div>
            <div className="rounded-2xl overflow-hidden border-2 border-white/10 h-40">
              <iframe
                title="HOMENETMEN HASK HQ map"
                width="100%"
                height="100%"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.openstreetmap.org/export/embed.html?bbox=44.5010%2C40.1780%2C44.5210%2C40.1900&layer=mapnik&marker=40.1840%2C44.5110"
              />
            </div>
            <a
              href="https://www.openstreetmap.org/?mlat=40.1840&mlon=44.5110#map=17/40.1840/44.5110"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] uppercase tracking-widest text-[hsl(32,87%,67%)] hover:text-[hsl(32,87%,80%)] mt-2 inline-block font-bold"
            >
              {t("Open in maps →", "Բացել քարտեզում →")}
            </a>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] text-white/50">
            <div>© 2026 HOMENETMEN HASK. {t("All rights reserved.", "Բոլոր իրավունքները պաշտպանված են։")}</div>
            <div>{t("Founded 1989 · Armenia", "Հիմնադրվել է 1989 · Հայաստան")}</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
