"use client";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { useState } from "react";

/** The game's shared look: dark glass panels, lime accent, chunky buttons. */
export const btn = "rounded-xl px-4 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-lime-300 data-disabled:opacity-40";
export const ghost = `${btn} border border-white/15 text-white/85 hover:border-white/40`;
export const lime = `${btn} bg-lime-300 text-[#0d0e1a] hover:bg-lime-200`;
export const glass = "rounded-2xl border border-white/10 bg-[#0b0d1a]/78 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,.45)]";

export interface Cadet { name: string; avatar: string }

const AVATARS = [
  { id: "cadet-1", color: "#7ddc3e" }, { id: "cadet-2", color: "#38bdf8" }, { id: "cadet-3", color: "#ff8f70" },
  { id: "cadet-4", color: "#b79cff" }, { id: "cadet-5", color: "#f2c14e" }, { id: "cadet-6", color: "#ef6f8a" },
];

/** The one-card Cadet Sign-Up (name + colour). Creates the player and sets the cookie. */
export function CadetSignUp({ onDone, cta = "▶ Start (sound on)" }: { onDone: (p: Cadet) => void; cta?: string }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("cadet-1");
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/player", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, avatar }) });
    if (res.ok) onDone((await res.json()).player);
  };
  return (
    <form onSubmit={signUp} className={`${glass} absolute inset-0 z-30 m-auto flex h-fit w-[min(92%,420px)] flex-col gap-4 p-6`}>
      <p className="font-mono text-xs tracking-[0.3em] text-lime-300">CADET SIGN-UP</p>
      <Field name="name">
        <FieldLabel className="text-sm text-white/70">Your name</FieldLabel>
        <Input required maxLength={24} value={name} onValueChange={setName} autoComplete="given-name" className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-lg outline-none focus:border-lime-300" />
      </Field>
      <Field name="avatar">
        <FieldLabel className="text-sm text-white/70">Pick your colour</FieldLabel>
        <RadioGroup value={avatar} onValueChange={(v) => setAvatar(String(v))} className="mt-2 flex gap-3">
          {AVATARS.map((a) => (
            <label key={a.id} data-slot="label" className="cursor-pointer">
              <Radio value={a.id} aria-label={a.id} className="grid size-10 place-items-center rounded-full border-2 border-transparent outline-none data-checked:border-white focus-visible:ring-2 focus-visible:ring-lime-300" style={{ background: a.color }}>
                <RadioIndicator className="size-2.5 rounded-full bg-white" />
              </Radio>
            </label>
          ))}
        </RadioGroup>
      </Field>
      <Button type="submit" className={`${lime} py-3 text-base`} disabled={!name.trim()}>{cta}</Button>
    </form>
  );
}
