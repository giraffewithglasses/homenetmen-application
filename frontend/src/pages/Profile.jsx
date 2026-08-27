import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label">Your account</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Profile</h1>
      </div>
      <Card className="clay-card p-8">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-black text-4xl font-display">{user.name?.[0]}</div>
          <div>
            <h2 className="font-display text-3xl font-black">{user.name}</h2>
            <div className="text-muted-foreground">{user.email}</div>
            <div className="mt-2 flex gap-2">
              <Badge className="rounded-full bg-[hsl(149,40%,30%)]">{user.role?.replace("_"," ")}</Badge>
              {user.chapter_id && <Badge variant="outline" className="rounded-full">{user.chapter_id}</Badge>}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
