// node tests/test-invoice-maker.js
var m = require("../docs/guides/invoice-maker.js");
var pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log("FAIL: " + msg); } }
function has(arr, re) { return arr.some(function (s) { return re.test(s); }); }

// line parsing
var p = m.itemLine("Labour, 1 day | 320"); ok(p.desc === "Labour, 1 day" && p.amount === 320 && p.qty === null, "pipe " + JSON.stringify(p));
p = m.itemLine("TRVs | 4 x 18.50 | materials"); ok(p.qty === 4 && p.unit === 18.5 && p.amount === 74 && p.kind === "materials", "qty x unit " + JSON.stringify(p));
p = m.itemLine("Labour | 6 @ £45 | lab"); ok(p.amount === 270 && p.kind === "labour", "at sign " + JSON.stringify(p));
p = m.itemLine("Radiators £1,286.40"); ok(p.desc === "Radiators" && p.amount === 1286.4, "pound comma " + JSON.stringify(p));
p = m.itemLine("Copper pipe 15mm: 3 x 12.20"); ok(p.desc === "Copper pipe 15mm" && p.amount === 36.6, "colon qty " + JSON.stringify(p));
p = m.itemLine("Boiler 24kW | 1850"); ok(p.desc === "Boiler 24kW" && p.amount === 1850, "digits in desc");
p = m.itemLine("Skip hire"); ok(isNaN(p.amount), "no amount");
p = m.itemLine("450"); ok(isNaN(p.amount), "amount only");
p = m.itemLine("Less: deposit | -100"); ok(p.amount === -100, "negative");
p = m.itemLine("Skip | 250 | plant"); ok(p.kind === "other", "other kind");
ok(m.validVatNo("GB123456789") && m.validVatNo("123 4567 89") && m.validVatNo("GB 123 4567 89"), "vat formats ok");
ok(!m.validVatNo("GB12345") && !m.validVatNo("XI-1"), "vat formats bad");
ok(m.money(1234.5) === "£1,234.50" && m.money(-40) === "-£40.00", "money");

var base = {
  mode: "invoice", structure: "sole", business: "Hale Plumbing & Heating", owner: "Robin Hale",
  address: "4 Mill Lane, Leeds LS6 2AB", contact: "07700 900123", customerName: "Sam Patel",
  customerAddress: "12 Elm Road, Leeds LS8 1QT", customer: "homeowner", number: "INV-0042",
  date: "2026-10-28", supplyDate: "2026-10-27", quoteRef: "Q-0042", summary: "Two bedroom radiators replaced",
  items: "Labour, 1 day | 320\nTwo 600 x 1000 mm double panel radiators | 2 x 98.20\nThermostatic radiator valves | 2 x 32 \nInhibitor | 26",
  vat: "none", payDays: "7", payment: "Bank transfer to Hale Plumbing, sort code 12-34-56, account 12345678", today: "2026-10-28"
};
function clone(o, x) { var r = JSON.parse(JSON.stringify(o)); for (var k in x) r[k] = x[k]; return r; }

