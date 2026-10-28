// Invoice and receipt maker for UK trades, with a checker.
// Runs in the browser and in node (module.exports) for tests. Nothing typed
// is sent anywhere.
// Rules checked 28 Oct 2026:
// gov.uk/invoicing-and-taking-payment-from-customers: what an invoice must
//   include (unique number, your name/address/contact, customer name and
//   address, description, supply date, invoice date, amounts, VAT, total);
//   sole traders using a business name add their own name and an address for
//   legal documents; companies use the full registered name; if no payment
//   date is agreed the customer must pay within 30 days.
// legislation.gov.uk/uksi/2015/17 reg 25: companies show registered number,
//   part of the UK registered in and registered office on business letters,
//   order forms and websites.
// gov.uk VAT Notice 700 section 16: full VAT invoice contents (16.3.1);
//   simplified invoice for supplies of £250 or less (16.6.1).
// gov.uk VAT reverse charge technical guide, "Invoices and other VAT
//   documents": note that the reverse charge applies and the customer accounts
//   for the VAT, show the VAT amount but don't charge it; must include the
//   words "reverse charge". Doesn't apply to domestic customers, or to end
//   users who notify in writing.
// gov.uk/what-you-must-do-as-a-cis-subcontractor: deductions 20% registered,
//   30% unregistered, 0% gross; not taken from VAT, materials, plant hire,
//   consumables.
// legislation.gov.uk/ukpga/1998/20 s.4 (terms over 60 days: expressly agreed,
//   not grossly unfair).
// gov.uk/vat-registration/when-to-register (£90,000); gov.uk/vat-rates (20%,
//   5%).
// Upkeep: VAT threshold and rates each Budget; CIS rates if HMRC changes them.
(function () {
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DAY = 86400000;
  var VAGUE = [
    [/\betc\.?(\b|$)/i, "\"etc.\": list what you actually did"],
    [/\b(misc(ellaneous)?|sundries)\b/i, "\"miscellaneous\"/\"sundries\": name the items, or customers query it"],
    [/\bvarious\b/i, "\"various\": name them"],
    [/\bas (discussed|agreed|quoted)\b/i, "\"as discussed\": say what was done (or give the quote number)"],
    [/^(work|works|job|labour|materials|parts)\s*(done|carried out)?$/i, "a one-word line: say what work or which materials"],
    [/\b(tbc|tbd)\b/i, "TBC on an invoice: settle it before you send it"],
    [/\?/, "a question mark on an invoice: settle it before you send it"]
  ];
  var LABOUR = /\b(labou?r|fit(ting)?|install(ation|ing)?|hours?|hrs?|days?|call[- ]?out|work|repair|service|visit|time)\b/i;
  var MATERIAL = /\b(materials?|parts?|supply|supplied|radiators?|valves?|boiler|cable|pipe|tiles?|timber|paint|fixings|sundries|skip|hire|plant)\b/i;

  function num(v) {
    if (v === undefined || v === null || v === "") return null;
    var n = parseFloat(String(v).replace(/[£,\s]/g, ""));
    return isNaN(n) ? NaN : n;
  }
  function r2(n) { return Math.round(n * 100 + 1e-9) / 100; }
  function money(n) {
    var neg = n < 0; n = Math.abs(r2(n));
    var s = n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-£" : "£") + s;
  }
  function parseDate(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d) ? null : d;
  }
  function fmt(d) { return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function lines(s) { return String(s || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function pad(s, n) { s = String(s); return s.length >= n ? s + "  " : s + new Array(n - s.length + 1).join(" "); }

  // "Labour, 2 days | 2 x 160 | labour", "Radiators | 286.40", "Valves £42.50",
  // "TRVs | 4 @ 18.50 | materials". Kind is optional: labour, materials or other.
  function itemLine(s) {
    var parts = s.split("|").map(function (x) { return x.trim(); });
    var desc, amt, kind = "";
    if (parts.length >= 2) {
      desc = parts[0]; amt = parts[1];
      if (parts[2]) kind = parts[2].toLowerCase();
    } else {
      var m = /^(.*?)[\s:]*(£?\s*-?[\d,]+(?:\.\d+)?(?:\s*(?:x|×|@)\s*£?\s*[\d,]+(?:\.\d+)?)?)$/i.exec(s);
      if (!m || !m[1].trim()) return { desc: s, amount: NaN, kind: "" };
      desc = m[1].trim(); amt = m[2];
    }
    var qty = null, unit = null, amount;
    var q = /^(-?[\d.,]+)\s*(?:x|×|@)\s*£?\s*(-?[\d,]+(?:\.\d+)?)$/i.exec(String(amt).replace(/£/g, "").trim());
    if (q) { qty = num(q[1]); unit = num(q[2]); amount = r2(qty * unit); } else amount = num(amt);
    if (amount === null) amount = NaN;
    if (/^lab/.test(kind)) kind = "labour"; else if (/^mat|^part/.test(kind)) kind = "materials";
    else if (kind) kind = "other";
    return { desc: desc.replace(/[\s:,-]+$/, ""), amount: amount, qty: qty, unit: unit, kind: kind };
  }
  function guessKind(desc) {
    var lab = LABOUR.test(desc), mat = MATERIAL.test(desc);
    if (lab && !mat) return "labour";
    if (mat && !lab) return "materials";
    return "";
  }
  function validVatNo(s) { return /^(GB)?\s*(\d{3}\s*\d{4}\s*\d{2}|\d{3}\s*\d{4}\s*\d{2}\s*\d{3})$/i.test(String(s).trim()); }

  function build(o) {
    var warn = [], info = [];
    var paid = o.mode === "receipt";
    var items = lines(o.items).map(itemLine);
    var bad = items.filter(function (p) { return isNaN(p.amount); });
    if (!items.length) return { error: "Add at least one line: what you did or supplied, then the amount, e.g. \"Labour, 1 day | 320\"." };
    if (bad.length) return { error: "Couldn't find an amount on: \"" + bad[0].desc + "\". Put the amount at the end, e.g. \"Labour, 1 day | 320\" or \"TRVs | 4 x 18.50\"." };
    var date = parseDate(o.date);
    if (!date) return { error: "Add the invoice date." };
    var supply = parseDate(o.supplyDate);
    var vatMode = o.vat || "none";
    var vatNo = String(o.vatNo || "").trim();
    var structure = o.structure || "sole";
    var cust = o.customer || "homeowner";
    var cis = cust === "contractor" ? (o.cisRate === undefined || o.cisRate === "" ? 20 : +o.cisRate) : null;
    var number = String(o.number || "").trim();
    var biz = String(o.business || "").trim(), owner = String(o.owner || "").trim();

    // who you are
    if (!biz && !owner) warn.push("Add your name or business name.");
    if (structure === "sole" && biz && !owner) warn.push("Sole trader using a business name: gov.uk says the invoice must also show your own name.");
    if (!String(o.address || "").trim()) warn.push(structure === "sole" && biz ? "Add your address: as a sole trader using a business name you must give an address where legal documents can reach you." : "Add your business address.");
    if (structure === "ltd") {
      if (biz && !/\b(limited|ltd|plc|llp|cyf(yngedig)?)\.?$/i.test(biz)) warn.push("Limited company: use the full registered name, as on the certificate of incorporation (usually ending \"Limited\" or \"Ltd\").");
      if (!String(o.companyNo || "").trim()) warn.push("Add your company number, where it's registered (e.g. England and Wales) and the registered office address. Companies must show them on business letters and order forms, so most put them on invoices too.");
    }
    if (!String(o.contact || "").trim()) warn.push("Add a phone number or email, so they can query the invoice instead of ignoring it.");
    // customer
    if (!String(o.customerName || "").trim()) warn.push("Add the customer's name.");
    if (!String(o.customerAddress || "").trim()) warn.push("Add the customer's address (gov.uk lists it as a must).");
    // number and dates
    if (!number) warn.push("Add an invoice number. Each one must be unique; a simple sequence (INV-0001, INV-0002) is easiest.");
    else if (!/\d/.test(number)) warn.push("Invoice number \"" + number + "\" has no digits: use a sequence so each number is unique and gaps are easy to spot.");
    if (!supply) warn.push("Add the date the work was done or finished (the supply date). For VAT it's usually the tax point.");
    else {
      if (supply - date > 0) warn.push("The work date is after the invoice date. Invoice when the work is done, or call it a deposit or stage invoice.");
      if (date - supply > 60 * DAY) warn.push("This invoice is over 60 days after the work. Send invoices as soon as the job's done: late invoices get paid late." + (vatNo ? " VAT invoices should normally go out within 30 days of the tax point." : ""));
    }
    if (o.today) { var td = parseDate(o.today); if (td && date - td > 7 * DAY) warn.push("The invoice date is in the future. Date it the day you send it."); }

    // lines
    items.forEach(function (p) {
      VAGUE.forEach(function (v) { if (v[0].test(p.desc)) warn.push("\"" + p.desc + "\": " + v[1] + "."); });
      if (p.amount < 0 && !/\b(discount|deposit|less|credit|refund)\b/i.test(p.desc)) warn.push("\"" + p.desc + "\" is negative: label it (\"Less: deposit paid\", \"Discount\") so it's clear.");
      if (p.amount === 0) warn.push("\"" + p.desc + "\" is £0. Fine if it's a free extra (say \"no charge\"), otherwise add the amount.");
    });
    var sub = r2(items.reduce(function (s, p) { return s + p.amount; }, 0));
    if (sub <= 0) return { error: "The lines add up to " + money(sub) + ". For money back, issue a credit note rather than a negative invoice." };

    // VAT
    var vat = 0, vatRate = 0, total, rc = false, vatLine;
    if (vatMode === "add20" || vatMode === "add5") vatRate = vatMode === "add5" ? 5 : 20;
    if (vatMode === "rc") { vatRate = 20; rc = true; }
    if (vatMode !== "none" && !vatNo) warn.push("You can only charge VAT if you're VAT registered, and then your VAT number must be on the invoice. Add it, or pick \"Not VAT registered\".");
    if (vatNo && !validVatNo(vatNo)) warn.push("VAT number \"" + vatNo + "\" doesn't look like a UK one (GB then 9 digits, e.g. GB123456789). Check it.");
    if (vatMode === "none" && vatNo) warn.push("You've given a VAT number but no VAT. If you're registered you must charge VAT (or the reverse charge for CIS contractors) unless the work is zero-rated. Check the VAT setting.");
    if (rc && cust !== "contractor") warn.push("The construction reverse charge only applies when the customer is a VAT and CIS registered contractor (and not an end user). Homeowners and end users get a normal VAT invoice.");
    if (cust === "contractor" && vatNo && !rc && vatMode !== "none") warn.push("VAT-registered subcontractor billing a CIS contractor: construction work is usually under the domestic reverse charge, so don't add VAT unless they've told you in writing they're an end user. Pick \"Reverse charge\" if it applies.");
    if (vatRate === 5) info.push("5% VAT is for specific work only (for example some energy-saving installations once the zero rate ends, or certain residential conversions). Check HMRC's notice for the job before using it.");
    if (vatRate) {
      vat = r2(sub * vatRate / 100);
      total = rc ? sub : r2(sub + vat);
    } else total = sub;

    // CIS
    var labour = 0, materials = 0, other = 0, guessed = [], cisDed = 0;
    if (cis !== null) {
      items.forEach(function (p) {
        var k = p.kind || guessKind(p.desc);
        if (!p.kind) guessed.push(p.desc + " → " + (k || "labour"));
        if (k === "materials") materials += p.amount; else if (k === "other") other += p.amount; else labour += p.amount;
      });
      labour = r2(labour); materials = r2(materials); other = r2(other);
      cisDed = r2(labour * cis / 100);
      if (guessed.length) info.push("CIS: lines without \"| labour\" or \"| materials\" were sorted by their wording (" + guessed.join("; ") + "). Add \"| labour\" or \"| materials\" at the end of a line to set it.");
      if (cis && !materials) info.push("No materials lines: the contractor will take CIS off the whole amount. If you bought materials for the job, list them separately and keep the receipts, as the contractor may ask for them.");
      if ([0, 20, 30].indexOf(cis) < 0) warn.push("CIS deductions are 20% (registered), 30% (not registered) or 0% (gross payment status).");
    }

    var deposit = num(o.depositPaid);
    if (deposit !== null && (isNaN(deposit) || deposit < 0)) { warn.push("Deposit paid should be an amount, e.g. 150."); deposit = 0; }
    deposit = deposit || 0;
    var due = r2(total - cisDed - deposit);
    if (deposit > total) warn.push("The deposit is more than the invoice total. Check the figures.");

    var payDays = num(o.payDays);
    if (payDays === null) payDays = cust === "homeowner" ? 7 : 30;
    if (isNaN(payDays) || payDays < 0) { warn.push("Payment terms should be a number of days."); payDays = 30; }
    var dueDate = new Date(date.getTime() + payDays * DAY);
    if (!paid && cust === "homeowner" && payDays > 30) warn.push("Over 30 days for a homeowner is long. Most trades ask for payment on completion or within 7–14 days. Make sure it matches what your quote said.");
    if (!paid && cust !== "homeowner" && payDays > 60) warn.push("Over 60 days for a business customer is long. Under the late payment law, terms over 60 days only count if they were expressly agreed and aren't grossly unfair to you.");
    var bank = String(o.payment || "").trim();
    if (!paid && !bank) warn.push("Add how to pay (bank name, sort code, account number, and the invoice number as the reference). It's the most common reason an invoice sits unpaid.");
    if (!paid && bank && /\b\d{2}-?\d{2}-?\d{2}\b/.test(bank) && !/(^|\D)\d{8}(\D|$)/.test(bank.replace(/\s/g, ""))) warn.push("Payment details: there's a sort code but no 8-digit account number.");

    if (!vatNo && vatMode === "none") info.push("Not VAT registered: the invoice says so, so they don't expect VAT. You must register if your taxable turnover passes £90,000 in a rolling 12 months.");
    if (vatNo && !rc && total <= 250) info.push("For £250 or less (including VAT) you could give a simplified VAT invoice if the customer agrees. This full one works for any amount.");
    if (cust !== "homeowner" && !paid) info.push("Business customer: if they pay late you can add statutory interest (8% over Bank Rate) and £40–£100 compensation. Our late payment calculator works it out.");
    if (cust === "homeowner" && !paid) info.push("Homeowner: you can only add late-payment interest if your quote or terms said so before the work started.");
    if (o.quoteRef && !/\d/.test(o.quoteRef)) info.push("Quote reference has no number: use the quote number so they can match it.");

    // build the text
    var L = [], doc = paid ? "RECEIPT" : (vatNo ? "VAT INVOICE" : "INVOICE");
    var head = biz || owner;
    L.push(head + (structure === "sole" && biz && owner ? " (" + owner + " trading as " + biz + ")" : ""));
    if (o.address) L.push(String(o.address).trim());
    if (o.contact) L.push(String(o.contact).trim());
    if (vatNo) L.push("VAT reg. no. " + vatNo);
    if (structure === "ltd" && o.companyNo) L.push("Company no. " + String(o.companyNo).trim());
    L.push("");
    L.push(doc + "  No. " + (number || "[number]") + "    Date: " + fmt(date) + (supply ? "    Work done: " + fmt(supply) : ""));
    L.push("Bill to: " + (String(o.customerName || "").trim() || "[customer]") + (o.customerAddress ? ", " + String(o.customerAddress).trim() : ""));
    if (o.jobAddress && String(o.jobAddress).trim() && String(o.jobAddress).trim() !== String(o.customerAddress || "").trim()) L.push("Job address: " + String(o.jobAddress).trim());
    if (o.quoteRef) L.push("Your quote: " + String(o.quoteRef).trim());
    if (o.summary) { L.push(""); L.push(String(o.summary).trim()); }
    L.push("");
    var shown = items.map(function (p) { return p.desc + (p.qty !== null ? " (" + p.qty + " x " + money(p.unit) + ")" : ""); });
    var labels = shown.concat(cis !== null ? ["Less CIS deduction at " + cis + "% of labour"] : [], vatRate ? ["Subtotal (excluding VAT)"] : []);
    var w = Math.max(32, Math.min(52, labels.reduce(function (m, d) { return Math.max(m, d.length); }, 0) + 2));
    items.forEach(function (p, i) {
      var d = shown[i];
      L.push("   " + pad(d, w) + money(p.amount) + (vatRate && !rc ? "   VAT " + vatRate + "%" : ""));
    });
    if (vatRate || cis !== null || deposit) L.push("   " + pad("Subtotal" + (vatRate ? " (excluding VAT)" : ""), w) + money(sub));
    if (vatRate && !rc) { L.push("   " + pad("VAT at " + vatRate + "%", w) + money(vat)); L.push("   " + pad("TOTAL", w) + money(total)); }
    if (rc) {
      L.push("   " + pad("VAT", w) + "£0.00");
      L.push("   " + pad("TOTAL", w) + money(total));
      L.push("   Reverse charge: customer to pay the VAT to HMRC. VAT Act 1994 Section 55A applies.");
      L.push("   VAT due under the reverse charge: " + money(vat) + " at " + vatRate + "%.");
    }
    if (!vatRate) { L.push("   " + pad("TOTAL", w) + money(total)); L.push("   No VAT: " + (vatNo ? "no VAT charged on this work." : "we're not VAT registered.")); }
    if (cis !== null) {
      L.push("");
      L.push("   CIS: labour " + money(labour) + ", materials " + money(materials) + (other ? ", other " + money(other) : ""));
      L.push("   " + pad("Less CIS deduction at " + cis + "% of labour", w) + money(-cisDed));
    }
    if (deposit) L.push("   " + pad("Less deposit paid", w) + money(-deposit));
    if (deposit || cis !== null) L.push("   " + pad(paid ? "PAID" : "AMOUNT DUE", w) + money(due));
    L.push("");
    if (paid) {
      L.push("PAID IN FULL" + (o.paidOn ? " on " + (parseDate(o.paidOn) ? fmt(parseDate(o.paidOn)) : o.paidOn) : " on " + fmt(date)) + (o.paidBy ? " by " + String(o.paidBy).trim() : "") + ". Thank you.");
    } else {
      L.push("Payment due: " + (payDays === 0 ? "on receipt (" + fmt(date) + ")" : "by " + fmt(dueDate) + " (" + payDays + " days)") + ".");
      if (bank) L.push("How to pay: " + bank + (number && bank.indexOf(number) < 0 ? ". Please use " + number + " as the reference." : ""));
    }
    if (o.guarantee) L.push("Guarantee: " + String(o.guarantee).trim() + ".");
    if (structure === "ltd" && (o.companyNo || o.regOffice)) {
      L.push("");
      L.push((biz || "[company name]") + ". Registered in " + (String(o.regIn || "").trim() || "England and Wales") + (o.companyNo ? ", company no. " + String(o.companyNo).trim() : "") + (o.regOffice ? ". Registered office: " + String(o.regOffice).trim() : "") + ".");
    }

    var cname = String(o.customerName || "").trim();
    var company = cust === "contractor" || /\b(ltd|limited|plc|llp|group|services|homes|construction|properties|council|school|trust)\b/i.test(cname);
    var first = cname.split(/\s+/)[0] || "there";
    var hi = company ? "Hello, " : "Hi " + first + ", ";
    var cover = paid
      ? hi + "thanks for your payment of " + money(due) + ". Your receipt (" + (number || "[number]") + ") is attached. Any problems with the work, just let me know."
      : hi + (company ? "please find attached invoice " : "thanks for having us. Here's invoice ") + (number || "[number]") + " for " + (o.summary ? String(o.summary).trim().replace(/\.$/, "").replace(/^./, function (c) { return c.toLowerCase(); }) : "the work") + ": " + money(due) + ", due " + (payDays === 0 ? "today" : "by " + fmt(dueDate)) + ". " + (bank ? "Bank details are on the invoice; please use " + (number || "the invoice number") + " as the reference. " : "") + "Any questions, just ask.";

    return { text: L.join("\n"), cover: cover, sub: sub, vat: vat, total: total, cis: cisDed, labour: labour,
      materials: materials, due: due, dueDate: fmt(dueDate), warn: warn, info: info, items: items };
  }

  var api = { build: build, itemLine: itemLine, validVatNo: validVatNo, money: money };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) { var e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
  function sync() {
    $("im-ltd").hidden = $("im-structure").value !== "ltd";
    $("im-cis-wrap").hidden = $("im-customer").value !== "contractor";
    $("im-paid-wrap").hidden = $("im-mode").value !== "receipt";
    $("im-terms-wrap").hidden = $("im-mode").value === "receipt";
  }
  document.addEventListener("DOMContentLoaded", function () {
    if (!$("im-form")) return;
    var t = new Date().toISOString().slice(0, 10);
    $("im-date").value = t; $("im-supply").value = t;
    sync();
    ["im-structure", "im-customer", "im-mode"].forEach(function (id) { $(id).addEventListener("change", sync); });
    $("im-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var out = $("im-out"); out.textContent = "";
      var mode = $("im-mode").value;
      var res = build({
        mode: mode, structure: $("im-structure").value, business: $("im-business").value, owner: $("im-owner").value,
        address: $("im-address").value, contact: $("im-contact").value, vatNo: $("im-vatno").value,
        companyNo: $("im-cono").value, regIn: $("im-regin").value, regOffice: $("im-regoff").value,
        customer: $("im-customer").value, cisRate: $("im-cis").value, customerName: $("im-cust").value,
        customerAddress: $("im-custaddr").value, jobAddress: $("im-jobaddr").value, number: $("im-num").value,
        date: $("im-date").value, supplyDate: $("im-supply").value, quoteRef: $("im-quote").value,
        summary: $("im-summary").value, items: $("im-items").value, vat: $("im-vat").value,
        depositPaid: $("im-dep").value, payDays: $("im-pay").value, payment: $("im-bank").value,
        guarantee: $("im-guar").value, paidOn: $("im-paidon").value, paidBy: $("im-paidby").value, today: t
      });
      if (res.error) { out.appendChild(el("p", res.error, "li-err")); return; }
      var word = mode === "receipt" ? "receipt" : "invoice";
      out.appendChild(el("h3", res.warn.length ? "Check these before you send it (" + res.warn.length + ")" : "No problems found"));
      if (res.warn.length) { var ul = el("ul", null, "li-warn qm-list"); res.warn.forEach(function (w) { ul.appendChild(el("li", w)); }); out.appendChild(ul); }
      if (res.info.length) { var ui = el("ul", null, "qm-info qm-list"); res.info.forEach(function (w) { ui.appendChild(el("li", w)); }); out.appendChild(ui); }
      out.appendChild(el("h3", "Your " + word));
      var pre = el("pre", res.text, "email qm-doc"); out.appendChild(pre);
      var b1 = el("button", "Copy the " + word); b1.type = "button";
      b1.addEventListener("click", function () { navigator.clipboard.writeText(pre.textContent).then(function () { b1.textContent = "Copied"; }); });
      var b2 = el("button", "Download .txt"); b2.type = "button";
      b2.addEventListener("click", function () {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([pre.textContent], { type: "text/plain" }));
        a.download = ($("im-num").value.trim() || word) + ".txt"; a.click();
      });
      var b3 = el("button", "Print or save as PDF"); b3.type = "button";
      b3.addEventListener("click", function () { window.print(); });
      out.appendChild(b1); out.appendChild(b2); out.appendChild(b3);
      out.appendChild(el("h3", "Message to send with it"));
      var pc = el("pre", res.cover, "email"); out.appendChild(pc);
      var b4 = el("button", "Copy the message"); b4.type = "button";
      b4.addEventListener("click", function () { navigator.clipboard.writeText(pc.textContent).then(function () { b4.textContent = "Copied"; }); });
      out.appendChild(b4);
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();
