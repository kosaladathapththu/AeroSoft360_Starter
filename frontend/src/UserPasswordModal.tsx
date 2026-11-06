import { FormEvent, useState } from "react";
import { X } from "lucide-react";

export default function UserPasswordModal({ user, save, close }: { user: any; save: (body: any) => Promise<void>; close: () => void }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (fields.password !== fields.password_confirmation) { setError("Passwords do not match."); return; }
    setBusy(true); setError("");
    try { await save(fields); close(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="backdrop"><form className="modal" role="dialog" aria-modal="true" aria-labelledby="user-password-title" onSubmit={submit}>
    <div className="popup-header"><button className="close" type="button" disabled={busy} onClick={close} aria-label="Close"><X /></button><span>ACCESS CONTROL / LOGIN PASSWORD</span><h2 id="user-password-title">Set a new password</h2><p>{user.name} / {user.email}</p></div>
    <div className="popup-body">
      {error && <div className="error" role="alert">{error}</div>}
      <p>Set the password this user will use to sign in. Existing passwords cannot be displayed.</p>
      <fieldset disabled={busy} style={{border: 0, padding: 0, minWidth: 0}}>
        <label>New password<input name="password" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required /><small>At least 8 characters.</small></label>
        <label>Confirm new password<input name="password_confirmation" type={show ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required /></label>
        <label className="access-check"><input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} /> Show the new password</label>
        <label>Reason<input name="reason" required maxLength={500} placeholder="e.g. User requested a password reset" /></label>
      </fieldset>
      <p>Other active sessions for this user will be signed out. Their assigned role and access stay unchanged.</p>
    </div>
    <div className="popup-footer"><div className="actions"><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Updating..." : "Update password"}</button></div></div>
  </form></div>;
}
