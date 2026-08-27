import React, { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, Award, Calendar, TrendingUp, Building2, Flame, ArrowUpRight, Sparkles } from "lucide-react";
import BadgePatch from "@/components/BadgePatch";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell,
} from "recharts";

export default function Dashboard() {
  const { user } = useAuth();
  const { lang } = useOutletContext();
  if (user?.role === "national_admin") return <NationalDashboard lang={lang} />;
  if (user?.role === "scout") return <ScoutDashboard lang={lang} user={user} />;
  if (user?.role === "parent") return <ParentDashboard lang={lang} user={user} />;
  return <ChapterDashboard lang={lang} user={user} />;
}

function StatTile({ icon: Icon, label, value, color = "hsl(12,65%,63%)", trend }) {
  return (
    <div className="stat-tile hover-lift" data-testid={`stat-${label.toLowerCase().replace(/\s/g,"-")}`}>
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${color}22`, color }}>
          <Icon size={20} />
        </div>
        {trend && <div className="text-xs font-semibold text-[hsl(149,40%,30%)] flex items-center gap-1"><ArrowUpRight size={12} />{trend}</div>}
      </div>
      <div className="mt-4 text-4xl font-black font-display tracking-tight">{value}</div>
      <div className="uppercase-label mt-1">{label}</div>
    </div>
  );
}

function NationalDashboard({ lang }) {
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [newsletters, setNewsletters] = useState([]);

  useEffect(() => {
    api.get("/stats/national").then(r => setStats(r.data)).catch(() => {});
    api.get("/announcements").then(r => setAnnouncements(r.data.slice(0, 3))).catch(() => {});
    api.get("/newsletters").then(r => setNewsletters(r.data.slice(0, 1))).catch(() => {});
  }, []);

  const COLORS = ["#E07A5F", "#2D6A4F", "#F4A261", "#52796F"];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="uppercase-label">{lang === "hy" ? "Ազգային վահանակ" : "National Command"}</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">
            {lang === "hy" ? "Ողջույն, հրամանատար" : "Welcome, Commander"}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {lang === "hy" ? "Ամբողջ ցանցի ամփոփ պատկերը՝ մասնաճյուղեր, անդամներ, կրծքանշաններ և ծրագրեր։" : "The pulse of the entire scouting network — chapters, members, badges and programs at a glance."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile icon={Users} label="Total Members" value={stats?.total_members ?? "—"} trend="+12%" color="hsl(12,65%,63%)" />
        <StatTile icon={Building2} label="Chapters" value={stats?.total_chapters ?? "—"} color="hsl(149,40%,30%)" />
        <StatTile icon={Award} label="Badges Awarded" value={stats?.badges_awarded ?? "—"} trend="+34" color="hsl(32,87%,67%)" />
        <StatTile icon={Calendar} label="Programs" value={stats?.activities_this_month ?? "—"} color="hsl(156,15%,40%)" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="clay-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-xl">Chapter Comparison</h3>
            <Badge variant="secondary" className="rounded-full">Members</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.per_chapter || []}>
                <XAxis dataKey="chapter" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="members" fill="#E07A5F" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="clay-card p-6">
          <h3 className="font-display font-bold text-xl mb-4">Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats?.per_chapter || []} dataKey="members" nameKey="chapter" innerRadius={50} outerRadius={90} paddingAngle={4}>
                  {(stats?.per_chapter || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
            {(stats?.per_chapter || []).map((c, i) => (
              <div key={c.chapter} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate">{c.chapter}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="clay-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-xl flex items-center gap-2"><Sparkles size={18} className="text-[hsl(32,87%,67%)]" /> Latest Newsletter</h3>
            <Link to="/newsletters" className="text-xs uppercase tracking-widest font-bold text-[hsl(12,65%,63%)]">Browse all</Link>
          </div>
          {newsletters[0] ? (
            <div>
              <div className="uppercase-label">{new Date(newsletters[0].created_at).toLocaleDateString()}</div>
              <div className="font-display font-black text-2xl mt-1">{newsletters[0].title}</div>
              <div className="text-sm text-muted-foreground mt-1">{newsletters[0].title_hy}</div>
              <p className="mt-3 text-sm">{newsletters[0].short_description}</p>
            </div>
          ) : <div className="text-sm text-muted-foreground">No newsletters yet.</div>}
        </Card>

        <Card className="clay-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-xl">Recent Announcements</h3>
            <Link to="/announcements" className="text-xs uppercase tracking-widest font-bold text-[hsl(12,65%,63%)]">All</Link>
          </div>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.announcement_id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                <div className={`w-2 h-2 rounded-full mt-2 ${a.priority === "high" ? "bg-[hsl(12,65%,63%)]" : "bg-[hsl(149,40%,30%)]"}`} />
                <div>
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{a.message}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ChapterDashboard({ lang, user }) {
  const [stats, setStats] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (!user?.chapter_id) return;
    api.get(`/stats/chapter/${user.chapter_id}`).then(r => setStats(r.data)).catch(() => {});
    api.get("/programs").then(r => setPrograms(r.data.slice(0, 5))).catch(() => {});
    api.get("/announcements").then(r => setAnnouncements(r.data.slice(0, 3))).catch(() => {});
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <div className="uppercase-label">{lang === "hy" ? "Մասնաճյուղի վահանակ" : "Chapter Command"}</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Hello, {user?.name?.split(" ")[0]}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile icon={Users} label="Members" value={stats?.total_members ?? "—"} color="hsl(12,65%,63%)" />
        <StatTile icon={Award} label="Badges Awarded" value={stats?.badges_awarded ?? "—"} color="hsl(32,87%,67%)" />
        <StatTile icon={TrendingUp} label="Attendance %" value={stats?.attendance_percent ?? "—"} color="hsl(149,40%,30%)" />
        <StatTile icon={Calendar} label="Programs" value={stats?.programs_count ?? "—"} color="hsl(156,15%,40%)" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="clay-card p-6">
          <h3 className="font-display font-bold text-xl mb-4">Members by section</h3>
          <div className="space-y-3">
            {stats && Object.entries(stats.by_section).map(([sec, n]) => (
              <div key={sec}>
                <div className="flex justify-between text-sm mb-1"><span>{sec}</span><span className="font-bold">{n}</span></div>
                <Progress value={Math.min(100, n * 8)} className="h-3" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="clay-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-xl">Upcoming activities</h3>
            <Link to="/programs" className="text-xs uppercase tracking-widest font-bold text-[hsl(12,65%,63%)]">All</Link>
          </div>
          <div className="space-y-2">
            {programs.map(p => (
              <Link to={`/programs/${p.program_id}`} key={p.program_id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/60">
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.date} · {p.location}</div>
                </div>
                <Badge className="rounded-full" style={{ background: "hsl(149 40% 30%)" }}>{p.section}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="clay-card p-6">
        <h3 className="font-display font-bold text-xl mb-4">Recent announcements</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {announcements.map(a => (
            <div key={a.announcement_id} className="p-4 rounded-xl bg-muted/50 border border-border">
              <div className="uppercase-label">{a.priority}</div>
              <div className="font-bold mt-1">{a.title}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{a.message}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScoutDashboard({ lang, user }) {
  const [stats, setStats] = useState(null);
  const [badges, setBadges] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [news, setNews] = useState([]);

  useEffect(() => {
    api.get("/stats/scout").then(r => setStats(r.data)).catch(() => {});
    api.get("/badges").then(r => setBadges(r.data)).catch(() => {});
    api.get("/programs").then(r => setPrograms(r.data.slice(0, 3))).catch(() => {});
    api.get("/announcements").then(r => setAnnouncements(r.data.slice(0, 3))).catch(() => {});
    api.get("/newsletters").then(r => setNews(r.data.slice(0, 1))).catch(() => {});
  }, []);

  const member = stats?.member;
  return (
    <div className="space-y-8">
      <div className="clay-card p-6 lg:p-8 relative overflow-hidden" style={{
        background: "linear-gradient(120deg, hsl(152 43% 15%), hsl(149 40% 25%))", color: "white", border: "none"
      }}>
        <div className="absolute -right-10 -bottom-10 opacity-20">
          <Flame size={200} strokeWidth={1.4} />
        </div>
        <div className="uppercase-label" style={{ color: "hsl(32 87% 75%)" }}>{lang === "hy" ? "Ողջույն" : "Welcome back"}</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">{user?.name?.split(" ")[0]}</h1>
        <div className="mt-2 text-white/80 text-sm">
          {member?.section} · {member?.patrol} Patrol · {lang === "hy" ? "Մասնաճյուղ" : "Chapter"}: {user?.chapter_id}
        </div>
        <div className="mt-6 max-w-md">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>{lang === "hy" ? "Ընդհանուր առաջընթաց" : "Overall progress"}</span>
            <span className="font-bold">{stats?.progress_percent || 0}%</span>
          </div>
          <div className="h-4 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${stats?.progress_percent || 0}%`, background: "linear-gradient(90deg, hsl(12 65% 63%), hsl(32 87% 67%))" }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile icon={Award} label="Badges earned" value={stats?.awarded_count ?? 0} color="hsl(32,87%,67%)" />
        <StatTile icon={TrendingUp} label="In progress" value={stats?.in_progress_count ?? 0} color="hsl(12,65%,63%)" />
        <StatTile icon={Users} label="Total badges" value={stats?.total_badges ?? 0} color="hsl(149,40%,30%)" />
        <StatTile icon={Calendar} label="Next activity" value={programs[0]?.date?.slice(5) || "—"} color="hsl(156,15%,40%)" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="clay-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-xl">Recent badges</h3>
            <Link to="/my-progress" className="text-xs uppercase tracking-widest font-bold text-[hsl(12,65%,63%)]">See all</Link>
          </div>
          <div className="flex flex-wrap gap-6 justify-center">
            {badges.slice(0, 6).map(b => (
              <BadgePatch key={b.badge_id} badge={b} awarded={false} />
            ))}
          </div>
        </Card>

        <Card className="clay-card p-6">
          <h3 className="font-display font-bold text-xl mb-4">Upcoming activities</h3>
          <div className="space-y-3">
            {programs.map(p => (
              <Link to={`/programs/${p.program_id}`} key={p.program_id} className="block p-3 rounded-xl hover:bg-muted/60 border border-border">
                <div className="font-semibold">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.date} · {p.start_time} · {p.location}</div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="clay-card p-6">
          <h3 className="font-display font-bold text-xl mb-4">Announcements</h3>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.announcement_id} className="pb-3 border-b border-border last:border-0">
                <div className="uppercase-label">{a.priority}</div>
                <div className="font-semibold">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.message}</div>
              </div>
            ))}
          </div>
        </Card>
        {news[0] && (
          <Card className="clay-card p-6">
            <div className="uppercase-label">Newsletter</div>
            <h3 className="font-display font-black text-2xl mt-1">{news[0].title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{news[0].short_description}</p>
            <Link to="/newsletters" className="inline-block mt-4 text-sm font-bold text-[hsl(12,65%,63%)]">Read all →</Link>
          </Card>
        )}
      </div>
    </div>
  );
}


