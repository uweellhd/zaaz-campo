// Compartilha somente consultas equivalentes; nunca amplia o escopo de acesso.
export function criarConsultasCompartilhadas(subscribe, equals) {
  const entries = new Set();
  return {
    ouvir(ref, receive, fail) {
      let entry = [...entries].find(e => equals(e.ref, ref));
      const client = { receive, fail };
      if (entry) {
        entry.clients.add(client);
        if (entry.hasSnapshot) receive(entry.snapshot);
      } else {
        entry = { ref, clients: new Set([client]), hasSnapshot: false, stop: null };
        entries.add(entry);
        entry.stop = subscribe(ref, snapshot => {
          entry.snapshot = snapshot; entry.hasSnapshot = true;
          for (const c of [...entry.clients]) c.receive(snapshot);
        }, error => {
          entries.delete(entry);
          for (const c of [...entry.clients]) c.fail?.(error);
          entry.clients.clear(); entry.snapshot = undefined;
        });
      }
      let closed = false;
      return () => {
        if (closed) return;
        closed = true; entry.clients.delete(client);
        if (!entry.clients.size) { entry.stop?.(); entry.snapshot = undefined; entries.delete(entry); }
      };
    },
    fechar() { for (const e of entries) { e.stop?.(); e.clients.clear(); e.snapshot = undefined; } entries.clear(); }
  };
}
