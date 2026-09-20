"use client";

import { create } from "zustand";

interface PaletteState {
  open: boolean;
  filter: string;
  setOpen: (open: boolean) => void;
  setFilter: (filter: string) => void;
}

export const useCommandPalette = create<PaletteState>((set) => ({
  open: false,
  filter: "",
  setOpen: (open) => set({ open }),
  setFilter: (filter) => set({ filter }),
}));