function ParentDashboard({ lang, user }) {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/parent/children").then(r => { setChildren(r.data.children || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-8">
      <div className="clay-card p-6 lg:p-8" style={{ background: "linear-gradient(120deg, hsl(152 43% 15%), hsl(149 40% 25%))", color: "white", border: "none" }}>
        <div className="uppercase-label" style={{ color: "hsl(32 87% 75%)" }}>Parent view</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Hello, {user?.name?.split(" ")[0]}</h1>
        <p className="text-white/80 mt-2 text-sm">Read-only overview of your scout{children.length > 1 ? "s" : ""}. Any changes need to be made by a chapter leader.</p>
      </div>

      {!children.length && (
        <Card className="clay-card p-8 text-center">
          <div className="text-sm text-muted-foreground">Your account isn't linked to any scouts yet. Ask a chapter leader to link a child to your email.</div>
        </Card>
      )}

      <div className="space-y-6">
        {children.map(k => (
          <Card key={k.member_id} className="clay-card p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-black text-2xl font-display">{k.full_name[0]}</div>
              <div className="flex-1">
                <div className="font-display font-black text-2xl">{k.full_name}</div>
                <div className="text-muted-foreground text-sm">{k.section} · {k.patrol} Patrol · {k.position}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="stat-tile"><div className="text-3xl font-black font-display">{k.awarded_count}</div><div className="uppercase-label mt-1">Badges</div></div>
              <div className="stat-tile"><div className="text-3xl font-black font-display">{k.attendance_percent}%</div><div className="uppercase-label mt-1">Attendance</div></div>
              <div className="stat-tile"><div className="text-3xl font-black font-display">{k.attendance?.length || 0}</div><div className="uppercase-label mt-1">Events</div></div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <div>
                <div className="uppercase-label mb-3">Badges in progress</div>
                <div className="flex flex-wrap gap-4">
                  {(k.badges || []).map(mb => {
                    if (!mb.badge) return null;
                    const total = mb.badge.requirements?.length || 1;
                    const done = (mb.completed_requirements || []).filter(Boolean).length;
                    const pct = Math.round(done / total * 100);
                    return (
                      <div key={mb.mb_id} className="text-center">
                        <BadgePatch badge={mb.badge} awarded={mb.awarded} progress={pct}/>
                        <div className="text-xs font-semibold mt-1 max-w-[80px]">{mb.badge.name}</div>
                      </div>
                    );
                  })}
                  {!k.badges?.length && <div className="text-sm text-muted-foreground">No badges yet.</div>}
                </div>
              </div>
              <div>
                <div className="uppercase-label mb-3">Next activity</div>
                {k.next_activity ? (
                  <Link to={`/programs/${k.next_activity.program_id}`} className="block p-4 rounded-xl bg-muted/50 border border-border hover:bg-muted">
                    <div className="font-semibold">{k.next_activity.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{k.next_activity.date} · {k.next_activity.start_time} · {k.next_activity.location}</div>
                  </Link>
                ) : <div className="text-sm text-muted-foreground">No upcoming activities.</div>}

                <div className="uppercase-label mt-6 mb-3">Recent attendance</div>
                <div className="space-y-1">
                  {(k.attendance || []).slice(0, 5).map(a => (
                    <div key={a.attendance_id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/40">
                      <span>{a.date?.slice(0, 10)}</span>
                      <Badge variant="outline" className="rounded-full text-[10px]">{a.status}</Badge>
                    </div>
                  ))}
                  {!k.attendance?.length && <div className="text-sm text-muted-foreground">No attendance yet.</div>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
