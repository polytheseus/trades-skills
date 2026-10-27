// Quote and estimate maker for UK trades, with a checker.
// Runs in the browser and in node (module.exports) for tests. Nothing typed
// is sent anywhere.
// Rules checked 27 Oct 2026:
// legislation.gov.uk/uksi/2013/3134 (Consumer Contracts Regulations 2013):
//   reg 7(4) off-premises contracts of £42 or less are exempt from Part 2;
//   reg 30(2) 14 days for service contracts; reg 31 extended by up to 12 months
//   if cancellation information isn't given; reg 36 work in the cancellation
//   period needs an express request, on a durable medium if off-premises, and
//   the customer pays a proportionate amount if they cancel;
//   reg 28(1)(e) no cancellation right for a visit the consumer asked for to
//   carry out urgent repairs or maintenance.
// legislation.gov.uk/ukpga/2015/15/section/50 (what you say or write is binding)
//   and section/51 (no price agreed: a reasonable price).
// gov.uk/vat-registration/when-to-register (£90,000 threshold);
// gov.uk notice 708/6 (energy-saving materials zero-rated to 31 March 2027).
// Upkeep: VAT threshold and standard rate each Budget; the energy-saving
// materials note expires 31 March 2027 (reverts to 5%).
(function () {
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DAY = 86400000;
  var EXCLUSIONS = {
    all: ["Redecoration after the work (we make good to a ready-to-paint finish only)",
      "Moving furniture or clearing the work area",
      "Hidden problems found once opened up (rot, damaged pipes or cables, asbestos): we'll stop, show you and price them before doing anything",
      "Work outside normal hours (8am to 5pm, Monday to Friday)",
      "Building control, planning or skip permit fees"],
    plumbing: ["System flush or powerflush", "Replacing radiator valves or pipework not listed above",
      "Upgrading the gas supply pipe", "Boxing in or tiling around new pipework"],
    electrical: ["Remedial work found during testing (we'll report it and price it separately)",
      "Plastering and painting after chasing in cables", "Fittings, lamps or appliances not listed above"],
    building: ["Structural engineer, architect or party wall surveyor fees",
      "Unexpected ground conditions (soft ground, tree roots, old foundations)",
      "Removing hazardous waste"],
    roofing: ["Replacing rotten rafters or joists found once the roof is stripped",
      "Scaffolding beyond the period stated", "Gutters, fascias and soffits unless listed above"],
    decorating: ["Paint and materials unless listed above", "Filling beyond minor cracks",
      "Stripping wallpaper", "Ceilings and woodwork unless listed above"],
    landscaping: ["Removing waste soil beyond the amount stated", "Rubble or buried services found when digging",
      "Watering and aftercare once the job is handed over"],
    carpentry: ["Painting or finishing unless listed above", "Ironmongery not listed above",
      "Making good plaster or flooring around new work"],
    general: []
  };
  var VAGUE = [
    [/\betc\.?(\b|$)/i, "\"etc.\" lets the customer read anything into it: list each item"],
    [/\bas (required|needed|necessary)\b/i, "\"as required\" has no limit: say how many or how much"],
    [/\bvarious\b/i, "\"various\": name them"],
    [/\bmisc(ellaneous)?\b/i, "\"miscellaneous\": name the items"],
    [/\bsort(ing)? out\b/i, "\"sort out\" doesn't say what you'll do"],
    [/\b(general|minor) (works?|repairs?|jobs?|bits)\b/i, "\"general/minor works\": list the actual jobs"],
    [/\b(tbc|tbd)\b/i, "TBC: price or describe it now, or move it to exclusions"],
    [/\bmake good\b(?!.*\b(ready|finish|paint|plaster|fill))/i, "\"make good\": say to what finish (e.g. ready to paint)"],
    [/\bwhatever\b/i, "\"whatever\": say exactly what"],
    [/\?/, "a question mark in the scope: settle it before sending"]
  ];

  function num(v) {
    if (v === undefined || v === null || v === "") return null;
    var n = Number(String(v).replace(/[£,\s]/g, ""));
    return isFinite(n) ? n : NaN;
  }
  function money(n) {
    var neg = n < 0; n = Math.abs(n);
    return (neg ? "-£" : "£") + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function parse(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCMonth() === p[1] - 1 ? d : null;
  }
  function fmt(d) { return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function lines(s) {
    return String(s || "").split(/\r?\n/).map(function (l) { return l.replace(/^\s*[-*•\d.)]+\s*/, "").trim(); })
      .filter(Boolean);
  }
  function r2(n) { return Math.round(n * 100) / 100; }

  // "Labour, 2 days | 640" or "Labour, 2 days £640" -> {desc, amount}
  function priceLine(l) {
    var m = l.match(/^(.*?)[\s|:=–-]*£?\s*(-?[\d,]+(?:\.\d{1,2})?)\s*$/);
    if (!m || !m[1].trim()) return { desc: l, amount: NaN };
    return { desc: m[1].replace(/[\s|:=–-]+$/, "").trim(), amount: num(m[2]) };
  }

  function build(o) {
    var warn = [], info = [], err = [];
    var date = parse(o.date) || new Date(Date.UTC(2026, 9, 27));
    var validDays = num(o.validDays); if (validDays === null || isNaN(validDays) || validDays < 1) validDays = 30;
    var until = new Date(date.getTime() + validDays * DAY);
    var estimate = o.kind === "estimate";
    var consumer = o.customer !== "business";
    var scope = lines(o.scope);
    var prices = lines(o.prices).map(priceLine);
    var bad = prices.filter(function (p) { return isNaN(p.amount); });
    if (!scope.length) err.push("Add at least one line to the scope of work.");
    if (!prices.length) err.push("Add at least one price line, e.g. \"Labour, 2 days | 640\".");
    if (bad.length) err.push("Couldn't read an amount on: " + bad.map(function (p) { return "\"" + p.desc + "\""; }).join(", ") + ". Put the amount at the end, e.g. \"Materials | 385.50\".");
    var deposit = num(o.depositPct); if (deposit === null) deposit = 0;
    if (isNaN(deposit) || deposit < 0 || deposit > 100) err.push("Deposit must be a percentage from 0 to 100.");
    var ceiling = num(o.ceiling);
    if (isNaN(ceiling)) err.push("The estimate's upper limit isn't a number.");
    if (err.length) return { error: err.join(" ") };

    var sub = r2(prices.reduce(function (s, p) { return s + p.amount; }, 0));
    var vat = o.vat === "add" ? r2(sub * 0.2) : 0;
    var total = r2(sub + vat);
    var depAmt = r2(total * deposit / 100);
    var payDays = num(o.payDays); if (payDays === null || isNaN(payDays) || payDays < 0) payDays = consumer ? 7 : 30;

    // Checks
    scope.forEach(function (l, i) {
      VAGUE.forEach(function (v) { if (v[0].test(l)) warn.push("Scope line " + (i + 1) + ": " + v[1] + "."); });
      if (l.split(/\s+/).length < 4) warn.push("Scope line " + (i + 1) + " (\"" + l + "\") is very short: could a stranger tick it off? Add sizes, quantities or what's included.");
    });
    var excl = (o.exclusions || []).concat(lines(o.extraExclusions));
    if (!excl.length) warn.push("No exclusions. Most arguments are about what the customer assumed was included: pick the ones that fit this job.");
    if (!estimate && /\b(approx(imately)?|around|roughly|estimated|circa|ish)\b/i.test(o.scope + " " + o.prices))
      warn.push("It's labelled a quote (fixed price) but uses words like \"approx\" or \"around\". If the price could change, make it an estimate with an upper limit.");
    if (estimate && ceiling === null) warn.push("An estimate with no upper limit gives the customer no idea of the worst case. Add one and say you'll call before going over it.");
    if (estimate && ceiling !== null && ceiling < total) warn.push("The upper limit (" + money(ceiling) + ") is below the estimate total (" + money(total) + ").");
    if (sub <= 0) warn.push("The total is " + money(total) + ". Check the price lines.");
    if (consumer && deposit > 50) warn.push("A " + deposit + "% deposit from a homeowner is high: customers worry about paying most of it upfront, and an unfair term can't be enforced against a consumer. Many trades cover materials only, or use stage payments.");
    else if (consumer && deposit > 25) info.push("A " + deposit + "% deposit: fine if it covers materials you're buying for this job. Say what it's for.");
    if (o.vat === "add" && !String(o.vatNo || "").trim()) warn.push("You're adding VAT but haven't entered a VAT number. Only VAT-registered businesses can charge VAT, and the number must be on the VAT invoice.");
    if (o.vat === "none" && String(o.vatNo || "").trim()) warn.push("You've entered a VAT number but chosen \"not VAT registered\".");
    if (o.vat === "add" && ["plumbing", "electrical", "roofing", "building"].indexOf(o.trade) > -1)
      info.push("Installing energy-saving materials in a home (heat pumps, solar panels, insulation, some heating controls) is zero-rated for VAT until 31 March 2027, then 5%. Check HMRC notice 708/6 if any of this job qualifies.");
    if (!String(o.business || "").trim()) warn.push("Add your business name and contact details at the top.");
    if (!String(o.customerName || "").trim()) warn.push("Add the customer's name and the job address.");

    // Cancellation rights (homeowners, England, Wales, Scotland and NI)
    var cancel = null;
    if (consumer && o.where === "home" && total > 42) {
      cancel = "home";
      info.push("Agreed at the customer's home, over £42: they have 14 days to cancel. Give them the cancellation information and a cancellation form with the quote, or the 14 days can stretch to 12 months. If they want you to start sooner, get that request in writing (a text or email is fine); if they then cancel, they pay for the work done so far.");
    } else if (consumer && o.where === "distance" && total > 42) {
      cancel = "distance";
      info.push("Agreed by phone, email or online with a homeowner: if you regularly take work this way without meeting at the property, the 14-day cancellation right usually applies too. Check Business Companion's guidance on distance contracts.");
    } else if (consumer && o.where === "urgent") {
      info.push("An urgent repair the customer called you out for has no 14-day cancellation right. Extra work you offer while you're there may be different: check before adding it to the same job.");
    }

    // Text
    var L = [], doc = estimate ? "ESTIMATE" : "QUOTE";
    var head = [o.business, o.contact, o.vatNo ? "VAT no. " + o.vatNo : ""].map(function (s) { return String(s || "").trim(); }).filter(Boolean);
    if (head.length) L.push(head.join(" · "), "");
    L.push(doc + (o.number ? "  No. " + o.number : "") + "    Date: " + fmt(date) + "    Valid until: " + fmt(until));
    L.push("For: " + (String(o.customerName || "").trim() || "[customer name]") + (String(o.address || "").trim() ? "    Job address: " + o.address.trim() : ""));
    L.push("");
    var n = 1;
    if (String(o.summary || "").trim()) { L.push(n++ + ". The job", "   " + o.summary.trim(), ""); }
    L.push(n++ + ". What's included");
    scope.forEach(function (l, i) { L.push("   " + (i + 1) + ". " + l); });
    L.push("");
    if (excl.length) {
      L.push(n++ + ". Not included");
      excl.forEach(function (l) { L.push("   - " + l); });
      L.push("");
    }
    var assume = lines(o.assumptions);
    if (assume.length) {
      L.push(n++ + ". This price assumes");
      assume.forEach(function (l) { L.push("   - " + l); });
      L.push("");
    }
    L.push(n++ + ". Price");
    var w = Math.max.apply(null, prices.map(function (p) { return p.desc.length; }).concat([18]));
    function row(a, b) { return "   " + a + new Array(Math.max(2, w + 4 - a.length)).join(" ") + b; }
    prices.forEach(function (p) { L.push(row(p.desc, money(p.amount))); });
    if (o.vat === "add") { L.push(row("Subtotal", money(sub)), row("VAT at 20%", money(vat))); }
    L.push(row(estimate ? "ESTIMATED TOTAL" : "TOTAL", money(total)));
    if (o.vat === "none") L.push("   No VAT: we're not VAT registered.");
    if (o.vat === "incl") L.push("   All prices include VAT.");
    if (estimate) {
      L.push("   This is an estimate, not a fixed price. The final bill depends on what we find once work starts.");
      if (ceiling !== null) L.push("   We won't go over " + money(ceiling) + " without your agreement first.");
    }
    L.push("");
    L.push(n++ + ". Payment");
    if (deposit > 0) L.push("   Deposit: " + money(depAmt) + " (" + deposit + "%)" + (String(o.depositFor || "").trim() ? ", for " + o.depositFor.trim() : "") + ", due when you accept.");
    L.push("   " + (deposit > 0 ? "Balance" : "Full amount") + ": due " + (payDays === 0 ? "on completion" : "within " + payDays + " days of completion") + ". Bank transfer to [sort code, account number, reference].");
    L.push("");
    L.push(n++ + ". Changes and extra work",
      "   Any change to the work above will be agreed in writing, with a price, before we do it.", "");
    if (String(o.guarantee || "").trim()) L.push(n++ + ". Guarantee", "   " + o.guarantee.trim(), "");
    if (cancel === "home" || cancel === "distance")
      L.push(n++ + ". Your right to cancel",
        "   You can cancel this contract within 14 days of accepting it, without giving a reason. See the attached cancellation information and form.",
        "   If you'd like us to start within the 14 days, please tell us in writing. If you then cancel, you'll pay for the work done up to that point.", "");
    L.push(n++ + ". To go ahead",
      "   Reply to this " + (o.number ? "quote (" + o.number + ")" : "message") + " saying \"I accept\", or sign below. This " + doc.toLowerCase() + " is valid until " + fmt(until) + ".",
      "", "   Signed: ____________________    Date: __________");

    var first = String(o.customerName || "").trim().split(/\s+/)[0] || "[name]";
    var cover = "Hi " + first + ", thanks for showing me the job. Here's my " + doc.toLowerCase() +
      (o.number ? " (" + o.number + ")" : "") + " for the job we discussed: " +
      (estimate ? "estimated at " : "") + money(total) + (o.vat === "add" ? " including VAT" : "") +
      ". It lists what's included and what isn't, so there are no surprises. It's valid until " + fmt(until) +
      ". Any questions, just ask. To go ahead, reply \"I accept\"" + (deposit > 0 ? " and I'll send the details for the " + money(depAmt) + " deposit." : ".");

    return { text: L.join("\n"), cover: cover, sub: sub, vat: vat, total: total, deposit: depAmt,
      until: fmt(until), warn: warn, info: info, cancel: cancel };
  }

  var api = { build: build, priceLine: priceLine, EXCLUSIONS: EXCLUSIONS };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) { var e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
  function drawExclusions() {
    var box = $("qm-excl"); box.textContent = "";
    EXCLUSIONS.all.concat(EXCLUSIONS[$("qm-trade").value] || []).forEach(function (t, i) {
      var lab = el("label"), cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = t; cb.id = "qm-ex" + i;
      lab.className = "qm-check"; lab.appendChild(cb); lab.appendChild(document.createTextNode(" " + t));
      box.appendChild(lab);
    });
  }
  function sync() {
    $("qm-ceiling-wrap").hidden = $("qm-kind").value !== "estimate";
    $("qm-where-wrap").hidden = $("qm-customer").value === "business";
  }
  document.addEventListener("DOMContentLoaded", function () {
    if (!$("qm-form")) return;
    var t = new Date(); $("qm-date").value = t.toISOString().slice(0, 10);
    drawExclusions(); sync();
    $("qm-trade").addEventListener("change", drawExclusions);
    $("qm-kind").addEventListener("change", sync);
    $("qm-customer").addEventListener("change", sync);
    $("qm-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var out = $("qm-out"); out.textContent = "";
      var ex = Array.prototype.slice.call(document.querySelectorAll("#qm-excl input:checked")).map(function (c) { return c.value; });
      var res = build({
        business: $("qm-business").value, contact: $("qm-contact").value, vatNo: $("qm-vatno").value,
        customerName: $("qm-cust").value, address: $("qm-addr").value, number: $("qm-num").value.trim(),
        date: $("qm-date").value, validDays: $("qm-valid").value, kind: $("qm-kind").value,
        ceiling: $("qm-ceiling").value, customer: $("qm-customer").value, where: $("qm-where").value,
        trade: $("qm-trade").value, summary: $("qm-summary").value, scope: $("qm-scope").value,
        exclusions: ex, extraExclusions: $("qm-extra").value, assumptions: $("qm-assume").value,
        prices: $("qm-prices").value, vat: $("qm-vat").value, depositPct: $("qm-dep").value,
        depositFor: $("qm-depfor").value, payDays: $("qm-pay").value, guarantee: $("qm-guar").value
      });
      if (res.error) { out.appendChild(el("p", res.error, "li-err")); return; }
      out.appendChild(el("h3", res.warn.length ? "Check these before you send it (" + res.warn.length + ")" : "No problems found"));
      if (res.warn.length) { var ul = el("ul", null, "li-warn qm-list"); res.warn.forEach(function (w) { ul.appendChild(el("li", w)); }); out.appendChild(ul); }
      if (res.info.length) { var ui = el("ul", null, "qm-info qm-list"); res.info.forEach(function (w) { ui.appendChild(el("li", w)); }); out.appendChild(ui); }
      out.appendChild(el("h3", "Your " + ($("qm-kind").value === "estimate" ? "estimate" : "quote")));
      var pre = el("pre", res.text, "email qm-doc"); out.appendChild(pre);
      var b1 = el("button", "Copy the quote"); b1.type = "button";
      b1.addEventListener("click", function () { navigator.clipboard.writeText(pre.textContent).then(function () { b1.textContent = "Copied"; }); });
      var b2 = el("button", "Download .txt"); b2.type = "button";
      b2.addEventListener("click", function () {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([pre.textContent], { type: "text/plain" }));
        a.download = ($("qm-num").value.trim() || "quote") + ".txt"; a.click();
      });
      var b3 = el("button", "Print"); b3.type = "button";
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
