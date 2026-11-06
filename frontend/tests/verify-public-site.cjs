const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const source = fs.readFileSync(
  path.join(__dirname, "../src/CompanyPortal.tsx"),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const mod = {};
vm.runInNewContext(code, {
  exports: mod,
  require: (name) => (name.endsWith(".css") ? {} : require(name)),
});
const home = renderToStaticMarkup(React.createElement(mod.HomePage));
const login = renderToStaticMarkup(
  React.createElement(mod.SignInPage, { api: "/api", onLogin() {} }),
);
assert(home.includes("One group. Many possibilities.") && home.includes("Choose your workspace"));
assert(home.includes('id="companies"'));
assert.equal(mod.portalCompanies.length,4);
assert.equal(mod.portalCompanies.filter(company=>company.available).length,1);
for(const company of mod.portalCompanies){
  assert(home.includes('href="#login/'+company.id+'"'));
  assert(home.includes('/brands/'+company.logo+'.png'));
  assert(home.includes(company.name));
  assert.equal(mod.portalRoute('#login/'+company.id).company.id,company.id);
  if(!company.available){
    const upcoming=renderToStaticMarkup(React.createElement(mod.UpcomingPage,{company}));
    assert(upcoming.includes('Hosting is upcoming'));
    assert(upcoming.includes(company.name));
    assert(!upcoming.includes('<form')&&!upcoming.includes('<input'),'Upcoming pages never collect credentials');
    assert(upcoming.includes('href="#companies"'));
    const guarded=renderToStaticMarkup(React.createElement(mod.SignInPage,{api:'/api',onLogin(){},company}));
    assert(guarded.includes('Hosting is upcoming')&&!guarded.includes('<form'));
  }
}
assert.equal(mod.portalRoute('#login').company.id,'ymac','Legacy login link still reaches Y-mac');
assert.equal(mod.portalRoute('#login/not-a-company').view,'home');
assert.equal(mod.portalRoute('#companies').view,'home');
assert(!/LKR|23120293|admin@|Admin@123/.test(home));
assert(login.includes('type="email"')&&login.includes('type="password"'));
assert(login.toLowerCase().includes('autocomplete="username"')&&login.toLowerCase().includes('autocomplete="current-password"'));
assert(!login.includes('value="')&&!login.includes('Admin@123'));
assert(login.includes('Back to home')&&login.includes('Contact your system administrator.'));
assert(login.includes('Show password')&&login.includes('aria-pressed="false"'));
assert(login.includes('Y-mac')&&login.includes('AeroSoft360'));
console.log('Public portal checks passed: four company routes, branded pages, upcoming guards, and Y-mac login.');

// Exercise the real submit handler with isolated hooks and HTTP fixtures.
async function checkLogin(status, result, expected) {
  const fixture = {};
  let loggedIn = false,
    lastError = "",
    request;
  let hook = 0;
  vm.runInNewContext(code, {
    exports: fixture,
    FormData: class {
      get(key) {
        return key === "email" ? "user@example.test" : "test-password";
      }
    },
    fetch: async (url, options) => {
      request = { url, options };
      return { ok: status === 200, json: async () => result };
    },
    window: {
      history: { replaceState() {} },
      location: { pathname: "/", search: "" },
    },
    require: (name) =>
      name.endsWith(".css")
        ? {}
        : name === "react"
          ? {
              ...React,
              useState: (initial) => {
                const index = hook++;
                return [
                  initial,
                  (value) => {
                    if (index === 1) lastError = value;
                  },
                ];
              },
            }
          : require(name),
  });
  const tree = fixture.SignInPage({
    api: "/api",
    onLogin() {
      loggedIn = true;
    },
  });
  function findForm(node) {
    if (!node || typeof node !== "object") return null;
    if (node.type === "form") return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = findForm(child);
      if (found) return found;
    }
    return null;
  }
  await findForm(tree).props.onSubmit({
    preventDefault() {},
    currentTarget: {},
  });
  assert.equal(loggedIn, expected);
  assert.equal(request.url, "/api/auth/login");
  assert.equal(request.options.headers.Accept, "application/json");
  if (!expected) assert(lastError);
}
(async () => {
  await checkLogin(
    200,
    { token: "fixture", user: { id: 1 }, permissions: [] },
    true,
  );
  await checkLogin(422, { message: "Credentials invalid" }, false);
  await checkLogin(200, { message: "Malformed response" }, false);
  console.log("3 login submission checks passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
