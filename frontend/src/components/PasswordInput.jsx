import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

/**
 * Password input with a show/hide toggle. Forwards all props to the underlying Input.
 * Use data-testid on the wrapping call — the button gets `${data-testid}-toggle`.
 */
export function PasswordInput({ "data-testid": testId, className = "", ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`relative ${className}`}>
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className="pr-10"
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(12,65%,63%)]"
        data-testid={testId ? `${testId}-toggle` : undefined}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
