import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const load = () => api.get("/notifications").then(r => setItems(r.data));
  useEffect(() => { load(); }, []);
  const readOne = async (id) => { await api.post(`/notifications/${id}/read`); load(); };
  const readAll = async () => { await api.post("/notifications/read-all"); load(); toast.success("All caught up"); };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="uppercase-label">Inbox</div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Notifications</h1>
        </div>
        <Button variant="outline" className="btn-pill" onClick={readAll} data-testid="mark-all-read"><Check size={14} className="mr-2"/>Mark all read</Button>
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
            {!n.read && <Button size="sm" variant="ghost" onClick={() => readOne(n.notification_id)}>Mark read</Button>}
          </Card>
        ))}
        {!items.length && <div className="text-sm text-muted-foreground text-center py-12">No notifications yet.</div>}
      </div>
    </div>
  );
}
