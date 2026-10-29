// node tests/test-gas-safety.js
var G = require("../docs/guides/gas-safety.js");
var n = 0, bad = 0;
function eq(a, b, msg) { n++; if (a !== b) { bad++; console.log("FAIL " + msg + ": got " + JSON.stringify(a) + ", want " + JSON.stringify(b)); } }
function d(s) { return G.iso(s); }

// addMonths: same date, month ends, leap years
eq(d(G.addMonths(G.parse("2026-03-15"), 12)), "2027-03-15", "+12 same date");
eq(d(G.addMonths(G.parse("2024-02-29"), 12)), "2025-02-28", "29 Feb -> 28 Feb");
eq(d(G.addMonths(G.parse("2027-02-28"), 12)), "2028-02-28", "28 Feb into leap year stays 28");
eq(d(G.addMonths(G.parse("2026-12-31"), -2)), "2026-10-31", "-2 from 31 Dec");
eq(d(G.addMonths(G.parse("2026-04-30"), -2)), "2026-02-28", "-2 from 30 Apr");
eq(d(G.addMonths(G.parse("2026-01-15"), -2)), "2025-11-15", "-2 across year");

// Early window: the 2 months ending with the deadline
eq(d(G.windowStart(G.parse("2027-03-15"))), "2027-01-16", "window 15 Mar");
eq(d(G.windowStart(G.parse("2027-04-30"))), "2027-03-01", "window 30 Apr");
eq(d(G.windowStart(G.parse("2027-03-31"))), "2027-02-01", "window 31 Mar");
eq(d(G.windowStart(G.parse("2027-01-10"))), "2026-11-11", "window across year");

// Basic case
var r = G.calc({ last: "2026-03-15", today: "2026-10-29" });
eq(d(r.deadline), "2027-03-15", "deadline");
eq(d(r.openFrom), "2027-01-16", "open from");
eq(d(r.bookBy), "2027-02-15", "book by 28 days before");
eq(d(r.tenantCopyBy), "2026-04-12", "copy within 28 days");
eq(r.status, "ok", "status ok");
eq(r.daysLeft, 137, "days left");
eq(r.deadlineText, "Monday 15 March 2027", "deadline text");

// Status bands
eq(G.calc({ last: "2026-03-15", today: "2026-12-20" }).status, "soon", "soon within 90 days");
eq(G.calc({ last: "2026-03-15", today: "2027-01-16" }).status, "window", "window opens");
eq(G.calc({ last: "2026-03-15", today: "2027-03-15" }).status, "window", "deadline day still in window");
eq(G.calc({ last: "2026-03-15", today: "2027-03-15" }).daysLeft, 0, "0 days left");
r = G.calc({ last: "2026-03-15", today: "2027-03-16" });
eq(r.status, "overdue", "overdue next day");
eq(r.daysLeft, -1, "-1");
eq(G.calc({ last: "2026-10-20", today: "2026-10-29" }).copyDue, true, "copy still due");
eq(G.calc({ last: "2026-09-01", today: "2026-10-29" }).copyDue, undefined, "copy period over");

// Early check keeps the previous deadline (reg 36A(1))
r = G.calc({ last: "2027-02-01", prevDeadline: "2027-03-15" });
eq(r.early, true, "early flagged");
eq(d(r.counted), "2027-03-15", "counts as deadline date");
eq(d(r.deadline), "2028-03-15", "next deadline kept");
eq(d(r.tenantCopyBy), "2027-03-01", "copy runs from the real check date");
r = G.calc({ last: "2027-01-16", prevDeadline: "2027-03-15" });
eq(r.early, true, "first day of window");
r = G.calc({ last: "2027-03-15", prevDeadline: "2027-03-15" });
eq(r.early, true, "on the deadline");
eq(d(r.deadline), "2028-03-15", "on the deadline -> +12");

// Too early: months lost
r = G.calc({ last: "2027-01-15", prevDeadline: "2027-03-15" });
eq(r.early, false, "day before window not early");
eq(d(r.deadline), "2028-01-15", "too early -> from check date");
eq(/lost/.test(r.notes[0]), true, "lost note");

// Late: after the deadline
r = G.calc({ last: "2027-04-01", prevDeadline: "2027-03-15" });
eq(r.late, true, "late");
eq(r.aligned, true, "within 2 months after: alignment possible");
eq(d(r.deadline), "2028-04-01", "late -> from check date");
r = G.calc({ last: "2027-05-15", prevDeadline: "2027-03-15" });
eq(r.aligned, false, "2 months after: outside alignment");
eq(r.late, true, "late outside alignment");
r = G.calc({ last: "2027-05-14", prevDeadline: "2027-03-15" });
eq(r.aligned, true, "last day of alignment period");

