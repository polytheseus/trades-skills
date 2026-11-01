// CIS tax refund estimator for UK subcontractors (sole traders).
// Runs in the browser and in node (module.exports) for tests. Nothing typed
// is sent anywhere.
// Rules checked 1 Nov 2026:
// gov.uk/what-you-must-do-as-a-cis-subcontractor (20% / 30% / gross; no
//   deductions from VAT or materials; deductions are advance payments of tax
//   and NI; sole traders claim them back on the Self Assessment return)
// gov.uk/income-tax-rates (PA £12,570, taper over £100,000; basic £37,700,
//   additional over £125,140; same for 2025/26 and 2026/27)
// gov.uk/scottish-income-tax (2025/26 and 2026/27 Scottish bands)
// gov.uk/government/publications/rates-and-allowances-national-insurance-contributions
//   (Class 4 6% £12,570-£50,270, 2% above; Class 2 SPT £6,845 / £7,105,
//   voluntary £3.50 / £3.65 a week)
// gov.uk/understand-self-assessment-bill/payments-on-account (none if the
//   bill is under £1,000 or more than 80% was paid at source)
// gov.uk/guidance/tax-free-allowances-on-property-and-trading-income (£1,000)
// Upkeep: add each new tax year to YEARS every April (and after each Budget,
// or Scottish Budget, check the bands).
(function () {
  var YEARS = {
    "2025-26": {
      label: "2025/26 (6 Apr 2025 to 5 Apr 2026, return due 31 Jan 2027)",
      pa: 12570, ruk: [[37700, 0.2], [125140, 0.4], [Infinity, 0.45]],
      scot: [[2827, 0.19], [14921, 0.2], [31092, 0.21], [62430, 0.42], [125140, 0.45], [Infinity, 0.48]],
      lpl: 12570, upl: 50270, c4main: 0.06, c4upper: 0.02, spt: 6845, c2week: 3.5
    },
    "2026-27": {
      label: "2026/27 (6 Apr 2026 to 5 Apr 2027, return due 31 Jan 2028)",
      pa: 12570, ruk: [[37700, 0.2], [125140, 0.4], [Infinity, 0.45]],
      scot: [[3967, 0.19], [16956, 0.2], [31092, 0.21], [62430, 0.42], [125140, 0.45], [Infinity, 0.48]],
      lpl: 12570, upl: 50270, c4main: 0.06, c4upper: 0.02, spt: 7105, c2week: 3.65
    }
  };
  var TRADING_ALLOWANCE = 1000;

  function r2(n) { return Math.round(n * 100) / 100; }
  function money(n) {
    var neg = n < 0; n = Math.abs(n);
    return (neg ? "-" : "") + "£" + n.toFixed(2).replace(/\.00$/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function num(v) {
    if (v === undefined || v === null || v === "") return 0;
    var n = Number(String(v).replace(/[£,\s]/g, ""));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function personalAllowance(y, income) {
    if (income <= 100000) return y.pa;
    return Math.max(0, y.pa - Math.floor((income - 100000) / 2));
  }
  function bandTax(bands, taxable) {
    var tax = 0, prev = 0, parts = [];
    for (var i = 0; i < bands.length && taxable > prev; i++) {
      var top = Math.min(taxable, bands[i][0]), amt = top - prev;
      tax += amt * bands[i][1];
      parts.push({ amount: amt, rate: bands[i][1], tax: amt * bands[i][1] });
      prev = bands[i][0];
    }
    return { tax: tax, parts: parts };
  }

  // inp: year, scotland (bool), gross (CIS gross pay), deducted (CIS taken),
  // otherSE (self-employed income not under CIS), expenses, otherIncome (job,
  // pension: taxable pay), otherTaxPaid (PAYE tax on it)
  function calc(inp) {
    var y = YEARS[inp.year] || YEARS["2025-26"];
    var gross = num(inp.gross), deducted = num(inp.deducted), otherSE = num(inp.otherSE);
    var expenses = num(inp.expenses), otherIncome = num(inp.otherIncome), otherTaxPaid = num(inp.otherTaxPaid);
    var notes = [], warn = [];

    var turnover = gross + otherSE;
    var useAllowance = expenses < TRADING_ALLOWANCE && turnover > 0;
    var deduction = useAllowance ? Math.min(TRADING_ALLOWANCE, turnover) : expenses;
    var profit = Math.max(0, turnover - deduction);
    var loss = !useAllowance && expenses > turnover ? expenses - turnover : 0;
    var total = profit + otherIncome;

    var pa = personalAllowance(y, total);
    var taxable = Math.max(0, total - pa);
    var it = bandTax(inp.scotland ? y.scot : y.ruk, taxable);
    var c4 = Math.max(0, Math.min(profit, y.upl) - y.lpl) * y.c4main + Math.max(0, profit - y.upl) * y.c4upper;
    var bill = r2(it.tax + c4);
    var paid = r2(deducted + otherTaxPaid);
    var balance = r2(bill - paid); // negative = refund

    // Payments on account for the next year (Income Tax + Class 4 only).
    var poa = 0, poaReason;
    if (balance < 1000) poaReason = balance <= 0 ? "refund" : "under1000";
    else if (paid > 0.8 * bill) poaReason = "mostlyAtSource";
    else { poaReason = "due"; poa = Math.floor(balance * 100 / 2) / 100; }

    if (useAllowance) notes.push("Your expenses are under £1,000, so this uses the £1,000 trading allowance instead (you can't claim both). If your real costs are higher, enter them.");
    if (loss > 0) notes.push("Your expenses are more than your income, a loss of " + money(r2(loss)) + ". A loss can be set against other income or carried forward: ask an accountant how to use it.");
    if (gross > 0 && deducted > gross * 0.3 + 0.5) warn.push("The deductions are more than 30% of your gross pay. Check the figures: contractors take 20% (30% if you're not verified) of the labour part only.");
    if (gross > 0 && deducted > 0 && deducted < gross * 0.05) notes.push("The deductions are under 5% of your gross pay. That's normal if most of the invoice was materials or you were paid gross; otherwise check your statements.");
    if (profit > 0 && profit < y.spt) notes.push("Profits under " + money(y.spt) + ": no National Insurance is due, but you may want to pay voluntary Class 2 (" + money(y.c2week) + " a week, " + money(r2(y.c2week * 52)) + " a year) to protect your State Pension record. That would reduce a refund.");
    if (total > 100000) notes.push("Income over £100,000 reduces the Personal Allowance (" + money(pa) + " here).");
    if (otherIncome > 0 && otherTaxPaid === 0) notes.push("You entered other income but no tax paid on it. If it was a PAYE job, put the tax from your P60 or P45 in that box.");

    return {
      year: inp.year in YEARS ? inp.year : "2025-26", yearLabel: y.label, scotland: !!inp.scotland,
      turnover: r2(turnover), deduction: r2(deduction), useAllowance: useAllowance, profit: r2(profit),
      total: r2(total), pa: pa, taxable: r2(taxable), incomeTax: r2(it.tax), bands: it.parts,
      class4: r2(c4), bill: bill, cis: r2(deducted), paye: r2(otherTaxPaid), paid: paid,
      balance: balance, refund: balance < 0 ? -balance : 0, owed: balance > 0 ? balance : 0,
      poa: poa, poaReason: poaReason, notes: notes, warn: warn
    };
  }

  function render(r) {
    var pct = function (x) { return (Math.round(x * 1000) / 10) + "%"; };
    var h = "";
    if (r.warn.length) h += r.warn.map(function (w) { return '<p class="cis-warn">' + w + "</p>"; }).join("");
    if (r.refund > 0) h += '<p class="cis-big">Estimated refund: <strong>' + money(r.refund) + "</strong></p>";
    else if (r.owed > 0) h += '<p class="cis-big">Estimated tax still to pay: <strong>' + money(r.owed) + "</strong></p>";
    else h += '<p class="cis-big">Your deductions cover the bill exactly: nothing to pay, no refund.</p>';
    h += '<table class="t"><tr><th colspan="2">' + r.yearLabel + (r.scotland ? ", Scottish rates" : "") + "</th></tr>";
    h += "<tr><td>Income from your trade</td><td>" + money(r.turnover) + "</td></tr>";
    h += "<tr><td>" + (r.useAllowance ? "Trading allowance" : "Allowable expenses") + "</td><td>-" + money(r.deduction) + "</td></tr>";
    h += "<tr><td><strong>Taxable profit</strong></td><td><strong>" + money(r.profit) + "</strong></td></tr>";
    if (r.total !== r.profit) h += "<tr><td>Plus other income</td><td>" + money(r2(r.total - r.profit)) + "</td></tr>";
    h += "<tr><td>Personal Allowance</td><td>-" + money(Math.min(r.pa, r.total)) + "</td></tr>";
    r.bands.forEach(function (b) {
      h += "<tr><td>Income Tax: " + money(r2(b.amount)) + " at " + pct(b.rate) + "</td><td>" + money(r2(b.tax)) + "</td></tr>";
    });
    h += "<tr><td>Class 4 National Insurance</td><td>" + money(r.class4) + "</td></tr>";
    h += "<tr><td><strong>Total tax and NI for the year</strong></td><td><strong>" + money(r.bill) + "</strong></td></tr>";
    h += "<tr><td>Less CIS deductions</td><td>-" + money(r.cis) + "</td></tr>";
    if (r.paye) h += "<tr><td>Less tax paid through PAYE</td><td>-" + money(r.paye) + "</td></tr>";
    h += "<tr><td><strong>" + (r.balance < 0 ? "Refund due" : "Still to pay") + "</strong></td><td><strong>" + money(Math.abs(r.balance)) + "</strong></td></tr></table>";
    if (r.poaReason === "due") h += '<p class="cis-warn">You may also have to make <strong>payments on account</strong> towards next year: about ' + money(r.poa) + " on 31 January and again on 31 July. CIS deductions on next year's work count towards them.</p>";
    else if (r.poaReason === "mostlyAtSource") h += "<p>No payments on account: more than 80% of your tax was already paid through CIS deductions and PAYE.</p>";
    else if (r.poaReason === "under1000") h += "<p>No payments on account: the amount left to pay is under £1,000.</p>";
    r.notes.forEach(function (n) { h += '<p class="small">' + n + "</p>"; });
    h += '<p class="small">An estimate from the figures you typed, not advice. It leaves out student loan repayments, Marriage Allowance, pension contributions, Gift Aid, savings and dividend income and partnership profits; HMRC\'s figure on your return is the one that counts.</p>';
    return h;
  }

  var api = { calc: calc, render: render, YEARS: YEARS, money: money };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  function v(id) { var el = document.getElementById(id); return el ? el.value : ""; }
  function run(e) {
    if (e) e.preventDefault();
    var out = document.getElementById("cis-out");
    if (!num(v("cis-gross")) && !num(v("cis-other-se"))) { out.innerHTML = '<p class="cis-warn">Enter your gross pay from your CIS statements first.</p>'; return; }
    var r = calc({
      year: v("cis-year"), scotland: v("cis-where") === "scot",
      gross: v("cis-gross"), deducted: v("cis-deducted"), otherSE: v("cis-other-se"),
      expenses: v("cis-expenses"), otherIncome: v("cis-job"), otherTaxPaid: v("cis-job-tax")
    });
    out.innerHTML = render(r);
  }
  function helper() {
    var lab = num(v("cis-labour")), rate = Number(v("cis-rate")) || 0.2;
    if (!lab) return;
    document.getElementById("cis-deducted").value = r2(lab * rate);
  }
  document.addEventListener("DOMContentLoaded", function () {
    var f = document.getElementById("cis-form");
    if (!f) return;
    f.addEventListener("submit", run);
    var b = document.getElementById("cis-fill");
    if (b) b.addEventListener("click", helper);
  });
})();
