"use client";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@ui-sdk/react/password-input";
import { ghost, glass, lime } from "@/components/battle/ui";

/** The /admin passphrase form: a plain form post, so it works before hydration too. */
export function AdminLogin({ denied }: { denied: boolean }) {
  return (
    <form method="post" action="/api/admin/session" className={`${glass} m-auto flex w-[min(92vw,400px)] flex-col gap-4 p-6`}>
      <p className="type-label-sm text-ink-2">Math World · admin</p>
      <Field name="key">
        <FieldLabel className="type-name text-[16px] text-ink-2">Passphrase</FieldLabel>
        <PasswordInput name="key" required>
          <div className="mt-1 flex gap-2">
            <PasswordInputControl autoFocus className="mw-input min-w-0 flex-1 text-base" />
            <PasswordInputToggle aria-label="Show passphrase" className={`${ghost} px-3`}>{(s: { visible: boolean }) => (s.visible ? "Hide" : "Show")}</PasswordInputToggle>
          </div>
        </PasswordInput>
        <FieldDescription className="mt-1 text-xs text-ink-3">Set by MW_ADMIN_KEY on the server.</FieldDescription>
      </Field>
      {denied && <p role="alert" className="type-body-sm text-ember">That passphrase did not match.</p>}
      <Button type="submit" className={`${lime} py-3 text-base`}>Open the dashboard</Button>
    </form>
  );
}
