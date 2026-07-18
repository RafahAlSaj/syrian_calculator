const fs = require("fs");
const vm = require("vm");

const codePath = "d:/xampp/htdocs/syrian_calculator/www/assets/app.js";
let code = fs.readFileSync(codePath, "utf8");
code = code.replace(/\ninit\(\);\s*$/m, "\n");

const dummyNode = () => ({
  value: "",
  textContent: "",
  hidden: false,
  style: {},
  clientWidth: 320,
  selectionStart: 0,
  setSelectionRange() {},
  addEventListener() {},
  setAttribute() {},
  getAttribute() { return ""; },
  querySelector() { return dummyNode(); },
  querySelectorAll() { return []; },
  contains() { return false; },
  focus() {},
  select() {},
  classList: { add() {}, remove() {} }
});

const sandbox = {
  console,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: {},
  window: {
    getComputedStyle() {
      return { fontStyle: "normal", fontVariant: "normal", fontWeight: "900", fontFamily: "Segoe UI" };
    },
    addEventListener() {}
  },
  document: {
    getElementById() { return dummyNode(); },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement(tag) {
      if (tag === "canvas") {
        return { getContext() { return { font: "", measureText() { return { width: 0 }; } }; } };
      }
      return dummyNode();
    }
  },
  setTimeout,
  clearTimeout,
  Number,
  Math,
  String,
  RegExp
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const results = [];
const t = (name, cond) => results.push({ name, cond: !!cond });

t("toNumber 15000", sandbox.toNumber("15000") === 15000);
t("toNumber 15,000", sandbox.toNumber("15,000") === 15000);
t("toNumber 15.000 grouping", sandbox.toNumber("15.000") === 15000);
t("toNumber dot decimal", sandbox.toNumber("15.25") === 15.25);
t("toNumber arabic digits", sandbox.toNumber("١٥٠٠٠") === 15000);
t("toNumber 11 zeros", sandbox.toNumber("100000000000") === 100000000000);
t("toNumber clamp huge", sandbox.toNumber("999999999999999999999") <= Number.MAX_SAFE_INTEGER);
t("format grouping", sandbox.formatNumericStringWithGrouping("15000") === "15,000");
t("format decimal", sandbox.formatNumericStringWithGrouping("15000.125") === "15,000.125");
t("readNonNegative clean", sandbox.readNonNegativeNumber(" 15,000 ") === 15000);
t("DISPLAY_DECIMALS=4", code.includes("const DISPLAY_DECIMALS = 4;"));

const failed = results.filter((r) => !r.cond);
for (const r of results) console.log(`${r.cond ? "PASS" : "FAIL"} | ${r.name}`);
console.log(`TOTAL=${results.length} FAILED=${failed.length}`);
if (failed.length) process.exit(1);
