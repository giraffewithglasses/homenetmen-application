import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { UserCheck, UserX, ShieldCheck, Archive, Trash2, ArchiveRestore, Globe, MapPin, Save, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ROLES = [
  "national_admin", "chapter_admin", "chapter_leader",
  "scout_leader", "cubs_leader", "patrol_leader", "patrol_co_leader",
  "parent", "scout",
];

const ROLE_LABEL = {
  scout: "Scout", parent: "Parent",
  patrol_co_leader: "Patrol Co-Leader", patrol_leader: "Patrol Leader",
  cubs_leader: "Cubs Leader", scout_leader: "Scout Leader",
  chapter_leader: "Chapter Leader", chapter_admin: "Chapter Admin",
  national_admin: "National Admin",
};

export default function Administration() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [logs, setLogs] = useState([]);
  const [includeScouts, setIncludeScouts] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadUsers = () => {
    const params = new URLSearchParams();
    if (includeScouts) params.set("include_scouts", "true");
    if (showArchived) params.set("status", "archived");
    api.get(`/users?${params}`).then(r => setUsers(r.data));
  };
  const loadPending = () => api.get("/users/pending").then(r => setPending(r.data));

  useEffect(() => {
    loadUsers();
    /* eslint-disable-next-line */
  }, [includeScouts, showArchived]);
  useEffect(() => {
    loadPending();
    api.get("/chapters").then(r => setChapters(r.data));
    if (user?.role === "national_admin") api.get("/audit-logs").then(r => setLogs(r.data));
  }, []);

  const setRole = async (uid, role, chapter_id) => {
    try { await api.put(`/users/${uid}/role`, { role, chapter_id }); toast.success("Updated"); loadUsers(); }
    catch { toast.error("Failed"); }
  };
  const approve = async (uid) => {
    try { await api.post(`/users/${uid}/approve`); toast.success("Approved"); loadPending(); loadUsers(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const reject = async (uid) => {
    try { await api.post(`/users/${uid}/reject`); toast.success("Rejected"); loadPending(); }
    catch { toast.error("Failed"); }
  };
  const archive = async (uid) => {
    if (!window.confirm("Archive this user? They won't be able to sign in.")) return;
    try { await api.post(`/users/${uid}/archive`); toast.success("Archived"); loadUsers(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };
  const unarchive = async (uid) => {
    try { await api.post(`/users/${uid}/unarchive`); toast.success("Restored"); loadUsers(); }
    catch { toast.error("Failed"); }
  };
  const purge = async (uid) => {
    if (!window.confirm("Permanently delete this user? This cannot be undone.")) return;
    try { await api.delete(`/users/${uid}`); toast.success("Deleted"); loadUsers(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label">Command Center</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Administration</h1>
      </div>

      <Tabs defaultValue={pending.length ? "pending" : "users"}>
        <TabsList className="rounded-full bg-muted p-1 flex-wrap h-auto">
          <TabsTrigger value="pending" className="rounded-full" data-testid="tab-pending">
            Pending Approvals {pending.length > 0 && <Badge className="ml-2 rounded-full bg-[hsl(12,65%,63%)]">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-full" data-testid="tab-users">Users</TabsTrigger>
          {user?.role === "national_admin" && <TabsTrigger value="audit" className="rounded-full" data-testid="tab-audit">Audit Log</TabsTrigger>}
          {user?.role === "national_admin" && <TabsTrigger value="homepage" className="rounded-full" data-testid="tab-homepage">Homepage</TabsTrigger>}
          {user?.role === "national_admin" && <TabsTrigger value="translations" className="rounded-full" data-testid="tab-translations">Translations</TabsTrigger>}
        </TabsList>

        <TabsContent value="pending">
          <Card className="clay-card p-0 overflow-hidden mt-4">
            {pending.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <ShieldCheck size={40} className="mx-auto mb-3 opacity-30"/>
                All caught up — no accounts awaiting approval.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Chapter</TableHead>
                    <TableHead>Requested role</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((u, i) => (
                    <TableRow key={u.user_id} className={i % 2 ? "bg-muted/30" : ""} data-testid={`pending-row-${u.user_id}`}>
                      <TableCell>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full ${u.signup_type === "leader" ? "bg-[hsl(12,65%,63%)]" : "bg-[hsl(149,40%,30%)]"}`}>
                          {u.signup_type === "leader" ? "Leader" : "Scout"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{chapters.find(c => c.chapter_id === u.chapter_id)?.name || u.chapter_id}</TableCell>
                      <TableCell><Badge variant="outline" className="rounded-full">{ROLE_LABEL[u.requested_role] || u.requested_role || "Scout"}</Badge></TableCell>
                      <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" className="btn-pill bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,45%,25%)] mr-1" onClick={() => approve(u.user_id)} data-testid={`approve-${u.user_id}`}>
                          <UserCheck size={14} className="mr-1"/> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="btn-pill text-[hsl(0,65%,55%)] border-[hsl(0,65%,55%)]/40 hover:bg-[hsl(0,65%,55%)]/10" onClick={() => reject(u.user_id)} data-testid={`reject-${u.user_id}`}>
                          <UserX size={14} className="mr-1"/> Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="flex items-center gap-6 mt-4 mb-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold cursor-pointer">
              <Switch checked={includeScouts} onCheckedChange={setIncludeScouts} data-testid="users-include-scouts"/>
              Include scouts
            </label>
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold cursor-pointer">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} data-testid="users-show-archived"/>
              Show archived
            </label>
            <span className="text-xs text-muted-foreground">Scouts live in the Members database — Administration shows leaders & admins by default.</span>
          </div>
          <Card className="clay-card p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead>
                  <TableHead>Role</TableHead><TableHead>Chapter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, i) => (
                  <TableRow key={u.user_id} className={i % 2 ? "bg-muted/30" : ""} data-testid={`user-row-${u.user_id}`}>
                    <TableCell className="font-semibold">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      {user?.role === "national_admin" ? (
                        <Select value={u.role} onValueChange={(v) => setRole(u.user_id, v, u.chapter_id)}>
                          <SelectTrigger className="w-52 h-8"><SelectValue/></SelectTrigger>
                          <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r] || r}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <Badge variant="outline" className="rounded-full">{ROLE_LABEL[u.role] || u.role}</Badge>}
                    </TableCell>
                    <TableCell>
                      {user?.role === "national_admin" ? (
                        <Select value={u.chapter_id || "none"} onValueChange={(v) => setRole(u.user_id, u.role, v === "none" ? null : v)}>
                          <SelectTrigger className="w-44 h-8"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— none —</SelectItem>
                            {chapters.map(c => <SelectItem key={c.chapter_id} value={c.chapter_id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : <span className="text-sm">{chapters.find(c => c.chapter_id === u.chapter_id)?.name || "—"}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "default" : "secondary"} className="rounded-full text-xs">
                        {u.status || "active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {u.status === "archived" ? (
                        <Button size="sm" variant="ghost" onClick={() => unarchive(u.user_id)} data-testid={`unarchive-${u.user_id}`}>
                          <ArchiveRestore size={14} className="mr-1"/> Restore
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => archive(u.user_id)} data-testid={`archive-user-${u.user_id}`}>
                          <Archive size={14}/>
                        </Button>
                      )}
                      {user?.role === "national_admin" && (
                        <Button size="sm" variant="ghost" onClick={() => purge(u.user_id)} className="text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" data-testid={`delete-user-${u.user_id}`}>
                          <Trash2 size={14}/>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {user?.role === "national_admin" && (
          <TabsContent value="audit">
            <Card className="clay-card p-0 overflow-hidden mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead><TableHead>User</TableHead>
                    <TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l, i) => (
                    <TableRow key={l.log_id} className={i % 2 ? "bg-muted/30" : ""}>
                      <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{l.user_email}</TableCell>
                      <TableCell><Badge variant="outline" className="rounded-full text-xs">{l.action}</Badge></TableCell>
                      <TableCell className="text-sm">{l.entity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs">{JSON.stringify(l.meta)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

        {user?.role === "national_admin" && (
          <TabsContent value="homepage">
            <HomepageSettings/>
          </TabsContent>
        )}

        {user?.role === "national_admin" && (
          <TabsContent value="translations">
            <TranslationsManager/>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function TranslationsManager() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [newEn, setNewEn] = useState("");
  const [newHy, setNewHy] = useState("");

  const load = () => api.get("/translations").then(r => { setItems(r.data); setDirty({}); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const setHy = (en, hy) => setDirty(prev => ({ ...prev, [en]: hy }));

  const saveAll = async () => {
    const entries = Object.entries(dirty).map(([en, hy]) => ({ en, hy }));
    if (!entries.length) return toast("Nothing to save");
    setSaving(true);
    try {
      await api.put("/translations", { entries });
      toast.success(`Saved ${entries.length} translation${entries.length === 1 ? "" : "s"}`);
      load();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const addNew = async () => {
    if (!newEn.trim()) return toast.error("Enter the English text first");
    try {
      await api.put("/translations", { entries: [{ en: newEn.trim(), hy: newHy.trim() }] });
      toast.success("Added");
      setNewEn(""); setNewHy(""); load();
    } catch { toast.error("Failed"); }
  };

  const remove = async (en) => {
    if (!window.confirm(`Delete translation for “${en}”?`)) return;
    try { await api.delete(`/translations?en=${encodeURIComponent(en)}`); toast.success("Deleted"); load(); }
    catch { toast.error("Failed"); }
  };

  const filtered = items.filter(it => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (it.en || "").toLowerCase().includes(s) || (it.hy || "").toLowerCase().includes(s);
  });

  const untranslated = filtered.filter(it => !it.hy).length;
  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="space-y-4 mt-4">
      <Card className="clay-card p-6" data-testid="translations-add-card">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-[hsl(12,65%,55%)]"/>
          <h3 className="font-display font-bold text-lg">Add or update a phrase</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>English (source key)</Label>
            <Input value={newEn} onChange={e => setNewEn(e.target.value)} placeholder="e.g. Prepared. Together. Outdoors." data-testid="tr-new-en"/>
          </div>
          <div>
            <Label>Armenian</Label>
            <Input value={newHy} onChange={e => setNewHy(e.target.value)} placeholder="օրինակ՝ Պատրաստ։ Միասին։ Բնության մեջ։" data-testid="tr-new-hy"/>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button onClick={addNew} className="btn-pill bg-[hsl(149,40%,30%)]" data-testid="tr-add-btn">
            <Save size={14} className="mr-2"/> Save phrase
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Any phrase saved here immediately overrides the built-in Armenian text on the homepage. Match the exact English wording (case + punctuation) so the site can find it.
        </p>
      </Card>

      <Card className="clay-card p-6" data-testid="translations-list-card">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div>
            <h3 className="font-display font-bold text-lg">Dictionary <span className="text-muted-foreground font-normal">({items.length})</span></h3>
            {untranslated > 0 && <div className="text-xs text-[hsl(0,65%,55%)] mt-1">{untranslated} phrase{untranslated === 1 ? "" : "s"} still empty in Armenian</div>}
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="w-64" data-testid="tr-search"/>
            <Button onClick={saveAll} disabled={!dirtyCount || saving} className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" data-testid="tr-save-all">
              <Save size={14} className="mr-2"/> {saving ? "Saving…" : dirtyCount ? `Save ${dirtyCount}` : "No changes"}
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">
            {items.length === 0 ? "No saved translations yet — add one above." : "No matches for that search."}
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map(it => {
              const value = it.en in dirty ? dirty[it.en] : (it.hy || "");
              return (
                <div key={it.en} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_40px] gap-2 items-center p-3 rounded-xl border border-border hover:bg-muted/30" data-testid={`tr-row-${it.en.slice(0,20)}`}>
                  <div className="text-sm font-medium truncate" title={it.en}>{it.en}</div>
                  <Input
                    value={value}
                    onChange={e => setHy(it.en, e.target.value)}
                    placeholder="Հայերեն"
                    className={value !== (it.hy || "") ? "border-[hsl(12,65%,63%)]" : ""}
                    data-testid={`tr-input-${it.en.slice(0,20)}`}
                  />
                  <button
                    onClick={() => remove(it.en)}
                    className="w-8 h-8 rounded-full text-muted-foreground hover:bg-[hsl(0,65%,55%)]/10 hover:text-[hsl(0,65%,55%)] flex items-center justify-center justify-self-end"
                    data-testid={`tr-del-${it.en.slice(0,20)}`}
                    title="Delete"
                  ><Trash2 size={14}/></button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function HomepageSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get("/public/homepage-settings").then(r => setSettings(r.data)).catch(() => {});
  }, []);

  if (!settings) return <Card className="clay-card p-6 mt-4">Loading…</Card>;

  const updateFooter = (k, v) => setSettings(s => ({ ...s, footer: { ...s.footer, [k]: v } }));
  const move = (idx, dir) => {
    const order = [...settings.section_order];
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    setSettings({ ...settings, section_order: order });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/homepage-settings", { footer: settings.footer, section_order: settings.section_order });
      toast.success("Homepage settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const LABELS = {
    chapters: "Chapters", events: "Upcoming events", badges: "Badges",
    newsletters: "Newsletters", leaders: "Leaders", galleries: "Galleries", resources: "Resources",
  };

  return (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      <Card className="clay-card p-6" data-testid="admin-footer-editor">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-[hsl(12,65%,55%)]"/>
          <h3 className="font-display font-bold text-lg">Footer & HQ info</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Description (English)</Label>
            <Textarea rows={3} value={settings.footer.description || ""} onChange={e => updateFooter("description", e.target.value)} data-testid="footer-desc-en"/>
          </div>
          <div>
            <Label>Description (Armenian)</Label>
            <Textarea rows={3} value={settings.footer.description_hy || ""} onChange={e => updateFooter("description_hy", e.target.value)} data-testid="footer-desc-hy"/>
          </div>
          <div>
            <Label>HQ address</Label>
            <Textarea rows={2} value={settings.footer.hq_address || ""} onChange={e => updateFooter("hq_address", e.target.value)} data-testid="footer-address"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input value={settings.footer.hq_email || ""} onChange={e => updateFooter("hq_email", e.target.value)} data-testid="footer-email"/>
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={settings.footer.hq_phone || ""} onChange={e => updateFooter("hq_phone", e.target.value)} data-testid="footer-phone"/>
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1"><MapPin size={12}/> Map pin (latitude, longitude)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" step="any" value={settings.footer.latitude ?? ""} onChange={e => updateFooter("latitude", parseFloat(e.target.value))} data-testid="footer-lat"/>
              <Input type="number" step="any" value={settings.footer.longitude ?? ""} onChange={e => updateFooter("longitude", parseFloat(e.target.value))} data-testid="footer-lng"/>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Yervand Kochar 17/6, Yerevan ≈ 40.1893, 44.5175</p>
          </div>
        </div>
      </Card>

      <Card className="clay-card p-6" data-testid="admin-section-order">
        <div className="flex items-center gap-2 mb-4">
          <GripVertical size={16} className="text-[hsl(12,65%,55%)]"/>
          <h3 className="font-display font-bold text-lg">Homepage section order</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Reorder how sections appear to guests. Top = first.</p>
        <div className="space-y-2">
          {settings.section_order.map((k, i) => (
            <div key={k} className="flex items-center gap-3 p-3 rounded-xl border border-border" data-testid={`section-row-${k}`}>
              <GripVertical size={14} className="text-muted-foreground"/>
              <div className="flex-1 font-semibold text-sm">{LABELS[k] || k}</div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} className="h-7 w-7 p-0" data-testid={`section-up-${k}`}>↑</Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === settings.section_order.length - 1} className="h-7 w-7 p-0" data-testid={`section-down-${k}`}>↓</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="md:col-span-2 flex justify-end">
        <Button onClick={save} disabled={saving} className="btn-pill bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,40%,25%)]" data-testid="save-homepage-settings">
          <Save size={14} className="mr-2"/> {saving ? "Saving…" : "Save homepage settings"}
        </Button>
      </div>
    </div>
  );
}
