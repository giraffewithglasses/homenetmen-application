import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Camera, Save, X } from "lucide-react";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [picture, setPicture] = useState(user?.picture || "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  if (!user) return null;

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast.error("Image must be under 2 MB");
    const r = new FileReader();
    r.onload = () => setPicture(r.result);
    r.readAsDataURL(f);
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateProfile({ name, picture });
      toast.success("Profile updated");
      setEditing(false);
    } catch { toast.error("Failed to update"); }
    finally { setBusy(false); }
  };

  const cancel = () => {
    setName(user.name || ""); setPicture(user.picture || ""); setEditing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="uppercase-label">Your account</div>
        <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight mt-1">Profile</h1>
      </div>

      <Card className="clay-card p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="relative">
            {picture ? (
              <img src={picture} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-[hsl(12,65%,63%)]" data-testid="profile-picture"/>
            ) : (
              <div className="w-24 h-24 rounded-full bg-[hsl(12,65%,63%)]/20 text-[hsl(12,65%,63%)] flex items-center justify-center font-black text-4xl font-display border-4 border-[hsl(12,65%,63%)]/40">
                {user.name?.[0]}
              </div>
            )}
            {editing && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[hsl(149,40%,30%)] text-white flex items-center justify-center hover:bg-[hsl(149,45%,25%)] shadow"
                data-testid="profile-picture-btn"
              >
                <Camera size={16}/>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile}/>
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3 max-w-md">
                <div>
                  <Label>Full name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} data-testid="profile-name-input"/>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={user.email} disabled className="bg-muted/60"/>
                </div>
              </div>
            ) : (
              <>
                <h2 className="font-display text-3xl font-black">{user.name}</h2>
                <div className="text-muted-foreground">{user.email}</div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Badge className="rounded-full bg-[hsl(149,40%,30%)]">{user.role?.replace("_"," ")}</Badge>
                  {user.chapter_id && <Badge variant="outline" className="rounded-full">{user.chapter_id}</Badge>}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" className="btn-pill" onClick={cancel} data-testid="profile-cancel-btn"><X size={16} className="mr-1"/> Cancel</Button>
                <Button className="btn-pill bg-[hsl(149,40%,30%)] hover:bg-[hsl(149,45%,25%)]" onClick={save} disabled={busy} data-testid="profile-save-btn"><Save size={16} className="mr-1"/> {busy ? "Saving…" : "Save"}</Button>
              </>
            ) : (
              <Button className="btn-pill bg-[hsl(12,65%,63%)] hover:bg-[hsl(12,70%,55%)]" onClick={() => setEditing(true)} data-testid="profile-edit-btn">
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
