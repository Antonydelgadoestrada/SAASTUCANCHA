// hooks/useSyncSessionToStore.ts
import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useUserStore } from "@/stores/userStore"
// import { useUserStore } from "@/stores/useStore"

export const useSyncSessionToStore = () => {
  const { data: session } = useSession()
  const setUser = useUserStore((state) => state.setUser)
  useEffect(() => {
    if (session?.user) {
      setUser({
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: session.user.role,
        clubId: session.user.clubId,
        accessToken: session.accessToken,
      })
    }
  }, [session, setUser])
}
