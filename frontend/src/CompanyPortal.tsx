import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Boxes, Building2, Check, ChevronRight, Clock3, Eye, EyeOff, Layers3, Loader2, LockKeyhole, Rocket, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";
import "./portal-tailwind.css";
import "./company-portal.css";

export type PortalCompany = {
  id: string; name: string; legalName: string; subtitle: string; logo: string;
  tone: string; available: boolean; description: string;
};
export const portalCompanies: PortalCompany[] = [
  { id: "ymac", name: "Y-mac", legalName: "Supun AeroSoft (Pvt) Ltd.", subtitle: "AeroSoft360 ERP", logo: "ymac-smart", tone: "ymac", available: true, description: "Sales, stock and finance. Your daily operations, connected." },
  { id: "supun-traders", name: "Supun Traders", legalName: "Supun Traders", subtitle: "Trading ERP", logo: "supun-traders", tone: "traders", available: false, description: "A dedicated workspace for the Supun Traders team." },
  { id: "fuji-industries", name: "Fuji Industries", legalName: "Fuji Industries (Pvt) Ltd.", subtitle: "Industry ERP", logo: "fuji-industries", tone: "fuji", available: false, description: "A dedicated workspace for the Fuji Industries team." },
  { id: "camy-smart", name: "Camy Smart", legalName: "Camy Smart", subtitle: "Business ERP", logo: "camy-smart", tone: "camy", available: false, description: "A dedicated workspace for the Camy Smart team." },
];

export function portalRoute(hash: string): { view: "home" | "company"; company: PortalCompany } {
  const id = hash === "#login" ? "ymac" : /^#login\/([a-z-]+)$/.exec(hash)?.[1];
  const company = portalCompanies.find((item) => item.id === id);
  return { view: company ? "company" : "home", company: company || portalCompanies[0] };
}

export function PublicBrand() {
  return <a className="portal-brand tw:inline-flex tw:items-center tw:gap-3" href="#home" aria-label="Supun Group portal home">
    <span className="portal-brand-symbol"><Layers3 size={24} strokeWidth={1.6} /></span>
    <span><b>SUPUN<span>GROUP</span></b><small>BUSINESS WORKSPACE</small></span>
  </a>;
}

function CompanyLogo({ company, large = false }: { company: PortalCompany; large?: boolean }) {
  return <div className={`portal-logo-surface logo-${company.tone} ${large ? "logo-large" : ""}`}>
    <img src={`/brands/${company.logo}.png`} alt={`${company.name} logo`} width="240" height="120" decoding="async" />
  </div>;
}

function StatusBadge({ available }: { available: boolean }) {
  return <span className={`portal-status ${available ? "is-live" : "is-upcoming"}`}>
    {available ? <span className="portal-live-dot" /> : <Clock3 size={12} />}
    {available ? "Available now" : "Coming soon"}
  </span>;
}

