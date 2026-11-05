import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  BarChart3,
  Boxes,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import "./public-site.css";

const modules = [
  {
    icon: ShoppingBag,
    tone: "coral",
    label: "Sales & customers",
    text: "From a customer order to an invoice, payment and a lasting customer relationship.",
  },
  {
    icon: PackageCheck,
    tone: "green",
    label: "Purchasing",
    text: "Keep purchase orders, goods received, supplier invoices and payments connected.",
  },
  {
    icon: Boxes,
    tone: "gold",
    label: "Inventory",
    text: "Know your articles, sizes and colours. Follow stock movements and individual returns.",
  },
  {
    icon: Wallet,
    tone: "lilac",
    label: "Finance & accounts",
    text: "Bring receivables, vouchers, account ledgers and cash flow into one workspace.",
  },
  {
    icon: Users,
    tone: "rose",
    label: "People & access",
    text: "Work with salesperson profiles, payroll and the right permissions for every role.",
  },
  {
    icon: BarChart3,
    tone: "mint",
    label: "Reports & insights",
    text: "Find the details you need with search, filters and printable business reports.",
  },
];

export function PublicBrand() {
  return (
    <a className="public-brand" href="#home" aria-label="AeroSoft360 home">
      <span className="public-brand-mark">
        <Layers3 size={25} />
      </span>
      <span>
        AeroSoft<span className="public-brand-number">360</span>
        <small>ONE CONNECTED WORKSPACE</small>
      </span>
    </a>
  );
}

