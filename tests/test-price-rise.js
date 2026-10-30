// node tests/test-price-rise.js
var r = require("../docs/guides/price-rise.js");
var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function has(arr, re) { return arr.some(function (s) { return re.test(s); }); }
var base = {
  group: "recurring", customer: "Amira Khan", owner: "Lisa Hale", business: "Hale Cleaning", contact: "07700 900123", cur: "£",
  service: "clean", unit: "visit", freq: "fortnightly", oldPrice: "60", newPrice: "68",
  effective: "2027-01-04", today: "2026-11-02", since: "2024", lastReview: "2024", reasons: ["materials", "fuel", "insurance"], vat: "none", format: "email"
};
function o(x) { var k, y = {}; for (k in base) y[k] = base[k]; for (k in x) y[k] = x[k]; return y; }

// every group x format x currency x unit builds a clean message with no placeholders
Object.keys(r.GROUPS).forEach(function (g) {
  ["email", "letter"].forEach(function (f) {
    ["£", "$", "€"].forEach(function (cur) {
      ["item", "hour", "day", "visit", "month"].forEach(function (u) {
        var b = r.build(o({ group: g, format: f, cur: cur, unit: u, service: g === "recurring" ? "clean" : "day rate" }));
        var msg = f === "letter" ? b.message.replace(/^\[Your business[^\n]*\n\[Date\]\n\n\[Customer's[^\n]*\n\n/, "") : b.message;
        ok(!/\[/.test(msg), g + f + cur + u + " no placeholder: " + msg);
        var c = r.check({ text: msg, recurring: g === "recurring" });
        ok(c.warn.length === 0, g + f + cur + u + " own message clean: " + c.warn.join(" | ") + " :: " + msg);
        ok(c.words <= 150, g + f + " under 150 words (" + c.words + ")");
        ok(msg.indexOf(cur + "68") > 0 && msg.indexOf(cur + "60") > 0, g + " both prices");
        var s = r.check({ text: b.sms, sms: true, recurring: g === "recurring" });
        ok(b.sms.length <= 306, g + u + " sms length " + b.sms.length);
        ok(!/\[/.test(b.sms), g + " sms no placeholder");
        Object.keys(b.pushback).forEach(function (k) { ok(/Lisa$/.test(b.pushback[k]), g + " pushback signed " + k); });
      });
    });
  });
});

// dates
ok(r.fmtDate(r.parseDate("2027-03-01")) === "1 March 2027", "UK date");
ok(r.fmtDate(r.parseDate("2027-03-01"), true) === "March 1, 2027", "US date");
ok(/From March 1, 2027/.test(r.build(o({ cur: "$", effective: "2027-03-01" })).message), "US date in message");
ok(isNaN(r.parseDate("1/3/2027")), "bad date rejected");

// numbers
var b = r.build(o({}));
ok(Math.abs(b.pct - 13.333) < 0.01, "pct " + b.pct);
ok(b.notice === 63, "notice days " + b.notice);
ok(has(b.info, /£8 a visit \(13\.3%\)/), "rise line " + b.info);
ok(has(b.info, /26 visits a year, it's £208 a year more.*£1,560 → £1,768/), "annual line " + b.info);
ok(r.money("£", 1234.5) === "£1,234.50", "money pence");
ok(r.money("€", 95) === "€95", "money whole");
ok(/Thank you for having us for the last 2 years\./.test(b.message), "since years");
ok(/your fortnightly clean will be £68 a visit \(currently £60\)/.test(b.message), "change line " + b.message);
ok(/since our last price review in 2024/.test(b.message), "since last review");
ok(/materials, fuel and insurance/.test(b.message), "reason list");
ok(/Visits before 4 January 2027 stay at £60\./.test(b.message), "visits honoured");
ok(/nothing to pay beyond the visits already done/.test(b.message), "exit line");
ok(b.subject === "Your fortnightly clean price from 4 January 2027", "subject " + b.subject);
ok(/^Hi Amira,/.test(b.message) && !/Khan/.test(b.message), "first name only");
ok(/Thanks,\nLisa\nHale Cleaning$/.test(b.message), "signoff " + b.message);

// notes
ok(has(r.build(o({ effective: "2026-11-20" })).notes, /Only 18 days' notice/), "short notice recurring");
ok(!has(r.build(o({ group: "regular", effective: "2026-11-20" })).notes, /notice/), "18 days fine for regular");
ok(has(r.build(o({ group: "regular", effective: "2026-11-05" })).notes, /Only 3 days' notice/), "very short for regular");
ok(has(r.build(o({ effective: "2026-10-01" })).notes, /in the past/), "past date");
ok(has(r.build(o({ newPrice: "80" })).notes, /phasing/), "big rise phase");
ok(!has(r.build(o({ group: "regular", newPrice: "80" })).notes, /phasing/), "no phase note for regular");
ok(has(r.build(o({ newPrice: "55" })).notes, /isn't higher/), "lower price");
ok(has(r.build(o({ vat: "ex", group: "regular" })).notes, /including VAT/), "ex VAT domestic");
ok(/£68 a day plus VAT/.test(r.build(o({ vat: "ex", group: "commercial", unit: "day", service: "day rate" })).message), "plus VAT commercial");
ok(/including VAT/.test(r.build(o({ vat: "inc" })).message), "inc VAT");
ok(has(r.build(o({ group: "commercial" })).notes, /review clause/), "commercial clause note");
ok(has(r.build(o({ effective: "" })).notes, /Add the date/), "no date note");
ok(/\[date\]/.test(r.build(o({ effective: "" })).message), "no date placeholder");

// reasons fallbacks
ok(/It's the first change to our prices since 2023/.test(r.build(o({ reasons: [], lastReview: "2023" })).message), "no reasons, last review");
ok(/\[One or two honest/.test(r.build(o({ reasons: [], lastReview: "" })).message), "no reasons placeholder");
ok(/over the last year/.test(r.build(o({ lastReview: "2026" })).message), "reviewed this year");
ok(/over the last year/.test(r.build(o({ lastReview: "2025", today: "2026-11-02" })).message), "reviewed last year");
ok(/Our costs for wages have gone up over the last year, and we've taken on a second van\./.test(r.build(o({ reasons: ["wages"], lastReview: "", other: "We've taken on a second van." })).message), "other reason appended");
ok(/This lets us keep the same team\./.test(r.build(o({ kept: "the same team" })).message), "kept prefixed");
ok(/This lets us pay our staff properly\./.test(r.build(o({ kept: "Pay our staff properly." })).message), "kept as given");

// letter + commercial
var L = r.build(o({ format: "letter", group: "regular", service: "the call-out fee", unit: "item" }));
ok(/^\[Your business name and address\]/.test(L.message) && /Dear Amira,/.test(L.message) && /Yours sincerely,/.test(L.message), "letter layout");
ok(/our call-out fee will be £68 \(currently £60\)/.test(L.message), "strips 'the' " + L.message);
ok(/please call me on 07700/.test(L.message), "letter contact");
var C = r.build(o({ group: "commercial" }));
ok(/^Dear Amira,/.test(C.message) && /Yours sincerely,/.test(C.message) && /purchase orders/.test(C.message), "commercial");
var A = r.build(o({ group: "agent" }));
ok(/Jobs instructed before/.test(A.message) && /landlords/.test(A.message), "agent");
ok(/Thanks for the work you've sent our way since 2024\./.test(A.message), "agent thanks");

// pushback
ok(/less often/.test(b.pushback["\"That's a lot.\""]), "less often for fortnightly");
ok(!/less often/.test(r.build(o({ freq: "monthly" })).pushback["\"That's a lot.\""]), "no less-often for monthly");
ok(/hold £60 until \[date\], then £68/.test(b.pushback["\"Can you keep me on the old price?\""]), "hold old price");
ok(/off the round/.test(b.pushback["\"I'm cancelling.\""]), "cancel recurring");

// checker: a bad message gets flagged
var bad = "Dear Valued Customer,\n\nUnfortunately due to circumstances beyond our control and the government's budget we have been forced to increase all prices by 15% with immediate effect! Prices are now £70 plus VAT. We are still the cheapest in town. We hope you understand.\n\nThe Management";
var cb = r.check({ text: bad, recurring: true });
[/Apologising/, /No choice/, /hope you understand/, /their name/, /politics/, /immediate effect/, /including VAT/, /price-comparison/, /exclamation/, /percentage/, /Only one price/, /No start date/, /ask questions/, /stop without a penalty/, /already booked/].forEach(function (re) {
  ok(has(cb.warn, re), "bad flagged " + re);
});
ok(has(r.check({ text: "Hi Jo, our prices are going up from March. Thanks, Dave" }).warn, /No prices/), "no prices");
ok(has(r.check({ text: "Hi Jo, from 1 March our rate is £[new] (currently £60)." }).warn, /placeholder/), "placeholder");
ok(r.check({ text: "  " }).error, "empty");
ok(has(r.check({ text: "Hi Jo, from 1 March 2027 our day rate will be £250 (currently £220). Jobs booked before then stay the same. Any questions, just ask. Dave", sms: true }).warn, /./) === false, "good sms clean");
ok(has(r.check({ text: new Array(80).join("word ") + "£1 £2 1 March booked call", sms: true }).warn, /Long for a text/), "long sms");
ok(has(r.check({ text: new Array(200).join("word ") + "£1 £2 1 March booked call" }).warn, /Long \(/), "long email");
ok(!has(r.check({ text: "Hi Jo, from 01/03/2027 our day rate will be £250 (currently £220). Jobs booked before then stay the same. Any questions, just ask." }).warn, /start date/), "numeric date ok");

// day rate
var d = r.dayRate({ takeHome: "40000", costs: "12000", days: "200", hours: "8" });
ok(d.rate === 260 && d.hourly === 32.5 && d.need === 52000, "day rate " + JSON.stringify(d));
ok(!d.notes.length, "200 days no note");
ok(r.dayRate({ takeHome: "40000", costs: "0", days: "250" }).notes.length === 1, "250 days note");
ok(r.dayRate({ takeHome: "", costs: "1", days: "200" }).error, "missing take-home");
ok(r.dayRate({ takeHome: "1", costs: "1", days: "0" }).error, "zero days");
ok(isNaN(r.dayRate({ takeHome: "1", costs: "1", days: "10" }).hourly), "no hours");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
