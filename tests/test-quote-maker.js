// node tests/test-quote-maker.js
var q = require("../docs/guides/quote-maker.js");
var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function has(arr, re) { return arr.some(function (s) { return re.test(s); }); }

// price line parsing
var p = q.priceLine("Labour, 2 days | 640"); ok(p.desc === "Labour, 2 days" && p.amount === 640, "pipe " + JSON.stringify(p));
p = q.priceLine("Materials £1,385.50"); ok(p.desc === "Materials" && p.amount === 1385.5, "pound comma " + JSON.stringify(p));
p = q.priceLine("Boiler 24kW: 1850"); ok(p.desc === "Boiler 24kW" && p.amount === 1850, "colon " + JSON.stringify(p));
p = q.priceLine("Skip hire"); ok(isNaN(p.amount), "no amount");
p = q.priceLine("450"); ok(isNaN(p.amount), "amount only, no description");

var base = {
  business: "Hale Plumbing & Heating", contact: "07700 900123", customerName: "Sam Patel", address: "12 Elm Road",
  number: "Q-0042", date: "2026-10-27", kind: "quote", customer: "homeowner", where: "home", trade: "plumbing",
  summary: "Replace two bedroom radiators", scope: "Drain down and refill the heating system, add inhibitor\nSupply and fit two 600 x 1000 mm double panel radiators in both bedrooms\nFit new thermostatic radiator valves to both",
  exclusions: ["System flush or powerflush"], prices: "Labour, 1 day | 320\nRadiators and valves | 286.40",
  vat: "none", depositPct: "", payDays: "7"
};
function clone(o, x) { var r = JSON.parse(JSON.stringify(o)); for (var k in x) r[k] = x[k]; return r; }

var r = q.build(base);
ok(!r.error, "base no error");
ok(r.total === 606.4, "total " + r.total);
ok(r.vat === 0, "no vat");
ok(r.until === "26 November 2026", "valid 30 days " + r.until);
ok(/QUOTE  No\. Q-0042/.test(r.text), "header");
ok(/TOTAL\s+£606\.40/.test(r.text), "total line");
ok(/not VAT registered/.test(r.text), "no-vat line");
ok(r.cancel === "home", "cancel home");
ok(/Your right to cancel/.test(r.text), "cancel section");
ok(has(r.info, /14 days to cancel/), "cancel info");
ok(r.warn.length === 0, "clean base, warns: " + r.warn.join(" | "));
ok(/Hi Sam,/.test(r.cover) && /£606\.40/.test(r.cover) && /26 November 2026/.test(r.cover), "cover " + r.cover);
ok(/Full amount: due within 7 days/.test(r.text), "pay terms");

// VAT add
r = q.build(clone(base, { vat: "add", vatNo: "GB123456789" }));
ok(r.vat === 121.28 && r.total === 727.68, "vat add " + r.vat + " " + r.total);
ok(/VAT at 20%\s+£121\.28/.test(r.text), "vat row");
ok(has(r.info, /zero-rated/), "ESM note for plumbing");
r = q.build(clone(base, { vat: "add" }));
ok(has(r.warn, /VAT number/), "vat without number");
r = q.build(clone(base, { vat: "none", vatNo: "GB1" }));
ok(has(r.warn, /not VAT registered/), "number but none");
r = q.build(clone(base, { vat: "incl" }));
ok(r.total === 606.4 && /include VAT/.test(r.text), "vat incl");
r = q.build(clone(base, { vat: "add", vatNo: "GB1", trade: "decorating" }));
ok(!has(r.info, /zero-rated/), "no ESM note for decorating");

// deposit
r = q.build(clone(base, { depositPct: "30", depositFor: "the radiators" }));
ok(r.deposit === 181.92, "deposit " + r.deposit);
ok(/Deposit: £181\.92 \(30%\), for the radiators/.test(r.text), "deposit line");
ok(/Balance: due within 7 days/.test(r.text), "balance line");
ok(has(r.info, /30% deposit/) && !has(r.warn, /deposit/), "30% info only");
r = q.build(clone(base, { depositPct: "60" }));
ok(has(r.warn, /60% deposit/), "60% warn");
r = q.build(clone(base, { depositPct: "60", customer: "business" }));
ok(!has(r.warn, /deposit/), "business deposit no warn");
r = q.build(clone(base, { depositPct: "150" }));
ok(r.error && /0 to 100/.test(r.error), "deposit >100");

