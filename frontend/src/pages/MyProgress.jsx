import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import BadgePatch from "@/components/BadgePatch";
import { Trophy } from "lucide-react";

export default function MyProgress() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [allBadges, setAllBadges] = useState([]);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const [s, b] = await Promise.all([api.get("/stats/scout"), api.get("/badges")]);
    setStats(s.data); setAllBadges(b.data);
  };
  useEffect(() => { load(); }, []);

  if (!stats) return <div>Loading…</div>;
  if (!stats.linked) return (
    <Card className="clay-card p-8 text-center">
      <div className="uppercase-label">No profile linked</div>
      <h2 className="font-display text-2xl mt-2">Ask your chapter leader to link a member record to your email.</h2>
    </Card>
  );

  const member = stats.member;
  const memberBadges = member?.badges || [];
  const getMB = (bid) => memberBadges.find(mb => mb.badge_id === bid);
  const awarded = allBadges.filter(b => getMB(b.badge_id)?.awarded);
  const inProgress = allBadges.filter(b => { const mb = getMB(b.badge_id); return mb && !mb.awarded; });
  const available = allBadges.filter(b => !getMB(b.badge_id));

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label">Achievement Journal</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">My Progress</h1>
      </div>

      <Card className="clay-card p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="uppercase-label">Overall completion</div>
          <div className="font-display font-black text-2xl">{stats.progress_percent}%</div>
        </div>
        <Progress value={stats.progress_percent} className="h-4"/>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="stat-tile"><div className="text-3xl font-black font-display">{stats.awarded_count}</div><div className="uppercase-label mt-1">Awarded</div></div>
          <div className="stat-tile"><div className="text-3xl font-black font-display">{stats.in_progress_count}</div><div className="uppercase-label mt-1">In progress</div></div>
          <div className="stat-tile"><div className="text-3xl font-black font-display">{stats.total_badges}</div><div className="uppercase-label mt-1">Total badges</div></div>
        </div>
      </Card>

      <Section title="Awarded" badges={awarded} getMB={getMB} onSelect={setSelected} awarded/>
      <Section title="In progress" badges={inProgress} getMB={getMB} onSelect={setSelected}/>
      <Section title="Available" badges={available} getMB={getMB} onSelect={setSelected}/>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-display">{selected.name}</DialogTitle></DialogHeader>
            <div className="flex items-center gap-4">
              <BadgePatch badge={selected} awarded={!!getMB(selected.badge_id)?.awarded} size={90}/>
              <div>
                <div className="text-sm text-muted-foreground">{selected.name_hy}</div>
                <div className="mt-1 flex gap-2">
                  <Badge className="rounded-full">{selected.section}</Badge>
                  <Badge variant="outline" className="rounded-full">{selected.category}</Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{selected.description}</p>
            <div className="uppercase-label">Requirements</div>
            <ul className="space-y-2">
              {selected.requirements.map((r, i) => {
                const mb = getMB(selected.badge_id);
                const done = mb?.completed_requirements?.[i];
                return (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${done ? "bg-[hsl(149,40%,30%)] border-[hsl(149,40%,30%)]" : "border-border"}`}>
                      {done && <span className="text-white text-xs">✓</span>}
                    </div>
                    <span className={done ? "line-through text-muted-foreground" : ""}>{r}</span>
                  </li>
                );
              })}
            </ul>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function Section({ title, badges, getMB, onSelect, awarded }) {
  if (!badges.length) return null;
  return (
    <Card className="clay-card p-6">
      <div className="flex items-center gap-2 mb-4">
        {awarded && <Trophy size={18} className="text-[hsl(32,87%,67%)]"/>}
        <h3 className="font-display font-bold text-xl">{title} <span className="text-muted-foreground font-normal">({badges.length})</span></h3>
      </div>
      <div className="flex flex-wrap gap-6">
        {badges.map(b => {
          const mb = getMB(b.badge_id);
          const total = b.requirements?.length || 1;
          const done = (mb?.completed_requirements || []).filter(Boolean).length;
          const pct = Math.round(done / total * 100);
          return (
            <button key={b.badge_id} onClick={() => onSelect(b)} className="text-center focus:outline-none group" data-testid={`bdg-open-${b.badge_id}`}>
              <BadgePatch badge={b} awarded={mb?.awarded} progress={pct}/>
              <div className="text-xs font-semibold mt-2 max-w-[86px] group-hover:text-[hsl(12,65%,63%)]">{b.name}</div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
