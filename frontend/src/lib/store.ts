import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserOut } from "./types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserOut | null;
  /** Set after a successful login/register. */
  setSession: (accessToken: string, refreshToken: string, user: UserOut) => void;
  /** Replace only the tokens (refresh rotation). */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Replace the cached profile (after PATCH /users/me). */
  setUser: (user: UserOut) => void;
  /** Clear everything (logout or auth failure). */
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: "lifeforge-auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