// vague scope
r = q.build(clone(base, { scope: "Replace radiators etc\nFix pipes as required\nSort out leak\nVarious bits\nMake good\nFit valves TBC" }));
["etc", "as required", "sort out", "various", "make good", "TBC"].forEach(function (w) { ok(has(r.warn, new RegExp(w, "i")), "vague " + w); });
ok(has(r.warn, /very short/), "short line");
r = q.build(clone(base, { scope: "Make good walls to a ready-to-paint finish around new pipework" }));
ok(!has(r.warn, /make good/), "make good with finish ok");
ok(!q.build(clone(base, { scope: "Supply and fit a new kitchen tap etc." })).warn.every(function (w) { return !/etc/.test(w); }), "etc. with dot");

// exclusions
r = q.build(clone(base, { exclusions: [], extraExclusions: "" }));
ok(has(r.warn, /No exclusions/), "no excl warn");
r = q.build(clone(base, { exclusions: [], extraExclusions: "Tiling" }));
ok(!has(r.warn, /No exclusions/) && /- Tiling/.test(r.text), "extra excl");

// quote vs estimate
r = q.build(clone(base, { prices: "Labour approx | 320" }));
ok(has(r.warn, /make it an estimate/), "approx in quote");
r = q.build(clone(base, { kind: "estimate", ceiling: "" }));
ok(has(r.warn, /no upper limit/), "estimate no ceiling");
ok(/ESTIMATE  No\./.test(r.text) && /ESTIMATED TOTAL/.test(r.text), "estimate label");
r = q.build(clone(base, { kind: "estimate", ceiling: "750" }));
ok(/won't go over £750\.00/.test(r.text) && !has(r.warn, /upper limit/), "ceiling ok");
ok(/estimated at £606\.40/.test(r.cover), "estimate cover");
r = q.build(clone(base, { kind: "estimate", ceiling: "500" }));
ok(has(r.warn, /below the estimate total/), "ceiling below");
r = q.build(clone(base, { kind: "estimate", ceiling: "abc" }));
ok(r.error, "bad ceiling");

// cancellation
r = q.build(clone(base, { where: "business" }));
ok(r.cancel === null && !/right to cancel/.test(r.text), "own premises no cancel");
r = q.build(clone(base, { where: "urgent" }));
ok(r.cancel === null && has(r.info, /urgent repair/), "urgent");
r = q.build(clone(base, { where: "distance" }));
ok(r.cancel === "distance" && has(r.info, /distance/), "distance");
r = q.build(clone(base, { prices: "Callout | 40" }));
ok(r.cancel === null, "under £42 exempt");
r = q.build(clone(base, { prices: "Callout | 42.01" }));
ok(r.cancel === "home", "over £42");
r = q.build(clone(base, { customer: "business" }));
ok(r.cancel === null && /within 7 days/.test(r.text), "business no cancel");
r = q.build(clone(base, { customer: "business", payDays: "" }));
ok(/within 30 days/.test(r.text), "business default 30");

// errors
ok(q.build(clone(base, { scope: "" })).error, "no scope");
ok(q.build(clone(base, { prices: "" })).error, "no prices");
ok(/Skip hire/.test(q.build(clone(base, { prices: "Skip hire" })).error), "bad price named");
r = q.build(clone(base, { business: "", customerName: "" }));
ok(has(r.warn, /business name/) && has(r.warn, /customer's name/), "missing names");
ok(/\[customer name\]/.test(r.text) && /Hi \[name\]/.test(r.cover), "placeholders");
r = q.build(clone(base, { validDays: "14" }));
ok(r.until === "10 November 2026", "valid 14");
r = q.build(clone(base, { scope: "- Drain down and refill the heating system\n2) Supply and fit two radiators in bedrooms" }));
ok(/   1\. Drain down/.test(r.text) && /   2\. Supply and fit/.test(r.text), "bullets stripped");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