export function HomePage() {
  return <div className="group-portal portal-home">
    <header className="portal-nav tw:mx-auto tw:flex tw:w-full tw:max-w-7xl tw:items-center tw:justify-between tw:gap-4 tw:px-6 tw:py-6 tw:md:px-10">
      <PublicBrand />
      <nav className="tw:flex tw:items-center tw:gap-6" aria-label="Public navigation">
        <a className="portal-nav-link tw:hidden tw:sm:inline-flex" href="#companies">Our workspaces</a>
        <a className="portal-nav-login" href="#login/ymac">Y-mac sign in <ArrowUpRight size={16} /></a>
      </nav>
    </header>
    <main>
      <section className="portal-hero tw:relative tw:mx-auto tw:max-w-4xl tw:px-6 tw:pt-10 tw:pb-12 tw:text-center tw:md:pt-16 tw:md:pb-14">
        <div className="portal-eyebrow tw:inline-flex tw:items-center tw:gap-2"><span /> THE SUPUN GROUP PORTAL</div>
        <h1 className="tw:mt-5 tw:mb-5 tw:text-4xl tw:font-semibold tw:tracking-tight tw:sm:text-5xl tw:md:text-6xl">One group. Many possibilities.<br /><em>Your workspace starts here.</em></h1>
        <p className="tw:mx-auto tw:max-w-xl tw:text-base tw:leading-7">A place for every business in our group. Choose your company below to access its own ERP workspace.</p>
        <div className="portal-hero-meta tw:mt-6 tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-x-5 tw:gap-y-2">
          <span><span className="portal-live-dot" />1 workspace live</span><span className="portal-meta-divider" /><span><Clock3 size={14} />3 more on the way</span>
        </div>
      </section>
      <section id="companies" className="portal-companies tw:mx-auto tw:max-w-7xl tw:px-6 tw:pb-12 tw:md:px-10" aria-labelledby="companies-title">
        <div className="tw:mb-6 tw:flex tw:flex-wrap tw:items-end tw:justify-between tw:gap-3">
          <div><span className="portal-section-kicker">OUR COMPANIES</span><h2 id="companies-title" className="tw:mt-2 tw:mb-0 tw:text-2xl tw:font-semibold tw:tracking-tight">Choose your workspace</h2></div>
          <p className="portal-section-note tw:m-0 tw:text-sm">Your company. Your team. Your access.</p>
        </div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
          {portalCompanies.map((company, index) => <a className={`portal-company-card company-${company.tone}`} href={`#login/${company.id}`} key={company.id} aria-label={company.available ? `Sign in to ${company.name} AeroSoft360` : `${company.name} — hosting is upcoming`}>
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-2"><StatusBadge available={company.available} /><span className="portal-card-number">0{index + 1}</span></div>
            <CompanyLogo company={company} />
            <div className="portal-card-copy"><h3>{company.name}</h3><span className="portal-card-subtitle">{company.subtitle}</span><p>{company.description}</p></div>
            <div className="portal-card-action">{company.available ? "Sign in to workspace" : "View upcoming workspace"}<ArrowRight size={17} /></div>
          </a>)}
        </div>
      </section>
      <section className="portal-access-strip tw:mx-6 tw:mb-12 tw:max-w-6xl tw:rounded-2xl tw:px-6 tw:py-6 tw:md:mx-auto" aria-label="How to access your workspace">
        <div className="tw:flex tw:items-center tw:gap-3"><ShieldCheck size={24} /><div><b>One portal. Separate workspaces.</b><p>Use the account assigned to your company by your administrator.</p></div></div>
        <a href="#login/ymac">Open Y-mac <ChevronRight size={16} /></a>
      </section>
    </main>
    <PortalFooter />
  </div>;
}

function PortalFooter() {
  return <footer className="portal-footer tw:mx-auto tw:flex tw:max-w-7xl tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:px-6 tw:py-6 tw:md:px-10">
    <span>© {new Date().getFullYear()} Supun Group of Companies</span><span>Independent businesses. A connected future.</span>
  </footer>;
}

function CompanyLayout({ company, children }: { company: PortalCompany; children: React.ReactNode }) {
  return <div className={`group-portal portal-company-page company-${company.tone}`}>
    <header className="portal-nav tw:mx-auto tw:flex tw:w-full tw:max-w-7xl tw:items-center tw:justify-between tw:gap-4 tw:px-6 tw:py-6 tw:md:px-10">
      <PublicBrand /><a href="#companies" className="portal-back-link"><ArrowLeft size={16} />All workspaces</a>
    </header>
    <main className="portal-login-layout tw:mx-auto tw:grid tw:w-full tw:max-w-6xl tw:grid-cols-1 tw:gap-0 tw:px-6 tw:pb-12 tw:pt-4 tw:lg:grid-cols-2 tw:lg:px-0 tw:lg:pt-7">
      <section className="portal-company-story tw:relative tw:overflow-hidden tw:rounded-t-3xl tw:p-8 tw:sm:p-12 tw:lg:rounded-l-3xl tw:lg:rounded-tr-none">
        <div className="portal-story-top tw:relative tw:z-10"><CompanyLogo company={company} large /><span className="portal-story-label">{company.subtitle}</span></div>
        <div className="portal-story-copy tw:relative tw:z-10">
          <h1>{company.available ? <>Your workday,<br /><em>well connected.</em></> : <>A new workspace.<br /><em>A fresh beginning.</em></>}</h1>
          <p>{company.available ? "Everything your team needs to keep business moving, together in AeroSoft360." : `A dedicated ERP experience for ${company.name}. Part of the next chapter of our group portal.`}</p>
          {company.available && <div className="portal-story-features"><span><ShoppingBag size={16} />Sales</span><span><Boxes size={16} />Inventory</span><span><Wallet size={16} />Finance</span></div>}
        </div>
        <div className="portal-story-bottom tw:relative tw:z-10"><Building2 size={16} />{company.legalName}</div>
        <div className="portal-story-ring ring-one" aria-hidden="true" /><div className="portal-story-ring ring-two" aria-hidden="true" />
      </section>
      <section className="portal-auth-panel tw:flex tw:flex-col tw:justify-center tw:rounded-b-3xl tw:p-7 tw:sm:p-12 tw:lg:rounded-r-3xl tw:lg:rounded-bl-none">{children}</section>
    </main>
    <PortalFooter />
  </div>;
}

