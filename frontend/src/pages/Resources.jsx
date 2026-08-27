import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { FileText, Plus, Download, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const CATEGORIES = ["Manuals", "Activity ideas", "Progress badge materials", "Forms", "Policies", "Camp documents", "Training materials", "Leader resources"];

export default function Resources() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Manuals", description: "", file_data: "", file_name: "", file_type: "" });
  const [category, setCategory] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (showArchived) params.set("include_archived", "true");
    api.get(`/resources?${params}`).then(r => setItems(r.data));
  };
  useEffect(() => { load(); }, [category, showArchived]);

  const canUpload = user?.role && user.role !== "scout";

  const onFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, file_data: reader.result, file_name: f.name, file_type: f.type });
    reader.readAsDataURL(f);
  };
  const save = async () => {
    try { await api.post("/resources", form); toast.success("Uploaded"); setOpen(false); load(); }
    catch { toast.error("Failed"); }
  };
  const archive = async (rid, archived) => {
    try {
      await api.post(`/resources/${rid}/${archived ? "unarchive" : "archive"}`);
      toast.success(archived ? "Restored" : "Archived");
      load();
    } catch { toast.error("Failed"); }
  };
  const remove = async (rid) => {
    if (!window.confirm("Delete this resource?")) return;
    try { await api.delete(`/resources/${rid}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };
  const download = async (rid, name) => {
    try {
      const { data } = await api.get(`/resources/${rid}`);
      if (!data.file_data) return toast.info("No file attached");
      const a = document.createElement("a"); a.href = data.file_data; a.download = name || "resource"; a.click();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label">Library</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Resources</h1>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {canUpload && (
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold cursor-pointer">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} data-testid="res-show-archived"/>
              Archived
            </label>
          )}
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Category"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {canUpload && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="btn-pill bg-[hsl(12,65%,63%)]" data-testid="new-res-btn"><Plus size={16} className="mr-2"/>Upload</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Upload Resource</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})}/></div>
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></div>
                  <div><Label>File</Label><Input type="file" onChange={onFile}/></div>
                  <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)]">Upload</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(r => (
          <Card key={r.resource_id} className={`clay-card p-6 hover-lift relative ${r.archived ? "opacity-60" : ""}`} data-testid={`res-${r.resource_id}`}>
            {canUpload && (
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={() => archive(r.resource_id, r.archived)}
                  className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(32,87%,67%)]/20 hover:text-[hsl(32,87%,55%)] flex items-center justify-center"
                  data-testid={`archive-res-${r.resource_id}`}
                  title={r.archived ? "Unarchive" : "Archive"}
                >
                  {r.archived ? <ArchiveRestore size={14}/> : <Archive size={14}/>}
                </button>
                {user?.role === "national_admin" && (
                  <button
                    onClick={() => remove(r.resource_id)}
                    className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(0,65%,55%)]/10 hover:text-[hsl(0,65%,55%)] flex items-center justify-center"
                    data-testid={`del-res-${r.resource_id}`}
                    title="Delete"
                  ><Trash2 size={14}/></button>
                )}
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[hsl(149,40%,30%)]/15 text-[hsl(149,40%,30%)] flex items-center justify-center">
                <FileText size={20}/>
              </div>
              <div className="flex-1">
                <div className="uppercase-label">{r.category}</div>
                <div className="font-semibold mt-1">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</div>
                <Button size="sm" variant="ghost" className="mt-3" onClick={() => download(r.resource_id, r.file_name)}><Download size={14} className="mr-1"/>Open</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
