import { create } from "zustand";

interface UI {
  logoutOpen: boolean;
  setLogoutOpen: (v: boolean) => void;
}

export const useUI = create<UI>((set) => ({
  logoutOpen: false,
  setLogoutOpen: (logoutOpen) => set({ logoutOpen }),
}));
