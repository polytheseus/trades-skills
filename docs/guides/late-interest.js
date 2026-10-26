// UK late payment interest and compensation calculator (business customers).
// Runs in the browser and in node (module.exports) for tests. Nothing typed
// is sent anywhere.
// Rules checked 26 Oct 2026:
// gov.uk/late-commercial-payments-interest-debt-recovery (8% + base rate,
//   £40/£70/£100, 30 days when no payment date was agreed)
// legislation.gov.uk/uksi/2002/1675/article/4 (reference rate: Bank Rate on
//   30 June for interest starting 1 Jul-31 Dec, on 31 December for 1 Jan-30 Jun)
// bankofengland.co.uk/boeapps/database/Bank-Rate.asp (Bank Rate history)
// Upkeep: add a row to REF_RATES every 1 January and 1 July.
(function () {
  // Bank Rate on each reference day, for interest that starts on or after `from`.
  var REF_RATES = [
    { from: "2023-01-01", base: 3.5 },   // 31 Dec 2022
    { from: "2023-07-01", base: 5.0 },   // 30 Jun 2023
    { from: "2024-01-01", base: 5.25 },  // 31 Dec 2023
    { from: "2024-07-01", base: 5.25 },  // 30 Jun 2024
    { from: "2025-01-01", base: 4.75 },  // 31 Dec 2024
    { from: "2025-07-01", base: 4.25 },  // 30 Jun 2025
    { from: "2026-01-01", base: 3.75 },  // 31 Dec 2025
    { from: "2026-07-01", base: 3.75 }   // 30 Jun 2026
  ];
  var KNOWN_UNTIL = "2026-12-31"; // last start date the table covers
  var CURRENT_BASE = 3.75;        // Bank Rate now (held 17 Sep 2026; next decision 5 Nov 2026)
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DAY = 86400000;

  function parse(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCMonth() === p[1] - 1 ? d : null;
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function fmt(d) { return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function money(n) {
    return "£" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function num(v) {
    if (v === undefined || v === null || v === "") return null;
    var n = Number(String(v).replace(/[£,\s]/g, ""));
    return isFinite(n) && n >= 0 ? n : NaN;
  }

  function compensation(amount) {
    if (amount < 1000) return 40;
    if (amount < 10000) return 70;
    return 100;
  }

  // Bank Rate that applies to interest starting on `start` (a Date).
  function refRate(start) {
    var s = iso(start);
    if (s < REF_RATES[0].from) return { base: null, early: true };
    if (s > KNOWN_UNTIL) return { base: CURRENT_BASE, guess: true };
    var base = REF_RATES[0].base;
    for (var i = 0; i < REF_RATES.length; i++) if (s >= REF_RATES[i].from) base = REF_RATES[i].base;
    return { base: base };
  }

  // The day payment was due when no date was agreed: 30 days after the later
  // of the invoice arriving and the work being done.
  function defaultDue(invoiceGot, workDone) {
    var later = workDone && workDone > invoiceGot ? workDone : invoiceGot;
    return new Date(later.getTime() + 30 * DAY);
  }

  // o: {amount, due | (invoiceGot, workDone), to, base (optional override)}
  function calc(o) {
    var amount = num(o.amount);
    if (amount === null || isNaN(amount) || amount <= 0) return { error: "Enter the invoice amount, e.g. 1450." };
    var due;
    if (o.due) {
      due = parse(o.due);
      if (!due) return { error: "Enter the date payment was due." };
    } else {
      var got = parse(o.invoiceGot), done = o.workDone ? parse(o.workDone) : null;
      if (!got) return { error: "Enter the date the customer got the invoice." };
      if (o.workDone && !done) return { error: "Check the date the work was finished." };
      due = defaultDue(got, done);
    }
    var to = parse(o.to);
    if (!to) return { error: "Enter the date to work the interest out to (today, or the day they paid)." };
    var days = Math.round((to - due) / DAY);
    if (days <= 0) return { notLate: true, due: due, dueText: fmt(due) };
    var start = new Date(due.getTime() + DAY);
    if (o.consumer) {
      // Homeowners: no statutory scheme. A county court claim (England and
      // Wales) usually adds simple interest at 8% (gov.uk/make-court-claim-for-money).
      var cd = amount * 0.08 / 365, ci = Math.round(cd * days * 100) / 100;
      return { consumer: true, amount: amount, due: due, dueText: fmt(due), start: start,
        startText: fmt(start), to: to, toText: fmt(to), days: days, rate: 8, daily: cd,
        interest: ci, compensation: 0, total: Math.round((amount + ci) * 100) / 100 };
    }
    var r = refRate(start), base = r.base, override = num(o.base);
    if (override !== null && !isNaN(override)) { base = override; r = { base: base, override: true }; }
    if (base === null) return { error: "This calculator covers debts that went overdue from 1 January 2023. For older debts, enter the Bank Rate yourself." };
    var rate = 8 + base;
    var daily = amount * rate / 100 / 365;
    var interest = Math.round(daily * days * 100) / 100;
    var comp = compensation(amount);
    return {
      amount: amount, due: due, dueText: fmt(due), start: start, startText: fmt(start),
      to: to, toText: fmt(to), days: days, base: base, rate: rate,
      daily: daily, interest: interest, compensation: comp,
      total: Math.round((amount + interest + comp) * 100) / 100,
      guess: !!r.guess, override: !!r.override
    };
  }

  function claimText(res, inv) {
    inv = inv || "[number]";
    if (res.consumer) return "Invoice " + inv + " for " + money(res.amount) + " was due on " + res.dueText +
      " and is now " + res.days + " days overdue.\n\n" +
      "If it isn't paid by [date, 14 days from now], I intend to start a claim in the County Court for the " +
      money(res.amount) + " owed, plus interest at 8% a year (" + money(res.daily) + " a day; " +
      money(res.interest) + " so far) and the court fee.";
    return "Invoice " + inv + " for " + money(res.amount) + " was due on " + res.dueText +
      " and is now " + res.days + " days overdue.\n\n" +
      "Under the Late Payment of Commercial Debts (Interest) Act 1998 I am entitled to claim:\n" +
      "- statutory interest at " + res.rate.toFixed(2) + "% a year (8% plus the Bank of England base rate of " +
      res.base.toFixed(2) + "%): " + money(res.amount) + " x " + res.rate.toFixed(2) + "% / 365 = £" +
      res.daily.toFixed(4) + " a day, x " + res.days + " days = " + money(res.interest) + "\n" +
      "- fixed compensation of " + money(res.compensation) + "\n\n" +
      "The total now due is " + money(res.total) + ". Interest continues at about " + money(res.daily) +
      " a day until payment is received.";
  }

  var api = { calc: calc, compensation: compensation, refRate: refRate, defaultDue: defaultDue,
    claimText: claimText, money: money, parse: parse, REF_RATES: REF_RATES };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // Browser wiring.
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, text, cls) { var e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
  var form = $("li-form");
  if (!form) return;
  $("li-to").value = iso(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())));
  function toggle() {
    var agreed = $("li-agreed").value === "yes";
    $("li-due-wrap").hidden = !agreed;
    $("li-noterms-wrap").hidden = agreed;
    $("li-b2c").hidden = $("li-who").value !== "consumer";
    $("li-base-wrap").hidden = $("li-who").value === "consumer";
  }
  $("li-agreed").addEventListener("change", toggle);
  $("li-who").addEventListener("change", toggle);
  toggle();
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var out = $("li-out");
    out.textContent = "";
    var agreed = $("li-agreed").value === "yes";
    var res = calc({
      amount: $("li-amount").value,
      due: agreed ? $("li-due").value : "",
      invoiceGot: agreed ? "" : $("li-got").value,
      workDone: agreed ? "" : $("li-done").value,
      to: $("li-to").value,
      base: $("li-base").value,
      consumer: $("li-who").value === "consumer"
    });
    if (res.error) { out.appendChild(el("p", res.error, "li-err")); return; }
    if (res.notLate) { out.appendChild(el("p", "Not overdue yet: payment is due on " + res.dueText + ". Interest starts the day after.")); return; }
    var t = el("table", null, "t");
    var rows = res.consumer ? [["Payment was due", res.dueText],
     ["Days overdue", res.days + " (to " + res.toText + ")"],
     ["Court-claim interest at 8%", money(res.daily) + " a day, " + money(res.interest) + " so far"],
     ["Statutory interest and compensation", "Not available: the customer isn't a business"],
     ["Amount plus 8% interest if you claim in court", money(res.total)]] : [["Payment was due", res.dueText],
     ["Interest runs from", res.startText + " to " + res.toText + " (" + res.days + " days)"],
     ["Rate", res.rate.toFixed(2) + "% a year (8% + " + res.base.toFixed(2) + "% Bank Rate" + (res.override ? ", your figure" : "") + ")"],
     ["Daily interest", "£" + res.daily.toFixed(4) + " (about " + money(res.daily) + ")"],
     ["Interest so far", money(res.interest)],
     ["Fixed compensation", money(res.compensation)],
     ["Total to claim", money(res.total)]];
    rows.forEach(function (row, i) {
      var tr = el("tr"); tr.appendChild(el("th", row[0])); var td = el("td", row[1]);
      if (i === rows.length - 1) td.style.fontWeight = "800";
      tr.appendChild(td); t.appendChild(tr);
    });
    out.appendChild(t);
    if (res.guess) out.appendChild(el("p", "This debt went overdue after 31 December 2026, so the rate depends on the Bank Rate on 31 December 2026. We've used today's " + res.base.toFixed(2) + "%: check the Bank of England site and type the right figure in the Bank Rate box.", "li-warn"));
    out.appendChild(el("p", res.consumer ? "Copy this into your final notice (only say you'll go to court if you will):" : "Copy this into your final reminder or a new invoice:"));
    var pre = el("pre", claimText(res, $("li-inv").value.trim() || undefined), "email");
    out.appendChild(pre);
    var b = el("button", "Copy the text"); b.type = "button";
    b.addEventListener("click", function () {
      navigator.clipboard.writeText(pre.textContent).then(function () { b.textContent = "Copied"; });
    });
    out.appendChild(b);
  });
})();
