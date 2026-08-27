import React from "react";

const colors = {
  "heart-pulse": "#E07A5F", "tent": "#2D6A4F", "mountain": "#52796F",
  "leaf": "#2D6A4F", "users": "#E07A5F", "compass": "#F4A261",
  "hand-heart": "#E07A5F", "message-circle": "#F4A261", "waves": "#52796F",
  "palette": "#F4A261", "landmark": "#2D6A4F", "flame": "#E07A5F",
  "anchor": "#52796F", "star": "#F4A261", "snowflake": "#52796F",
};

import {
  HeartPulse, Tent, Mountain, Leaf, Users, Compass, HandHeart,
  MessageCircle, Waves, Palette, Landmark, Flame, Anchor, Star, Snowflake, Award,
} from "lucide-react";

const map = {
  "heart-pulse": HeartPulse, "tent": Tent, "mountain": Mountain, "leaf": Leaf,
  "users": Users, "compass": Compass, "hand-heart": HandHeart,
  "message-circle": MessageCircle, "waves": Waves, "palette": Palette,
  "landmark": Landmark, "flame": Flame, "anchor": Anchor, "star": Star,
  "snowflake": Snowflake,
};

export default function BadgePatch({ badge, size = 72, awarded = false, progress = 0 }) {
  const Icon = map[badge.icon] || Award;
  const color = badge.color || colors[badge.icon] || "#2D6A4F";
  const scale = size / 72;
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="patch"
        style={{
          width: size, height: size,
          background: `radial-gradient(circle at 30% 30%, ${color} 0%, ${color} 55%, ${shade(color, -0.2)} 100%)`,
          filter: awarded ? "saturate(1)" : "saturate(0.4) opacity(0.75)",
          borderColor: shade(color, -0.25),
        }}
        data-testid={`badge-patch-${badge.badge_id}`}
      >
        <Icon size={26 * scale} color="white" strokeWidth={2.2} />
      </div>
      {progress > 0 && progress < 100 && (
        <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function shade(hex, p) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const t = p < 0 ? 0 : 255, pct = Math.abs(p);
  const nr = Math.round((t - r) * pct + r);
  const ng = Math.round((t - g) * pct + g);
  const nb = Math.round((t - b) * pct + b);
  return `#${[nr, ng, nb].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
