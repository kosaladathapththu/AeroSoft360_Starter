import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, Building2, Users, Plus, Pencil, Trash2 } from 'lucide-react';
import './commission-categories.css';

type Props = { token: string; permissions: string[] };
const api = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api/v1' : `${location.protocol}//${location.hostname}:8000/api/v1`);
const money = (value: unknown) => `LKR ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CommissionCategoriesPage({ token, permissions }: Props) {
  const [category, setCategory] = useState('');
  const [data, setData] = useState<any>(null);
  const [configured, setConfigured] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState(false);
  const [entry, setEntry] = useState<any>(null);
  const [removing, setRemoving] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = permissions.includes('accounting.manage');
  const admin = permissions.includes('admin.manage');

  async function request(path: string, body?: any, method = 'GET') {
    const response = await fetch(`${api}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 403 && category === 'head_office') { setUnlocked(false); setData(null); }
      throw new Error(Object.values(result.errors || {}).flat().join(' ') || result.message || 'Unable to complete the request.');
    }
    return result;
  }
  async function load(selected = category) {
    const result = await request(`commission-categories?category=${selected}`);
    setData(result);
  }
  useEffect(() => {
    if (!category) return;
    let active = true;
    setData(null); setError(''); setEntry(null); setRemoving(null); setSettings(false);
    (async () => {
      if (category === 'head_office') {
        const status = await request('commission-categories/status');
        if (!active) return;
        setConfigured(status.configured); setUnlocked(status.unlocked);
        if (!status.unlocked) return;
      }
      const result = await request(`commission-categories?category=${category}`);
      if (active) setData(result);
    })().catch(e => active && setError(e.message));
    return () => { active = false; };
  }, [category, token]);
  useEffect(() => {
    if (category !== 'head_office' || !unlocked) return;
    const timer = window.setTimeout(() => { setUnlocked(false); setData(null); setEntry(null); setSettings(false); }, 15 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [category, unlocked]);

  async function submit(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function back() {
    await submit(async () => { if (category === 'head_office') await request('commission-categories/lock', {}, 'POST'); setCategory(''); setData(null); setUnlocked(false); setEntry(null); });
  }
  const rows = data ? [
    ...data.manual.map((r: any) => ({ ...r, kind: 'manual', date: r.commission_date, pieces: r.basis_amount, document: `Manual ${r.id}` })),
    ...data.automatic.map((r: any) => ({ ...r, kind: 'automatic', date: r.receipt_date, pieces: r.commission_pieces, status: r.commission_status, document: r.invoice_number })),
  ].filter((r: any) => `${r.rep_name} ${r.document} ${r.date} ${r.status}`.toLowerCase().includes(search.toLowerCase())) : [];

  return <section className="commission-workspace">
    <div className="heading"><div><h1>{category ? category === 'head_office' ? 'Head Office commissions' : 'Direct / AeroSoft commissions' : 'Commissions'}</h1><p>Separate commission registers and rates.</p></div>
      {category && <button onClick={back} disabled={busy}><ArrowLeft size={16} /> Categories {category === 'head_office' && '& lock'}</button>}
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="success">{notice}</p>}
    {!category ? <div className="commission-category-cards">
      <button onClick={() => setCategory('direct')}><Users /><strong>Direct / AeroSoft</strong><span>Existing representative rates and collections</span></button>
      <button onClick={() => setCategory('head_office')}><Building2 /><strong>Head Office</strong><span><LockKeyhole size={15} /> Password protected · separate rate</span></button>
    </div> : <>
      {category === 'head_office' && !unlocked && !settings && <form className="commission-panel commission-unlock" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const form = e.currentTarget; submit(async () => { await request('commission-categories/unlock', { password: f.get('password') }, 'POST'); form.reset(); setUnlocked(true); await load(); }); }}>
        <LockKeyhole /><h2>{configured ? 'Unlock Head Office' : 'Head Office setup required'}</h2>
        {configured ? <><label>Head Office password<input type="password" name="password" required autoComplete="current-password" /></label><button className="primary" disabled={busy}>Unlock commissions</button></> : <p>An administrator must set the password and rate before this register can be opened.</p>}
        {admin && <button type="button" onClick={() => setSettings(true)}>Set password & rates</button>}
      </form>}
      {category === 'head_office' && settings && admin && <form className="commission-panel" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); submit(async () => { await request('commission-categories/settings', Object.fromEntries(f), 'PUT'); setSettings(false); setConfigured(true); setUnlocked(true); await load(); setNotice('Settings saved. Existing posted commissions retain their original rates.'); }); }}>
        <h2>Head Office password & rate</h2><div className="commission-form-grid">
          {configured && <label>Current Head Office password<input name="current_password" type="password" required autoComplete="current-password" /></label>}
          <label>New password {configured && '(optional)'}<input name="password" type="password" minLength={12} required={!configured} autoComplete="new-password" /></label>
          <label>Confirm new password<input name="password_confirmation" type="password" minLength={12} required={!configured} autoComplete="new-password" /></label>
          <label>Rate per piece (LKR)<input name="rate_per_piece" type="number" min="0" max="999999" step="0.01" required defaultValue={data?.rate_per_piece ?? 0} /></label>
          <label>Maximum collection days<input name="max_collection_days" type="number" min="1" max="365" required defaultValue={data?.max_collection_days ?? 100} /></label>
        </div><p>Applies to new Head Office collections and manual entries. Assign Head Office representatives in Salespersons.</p>
        <div className="actions"><button type="button" onClick={() => setSettings(false)}>Cancel</button><button className="primary" disabled={busy}>Save settings</button></div>
      </form>}
      {data && (category !== 'head_office' || unlocked) && !settings && <>
        <div className="commission-toolbar"><input aria-label="Search commissions" placeholder="Search representative, document, date or status" value={search} onChange={e => setSearch(e.target.value)} />
          <span>{rows.length} entries · {category === 'head_office' ? `${money(data.rate_per_piece)} / piece` : 'Rates from Salespersons'} · {data.max_collection_days} days</span>
          {admin && category === 'head_office' && <button onClick={() => setSettings(true)}>Password & rates</button>}
          {canManage && <button className="primary" onClick={() => {setEntry({}); setRemoving(null);}}><Plus size={16} /> Manual commission</button>}
        </div>
        {entry && <form className="commission-panel" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); submit(async () => { await request(entry.id ? `commissions/manual/${entry.id}` : 'commissions/manual', { ...Object.fromEntries(f), basis_amount: Number(f.get('basis_amount')), commission_rate: Number(f.get('commission_rate') || data.rate_per_piece || 0) }, entry.id ? 'PUT' : 'POST'); setEntry(null); await load(); setNotice('Commission saved and linked to its accounting journal.'); }); }}>
          <h2>{entry.id ? 'Edit' : 'New'} manual commission</h2><div className="commission-form-grid">
            <label>Representative<select name="sales_rep_id" required defaultValue={entry.sales_rep_id || ''}><option value="">Choose representative</option>{data.reps.map((r: any) => <option value={r.id} key={r.id}>{r.name}</option>)}</select></label>
            <label>Date<input name="commission_date" type="date" required defaultValue={entry.commission_date || new Date().toLocaleDateString('en-CA')} /></label>
            <label>Basis quantity / pieces<input name="basis_amount" type="number" min="0.0001" step="0.0001" required defaultValue={entry.basis_amount || ''} /></label>
            <label>Rate / piece (LKR)<input name="commission_rate" type="number" min="0" step="0.01" required readOnly={category === 'head_office'} defaultValue={category === 'head_office' ? data.rate_per_piece : entry.commission_rate || ''} /></label>
            <label>Notes<input name="notes" maxLength={255} defaultValue={entry.notes || ''} /></label>
            {entry.id && <label>Reason for edit<input name="reason" required minLength={3} maxLength={255} /></label>}
          </div><div className="actions"><button type="button" onClick={() => setEntry(null)}>Cancel</button><button className="primary" disabled={busy || !data.reps.length}>Save commission</button></div>
          {!data.reps.length && <p>Add a representative with the matching channel in Salespersons first.</p>}
        </form>}
        {removing && <form className="commission-panel" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); submit(async () => { await request(`commissions/manual/${removing.id}`, { reason: f.get('reason') }, 'DELETE'); setRemoving(null); await load(); setNotice('Manual commission removed.'); }); }}><h2>Remove manual commission for {removing.rep_name}</h2><label>Reason<input name="reason" required minLength={3} maxLength={255} /></label><div className="actions"><button type="button" onClick={() => setRemoving(null)}>Cancel</button><button className="danger-action" disabled={busy}>Confirm removal</button></div></form>}
        <div className="commission-panel"><table><thead><tr><th>Date / document</th><th>Representative</th><th>Pieces</th><th>Rate / piece</th><th>Commission</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {rows.map((r: any) => <tr key={`${r.kind}-${r.id}`}><td>{r.date}<small>{r.document}</small></td><td>{r.rep_name || 'Not assigned'}</td><td>{Number(r.pieces || 0).toLocaleString()}</td><td>{money(r.commission_rate)}</td><td><b>{money(r.commission_amount)}</b></td><td>{String(r.status || '').replace(/_/g, ' ')}</td><td>{canManage && r.kind === 'manual' ? <div className="actions"><button aria-label="Edit commission" onClick={() => setEntry(r)}><Pencil size={16} /></button><button aria-label="Remove commission" onClick={() => setRemoving(r)}><Trash2 size={16} /></button></div> : <small>From collection</small>}</td></tr>)}
          {!rows.length && <tr><td colSpan={7}>No commissions in this category.</td></tr>}
        </tbody></table></div>
      </>}
    </>}
  </section>;
}
