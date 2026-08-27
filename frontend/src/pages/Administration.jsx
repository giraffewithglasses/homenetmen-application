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
import { UserCheck, UserX, ShieldCheck, Archive, Trash2, ArchiveRestore } from "lucide-react";

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
      </Tabs>
    </div>
  );
}
