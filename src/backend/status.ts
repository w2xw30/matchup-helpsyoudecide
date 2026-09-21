import { create } from "zustand";

/** Boot progress of the online backend (sign-in + first data load). */
export const useBackend = create<{ phase: "booting" | "ready" | "error"; error: string; retry: number; recovery: boolean }>(() => ({
  phase: "booting",
  error: "",
  retry: 0,
  recovery: false,
}));
