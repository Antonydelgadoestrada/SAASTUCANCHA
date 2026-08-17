import { create } from 'zustand'

type User = {
  name: string
  email: string
  role?: string
  clubId?: string
  accessToken?: string
}

type UserState = {
  user: User | null
  setUser: (user: User) => void
  clearUser: () => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,

  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}))
