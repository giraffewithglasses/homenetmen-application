import React, { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, Image as ImageIcon, Trash2, X, Download, Camera } from "lucide-react";

export default function Galleries() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null); // gallery to view
  const [form, setForm] = useState({ title: "", description: "", cover: "", images: [] });
  const fileRef = useRef(null);

  const load = () => api.get("/galleries").then(r => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const canManage = user?.role && user.role !== "scout" && user.role !== "parent";
  const addFiles = (fs) => {
    Array.from(fs || []).forEach(f => {
      if (f.size > 2 * 1024 * 1024) return toast.error(`${f.name} > 2MB`);
      const r = new FileReader();
      r.onload = () => setForm(prev => ({...prev, images: [...prev.images, { data: r.result, caption: "" }], cover: prev.cover || r.result }));
      r.readAsDataURL(f);
    });
  };
  const save = async () => {
    if (!form.title) return toast.error("Title is required");
    try { await api.post("/galleries", form); toast.success("Gallery published"); setOpen(false); setForm({title:"",description:"",cover:"",images:[]}); load(); }
    catch { toast.error("Failed"); }
  };
  const remove = async (gid) => {
    if (!window.confirm("Delete this gallery?")) return;
    try { await api.delete(`/galleries/${gid}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="uppercase-label">Photo Album</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Galleries</h1>
          <p className="text-muted-foreground mt-1">Moments from chapters across the country.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-pill bg-[hsl(12,65%,63%)]" data-testid="new-gallery-btn"><Plus size={16} className="mr-2"/>New Gallery</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>New Gallery</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} data-testid="gal-title"/></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></div>
                <div>
                  <Label>Photos</Label>
                  <Input ref={fileRef} type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)} data-testid="gal-files"/>
                </div>
                {form.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {form.images.map((img, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-border">
                        <img src={img.data} alt="" className="w-full h-full object-cover"/>
                        <button type="button" onClick={() => setForm({...form, images: form.images.filter((_, j) => j !== i)})} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center">
                          <X size={12}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={save} className="btn-pill w-full bg-[hsl(149,40%,30%)]" data-testid="gal-save">Publish</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(g => (
          <Card key={g.gallery_id} className="clay-card overflow-hidden hover-lift group relative" data-testid={`gallery-${g.gallery_id}`}>
            <div className="h-56 bg-muted relative cursor-pointer overflow-hidden" onClick={() => setView(g)}>
              {g.cover
                ? <img src={g.cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = "none"; }}/>
                : (g.images?.[0]?.data
                    ? <img src={g.images[0].data} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = "none"; }}/>
                    : <div className="flex items-center justify-center h-full text-muted-foreground/40"><Camera size={56} strokeWidth={1.4}/></div>
                  )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"/>
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-[10px] font-bold uppercase tracking-widest text-[hsl(149,40%,30%)]">
                <ImageIcon size={11}/> {g.images?.length || 0}
              </div>
            </div>
            <div className="p-5">
              <div className="uppercase-label">{new Date(g.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
              <div className="font-display font-bold text-lg mt-1 line-clamp-1">{g.title}</div>
              {g.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</p>}
              <div className="mt-4 flex items-center gap-2">
                <Button size="sm" variant="outline" className="btn-pill flex-1" onClick={() => setView(g)} data-testid={`view-gallery-${g.gallery_id}`}>
                  View
                </Button>
                <Button
                  size="sm"
                  className="btn-pill flex-1 bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]"
                  onClick={async (e) => {
                    e.stopPropagation();
                    toast("Preparing your download…");
                    try {
                      const r = await api.get(`/galleries/${g.gallery_id}/download`, { responseType: "blob" });
                      const url = URL.createObjectURL(r.data);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${(g.title || "gallery").replace(/[^\w.-]+/g, "_")}.zip`;
                      document.body.appendChild(a); a.click(); a.remove();
                      URL.revokeObjectURL(url);
                    } catch { toast.error("Download failed"); }
                  }}
                  data-testid={`download-gallery-${g.gallery_id}`}
                >
                  <Download size={12} className="mr-1"/> ZIP
                </Button>
              </div>
            </div>
            {canManage && (
              <button onClick={(e) => { e.stopPropagation(); remove(g.gallery_id); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/95 text-muted-foreground hover:text-[hsl(0,65%,55%)] flex items-center justify-center opacity-0 group-hover:opacity-100" data-testid={`del-gallery-${g.gallery_id}`}>
                <Trash2 size={14}/>
              </button>
            )}
          </Card>
        ))}
        {!items.length && <div className="col-span-full text-center text-muted-foreground py-10">No galleries yet.</div>}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle className="font-display text-2xl">{view.title}</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">{view.description}</p>
              {canManage && (
                <div className="flex items-center gap-3 pt-3 border-b border-border pb-3">
                  <Label htmlFor="gal-add-more" className="text-xs uppercase tracking-widest font-bold cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(12,65%,63%)] text-white hover:bg-[hsl(12,70%,55%)]">
                    <Plus size={14}/> Add more photos
                  </Label>
                  <input
                    id="gal-add-more"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    data-testid="gal-add-more-input"
                    onChange={async (e) => {
                      const fs = Array.from(e.target.files || []);
                      if (!fs.length) return;
                      const imgs = [];
                      for (const f of fs) {
                        if (f.size > 2 * 1024 * 1024) { toast.error(`${f.name} > 2MB`); continue; }
                        // eslint-disable-next-line no-await-in-loop
                        const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
                        imgs.push({ data: dataUrl, caption: "" });
                      }
                      if (!imgs.length) return;
                      try {
                        const { data } = await api.post(`/galleries/${view.gallery_id}/images`, { images: imgs });
                        toast.success(`Added ${imgs.length} photo${imgs.length > 1 ? "s" : ""}`);
                        setView(data);
                        load();
                      } catch { toast.error("Upload failed"); }
                      e.target.value = "";
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{view.images?.length || 0} photos in this catalogue</span>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                {(view.images || []).map((img, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-border">
                    <a href={img.data} target="_blank" rel="noreferrer" className="block w-full h-full">
                      <img src={img.data} alt={img.caption || ""} className="w-full h-full object-cover hover:scale-105 transition-transform"/>
                    </a>
                    {canManage && (
                      <button
                        onClick={async () => {
                          if (!window.confirm("Delete this photo?")) return;
                          try {
                            await api.delete(`/galleries/${view.gallery_id}/images/${i}`);
                            const updated = { ...view, images: view.images.filter((_, j) => j !== i) };
                            setView(updated); load();
                          } catch { toast.error("Failed"); }
                        }}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                        data-testid={`del-gal-img-${i}`}
                      ><X size={12}/></button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
