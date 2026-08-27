import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { confirmWithUndo } from "@/lib/undo";
import { Plus, AlertOctagon, Megaphone, Trash2 } from "lucide-react";

export default function Announcements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [form, setForm] = useState({ title: "", title_hy: "", message: "", priority: "normal", expires_at: "" });

  const load = async () => {
    const { data } = await api.get("/announcements");
    setItems(data); setSelected(new Set());
  };
  useEffect(() => { load(); }, []);

  const canPost = user?.role && user.role !== "scout";
  const canDelete = (a) => {
    if (user?.role === "national_admin") return true;
    if (["chapter_admin","chapter_leader"].includes(user?.role) && a.chapter_id === user?.chapter_id) return true;
    return false;
  };

  const save = async () => {
    try { await api.post("/announcements", form); toast.success("Posted"); setOpen(false); load(); }
    catch { toast.error("Failed"); }
  };
  const remove = (a) => {
    const prev = items;
    setItems(items.filter(x => x.announcement_id !== a.announcement_id));
    confirmWithUndo({
      message: `Deleted "${a.title}"`,
      doDelete: async () => { await api.delete(`/announcements/${a.announcement_id}`); },
      restore: () => setItems(prev),
    });
  };
  const removeBulk = () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const prev = items;
    setItems(items.filter(x => !selected.has(x.announcement_id)));
    setSelected(new Set());
    confirmWithUndo({
      message: `Deleted ${ids.length} announcements`,
      doDelete: async () => { for (const id of ids) await api.delete(`/announcements/${id}`); },
      restore: () => setItems(prev),
    });
  };
  const toggle = (id, checked) => {
    const n = new Set(selected);
    if (checked) n.add(id); else n.delete(id);
    setSelected(n);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label">News</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Announcements</h1>
          {selected.size > 0 && <p className="text-xs uppercase tracking-widest text-[hsl(12,65%,63%)] font-bold mt-1">{selected.size} selected</p>}
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="outline" className="btn-pill text-[hsl(0,65%,55%)] border-[hsl(0,65%,55%)]/40 hover:bg-[hsl(0,65%,55%)]/10" onClick={removeBulk} data-testid="bulk-del-ann">
              <Trash2 size={14} className="mr-2"/>Delete selected
            </Button>
          )}
          {canPost && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="btn-pill bg-[hsl(12,65%,63%)]" data-testid="new-ann-btn"><Plus size={16} className="mr-2"/>New Announcement</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})}/></div>
                  <div><Label>Title (Armenian)</Label><Input value={form.title_hy} onChange={e => setForm({...form, title_hy: e.target.value})}/></div>
                  <div><Label>Message</Label><Textarea rows={5} value={form.message} onChange={e => setForm({...form, message: e.target.value})}/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Priority</Label>
                      <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Expires at</Label><Input type="date" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})}/></div>
                  </div>
                  <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)]">Post</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map(a => (
          <Card key={a.announcement_id} className={`clay-card p-6 border-l-4 relative ${a.priority === "high" || a.priority === "urgent" ? "border-l-[hsl(12,65%,63%)]" : "border-l-[hsl(149,40%,30%)]"} ${selected.has(a.announcement_id) ? "ring-2 ring-[hsl(12,65%,63%)]" : ""}`}>
            {canDelete(a) && (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <Checkbox
                  checked={selected.has(a.announcement_id)}
                  onCheckedChange={(v) => toggle(a.announcement_id, v)}
                  data-testid={`ann-check-${a.announcement_id}`}
                />
                <button
                  onClick={() => remove(a)}
                  className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(0,65%,55%)]/10 hover:text-[hsl(0,65%,55%)] flex items-center justify-center"
                  data-testid={`del-ann-${a.announcement_id}`}
                ><Trash2 size={14}/></button>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.priority === "high" || a.priority === "urgent" ? "bg-[hsl(12,65%,63%)]" : "bg-[hsl(149,40%,30%)]"} text-white`}>
                {a.priority === "high" || a.priority === "urgent" ? <AlertOctagon size={18}/> : <Megaphone size={18}/>}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="rounded-full uppercase text-[10px]">{a.priority}</Badge>
                  <Badge className="rounded-full" style={{ background: a.chapter_id ? "hsl(149 40% 30%)" : "hsl(32 87% 67%)", color: a.chapter_id ? "white" : "hsl(155 60% 8%)" }}>
                    {a.chapter_id ? "Chapter" : "National"}
                  </Badge>
                </div>
                <div className="font-display font-bold text-lg mt-2">{a.title}</div>
                <div className="text-xs text-muted-foreground">{a.title_hy}</div>
                <p className="text-sm mt-2">{a.message}</p>
                <div className="uppercase-label mt-3">by {a.author} · {new Date(a.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
