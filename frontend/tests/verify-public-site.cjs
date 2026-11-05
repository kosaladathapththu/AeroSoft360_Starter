const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const source = fs.readFileSync(
  path.join(__dirname, "../src/PublicSite.tsx"),
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
assert(
  home.includes("Many moving parts.") && home.includes("One clear picture."),
);
assert((home.match(/href="#login"/g) || []).length >= 3);
assert(home.includes('id="modules"') && home.includes('id="workflow"'));
assert(home.includes("Finance &amp; accounts") && home.includes("Inventory"));
assert(!/LKR|23120293|admin@|Admin@123/.test(home));
assert(login.includes('type="email"') && login.includes('type="password"'));
assert(
  login.toLowerCase().includes('autocomplete="username"') &&
    login.toLowerCase().includes('autocomplete="current-password"'),
);
assert(!login.includes('value="') && !login.includes("Admin@123"));
assert(
  login.includes("Back to home") &&
    login.includes("Contact your system administrator."),
);
assert(
  login.includes("Show password") && login.includes('aria-pressed="false"'),
);
console.log("10 public home/login rendering checks passed.");

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