// Chains: early check two years running keeps the original date
var first = G.calc({ last: "2026-03-15" });
var second = G.calc({ last: "2027-02-10", prevDeadline: G.iso(first.deadline) });
var third = G.calc({ last: "2028-01-20", prevDeadline: G.iso(second.deadline) });
eq(d(third.deadline), "2029-03-15", "date held over 3 checks");

// Leap day
r = G.calc({ last: "2028-02-29" });
eq(d(r.deadline), "2029-02-28", "leap check");
r = G.calc({ last: "2028-01-05", prevDeadline: "2028-02-29" });
eq(d(r.deadline), "2029-02-28", "early on a leap deadline");

// New tenancy (reg 36(3)(b))
eq(G.calc({ last: "2026-03-15", tenancy: "2027-03-15" }).tenancyOk, "yes", "tenancy on deadline ok");
eq(G.calc({ last: "2026-03-15", tenancy: "2027-03-16" }).tenancyOk, "no", "tenancy after deadline");
eq(G.calc({ last: "2026-03-15", tenancy: "2026-11-01" }).tenancyOk, "yes", "tenancy within year");
eq(G.calc({ last: "2026-03-15", tenancy: "2026-01-01" }).tenancyOk, "before", "tenancy before check");
eq(G.calc({ last: "2027-02-01", prevDeadline: "2027-03-15", tenancy: "2028-03-10" }).tenancyOk, "yes", "tenancy covered by kept date");

// Errors
eq(!!G.calc({}).error, true, "missing date");
eq(!!G.calc({ last: "2026-02-30" }).error, true, "invalid date");
eq(!!G.calc({ last: "2026-11-01", today: "2026-10-29" }).error, true, "future check");
eq(!!G.calc({ last: "2026-03-15", prevDeadline: "x" }).error, true, "bad prev");
eq(!!G.calc({ last: "2026-03-15", tenancy: "2026-13-01" }).error, true, "bad tenancy");

// Messages: placeholders filled, missing ones shown in brackets
r = G.calc({ last: "2026-03-15" });
var f = G.fields(r, { customer: "Sam", address: "12 Elm Road", business: "Ridge Heating", phone: "07700 900123" });
var m = G.message("engineer_landlord", f);
eq(/due by 15 March 2027/.test(m), true, "deadline in message");
eq(/any time from 16 January 2027/.test(m), true, "window in message");
eq(/stays at 15 March 2028/.test(m), true, "next deadline in message");
eq(/\[/.test(m), false, "no gaps when filled");
eq(/\[tenant\]/.test(G.message("landlord_tenant", f)), true, "missing tenant bracketed");
eq(/\[visit time\]/.test(G.message("landlord_tenant", f)), true, "underscore key bracketed readably");
Object.keys(G.TEMPLATES).forEach(function (k) {
  var all = G.message(k, G.fields(r, { customer: "A", tenant: "B", address: "C", business: "D", phone: "E", visit: "F", visit_time: "G" }));
  eq(/[\[\]{}]/.test(all), false, k + " fully filled");
  eq(/—/.test(all), false, k + " no em dash");
});
eq(G.message("engineer_landlord_sms", f).length <= 320, true, "landlord text is 2 SMS or fewer");
eq(G.message("service_homeowner_sms", G.fields(r, { customer: "Sam", business: "Ridge Heating", phone: "07700 900123", visit: "Tue 10 or Thu 12 Nov" })).length <= 160, true, "service text fits one SMS");

// ICS
var c = G.ics(r, "Gas safety check 12 Elm Road");
eq(c.split("BEGIN:VEVENT").length - 1, 3, "3 events");
eq(/DTSTART;VALUE=DATE:20270116/.test(c), true, "window event");
eq(/DTSTART;VALUE=DATE:20270315\r\nDTEND;VALUE=DATE:20270316/.test(c), true, "deadline event all-day");
eq(/[^\r]\n/.test(c), false, "CRLF only");
eq(/,/.test(G.ics(r, "a, b; c")), false, "label sanitised");

// Sweep: every check date over 3 years, early window rule holds
var start = G.parse("2026-01-01"), sweepBad = 0;
for (var i = 0; i < 1100; i++) {
  var dl = new Date(start.getTime() + i * 86400000);
  var x = G.calc({ last: G.iso(dl) });
  if (x.deadline <= dl || G.iso(G.addMonths(x.openFrom, 0)) > G.iso(x.deadline)) sweepBad++;
  var win = G.calc({ last: G.iso(x.openFrom), prevDeadline: G.iso(x.deadline) });
  var before = G.calc({ last: G.iso(new Date(x.openFrom.getTime() - 86400000)), prevDeadline: G.iso(x.deadline) });
  if (!win.early || before.early) sweepBad++;
  var span = Math.round((x.deadline - x.openFrom) / 86400000);
  if (span < 58 || span > 61) sweepBad++;
}
eq(sweepBad, 0, "sweep of 1,100 check dates");

console.log((n - bad) + "/" + n + " passed");
process.exit(bad ? 1 : 0);
