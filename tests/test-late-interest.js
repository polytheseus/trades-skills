// node tests/test-late-interest.js
var L = require("../docs/guides/late-interest.js");
var n = 0, bad = 0;
function eq(a, b, msg) { n++; if (a !== b) { bad++; console.log("FAIL " + msg + ": got " + JSON.stringify(a) + ", want " + JSON.stringify(b)); } }

// Compensation bands (gov.uk table)
eq(L.compensation(999.99), 40, "under 1000");
eq(L.compensation(1000), 70, "1000");
eq(L.compensation(9999.99), 70, "9999.99");
eq(L.compensation(10000), 100, "10000");

// Reference rates by the day interest starts
eq(L.refRate(L.parse("2026-01-01")).base, 3.75, "Jan 2026");
eq(L.refRate(L.parse("2025-06-30")).base, 4.75, "Jun 2025 uses 31 Dec 2024");
eq(L.refRate(L.parse("2025-07-01")).base, 4.25, "Jul 2025 uses 30 Jun 2025");
eq(L.refRate(L.parse("2023-07-15")).base, 5.0, "Jul 2023");
eq(L.refRate(L.parse("2022-12-31")).early, true, "before table");
eq(L.refRate(L.parse("2027-01-01")).guess, true, "after table");

// gov.uk worked example: £1,000 at 8.5% for 50 days = £11.64 exact (gov.uk rounds the daily to 23p, giving £11.50)
var r = L.calc({ amount: "1000", due: "2026-01-01", to: "2026-02-20", base: "0.5" });
eq(r.days, 50, "50 days");
eq(r.interest, 11.64, "gov.uk example, unrounded daily");
eq(r.override, true, "override flagged");

// Real 2026 case: £2,400 due 15 Sep 2026, worked to 26 Oct 2026 (41 days), 11.75%
r = L.calc({ amount: "£2,400", due: "2026-09-15", to: "2026-10-26" });
eq(r.days, 41, "41 days");
eq(r.rate, 11.75, "11.75%");
eq(r.interest, 31.68, "2400*0.1175/365*41");
eq(r.compensation, 70, "comp 70");
eq(r.total, 2501.68, "total");
eq(r.startText, "16 September 2026", "interest starts day after due");

// Rate change across the year boundary is decided by the start date only
r = L.calc({ amount: "500", due: "2025-06-30", to: "2025-08-30" });
eq(r.base, 4.25, "starts 1 Jul 2025");
r = L.calc({ amount: "500", due: "2025-06-29", to: "2025-08-30" });
eq(r.base, 4.75, "starts 30 Jun 2025");

// No agreed date: 30 days after the later of invoice received / work done
r = L.calc({ amount: "800", invoiceGot: "2026-09-01", workDone: "2026-09-10", to: "2026-10-26" });
eq(r.dueText, "10 October 2026", "30 days after work done");
eq(r.days, 16, "16 days late");
r = L.calc({ amount: "800", invoiceGot: "2026-09-10", workDone: "2026-09-01", to: "2026-10-26" });
eq(r.dueText, "10 October 2026", "30 days after invoice received");
r = L.calc({ amount: "800", invoiceGot: "2026-09-10", to: "2026-10-26" });
eq(r.dueText, "10 October 2026", "no work date");
eq(L.calc({ amount: "800", invoiceGot: "2026-09-30", to: "2026-10-26" }).notLate, true, "not late yet");

// Leap year: 2028-02-28 to 2028-03-01 is 2 days
eq(L.calc({ amount: "1000", due: "2028-02-28", to: "2028-03-01", base: "4" }).days, 2, "leap day counted");

// After the table: uses current Bank Rate and flags it
r = L.calc({ amount: "1000", due: "2027-01-05", to: "2027-02-04" });
eq(r.guess, true, "guess flagged");
eq(r.base, 3.75, "current base used");

// Errors
eq(!!L.calc({ amount: "", due: "2026-01-01", to: "2026-02-01" }).error, true, "no amount");
eq(!!L.calc({ amount: "abc", due: "2026-01-01", to: "2026-02-01" }).error, true, "bad amount");
eq(!!L.calc({ amount: "100", due: "2026-02-30", to: "2026-03-01" }).error, true, "bad date");
eq(!!L.calc({ amount: "100", due: "2022-10-01", to: "2023-03-01" }).error, true, "pre-2023 needs base");
eq(L.calc({ amount: "100", due: "2022-10-01", to: "2023-03-01", base: "2.25" }).rate, 10.25, "pre-2023 with base");

// Claim text has the working
var t = L.claimText(L.calc({ amount: "2400", due: "2026-09-15", to: "2026-10-26" }), "1042");
eq(t.indexOf("Invoice 1042 for £2,400.00") === 0, true, "text starts with invoice");
eq(t.indexOf("£0.7726 a day, x 41 days = £31.68") > 0, true, "working shown");
eq(t.indexOf("total now due is £2,501.68") > 0, true, "total in text");

// Homeowner: 8% court-claim interest, no compensation
r = L.calc({ amount: "2400", due: "2026-09-15", to: "2026-10-26", consumer: true });
eq(r.consumer, true, "consumer");
eq(r.interest, 21.57, "2400*0.08/365*41");
eq(r.compensation, 0, "no comp for consumer");
eq(r.total, 2421.57, "consumer total");
eq(L.claimText(r, "7").indexOf("County Court") > 0, true, "consumer text");

console.log((n - bad) + "/" + n + " passed");
process.exit(bad ? 1 : 0);
