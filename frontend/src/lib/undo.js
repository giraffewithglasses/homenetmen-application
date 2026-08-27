import { toast } from "sonner";

/**
 * confirmWithUndo({ message, doDelete, restore })
 * Optimistically removes the item (caller does that in state), shows an Undo toast
 * for 5s. If not undone, actually calls doDelete(). If undone, calls restore().
 */
export function confirmWithUndo({ message = "Deleted", doDelete, restore, duration = 5000 } = {}) {
  let undone = false;
  const timer = setTimeout(async () => {
    if (undone) return;
    try { await doDelete?.(); } catch (e) { toast.error("Delete failed — restored"); restore?.(); }
  }, duration);

  toast(message, {
    duration,
    action: {
      label: "Undo",
      onClick: () => { undone = true; clearTimeout(timer); restore?.(); toast.success("Restored"); },
    },
  });
}
