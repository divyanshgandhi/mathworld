"use client";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Radio, RadioGroup } from "@ui-sdk/react/radio";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/kit/Button";
import { Icon } from "@/components/kit/Icon";
import { CADET, CADET_NAME, type CadetColor } from "@/design/tokens";
import { checkName, limitName, NAME_CUT, NAME_WORDS } from "./cadetName";

import { rememberCadet } from "./cadets";

export interface Cadet { name: string; avatar: string }

const COLOURS = Object.keys(CADET) as CadetColor[];
const FAILED = "That did not save. Check the connection and press Begin again.";

/**
 * Sign-up, in place: one question ("What should we call you, cadet?"), a name field, six colours and
 * Begin. It has no card of its own, so it can stand where the title's words stood (or inside a sheet).
 *
 * - The name is 1 to 16 letters, numbers and spaces (`cadetName.ts`). A long paste is cut to 16 and
 *   says so; a symbol or emoji is pointed out at once; an empty name is pointed out on Begin.
 * - Enter submits. A second press while the first is saving does nothing. A failed save keeps
 *   everything typed and says what to do.
 * - Escape and Back call `onBack` (when given).
 * - It creates the cadet (POST /api/player sets this device's cookie) and hands them to `onDone`.
 */
export function CadetSignUp({ onDone, onBack, cta = "Begin", className = "" }: {
  onDone: (p: Cadet) => void;
  onBack?: () => void;
  cta?: string;
  className?: string;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<CadetColor>("cadet-1");
  const [tried, setTried] = useState(false);
  const [cut, setCut] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const field = useRef<HTMLInputElement>(null);

  const { problem } = checkName(name);
  // symbols show at once (the child can see them); an empty field only after they press Begin
  const shown = problem === "symbols" || (problem === "empty" && tried) ? NAME_WORDS[problem] : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    setTried(true);
    const checked = checkName(name);
    if (checked.problem) { field.current?.focus(); return; }
    sending.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/player", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: checked.name, avatar }) });
      if (!res.ok) throw new Error(String(res.status));
      const made = (await res.json()).player;
      if (made?.id) rememberCadet({ id: made.id, name: made.name });
      onDone(made);
      // stay busy: the screen is about to leave, and a second Begin must not make a second cadet
    } catch {
      sending.current = false;
      setBusy(false);
      setFailed(true);
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => { if (e.key === "Escape" && onBack && !busy) { e.preventDefault(); onBack(); } }}
      noValidate
      aria-busy={busy}
      className={`flex flex-col ${className}`}
    >
      <Field name="name" invalid={shown ? true : undefined}>
        <FieldLabel className="block text-[clamp(24px,2.3vw,32px)] font-light leading-tight [font-stretch:112%]">What should we call you, cadet?</FieldLabel>
        <Input
          ref={field}
          autoFocus
          value={name}
          onValueChange={(v) => { const l = limitName(v); setName(l.value); setCut(l.cut); setFailed(false); if (!l.value) setTried(false); }}
          placeholder="Your name"
          autoComplete="nickname"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          readOnly={busy}
          className="mw-input mt-4 !min-h-[60px] max-w-[440px] text-[22px]"
        />
        {shown && <FieldError match className="mw-field-error"><Icon name="close" size={18} />{shown}</FieldError>}
        {!shown && cut && <p className="mw-field-error" role="status"><Icon name="check" size={18} className="!text-sky" />{NAME_CUT}</p>}
      </Field>

      <fieldset className="m-0 mt-7 border-0 p-0">
        <legend className="p-0 type-child text-ink-2">
          Pick a colour: <span className="text-ink-1">{CADET_NAME[avatar]}</span>
        </legend>
        <RadioGroup value={avatar} onValueChange={(v) => v && setAvatar(v as CadetColor)} loop disabled={busy} className="mt-3 flex flex-wrap gap-2 min-[400px]:gap-3.5" aria-label="Colour">
          {COLOURS.map((id) => (
            <Radio key={id} value={id} aria-label={CADET_NAME[id]} title={CADET_NAME[id]} className="mw-swatch" style={{ background: CADET[id] }} />
          ))}
        </RadioGroup>
      </fieldset>

      {failed && <p className="mw-field-error mt-5" role="alert"><Icon name="close" size={18} />{FAILED}</p>}

      <div className="mt-8 flex flex-col items-stretch gap-3 min-[480px]:flex-row min-[480px]:items-center">
        <Button type="submit" variant="primary" size="lg" disabled={busy} focusableWhenDisabled className="justify-between min-[480px]:justify-start">
          {cta.replace(/^[^\p{L}\p{N}]+/u, "") || "Begin"}
        </Button>
        {onBack && <Button type="button" variant="quiet" onClick={onBack} disabled={busy}>Back</Button>}
      </div>
    </form>
  );
}
