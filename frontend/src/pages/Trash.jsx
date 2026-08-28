import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Award, FileText, RotateCcw, Trash2, Users } from "lucide-react";
import BadgePatch from "@/components/BadgePatch";
import { toast } from "sonner";

export default function Trash() {
  const [data, setData] = useState({ chapters: [], badges: [], resources: [], members: [] });
  const load = () => api.get("/trash").then(r => setData({ chapters: [], badges: [], resources: [], members: [], ...r.data })).catch(() => {});
  useEffect(() => { load(); }, []);

  const restore = async (kind, id) => {
    try {
      await api.post(`/${kind}/${id}/unarchive`);
      toast.success("Restored"); load();
    } catch { toast.error("Failed"); }
  };
  const purge = async (kind, id) => {
    if (!window.confirm("Permanently delete this? This cannot be undone.")) return;
    try {
      await api.delete(`/${kind}/${id}`);
      toast.success("Permanently deleted"); load();
    } catch { toast.error("Failed"); }
  };

  const total = data.chapters.length + data.badges.length + data.resources.length + data.members.length;

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label">Recycle</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Trash Bin</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Archived items across the platform. Restore anything, or delete forever.
          <span className="ml-2 font-bold">{total} items</span>
        </p>
      </div>

      <Tabs defaultValue="chapters">
        <TabsList className="rounded-full bg-muted p-1">
          <TabsTrigger value="chapters" className="rounded-full" data-testid="trash-tab-chapters">Chapters ({data.chapters.length})</TabsTrigger>
          <TabsTrigger value="badges" className="rounded-full" data-testid="trash-tab-badges">Badges ({data.badges.length})</TabsTrigger>
          <TabsTrigger value="resources" className="rounded-full" data-testid="trash-tab-resources">Resources ({data.resources.length})</TabsTrigger>
          <TabsTrigger value="members" className="rounded-full" data-testid="trash-tab-members">Members ({data.members.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="chapters">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {data.chapters.map(c => (
              <Card key={c.chapter_id} className="clay-card p-6">
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-[hsl(149,40%,30%)] text-white flex items-center justify-center"><Building2 size={20}/></div>
                </div>
                <div className="font-display font-bold text-lg mt-3">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.location}</div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="btn-pill flex-1" onClick={() => restore("chapters", c.chapter_id)} data-testid={`trash-restore-chp-${c.chapter_id}`}><RotateCcw size={12} className="mr-1"/>Restore</Button>
                  <Button size="sm" variant="ghost" className="btn-pill text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" onClick={() => purge("chapters", c.chapter_id)} data-testid={`trash-purge-chp-${c.chapter_id}`}><Trash2 size={12}/></Button>
                </div>
              </Card>
            ))}
            {!data.chapters.length && <div className="col-span-full text-sm text-muted-foreground text-center py-8">No archived chapters.</div>}
          </div>
        </TabsContent>

        <TabsContent value="badges">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {data.badges.map(b => (
              <Card key={b.badge_id} className="clay-card p-6">
                <div className="flex items-center gap-4">
                  <BadgePatch badge={b} awarded size={56}/>
                  <div>
                    <div className="font-display font-bold">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.section} · {b.category}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="btn-pill flex-1" onClick={() => restore("badges", b.badge_id)} data-testid={`trash-restore-bdg-${b.badge_id}`}><RotateCcw size={12} className="mr-1"/>Restore</Button>
                  <Button size="sm" variant="ghost" className="btn-pill text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" onClick={() => purge("badges", b.badge_id)} data-testid={`trash-purge-bdg-${b.badge_id}`}><Trash2 size={12}/></Button>
                </div>
              </Card>
            ))}
            {!data.badges.length && <div className="col-span-full text-sm text-muted-foreground text-center py-8">No archived badges.</div>}
          </div>
        </TabsContent>

        <TabsContent value="resources">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {data.resources.map(r => (
              <Card key={r.resource_id} className="clay-card p-6">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[hsl(32,87%,67%)]/25 text-[hsl(32,87%,55%)] flex items-center justify-center"><FileText size={18}/></div>
                  <div>
                    <div className="uppercase-label">{r.category}</div>
                    <div className="font-semibold">{r.title}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="btn-pill flex-1" onClick={() => restore("resources", r.resource_id)} data-testid={`trash-restore-res-${r.resource_id}`}><RotateCcw size={12} className="mr-1"/>Restore</Button>
                  <Button size="sm" variant="ghost" className="btn-pill text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" onClick={() => purge("resources", r.resource_id)} data-testid={`trash-purge-res-${r.resource_id}`}><Trash2 size={12}/></Button>
                </div>
              </Card>
            ))}
            {!data.resources.length && <div className="col-span-full text-sm text-muted-foreground text-center py-8">No archived resources.</div>}
          </div>
        </TabsContent>

        <TabsContent value="members">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {data.members.map(m => (
              <Card key={m.member_id} className="clay-card p-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-display font-black">
                    {m.full_name?.[0] || <Users size={20}/>}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm truncate">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.section} · {m.patrol || "—"}</div>
                    {m.email && <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" className="btn-pill flex-1" onClick={() => restore("members", m.member_id)} data-testid={`trash-restore-mbr-${m.member_id}`}><RotateCcw size={12} className="mr-1"/>Restore</Button>
                </div>
              </Card>
            ))}
            {!data.members.length && <div className="col-span-full text-sm text-muted-foreground text-center py-8">No archived members.</div>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
