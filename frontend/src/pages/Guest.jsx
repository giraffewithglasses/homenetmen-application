import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BadgePatch from "@/components/BadgePatch";
import {
  Flame, Users, Building2, Award, Compass, CalendarDays, MapPin, Clock,
  Mail, ChevronRight, Mountain, Tent, Heart, ArrowRight, Sparkles, Megaphone,
} from "lucide-react";

export default function Guest() {
  const [overview, setOverview] = useState(null);
  const [badges, setBadges] = useState([]);
  const [newsletters, setNewsletters] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [lang, setLang] = useState(() => localStorage.getItem("scout_lang") || "en");

  useEffect(() => {
    api.get("/public/overview").then(r => setOverview(r.data)).catch(() => {});
    api.get("/public/badges").then(r => setBadges(r.data)).catch(() => {});
    api.get("/public/newsletters").then(r => setNewsletters(r.data)).catch(() => {});
    api.get("/public/programs/upcoming").then(r => setUpcoming(r.data)).catch(() => {});
    api.get("/public/announcements").then(r => setAnnouncements(r.data)).catch(() => {});
  }, []);

  const setLangPersist = (l) => { setLang(l); localStorage.setItem("scout_lang", l); };
  const t = (en, hy) => (lang === "hy" ? hy : en);

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="sticky top-0 z-40 bg-[hsl(42,30%,94%)]/85 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[hsl(12,65%,63%)] text-white border-2 border-white shadow-inner">
              <Flame size={18}/>
            </div>
            <div>
              <div className="font-display font-black text-base leading-none">SCOUTS OF ARMENIA</div>
              <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground">Հայաստանի սկաուտներ · Est. 1918</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            <a href="#chapters" className="hover:text-[hsl(12,65%,63%)]">{t("Chapters", "Մասնաճյուղեր")}</a>
            <a href="#badges" className="hover:text-[hsl(12,65%,63%)]">{t("Badges", "Կրծքանշաններ")}</a>
            <a href="#events" className="hover:text-[hsl(12,65%,63%)]">{t("Events", "Ծրագրեր")}</a>
            <a href="#newsletters" className="hover:text-[hsl(12,65%,63%)]">{t("News", "Նորություններ")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLangPersist(lang === "hy" ? "en" : "hy")}
              className="px-3 py-1.5 rounded-full border border-border bg-white/60 hover:bg-white text-[11px] font-bold uppercase tracking-widest"
              data-testid="guest-lang-toggle"
            >{lang === "hy" ? "EN" : "ՀԱՅ"}</button>
            <Link to="/login">
              <Button className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)] h-9" data-testid="guest-signin-btn">
                {t("Sign in", "Մուտք")}
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
              "linear-gradient(115deg, hsl(152 43% 15% / 0.92), hsl(149 40% 30% / 0.55)), url('https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?crop=entropy&cs=srgb&fm=jpg&q=85')",
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
                  {!p.chapter_id && <Badge className="rounded-full ml-1 bg-[hsl(32,87%,67%)] text-[hsl(155,60%,8%)]">National</Badge>}
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
      <footer className="border-t border-border">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[hsl(12,65%,63%)] text-white">
              <Flame size={16}/>
            </div>
            <div>
              <div className="font-display font-black text-sm">SCOUTS OF ARMENIA</div>
              <div className="text-[10px] tracking-[0.28em] uppercase text-muted-foreground">© 2026 · Founded 1918</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            <a href="#chapters" className="mr-4 hover:text-foreground">Chapters</a>
            <a href="#badges" className="mr-4 hover:text-foreground">Badges</a>
            <a href="#events" className="mr-4 hover:text-foreground">Events</a>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