export function UpcomingPage({ company }: { company: PortalCompany }) {
  return <CompanyLayout company={company}>
    <div className="portal-upcoming-symbol"><Rocket size={28} strokeWidth={1.5} /></div>
    <span className="portal-section-kicker">{company.name.toUpperCase()} WORKSPACE</span>
    <h2 className="portal-auth-title">Hosting is upcoming</h2>
    <p className="portal-auth-intro">The {company.name} ERP workspace is being prepared. Sign-in will be available here once hosting is ready.</p>
    <div className="portal-upcoming-note"><Clock3 size={19} /><div><b>Something good is on the way.</b><p>No sign-in details are needed yet. Your administrator will share access when the workspace is available.</p></div></div>
    <a className="portal-primary-button tw:mt-7" href="#companies"><ArrowLeft size={17} />Choose another company</a>
    <a className="portal-secondary-link tw:mt-4" href="#login/ymac">Y-mac is available now <ArrowUpRight size={15} /></a>
  </CompanyLayout>;
}

export function SignInPage({ api, onLogin, company = portalCompanies[0] }: { api: string; onLogin: (result: any) => void; company?: PortalCompany }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !company.available || company.id !== "ymac") return;
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: fields.get("email"), password: fields.get("password") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Unable to sign in. Check your details and try again.");
      if (!result.token || !result.user || !Array.isArray(result.permissions)) throw new Error("The server returned an incomplete sign-in response. Please try again.");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      onLogin(result);
    } catch (e) {
      setError(e instanceof TypeError ? "Unable to reach the server. Check your connection and try again." : (e as Error).message);
    } finally { setBusy(false); }
  }
  if (!company.available) return <UpcomingPage company={company} />;
  return <CompanyLayout company={company}>
    <div className="tw:mb-6 tw:flex tw:items-center tw:justify-between tw:gap-3"><span className="portal-auth-icon"><LockKeyhole size={22} /></span><StatusBadge available /></div>
    <span className="portal-section-kicker">Y-MAC / AEROSOFT360</span>
    <h2 className="portal-auth-title">Good to see you again.</h2>
    <p className="portal-auth-intro">Sign in to your Y-mac workspace with your AeroSoft360 account.</p>
    <form onSubmit={submit} aria-label="Y-mac workspace sign in" className="portal-login-form tw:mt-6">
      {error && <div className="portal-login-error" role="alert">{error}</div>}
      <fieldset disabled={busy} className="tw:m-0 tw:grid tw:gap-5 tw:border-0 tw:p-0">
        <label htmlFor="portal-login-email">Email address<input id="portal-login-email" name="email" type="email" autoComplete="username" placeholder="you@company.com" required maxLength={160} /></label>
        <label htmlFor="portal-login-password">Password<span className="portal-password-field">
          <input id="portal-login-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required maxLength={128} />
          <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </span></label>
        <button className="portal-primary-button tw:mt-1" type="submit">{busy ? <><Loader2 size={18} className="portal-spinner" />Signing in…</> : <>Sign in to Y-mac <ArrowRight size={18} /></>}</button>
      </fieldset>
    </form>
    <p className="portal-login-help tw:mt-6">Need an account or a password reset?<br /><b>Contact your system administrator.</b></p>
    <div className="portal-login-security tw:mt-6"><ShieldCheck size={16} />Access is controlled by your assigned role.</div>
    <a href="#home" className="portal-secondary-link tw:mt-5"><ArrowLeft size={14} />Back to home</a>
  </CompanyLayout>;
}

export default function PublicSite({ api, onLogin }: { api: string; onLogin: (result: any) => void }) {
  const [route, setRoute] = useState(() => portalRoute(window.location.hash));
  useEffect(() => {
    const update = () => { setRoute(portalRoute(window.location.hash)); if (window.location.hash.startsWith("#login") || window.location.hash === "#home") window.scrollTo(0, 0); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.title = route.view === "home" ? "Supun Group | Business workspaces" : `${route.company.available ? "Sign in" : "Hosting is upcoming"} | ${route.company.name}`;
    return () => { document.title = "AeroSoft360 ERP"; };
  }, [route.view, route.company.id]);
  return route.view === "home" ? <HomePage /> : route.company.available ? <SignInPage key={route.company.id} api={api} onLogin={onLogin} company={route.company} /> : <UpcomingPage key={route.company.id} company={route.company} />;
}
