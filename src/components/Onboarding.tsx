import { useState } from "react";

import { InfoModal } from "./InfoModal";
import { generateKeyPair } from "@/lib/keys";
import { clearOnboardingGrid, loadOrRollGrid } from "@/lib/onboarding-grid";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function Onboarding() {
  const { patch, addEmojisToCollection } = useStore();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // Rendered only after the local store has loaded (client side), so storage is available.
  const [grid] = useState(() => loadOrRollGrid());

  const cleanUser = username.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nameOk = name.trim().length >= 1 && name.trim().length <= 20;
  const userOk = cleanUser.length >= 4 && cleanUser.length <= 16;
  const canGo = nameOk && userOk && picked.length === 3 && !busy;

  const toggle = (emoji: string) => {
    setPicked((p) =>
      p.includes(emoji) ? p.filter((e) => e !== emoji) : p.length < 3 ? [...p, emoji] : p,
    );
  };

  const create = async () => {
    setBusy(true);
    try {
      const keys = await generateKeyPair();
      patch({
        identity: {
          name: name.trim(),
          username: cleanUser,
          emojis: picked,
          keys,
          createdAt: Date.now(),
        },
      });
      addEmojisToCollection(picked);
      // Profile and identity exist: the frozen grid is no longer needed.
      clearOnboardingGrid();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell safe-top safe-bottom flex min-h-screen flex-col justify-center gap-5 py-10">
      <div className="text-center">
        <img
          src="/logo.png"
          alt="Logo QuestionAR"
          width={88}
          height={88}
          className="mx-auto mb-3 size-[88px] rounded-lg object-contain"
        />
        <h1 className="text-2xl">QuestionAR</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Compatibilità tra profili, tutto salvato solo sul tuo dispositivo.
        </p>
      </div>

      <div className="section-card space-y-3">
        <label className="block">
          <span className="text-[12px] text-muted-foreground">Nome (1-20 caratteri)</span>
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
            placeholder="Come ti chiami"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-muted-foreground">
            Username (4-16 lettere o numeri)
          </span>
          <input
            value={username}
            maxLength={16}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-[14px] outline-none ring-1 ring-input focus:ring-accent"
            placeholder="username"
          />
          {username !== cleanUser && (
            <span className="text-[12px] text-muted-foreground">Diventerà: {cleanUser || "—"}</span>
          )}
        </label>
      </div>

      <div className="section-card">
        <p className="text-center text-[12px] text-muted-foreground">
          Scegli 3 emoji: verranno associate al tuo username e saranno le prime ad entrare nella tua
          collezione.
        </p>
        <div className="mx-auto mt-3 grid w-fit grid-cols-3 gap-2">
          {grid.map((e) => {
            const active = picked.includes(e);
            return (
              <button
                key={e}
                onClick={() => toggle(e)}
                className={`grid size-16 place-items-center rounded-2xl text-3xl transition-transform ${
                  active ? "bg-accent/20 ring-2 ring-accent" : "bg-background"
                }`}
              >
                {e}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[14px]">
          Handle:{" "}
          <span className="font-bold text-accent">
            @{cleanUser}
            {picked.join("")}
          </span>
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => setInfoOpen(true)}
          className="h-auto rounded-2xl px-5 py-3"
        >
          Info
        </Button>
        <Button
          disabled={!canGo}
          onClick={create}
          className="h-auto flex-1 rounded-2xl px-4 py-3 disabled:opacity-40"
        >
          Crea il profilo
        </Button>
      </div>

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
