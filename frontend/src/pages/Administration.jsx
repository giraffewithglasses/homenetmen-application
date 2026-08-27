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

const ROLES = ["national_admin", "chapter_admin", "chapter_leader", "scout"];

export default function Administration() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [logs, setLogs] = useState([]);

  const load = () => api.get("/users").then(r => setUsers(r.data));
  useEffect(() => {
    load();
    api.get("/chapters").then(r => setChapters(r.data));
    if (user?.role === "national_admin") api.get("/audit-logs").then(r => setLogs(r.data));
  }, []);

  const setRole = async (uid, role, chapter_id) => {
    try { await api.put(`/users/${uid}/role`, { role, chapter_id }); toast.success("Updated"); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label">Command Center</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Administration</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="rounded-full bg-muted p-1">
          <TabsTrigger value="users" className="rounded-full" data-testid="tab-users">Users</TabsTrigger>
          {user?.role === "national_admin" && <TabsTrigger value="audit" className="rounded-full" data-testid="tab-audit">Audit Log</TabsTrigger>}
        </TabsList>

        <TabsContent value="users">
          <Card className="clay-card p-0 overflow-hidden mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead>
                  <TableHead>Role</TableHead><TableHead>Chapter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, i) => (
                  <TableRow key={u.user_id} className={i % 2 ? "bg-muted/30" : ""}>
                    <TableCell className="font-semibold">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      {user?.role === "national_admin" ? (
                        <Select value={u.role} onValueChange={(v) => setRole(u.user_id, v, u.chapter_id)}>
                          <SelectTrigger className="w-44 h-8"><SelectValue/></SelectTrigger>
                          <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r.replace("_"," ")}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <Badge variant="outline" className="rounded-full">{u.role}</Badge>}
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
