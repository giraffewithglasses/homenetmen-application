import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { createPortal } from "react-dom";
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
  Phone, Pencil, FileText, Download, Camera, Facebook, Instagram, Twitter, Send, ChevronLeft,
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
  const [openProgram, setOpenProgram] = useState(null);
  const [openNewsletter, setOpenNewsletter] = useState(null);
  const [openGallery, setOpenGallery] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(null);

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
    api.get("/public/translations").then(r => setDict(r.data || {})).catch(() => {});
  }, []);

  const defaultOrder = ["chapters", "events", "badges", "newsletters", "leaders", "galleries", "resources"];
  const order = settings?.section_order?.length ? settings.section_order : defaultOrder;
  const orderIdx = (k) => { const i = order.indexOf(k); return i === -1 ? 999 : i; };
  const footer = settings?.footer || {};

  const setLangPersist = (l) => { setLang(l); localStorage.setItem("scout_lang", l); };
  const [dict, setDict] = useState({});
  const t = (en, hy) => {
    if (lang !== "hy") return en;
    // Prefer DB-managed translation, then the JSX-provided fallback, then EN
    return (dict[en] || hy || en);
  };

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
            <div className="grid grid-cols-3 gap-3 mt-14 max-w-3xl">
              {[
                { n: overview.stats.chapters, l: t("Chapters", "Մասնաճյուղ"), i: Building2 },
                { n: overview.stats.members, l: t("Scouts", "Սկաուտ"), i: Users },
                { n: overview.stats.badges, l: t("Badges", "Կրծքանշան"), i: Award },
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
              <div className="font-display font-bold text-lg">{announcements[0].title_hy && lang === "hy" ? announcements[0].title_hy : announcements[0].title}</div>
              <div className="text-sm text-muted-foreground line-clamp-1">{announcements[0].message_hy && lang === "hy" ? announcements[0].message_hy : announcements[0].message}</div>
            </div>
          </Card>
        </section>
      )}

      {/* About / What we do */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
        <div className="grid lg:grid-cols-3 gap-6">
          {[
            { i: Tent, en: "Camp Craft", hy: "Ճամբարային գործ", de_en: "Pitch a tent, build a fire, and cook under the stars — the fundamentals of the outdoors.", de_hy: "Վրան տեղադրիր, խարույկ վառիր և աստղերի տակ ճաշ պատրաստիր՝ բնության հիմունքները։" },
            { i: Compass, en: "Navigation", hy: "Կողմնորոշում", de_en: "Read maps, use a compass, plan a route — never get lost again.", de_hy: "Կարդա քարտեզը, օգտագործիր կողմնացույցը, պլանավորիր երթուղին։" },
            { i: Heart, en: "Service", hy: "Ծառայություն", de_en: "Ten hours a season serving neighbors, forests, and the country we love.", de_hy: "Յուրաքանչյուր սեզոն տասը ժամ՝ մեր հարևանների, անտառների և հայրենիքի համար։" },
          ].map((f) => (
            <Card key={f.en} className="clay-card p-8 hover-lift">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(149,40%,30%)] text-white flex items-center justify-center">
                <f.i size={22}/>
              </div>
              <div className="font-display font-bold text-2xl mt-5">{t(f.en, f.hy)}</div>
              <p className="text-sm text-muted-foreground mt-2">{t(f.de_en, f.de_hy)}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Reorderable sections (order controlled from Administration → Homepage) */}
      <div className="flex flex-col w-full items-stretch">

      {/* Chapters */}
      <section id="chapters" className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-20" style={{ order: orderIdx("chapters") }}>
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
              <div className="font-display font-bold text-lg mt-4">{lang === "hy" ? (c.name_hy || c.name) : c.name}</div>
              <div className="text-xs text-muted-foreground">{lang === "hy" ? c.name : c.name_hy}</div>
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
      <section id="badges" className="py-20" style={{ background: "hsl(152 43% 15%)", color: "hsl(42 30% 94%)", order: orderIdx("badges") }}>
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
      <section id="events" className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-20" style={{ order: orderIdx("events") }}>
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
              <Card key={p.program_id} onClick={() => setOpenProgram(p)} className="clay-card p-6 hover-lift flex gap-5 cursor-pointer" data-testid={`guest-event-${p.program_id}`}>
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
      <section id="newsletters" className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-20" style={{ order: orderIdx("newsletters") }}>
        <div className="mb-6">
          <div className="uppercase-label">{t("From HQ", "Կենտրոնից")}</div>
          <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">
            {t("Latest newsletters", "Վերջին տեղեկագրերը")}
          </h2>
        </div>

        {newsletters[0] && (
          <Card onClick={() => setOpenNewsletter(newsletters[0])} className="clay-card overflow-hidden mb-6 cursor-pointer hover-lift" data-testid={`guest-newsletter-${newsletters[0].newsletter_id}`}>
            <div className="grid md:grid-cols-2">
              <div
                className="h-56 md:h-auto"
                style={{
                  backgroundImage: `url('${newsletters[0].cover || 'https://images.unsplash.com/photo-1597120590849-a1d5a743d155?crop=entropy&cs=srgb&fm=jpg&q=85'}')`,
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
            <Card key={n.newsletter_id} onClick={() => setOpenNewsletter(n)} className="clay-card overflow-hidden hover-lift cursor-pointer" data-testid={`guest-newsletter-${n.newsletter_id}`}>
              {n.cover && <div className="h-32 bg-muted" style={{ backgroundImage: `url('${n.cover}')`, backgroundSize: "cover", backgroundPosition: "center" }}/>}
              <div className="p-6">
                {!n.cover && <div className="w-10 h-10 rounded-full bg-[hsl(32,87%,67%)]/25 text-[hsl(32,87%,55%)] flex items-center justify-center"><Mail size={18}/></div>}
                <div className="uppercase-label mt-3">{new Date(n.created_at).toLocaleDateString()}</div>
                <div className="font-display font-bold text-lg mt-1">
                  {lang === "hy" ? n.title_hy || n.title : n.title}
                </div>
                <p className="text-sm mt-3 line-clamp-3">{n.short_description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Leaders */}
      <section id="leaders" className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-20" style={{ order: orderIdx("leaders") }}>
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
              onClick={() => { setActiveLeader(l); setLeaderEdit(false); setLeaderForm({ name: l.name || "", name_hy: l.name_hy || "", position_title: l.position_title || "", position_title_hy: l.position_title_hy || "", bio: l.bio || "", bio_hy: l.bio_hy || "", phone: l.phone || "", picture: l.picture || "" }); }}
              className="text-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(12,65%,63%)] rounded-2xl p-2 hover:bg-white/50 transition"
              data-testid={`leader-${l.user_id}`}
            >
              <div className="w-24 h-24 mx-auto rounded-full border-4 border-[hsl(12,65%,63%)]/40 group-hover:border-[hsl(12,65%,63%)] bg-[hsl(149,40%,30%)] text-white flex items-center justify-center font-display font-black text-3xl overflow-hidden transition">
                {l.picture ? <img src={l.picture} alt="" className="w-full h-full object-cover"/> : l.name?.[0]}
              </div>
              <div className="font-semibold text-sm mt-3">{lang === "hy" ? (l.name_hy || l.name) : l.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{lang === "hy" ? (l.position_title_hy || l.position_title || (l.role || "").replace(/_/g, " ")) : (l.position_title || (l.role || "").replace(/_/g, " "))}</div>
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
                  <div className="font-display font-bold text-lg">{lang === "hy" ? (activeLeader.name_hy || activeLeader.name) : activeLeader.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{lang === "hy" ? (activeLeader.position_title_hy || activeLeader.position_title || (activeLeader.role || "").replace(/_/g, " ")) : (activeLeader.position_title || (activeLeader.role || "").replace(/_/g, " "))}</div>
                  {activeLeader.chapter_name && <div className="text-xs text-[hsl(12,65%,63%)] font-semibold mt-0.5">{activeLeader.chapter_name}</div>}
                </div>
              </div>
              {(lang === "hy" ? activeLeader.bio_hy : activeLeader.bio) && <p className="text-sm text-muted-foreground whitespace-pre-line">{lang === "hy" ? (activeLeader.bio_hy || activeLeader.bio) : activeLeader.bio}</p>}
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
                <Label>{t("Name (Armenian)", "Անուն (հայերեն)")}</Label>
                <Input value={leaderForm.name_hy} onChange={e => setLeaderForm({ ...leaderForm, name_hy: e.target.value })} placeholder="Դավիթ Պետրոսյան" data-testid="leader-form-name-hy"/>
              </div>
              <div>
                <Label>{t("Position", "Պաշտոն")}</Label>
                <Input value={leaderForm.position_title} onChange={e => setLeaderForm({ ...leaderForm, position_title: e.target.value })} placeholder="e.g. Scout Leader" data-testid="leader-form-position"/>
              </div>
              <div>
                <Label>{t("Position (Armenian)", "Պաշտոն (հայերեն)")}</Label>
                <Input value={leaderForm.position_title_hy} onChange={e => setLeaderForm({ ...leaderForm, position_title_hy: e.target.value })} placeholder="օրինակ՝ Սկաուտի ղեկավար" data-testid="leader-form-position-hy"/>
              </div>
              <div>
                <Label>{t("Phone", "Հեռախոս")}</Label>
                <Input value={leaderForm.phone} onChange={e => setLeaderForm({ ...leaderForm, phone: e.target.value })} data-testid="leader-form-phone"/>
              </div>
              <div>
                <Label>{t("About", "Մասին")}</Label>
                <Textarea rows={3} value={leaderForm.bio} onChange={e => setLeaderForm({ ...leaderForm, bio: e.target.value })} data-testid="leader-form-bio"/>
              </div>
              <div>
                <Label>{t("About (Armenian)", "Մասին (հայերեն)")}</Label>
                <Textarea rows={3} value={leaderForm.bio_hy} onChange={e => setLeaderForm({ ...leaderForm, bio_hy: e.target.value })} data-testid="leader-form-bio-hy"/>
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
                        name_hy: leaderForm.name_hy,
                        position_title: leaderForm.position_title,
                        position_title_hy: leaderForm.position_title_hy,
                        phone: leaderForm.phone,
                        bio: leaderForm.bio,
                        bio_hy: leaderForm.bio_hy,
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
        <section id="galleries" className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-20" style={{ order: orderIdx("galleries") }}>
          <div className="mb-6">
            <div className="uppercase-label">{t("Snapshots", "Պահեր")}</div>
            <h2 className="font-display text-4xl md:text-5xl font-black tracking-tight">
              {t("From the field", "Դաշտից")}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleries.slice(0, 6).map(g => (
              <Card key={g.gallery_id} onClick={() => setOpenGallery(g)} className="clay-card overflow-hidden hover-lift cursor-pointer group w-full" data-testid={`guest-gallery-${g.gallery_id}`}>
                <div className="relative w-full aspect-square bg-[hsl(149,40%,30%)] overflow-hidden" style={{ aspectRatio: "1 / 1" }}>
                  {g.cover
                    ? <img src={g.cover} alt={g.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = "none"; }}/>
                    : (g.images?.[0]?.data
                        ? <img src={g.images[0].data} alt={g.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = "none"; }}/>
                        : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-3" style={{ background: "linear-gradient(135deg, hsl(152 43% 15%), hsl(149 40% 30%))" }}>
                            <Camera size={64} strokeWidth={1.3}/>
                            <div className="text-[10px] uppercase tracking-[0.3em] font-bold">{t("Photos coming soon", "Լուսանկարները շուտով")}</div>
                          </div>
                        )
                      )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"/>
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/95 backdrop-blur text-[10px] font-bold uppercase tracking-widest text-[hsl(149,40%,30%)]">
                    {g.images?.length || 0} {t("photos", "լուսանկար")}
                  </div>
                  <div className="absolute bottom-5 left-6 right-6 text-white">
                    <div className="font-display font-black text-2xl leading-tight">{g.title}</div>
                    {g.description && <div className="text-sm opacity-85 mt-1 line-clamp-2">{g.description}</div>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Resources */}
      {resources.length > 0 && (
        <section id="resources" className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 pb-20" style={{ order: orderIdx("resources") }}>
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

      {/* Program details dialog */}
      </div>
      <Dialog open={!!openProgram} onOpenChange={(o) => !o && setOpenProgram(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="guest-program-dialog">
          {openProgram && (() => {
            const p = openProgram;
            const d = new Date(p.date);
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{lang === "hy" ? p.title_hy || p.title : p.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <Badge className="rounded-full bg-[hsl(149,40%,30%)]">{p.section}</Badge>
                    {!p.chapter_id && <Badge className="rounded-full bg-[hsl(32,87%,67%)] text-[hsl(155,60%,8%)]">{t("National", "Ազգային")}</Badge>}
                    {Number(p.fee) > 0 && <Badge className="rounded-full bg-[hsl(12,65%,63%)]">֏{Number(p.fee).toLocaleString()} AMD</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-muted">
                      <div className="uppercase-label">{t("Date", "Ամսաթիվ")}</div>
                      <div className="font-semibold text-sm">{d.toLocaleDateString(lang === "hy" ? "hy-AM" : "en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-muted">
                      <div className="uppercase-label">{t("Time", "Ժամ")}</div>
                      <div className="font-semibold text-sm">{p.start_time} – {p.end_time}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-muted">
                      <div className="uppercase-label">{t("Location", "Վայր")}</div>
                      <div className="font-semibold text-sm truncate">{p.location}</div>
                    </div>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  {p.objectives && (
                    <div>
                      <div className="uppercase-label">{t("Objectives", "Նպատակներ")}</div>
                      <p className="text-sm mt-1 whitespace-pre-line">{p.objectives}</p>
                    </div>
                  )}
                  {p.prerequisites && (
                    <div className="rounded-xl bg-[hsl(32,87%,67%)]/15 border-l-4 border-[hsl(32,87%,55%)] p-3">
                      <div className="uppercase-label text-[hsl(32,87%,45%)]">{t("Prerequisites", "Նախապահանջներ")}</div>
                      <p className="text-sm mt-1 whitespace-pre-line">{p.prerequisites}</p>
                    </div>
                  )}
                  {p.activities?.length > 0 && (
                    <div>
                      <div className="uppercase-label mb-2">{t("Schedule", "Ծրագրի ցանկ")}</div>
                      <div className="space-y-2">
                        {p.activities.map((a, i) => (
                          <div key={i} className="p-3 rounded-xl border border-border">
                            <div className="text-xs text-muted-foreground">{a.time}</div>
                            <div className="font-semibold text-sm">{a.title}</div>
                            {a.description && <div className="text-xs text-muted-foreground mt-1">{a.description}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.materials && (
                    <div>
                      <div className="uppercase-label">{t("Materials", "Պիտույքներ")}</div>
                      <p className="text-sm mt-1 whitespace-pre-line">{p.materials}</p>
                    </div>
                  )}
                  <Link to={user ? `/programs/${p.program_id}` : "/login"}>
                    <Button className="btn-pill w-full bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="guest-program-cta">
                      {user ? t("Open in dashboard", "Բացել վահանակում") : t("Sign in to register", "Մուտք՝ գրանցվելու համար")}
                    </Button>
                  </Link>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Newsletter details dialog */}
      <Dialog open={!!openNewsletter} onOpenChange={(o) => !o && setOpenNewsletter(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0" data-testid="guest-newsletter-dialog">
          {openNewsletter && (
            <>
              {openNewsletter.cover && <div className="h-48" style={{ backgroundImage: `url('${openNewsletter.cover}')`, backgroundSize: "cover", backgroundPosition: "center" }}/>}
              <div className="p-6 space-y-3">
                <DialogHeader>
                  <div className="uppercase-label">{new Date(openNewsletter.created_at).toLocaleDateString(lang === "hy" ? "hy-AM" : "en-US", { month: "long", day: "numeric", year: "numeric" })} · {t("By", "Հեղինակ")} {openNewsletter.author}</div>
                  <DialogTitle className="!text-2xl">{lang === "hy" ? openNewsletter.title_hy || openNewsletter.title : openNewsletter.title}</DialogTitle>
                </DialogHeader>
                {openNewsletter.short_description && <p className="text-sm text-muted-foreground italic">{openNewsletter.short_description}</p>}
                <div className="prose prose-sm max-w-none whitespace-pre-line text-sm leading-relaxed">{openNewsletter.content}</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Gallery viewer dialog (no download) */}
      <Dialog open={!!openGallery} onOpenChange={(o) => !o && setOpenGallery(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" data-testid="guest-gallery-dialog">
          {openGallery && (
            <>
              <DialogHeader>
                <div className="uppercase-label">{t("Snapshots", "Պահեր")} · {openGallery.images?.length || 0} {t("photos", "լուսանկար")}</div>
                <DialogTitle>{openGallery.title}</DialogTitle>
              </DialogHeader>
              {openGallery.description && <p className="text-sm text-muted-foreground -mt-2">{openGallery.description}</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                {(openGallery.images || []).map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxIdx(i)}
                    className="aspect-square rounded-xl overflow-hidden bg-muted relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(12,65%,63%)]"
                    data-testid={`gallery-thumb-${i}`}
                  >
                    <img src={img.data} alt={img.caption || `photo ${i+1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { e.currentTarget.style.display = "none"; }}/>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors"/>
                  </button>
                ))}
                {!openGallery.images?.length && <div className="col-span-full text-sm text-muted-foreground text-center py-6">{t("No photos yet.", "Դեռ լուսանկարներ չկան։")}</div>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox for gallery images */}
      {openGallery && lightboxIdx !== null && (
        <Lightbox
          images={openGallery.images || []}
          index={lightboxIdx}
          onIndex={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
          title={openGallery.title}
          t={t}
        />
      )}

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
              {lang === "hy"
                ? (footer.description_hy || "ՀՄԸՄ-ի սկաուտական շարժումը՝ բնության, համայնքի և ծառայության միջոցով բնավորության կրթություն։")
                : (footer.description || "The scouting movement of HOMENETMEN — building character through the outdoors, community, and service.")
              }
            </p>
          </div>

          <div>
            <div className="uppercase-label text-[hsl(32,87%,67%)] mb-3">{t("Headquarters", "Կենտրոն")}</div>
            <div className="text-sm space-y-2 text-white/80">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 flex-shrink-0"/>
                <div className="whitespace-pre-line">{footer.hq_address || "Yervand Kochar 17/6\nYerevan, Armenia"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14}/> <a href={`mailto:${footer.hq_email || "hq@homenetmen-hask.am"}`} className="hover:text-[hsl(12,65%,63%)]">{footer.hq_email || "hq@homenetmen-hask.am"}</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14}/> <a href={`tel:${(footer.hq_phone || "+37410000000").replace(/\s/g, "")}`} className="hover:text-[hsl(12,65%,63%)]">{footer.hq_phone || "+374 10 000 000"}</a>
              </div>
              {(footer.facebook || footer.instagram || footer.x || footer.telegram) && (
                <div className="flex items-center gap-2 pt-2" data-testid="footer-socials">
                  {footer.facebook && <a href={footer.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[hsl(12,65%,63%)] flex items-center justify-center transition-colors"><Facebook size={14}/></a>}
                  {footer.instagram && <a href={footer.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[hsl(12,65%,63%)] flex items-center justify-center transition-colors"><Instagram size={14}/></a>}
                  {footer.x && <a href={footer.x} target="_blank" rel="noreferrer" aria-label="X (Twitter)" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[hsl(12,65%,63%)] flex items-center justify-center transition-colors"><Twitter size={14}/></a>}
                  {footer.telegram && <a href={footer.telegram} target="_blank" rel="noreferrer" aria-label="Telegram" className="w-8 h-8 rounded-full bg-white/10 hover:bg-[hsl(12,65%,63%)] flex items-center justify-center transition-colors"><Send size={14}/></a>}
                </div>
              )}
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
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(footer.longitude || 44.5175) - 0.01}%2C${(footer.latitude || 40.1893) - 0.005}%2C${(footer.longitude || 44.5175) + 0.01}%2C${(footer.latitude || 40.1893) + 0.005}&layer=mapnik&marker=${footer.latitude || 40.1893}%2C${footer.longitude || 44.5175}`}
              />
            </div>
            <a
              href={`https://www.openstreetmap.org/?mlat=${footer.latitude || 40.1893}&mlon=${footer.longitude || 44.5175}#map=18/${footer.latitude || 40.1893}/${footer.longitude || 44.5175}`}
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

function Lightbox({ images, index, onIndex, onClose, title, t }) {
  const total = images.length;
  const [zoom, setZoom] = React.useState(false);

  const go = React.useCallback((delta) => {
    if (!total) return;
    const next = (index + delta + total) % total;
    onIndex(next);
    setZoom(false);
  }, [index, total, onIndex]);

  React.useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", handler, true);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler, true);
      document.body.style.overflow = "";
    };
  }, [go, onClose]);

  if (!total) return null;
  const img = images[index];

  const download = () => {
    if (!img?.data) return;
    const a = document.createElement("a");
    a.href = img.data;
    const safe = (img.caption || `${title || "photo"}-${index + 1}`).replace(/[^\w.-]+/g, "_");
    const ext = (img.data.match(/data:image\/(\w+)/) || [null, "jpg"])[1].replace("jpeg", "jpg");
    a.download = `${safe}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      style={{ pointerEvents: "auto" }}
      data-testid="lightbox"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white/90 flex-shrink-0">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest opacity-70 truncate">{title}</div>
          <div className="text-sm font-semibold">{index + 1} / {total}{img?.caption ? ` · ${img.caption}` : ""}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={download}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold"
            data-testid="lightbox-download"
          >
            <Download size={14}/> {t("Download", "Ներբեռնել")}
          </button>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Close"
            data-testid="lightbox-close"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center px-4 pb-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <button
          onClick={() => go(-1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10"
          aria-label="Previous"
          data-testid="lightbox-prev"
        >
          <ChevronLeft size={22}/>
        </button>
        <img
          src={img?.data}
          alt={img?.caption || `photo ${index + 1}`}
          onClick={() => setZoom(z => !z)}
          className={`max-h-full max-w-full object-contain select-none cursor-${zoom ? "zoom-out" : "zoom-in"} transition-transform duration-200`}
          style={{ transform: zoom ? "scale(2)" : "scale(1)" }}
          data-testid="lightbox-image"
        />
        <button
          onClick={() => go(1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10"
          aria-label="Next"
          data-testid="lightbox-next"
        >
          <ChevronRight size={22}/>
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-4 overflow-x-auto flex-shrink-0">
        {images.map((im, i) => (
          <button
            key={i}
            onClick={() => { onIndex(i); setZoom(false); }}
            className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${i === index ? "border-[hsl(12,65%,63%)] scale-105" : "border-transparent opacity-60 hover:opacity-100"}`}
            data-testid={`lightbox-thumb-${i}`}
          >
            <img src={im.data} alt="" className="w-full h-full object-cover"/>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