export function HomePage() {
  return (
    <div className="public-site">
      <header className="public-nav">
        <PublicBrand />
        <nav aria-label="Public navigation">
          <a href="#modules">Explore the system</a>
          <a href="#workflow">How it connects</a>
          <a className="public-button public-button-small" href="#login">
            Sign in <ArrowUpRight size={17} />
          </a>
        </nav>
      </header>
      <main id="home">
        <section className="public-hero">
          <div className="public-hero-copy">
            <div className="public-eyebrow">
              <span /> BUILT FOR YOUR BUSINESS, EVERY DAY
            </div>
            <h1>
              Many moving parts.
              <br />
              <em>One clear picture.</em>
            </h1>
            <p>
              Orders, inventory, people and finances. Bring your daily work
              together with AeroSoft360, the connected business workspace for
              Supun AeroSoft.
            </p>
            <div className="public-hero-actions">
              <a className="public-button" href="#login">
                Enter your workspace <ArrowRight size={19} />
              </a>
              <a className="public-text-link" href="#modules">
                Take a look around <ChevronRight size={17} />
              </a>
            </div>
            <div className="public-hero-points">
              <span>
                <Check size={15} /> Connected records
              </span>
              <span>
                <Check size={15} /> Clear workflows
              </span>
              <span>
                <Check size={15} /> Access by role
              </span>
            </div>
          </div>
          <div
            className="public-visual"
            aria-label="Illustration of connected business modules"
          >
            <div className="public-visual-orbit orbit-one" />
            <div className="public-visual-orbit orbit-two" />
            <div className="public-float public-float-top">
              <span className="public-icon coral">
                <ReceiptText />
              </span>
              <div>
                <b>From order to invoice</b>
                <small>Every detail stays connected</small>
              </div>
              <Check size={17} />
            </div>
            <div className="public-workspace-preview">
              <div className="public-preview-top">
                <div>
                  <i />
                  <i />
                  <i />
                </div>
                <span>YOUR BUSINESS, IN FOCUS</span>
                <Layers3 size={16} />
              </div>
              <div className="public-preview-body">
                <div className="public-preview-welcome">
                  <span>THE DAILY PICTURE</span>
                  <h2>
                    A little more clarity.
                    <br />A lot more possibility.
                  </h2>
                </div>
                <div className="public-preview-tiles">
                  <div>
                    <ShoppingBag />
                    <b>Sales</b>
                    <small>Customers & orders</small>
                  </div>
                  <div>
                    <Boxes />
                    <b>Stock</b>
                    <small>Articles & sizes</small>
                  </div>
                  <div>
                    <Wallet />
                    <b>Finance</b>
                    <small>Accounts & cash flow</small>
                  </div>
                </div>
                <div className="public-preview-flow">
                  <span className="public-check">
                    <Check size={15} />
                  </span>
                  <div>
                    <b>One connected workflow</b>
                    <small>
                      Order <ChevronRight size={10} /> Invoice{" "}
                      <ChevronRight size={10} /> Payment
                    </small>
                  </div>
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </div>
            <div className="public-float public-float-bottom">
              <span className="public-icon lilac">
                <ShieldCheck />
              </span>
              <div>
                <b>The right access.</b>
                <small>For the right people.</small>
              </div>
            </div>
            <div className="public-visual-spark">
              <Sparkles size={25} />
            </div>
          </div>
        </section>
        <section className="public-ribbon" aria-label="Workspace capabilities">
          <span>LESS RE-ENTRY.</span>
          <span>MORE VISIBILITY.</span>
          <span>BETTER DAILY FLOW.</span>
          <span className="public-ribbon-end">
            <Layers3 size={18} /> All together, AeroSoft360.
          </span>
        </section>
        <section className="public-modules" id="modules">
          <div className="public-section-heading">
            <div>
              <span className="public-eyebrow">EVERYTHING HAS ITS PLACE</span>
              <h2>
                Room for every part
                <br />
                of your business.
              </h2>
            </div>
            <p>
              Practical tools for your team.
              <br />
              Connected information for your next decision.
            </p>
          </div>
          <div className="public-module-grid">
            {modules.map(({ icon: Icon, tone, label, text }, index) => (
              <article className={`public-module ${tone}`} key={label}>
                <div>
                  <span className={`public-icon ${tone}`}>
                    <Icon size={23} />
                  </span>
                  <span className="public-module-number">0{index + 1}</span>
                </div>
                <h3>{label}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="public-workflow" id="workflow">
          <div>
            <span className="public-eyebrow">WORK THAT MOVES TOGETHER</span>
            <h2>
              A clear path.
              <br />
              From the first order
              <br />
              to the final payment.
            </h2>
            <p>
              Follow the sales process step by step, with the customer and item
              details continuing through the workflow.
            </p>
            <a href="#login" className="public-text-link">
              Ready when you are <ArrowRight size={18} />
            </a>
          </div>
          <ol>
            {[
              {
                title: "Create the order",
                text: "Choose the customer, articles, sizes and agreed rates.",
              },
              {
                title: "Dispatch & invoice",
                text: "Record what is supplied and issue the customer invoice.",
              },
              {
                title: "Collect & reconcile",
                text: "Apply payments, track outstanding balances and review the ledger.",
              },
            ].map((step, index) => (
              <li key={step.title}>
                <span>{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="public-cta">
          <div>
            <span>YOUR NEXT WORKDAY, A LITTLE MORE CONNECTED.</span>
            <h2>Let’s get to work.</h2>
          </div>
          <a href="#login" className="public-button public-button-light">
            Sign in to AeroSoft360 <ArrowUpRight size={20} />
          </a>
        </section>
      </main>
      <footer className="public-footer">
        <PublicBrand />
        <span>
          Supun AeroSoft (Pvt) Ltd.
          <br />
          <small>Finance, inventory & business operations.</small>
        </span>
        <a href="#login">
          Workspace login <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}

export function SignInPage({
  api,
  onLogin,
}: {
  api: string;
  onLogin: (result: any) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${api}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: fields.get("email"),
          password: fields.get("password"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          result.message ||
            "Unable to sign in. Check your details and try again.",
        );
      if (!result.token || !result.user || !Array.isArray(result.permissions))
        throw new Error(
          "The server returned an incomplete sign-in response. Please try again.",
        );
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      onLogin(result);
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Unable to reach the server. Check your connection and try again."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="public-site public-sign-in">
      <header className="public-nav">
        <PublicBrand />
        <a href="#home" className="public-text-link">
          <ArrowLeft size={17} /> Back to home
        </a>
      </header>
      <main className="public-login-layout">
        <section className="public-login-story">
          <span className="public-eyebrow">YOUR WORKSPACE IS WAITING</span>
          <h1>
            Welcome back.
            <br />
            <em>Make today flow.</em>
          </h1>
          <p>
            One place for your team, your records and the work that matters.
          </p>
          <div className="public-login-mosaic">
            <div>
              <ShoppingBag />
              <span>Sales</span>
            </div>
            <div>
              <Boxes />
              <span>Inventory</span>
            </div>
            <div>
              <Wallet />
              <span>Finance</span>
            </div>
            <div>
              <Users />
              <span>People</span>
            </div>
          </div>
          <span className="public-login-company">
            SUPUN AEROSOFT (PVT) LTD.
          </span>
        </section>
        <section className="public-login-panel">
          <div className="public-login-symbol">
            <LockKeyhole size={25} />
          </div>
          <span className="public-eyebrow">AEROSOFT360 ACCOUNT</span>
          <h2>Sign in to your workspace</h2>
          <p>Enter the details assigned by your administrator.</p>
          <form onSubmit={submit} aria-label="Workspace sign in">
            {error && (
              <div className="public-login-error" role="alert">
                {error}
              </div>
            )}
            <fieldset disabled={busy}>
              <label htmlFor="public-login-email">
                Email address
                <input
                  id="public-login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  required
                  maxLength={160}
                />
              </label>
              <label htmlFor="public-login-password">
                Password
                <span className="public-password-field">
                  <input
                    id="public-login-password"
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    maxLength={128}
                  />
                  <button
                    type="button"
                    onClick={() => setVisible(!visible)}
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                  >
                    {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </span>
              </label>
              <button
                className="public-button public-login-submit"
                type="submit"
              >
                {busy ? (
                  <>
                    <Loader2 size={19} className="public-spinner" /> Signing
                    in...
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight size={19} />
                  </>
                )}
              </button>
            </fieldset>
          </form>
          <p className="public-login-help">
            Need an account or a password reset?
            <br />
            <b>Contact your system administrator.</b>
          </p>
          <div className="public-login-security">
            <ShieldCheck size={16} /> Access is controlled by your assigned
            role.
          </div>
        </section>
      </main>
      <footer className="public-login-footer">
        AeroSoft360 / Business, better connected.
      </footer>
    </div>
  );
}

export default function PublicSite({
  api,
  onLogin,
}: {
  api: string;
  onLogin: (result: any) => void;
}) {
  const [login, setLogin] = useState(() => window.location.hash === "#login");
  useEffect(() => {
    const update = () => {
      setLogin(window.location.hash === "#login");
      if (window.location.hash === "#login" || window.location.hash === "#home")
        window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.title = login
      ? "Sign in | AeroSoft360"
      : "AeroSoft360 | Business, better connected";
    return () => {
      document.title = "AeroSoft360 ERP";
    };
  }, [login]);
  return login ? <SignInPage api={api} onLogin={onLogin} /> : <HomePage />;
}
