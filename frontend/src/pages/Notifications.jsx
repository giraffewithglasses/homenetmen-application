import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/notifications").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);
  const readOne = async (id) => { await api.post(`/notifications/${id}/read`); load(); };
  const readAll = async () => { await api.post("/notifications/read-all"); load(); toast.success("All caught up"); };
  const remove = async (id) => { await api.delete(`/notifications/${id}`); load(); };
  const clearAll = async () => {
    if (!window.confirm("Clear all notifications?")) return;
    await api.delete("/notifications"); load(); toast.success("Cleared");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <div className="uppercase-label">Inbox</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Notifications</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="btn-pill" onClick={readAll} data-testid="mark-all-read"><Check size={14} className="mr-2"/>Mark all read</Button>
          <Button variant="outline" className="btn-pill text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" onClick={clearAll} data-testid="clear-all-notifs"><Trash2 size={14} className="mr-2"/>Clear all</Button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map(n => (
          <Card key={n.notification_id} className={`clay-card p-4 flex items-start gap-3 ${n.read ? "opacity-70" : ""}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${n.read ? "bg-muted text-muted-foreground" : "bg-[hsl(12,65%,63%)] text-white"}`}>
              <Bell size={16}/>
            </div>
            <div className="flex-1">
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm text-muted-foreground">{n.message}</div>
              <div className="uppercase-label mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
            <div className="flex gap-1">
              {!n.read && <Button size="sm" variant="ghost" onClick={() => readOne(n.notification_id)} data-testid={`read-${n.notification_id}`}>Mark read</Button>}
              <Button size="sm" variant="ghost" onClick={() => remove(n.notification_id)} className="text-[hsl(0,65%,55%)] hover:bg-[hsl(0,65%,55%)]/10" data-testid={`del-notif-${n.notification_id}`}><Trash2 size={14}/></Button>
            </div>
          </Card>
        ))}
        {!items.length && <div className="text-sm text-muted-foreground text-center py-12">No notifications yet.</div>}
      </div>
    </div>
  );
}