var r = m.build(base);
ok(!r.error, "base no error " + r.error);
ok(r.total === 606.4 && r.due === 606.4, "total " + r.total);
ok(r.warn.length === 0, "base clean: " + r.warn.join(" | "));
ok(/^Hale Plumbing & Heating \(Robin Hale trading as Hale Plumbing & Heating\)/.test(r.text), "trading as");
ok(/INVOICE  No\. INV-0042    Date: 28 October 2026    Work done: 27 October 2026/.test(r.text), "header " + r.text.split("\n")[4]);
ok(!/VAT INVOICE/.test(r.text), "not a VAT invoice");
ok(/Bill to: Sam Patel, 12 Elm Road/.test(r.text), "bill to");
ok(/Your quote: Q-0042/.test(r.text), "quote ref");
ok(/\(2 x £98\.20\)\s+£196\.40/.test(r.text), "qty shown");
ok(/TOTAL\s+£606\.40/.test(r.text), "total line");
ok(/No VAT: we're not VAT registered/.test(r.text), "no vat line");
ok(/Payment due: by 4 November 2026 \(7 days\)/.test(r.text), "due date");
ok(/Please use INV-0042 as the reference/.test(r.text), "reference");
ok(r.dueDate === "4 November 2026", "dueDate");
ok(/Hi Sam, thanks for having us\. Here's invoice INV-0042 for two bedroom radiators replaced: £606\.40, due by 4 November 2026/.test(r.cover), "cover " + r.cover);
ok(has(r.info, /£90,000/), "threshold info");
ok(has(r.info, /only add late-payment interest if your quote/), "homeowner interest info");
ok(!/Job address/.test(r.text), "no job address when same/blank");

// errors
ok(m.build(clone(base, { items: "" })).error, "no items");
ok(/Skip hire/.test(m.build(clone(base, { items: "Labour | 100\nSkip hire" })).error), "item without amount");
ok(m.build(clone(base, { date: "" })).error, "no date");
ok(/credit note/.test(m.build(clone(base, { items: "Refund | -50" })).error), "negative total");

// who you are
r = m.build(clone(base, { owner: "" })); ok(has(r.warn, /must also show your own name/), "sole trader own name");
r = m.build(clone(base, { address: "" })); ok(has(r.warn, /legal documents/), "address for legal docs");
r = m.build(clone(base, { business: "", owner: "" })); ok(has(r.warn, /Add your name or business name/), "no name");
r = m.build(clone(base, { contact: "" })); ok(has(r.warn, /phone number or email/), "no contact");
r = m.build(clone(base, { business: "", owner: "Robin Hale" })); ok(!has(r.warn, /own name/) && /^Robin Hale\n/.test(r.text), "own name only");
r = m.build(clone(base, { structure: "ltd", business: "Hale Plumbing" })); ok(has(r.warn, /full registered name/), "ltd name");
ok(has(r.warn, /company number/), "ltd number missing");
r = m.build(clone(base, { structure: "ltd", business: "Hale Plumbing Ltd", companyNo: "12345678", regOffice: "4 Mill Lane, Leeds LS6 2AB" }));
ok(!has(r.warn, /registered name|company number/), "ltd ok: " + r.warn.join("|"));
ok(/Company no\. 12345678/.test(r.text) && /Registered in England and Wales, company no\. 12345678\. Registered office: 4 Mill Lane/.test(r.text), "ltd footer");
ok(!/trading as/.test(r.text), "no trading-as for ltd");
r = m.build(clone(base, { structure: "ltd", business: "Hale Plumbing Limited", companyNo: "SC123456", regIn: "Scotland" }));
ok(/Registered in Scotland/.test(r.text), "reg in Scotland");

// customer, numbers and dates
r = m.build(clone(base, { customerName: "" })); ok(has(r.warn, /customer's name/) && /Hi there/.test(r.cover), "no customer");
r = m.build(clone(base, { customerAddress: "" })); ok(has(r.warn, /customer's address/), "no customer address");
r = m.build(clone(base, { number: "" })); ok(has(r.warn, /Add an invoice number/) && /\[number\]/.test(r.text), "no number");
r = m.build(clone(base, { number: "Sam's job" })); ok(has(r.warn, /no digits/), "number no digits");
r = m.build(clone(base, { supplyDate: "" })); ok(has(r.warn, /supply date/), "no supply date");
r = m.build(clone(base, { supplyDate: "2026-11-02" })); ok(has(r.warn, /after the invoice date/), "supply after invoice");
r = m.build(clone(base, { supplyDate: "2026-07-01" })); ok(has(r.warn, /over 60 days after/) && !has(r.warn, /30 days of the tax point/), "late invoice");
r = m.build(clone(base, { supplyDate: "2026-07-01", vat: "add20", vatNo: "GB123456789" })); ok(has(r.warn, /30 days of the tax point/), "late VAT invoice");
r = m.build(clone(base, { date: "2026-12-01", supplyDate: "2026-11-30" })); ok(has(r.warn, /in the future/), "future date");
r = m.build(clone(base, { jobAddress: "Flat 2, 9 Oak St, Leeds" })); ok(/Job address: Flat 2/.test(r.text), "job address");
r = m.build(clone(base, { quoteRef: "your quote" })); ok(has(r.info, /Quote reference has no number/), "quote ref no number");

// vague lines
r = m.build(clone(base, { items: "Labour etc | 320" })); ok(has(r.warn, /etc/), "etc");
r = m.build(clone(base, { items: "Sundries | 20\nLabour | 300" })); ok(has(r.warn, /sundries/i), "sundries");
r = m.build(clone(base, { items: "Work as discussed | 300" })); ok(has(r.warn, /as discussed/), "as discussed");
r = m.build(clone(base, { items: "Materials | 300" })); ok(has(r.warn, /one-word line/), "one word");
r = m.build(clone(base, { items: "Extra valve? | 30\nLabour | 300" })); ok(has(r.warn, /question mark/), "question mark");
r = m.build(clone(base, { items: "Labour | 300\nOld boiler | -50" })); ok(has(r.warn, /is negative/), "unlabelled negative");
r = m.build(clone(base, { items: "Labour | 300\nDiscount | -50" })); ok(!has(r.warn, /is negative/) && r.total === 250, "labelled discount");
r = m.build(clone(base, { items: "Labour | 300\nTap washer | 0" })); ok(has(r.warn, /is £0/), "zero line");

// VAT
var vb = clone(base, { vat: "add20", vatNo: "GB123456789" });
r = m.build(vb);
ok(r.vat === 121.28 && r.total === 727.68, "vat 20 " + r.vat + " " + r.total);
ok(/^VAT INVOICE/m.test(r.text.split("\n").slice(5).join("\n")) || /VAT INVOICE  No\./.test(r.text), "vat invoice title");
ok(/VAT reg\. no\. GB123456789/.test(r.text), "vat no shown");
ok(/£320\.00   VAT 20%/.test(r.text), "rate per line");
ok(/Subtotal \(excluding VAT\)\s+£606\.40/.test(r.text) && /VAT at 20%\s+£121\.28/.test(r.text) && /TOTAL\s+£727\.68/.test(r.text), "vat lines");
ok(r.warn.length === 0, "vat clean: " + r.warn.join("|"));
ok(!has(r.info, /£90,000/), "no threshold info when registered");
r = m.build(clone(base, { vat: "add20" })); ok(has(r.warn, /only charge VAT if you're VAT registered/), "vat without number");
r = m.build(clone(base, { vat: "add20", vatNo: "GB123" })); ok(has(r.warn, /doesn't look like a UK one/), "bad vat no");
r = m.build(clone(base, { vatNo: "GB123456789" })); ok(has(r.warn, /no VAT\. If you're registered/) && /no VAT charged on this work/.test(r.text), "vat no but none");
r = m.build(clone(base, { vat: "add5", vatNo: "GB123456789" })); ok(r.vat === 30.32 && has(r.info, /5% VAT is for specific work/), "5% " + r.vat);
r = m.build(clone(vb, { items: "Tap washer replaced | 150" })); ok(r.total === 180 && has(r.info, /simplified VAT invoice/), "simplified info");
r = m.build(clone(vb, { items: "Labour | 0.10\nWasher | 0.05" })); ok(r.vat === 0.03, "rounding " + r.vat);

// reverse charge and CIS
var cb = clone(base, { customer: "contractor", customerName: "Northside Build Ltd", vat: "rc", vatNo: "GB123456789",
  items: "Labour, first fix plumbing, 3 days | 3 x 220\nCopper pipe and fittings | 184.50 | materials\nSkip share | 40 | other", payDays: "30", cisRate: "20" });
r = m.build(cb);
ok(r.sub === 884.5 && r.vat === 176.9 && r.total === 884.5, "rc totals " + r.sub + " " + r.vat + " " + r.total);
ok(/Reverse charge: customer to pay the VAT to HMRC\. VAT Act 1994 Section 55A applies\./.test(r.text), "rc wording");
ok(/VAT due under the reverse charge: £176\.90 at 20%/.test(r.text), "rc amount shown");
ok(/VAT\s+£0\.00/.test(r.text) && !/VAT 20%\n/.test(r.text) && !/£660\.00   VAT/.test(r.text), "rc no vat charged");
ok(r.labour === 660 && r.materials === 184.5 && r.cis === 132, "cis split " + r.labour + " " + r.materials + " " + r.cis);
ok(/Less CIS deduction at 20% of labour\s+-£132\.00/.test(r.text) && /AMOUNT DUE\s+£752\.50/.test(r.text), "cis lines");
ok(r.due === 752.5, "due " + r.due);
ok(/CIS: labour £660\.00, materials £184\.50, other £40\.00/.test(r.text), "cis breakdown");
ok(!has(r.warn, /reverse charge only applies/), "rc ok for contractor");
ok(has(r.info, /statutory interest/), "business info for contractor");
ok(r.warn.length === 0, "cis clean: " + r.warn.join("|"));
r = m.build(clone(cb, { cisRate: "30" })); ok(r.cis === 198 && r.due === 686.5, "cis 30");
r = m.build(clone(cb, { cisRate: "0" })); ok(r.cis === 0 && r.due === 884.5, "cis gross");
r = m.build(clone(cb, { cisRate: "25" })); ok(has(r.warn, /20% \(registered\), 30%/), "cis bad rate");
r = m.build(clone(cb, { items: "Labour, 2 days | 440\nRadiators supplied | 300" }));
ok(r.labour === 440 && r.materials === 300 && has(r.info, /sorted by their wording/), "cis guess");
r = m.build(clone(cb, { items: "Labour, 2 days | 440 | labour" })); ok(has(r.info, /No materials lines/), "cis no materials");
r = m.build(clone(cb, { vat: "add20" })); ok(has(r.warn, /usually under the domestic reverse charge/), "contractor normal vat warning");
r = m.build(clone(base, { vat: "rc", vatNo: "GB123456789" })); ok(has(r.warn, /reverse charge only applies when the customer is/), "rc homeowner");
r = m.build(clone(cb, { vat: "none", vatNo: "" })); ok(r.cis === 132 && r.due === 752.5 && /not VAT registered/.test(r.text), "cis non-vat subbie");

// deposit and payment terms
r = m.build(clone(base, { depositPaid: "200" })); ok(r.due === 406.4 && /Less deposit paid\s+-£200\.00/.test(r.text) && /AMOUNT DUE\s+£406\.40/.test(r.text), "deposit");
ok(/: £406\.40, due/.test(r.cover), "cover uses amount due");
r = m.build(clone(base, { depositPaid: "900" })); ok(has(r.warn, /more than the invoice total/), "deposit too big");
r = m.build(clone(base, { depositPaid: "lots" })); ok(has(r.warn, /Deposit paid should be an amount/), "deposit nan");
r = m.build(clone(base, { payDays: "" })); ok(/\(7 days\)/.test(r.text), "homeowner default 7");
r = m.build(clone(base, { payDays: "", customer: "business" })); ok(/\(30 days\)/.test(r.text) && has(r.info, /statutory interest/), "business default 30");
r = m.build(clone(base, { payDays: "0" })); ok(/Payment due: on receipt \(28 October 2026\)/.test(r.text) && /due today/.test(r.cover), "on receipt");
r = m.build(clone(base, { payDays: "45" })); ok(has(r.warn, /Over 30 days for a homeowner/), "homeowner long terms");
r = m.build(clone(base, { payDays: "90", customer: "business" })); ok(has(r.warn, /grossly unfair/), "business 90 days");
r = m.build(clone(base, { payDays: "-3" })); ok(has(r.warn, /number of days/), "bad pay days");
r = m.build(clone(base, { payment: "" })); ok(has(r.warn, /Add how to pay/) && !/How to pay/.test(r.text), "no payment details");
r = m.build(clone(base, { payment: "Sort code 12-34-56" })); ok(has(r.warn, /no 8-digit account number/), "sort code no account");
r = m.build(clone(base, { payment: "Bank transfer, ref INV-0042, sort code 12-34-56, account 12345678" })); ok(!/Please use INV-0042/.test(r.text), "ref not repeated");
r = m.build(clone(base, { guarantee: "12 months on our workmanship" })); ok(/Guarantee: 12 months on our workmanship\./.test(r.text), "guarantee");

// receipt mode
r = m.build(clone(base, { mode: "receipt", paidOn: "2026-10-27", paidBy: "card", payment: "" }));
ok(/RECEIPT  No\. INV-0042/.test(r.text), "receipt title");
ok(/PAID IN FULL on 27 October 2026 by card\. Thank you\./.test(r.text), "paid line");
ok(!/Payment due/.test(r.text) && !has(r.warn, /how to pay/i), "no due in receipt");
ok(/thanks for your payment of £606\.40/.test(r.cover), "receipt cover");
r = m.build(clone(base, { mode: "receipt", payment: "" })); ok(/PAID IN FULL on 28 October 2026/.test(r.text), "receipt default date");

// cover greeting and column alignment
r = m.build(cb); ok(/^Hello, please find attached invoice INV-0042 for two bedroom radiators replaced: £752\.50/.test(r.cover), "company cover " + r.cover);
r = m.build(clone(base, { customer: "business", customerName: "Oakwood Properties" })); ok(/^Hello, /.test(r.cover), "company name cover");
r = m.build(clone(base, { mode: "receipt", customer: "contractor" })); ok(/^Hello, thanks for your payment/.test(r.cover), "company receipt cover");
r = m.build(cb);
var cols = r.text.split("\n").filter(function (l) { return /^   \S.*\s(-?£[\d,.]+)$/.test(l) && !/^   (CIS|VAT due|Reverse)/.test(l); }).map(function (l) { return l.search(/-?£[\d,.]+$/); });
ok(cols.length >= 6 && cols.every(function (c) { var d = c - cols[0]; return d === 0 || d === -1; }), "amounts aligned " + cols.join(","));

// every warning text is a sentence, no stray undefined/NaN anywhere
var combos = 0;
["sole", "ltd", "partnership"].forEach(function (s) {
  ["homeowner", "business", "contractor"].forEach(function (c) {
    ["none", "add20", "add5", "rc"].forEach(function (v) {
      ["invoice", "receipt"].forEach(function (md) {
        var x = m.build(clone(cb, { structure: s, customer: c, vat: v, mode: md, depositPaid: "50" }));
        combos++;
        ok(!x.error && !/undefined|NaN|null/.test(x.text + x.cover + x.warn.join("") + x.info.join("")), "combo " + [s, c, v, md].join("/"));
        ok(Math.abs(x.due - (x.total - x.cis - 50)) < 0.001, "due arithmetic " + [s, c, v, md].join("/"));
      });
    });
  });
});

console.log(pass + " passed, " + fail + " failed (" + combos + " combinations)");
process.exit(fail ? 1 : 0);
