import { useEffect } from "react";
import type { Lobby } from "../data/mock";
import { useStore } from "../store/useStore";

/**
 * Prototype behaviour: pending invites are "accepted" a few seconds after they're sent so the
 * whole invite → join → ready → vote flow can be exercised alone. When there is a backend,
 * delete this hook — acceptance will arrive from the server instead.
 */
export function useSimulatedJoins(lobby: Lobby | undefined) {
  const accept = useStore((s) => s.acceptInvite);
  const toast = useStore((s) => s.toast);
  const id = lobby?.id;
  const invites = lobby?.invites;
  useEffect(() => {
    if (!id || !invites?.length) return;
    const timers = invites.map((inv) =>
      setTimeout(() => {
        const name = accept(id, inv.id);
        if (name) toast(`${name} joined the lobby`);
      }, Math.max(600, 4500 - (Date.now() - inv.sentAt))),
    );
    return () => timers.forEach(clearTimeout);
  }, [id, invites, accept, toast]);
}
