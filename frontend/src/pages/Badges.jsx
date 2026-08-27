import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, Archive, ArchiveRestore } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import BadgePatch from "@/components/BadgePatch";

const SECTIONS = ["Cubs", "Scouts", "Senior Scouts", "Rovers"];
const CATEGORIES = ["Scouting Skills", "Camping", "Hiking", "First Aid", "Leadership", "Nature", "Community Service", "Communication", "Navigation", "Sports", "Creativity", "Citizenship"];

export default function Badges() {
  const { user } = useAuth();
  const [badges, setBadges] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    name: "", name_hy: "", icon: "star", icon_image: "", color: "#2D6A4F", description: "",
    section: "Scouts", category: "Scouting Skills", difficulty: "medium",
    recommended_age: "12+", requirements: [],
  });
  const [reqInput, setReqInput] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const load = () => api.get(`/badges?include_archived=${showArchived}`).then(r => setBadges(r.data));
  useEffect(() => { load(); }, [showArchived]);

  const save = async () => {
    try { await api.post("/badges", form); toast.success("Badge created"); setOpen(false); load(); }
    catch { toast.error("Failed"); }
  };
  const archive = async (bid, archived) => {
    try {
      await api.post(`/badges/${bid}/${archived ? "unarchive" : "archive"}`);
      toast.success(archived ? "Restored" : "Archived");
      load();
    } catch { toast.error("Failed"); }
  };
  const addReq = () => { if (reqInput.trim()) { setForm({...form, requirements: [...form.requirements, reqInput.trim()]}); setReqInput(""); } };

  const filtered = filter === "all" ? badges : badges.filter(b => b.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label">Progress</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Progress Badges</h1>
          <p className="text-muted-foreground mt-1">Skills, adventures and merit.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {user?.role === "national_admin" && (
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold cursor-pointer">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} data-testid="bdg-show-archived"/>
              Show archived
            </label>
          )}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Category"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {user?.role === "national_admin" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="btn-pill bg-[hsl(12,65%,63%)]" data-testid="new-badge-btn"><Plus size={16} className="mr-2"/>New Badge</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Badge</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="bdg-name"/></div>
                  <div><Label>Name (Armenian)</Label><Input value={form.name_hy} onChange={e => setForm({...form, name_hy: e.target.value})}/></div>
                  <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></div>
                  <div className="col-span-2">
                    <Label>Badge image</Label>
                    <div className="flex items-center gap-4 mt-2">
                      <BadgePatch badge={form} awarded size={64}/>
                      <div className="flex-1 space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          data-testid="bdg-image-input"
                          onChange={(e) => {
                            const f = e.target.files?.[0]; if (!f) return;
                            if (f.size > 1024 * 1024) return toast.error("Image must be under 1 MB");
                            const r = new FileReader();
                            r.onload = () => setForm({...form, icon_image: r.result});
                            r.readAsDataURL(f);
                          }}
                        />
                        {form.icon_image && (
                          <button
                            type="button"
                            onClick={() => setForm({...form, icon_image: ""})}
                            className="text-xs uppercase tracking-widest font-bold text-[hsl(0,65%,55%)]"
                            data-testid="bdg-image-clear"
                          >Remove image</button>
                        )}
                        <p className="text-xs text-muted-foreground">Upload a square image (PNG/JPG, &lt;1&nbsp;MB). Leave empty to use the color badge below.</p>
                      </div>
                    </div>
                  </div>
                  <div><Label>Fallback color</Label><Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})}/></div>
                  <div><Label>Section</Label>
                    <Select value={form.section} onValueChange={v => setForm({...form, section: v})}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{SECTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Difficulty</Label>
                    <Select value={form.difficulty} onValueChange={v => setForm({...form, difficulty: v})}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Recommended age</Label><Input value={form.recommended_age} onChange={e => setForm({...form, recommended_age: e.target.value})}/></div>
                  <div className="col-span-2">
                    <Label>Requirements</Label>
                    <div className="flex gap-2">
                      <Input value={reqInput} onChange={e => setReqInput(e.target.value)} placeholder="Add a requirement…"/>
                      <Button type="button" onClick={addReq}>Add</Button>
                    </div>
                    <ul className="mt-2 text-sm space-y-1">
                      {form.requirements.map((r, i) => <li key={i} className="flex items-center gap-2">• {r}</li>)}
                    </ul>
                  </div>
                </div>
                <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)] mt-2" data-testid="bdg-save">Create Badge</Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(b => (
          <Card key={b.badge_id} className={`clay-card p-6 hover-lift relative ${b.archived ? "opacity-60" : ""}`}>
            {user?.role === "national_admin" && (
              <button
                onClick={() => archive(b.badge_id, b.archived)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(32,87%,67%)]/20 hover:text-[hsl(32,87%,55%)] flex items-center justify-center"
                data-testid={`archive-bdg-${b.badge_id}`}
                title={b.archived ? "Unarchive" : "Archive"}
              >
                {b.archived ? <ArchiveRestore size={14}/> : <Archive size={14}/>}
              </button>
            )}
            <div className="flex items-start gap-4">
              <BadgePatch badge={b} awarded />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full">{b.section}</Badge>
                  <Badge className="rounded-full bg-[hsl(32,87%,67%)] text-[hsl(155,60%,8%)]">{b.difficulty}</Badge>
                </div>
                <div className="font-display font-bold text-lg mt-2">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.name_hy}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">{b.description}</p>
            <div className="uppercase-label mt-4">Requirements ({b.requirements?.length || 0})</div>
            <ul className="mt-2 text-sm space-y-1">
              {(b.requirements || []).slice(0, 3).map((r, i) => <li key={i}>• {r}</li>)}
              {b.requirements?.length > 3 && <li className="text-muted-foreground">+ {b.requirements.length - 3} more…</li>}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
