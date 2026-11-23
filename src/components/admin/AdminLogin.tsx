"use client";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
import { ghost, glass, lime } from "@/components/battle/ui";

/** The /admin passphrase form: a plain form post, so it works before hydration too. */
export function AdminLogin({ denied }: { denied: boolean }) {
  return (
    <form method="post" action="/api/admin/session" className={`${glass} m-auto flex w-[min(92vw,400px)] flex-col gap-4 p-6`}>
      <p className="font-mono text-xs tracking-[0.3em] text-lime-300">MATH WORLD · ADMIN</p>
      <Field name="key">
        <FieldLabel className="text-sm text-white/70">Passphrase</FieldLabel>
        <PasswordInput name="key" required>
          <div className="mt-1 flex gap-2">
            <PasswordInputControl autoFocus className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base outline-none focus:border-lime-300" />
            <PasswordInputToggle aria-label="Show passphrase" className={`${ghost} px-3`}>{(s: { visible: boolean }) => (s.visible ? "Hide" : "Show")}</PasswordInputToggle>
          </div>
        </PasswordInput>
        <FieldDescription className="mt-1 text-xs text-white/45">Set by MW_ADMIN_KEY on the server.</FieldDescription>
      </Field>
      {denied && <p role="alert" className="text-sm text-[#ffb3a0]">That passphrase did not match.</p>}
      <Button type="submit" className={`${lime} py-3 text-base`}>Open the dashboard</Button>
    </form>
  );
}
