// Price increase letter writer and checker for trades and local service businesses,
// plus a minimum day rate check. Runs in the browser and in node (module.exports)
// for tests. Nothing typed is sent anywhere.
// Rules checked 30 Oct 2026:
// CMA37 Unfair contract terms guidance (updated 22 July 2026), paras 6.52-6.55:
//   price variation terms in consumer contracts are more likely to be fair with
//   an objective justification, specified level/timing, and "sufficient and
//   effective advance notice" so the consumer can avoid the rise by ending the
//   contract, with a genuine, penalty-free exit. Consumer Rights Act 2015,
//   Sch. 2 Part 1 (grey list): raising the price without a right to cancel.
// No statutory notice period for most small service businesses: 30 days is
//   good practice, and the customer's terms or contract come first.
// Upkeep: none time-bound. Re-check CMA37 if it is revised.
(function () {
  var GROUPS = {
    recurring: "Recurring-service customers (cleaning, gardening, windows, servicing)",
    regular: "Regular customers who book jobs now and then",
    agent: "Landlords and letting agents",
    commercial: "Commercial accounts"
  };
  var FREQ = { weekly: 52, fortnightly: 26, "every four weeks": 13, monthly: 12, quarterly: 4, "every six months": 2, yearly: 1 };
  var UNITS = { item: "", hour: " an hour", day: " a day", visit: " a visit", month: " a month" };
  var REASONS = { materials: "materials", fuel: "fuel", insurance: "insurance", wages: "wages", tools: "tools and equipment", fees: "scheme and certification fees" };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function first(s) { return clean(s).split(" ")[0] || ""; }
  function words(s) { var m = clean(s).match(/\S+/g); return m ? m.length : 0; }
  function num(s) { var n = parseFloat(String(s == null ? "" : s).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : NaN; }
  function money(cur, n) {
    if (!isFinite(n)) return "";
    var s = Math.round(n * 100) % 100 ? n.toFixed(2) : String(Math.round(n));
    return (cur || "£") + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function parseDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(s)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; }
  function fmtDate(t, us) {
    if (!isFinite(t)) return "";
    var d = new Date(t);
    return us ? MONTHS[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear() : d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function list(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
  function stripThe(s) { return lcFirst(clean(s).replace(/^(your|our|the|my)\s+/i, "")); }
  function lcFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  // o: {group, customer, owner, business, contact, cur, service, unit, freq, oldPrice, newPrice,
  //     effective (YYYY-MM-DD), today (YYYY-MM-DD), since (year customer started), lastReview (year),
  //     reasons [keys of REASONS], other (free-text reason), kept, vat ("inc"|"ex"|"none"), format ("email"|"letter")}
  function build(o) {
    var group = o.group in GROUPS ? o.group : "regular";
    var cur = o.cur || "£", us = cur === "$";
    var oldP = num(o.oldPrice), newP = num(o.newPrice);
    var eff = parseDate(o.effective), today = parseDate(o.today);
    var date = fmtDate(eff, us) || "[date]";
    var name = first(o.customer), owner = first(o.owner), biz = clean(o.business), contact = clean(o.contact);
    var service = stripThe(o.service) || "[service]";
    var unit = UNITS[o.unit] != null ? UNITS[o.unit] : "";
    var freq = o.freq in FREQ ? o.freq : "";
    var domestic = group === "recurring" || group === "regular";
    var vat = o.vat === "inc" || o.vat === "ex" ? o.vat : "none";
    var vatSfx = vat === "inc" && domestic ? " including VAT" : vat === "ex" && !domestic ? " plus VAT" : vat === "inc" && !domestic ? " including VAT" : "";
    var oldS = isFinite(oldP) ? money(cur, oldP) : "[current price]", newS = isFinite(newP) ? money(cur, newP) : "[new price]";
    var thisYear = isFinite(today) ? new Date(today).getUTCFullYear() : new Date().getUTCFullYear();
    var since = parseInt(o.since, 10), last = parseInt(o.lastReview, 10);
    var notes = [], info = [];

    // the numbers, for the owner
    var pct = isFinite(oldP) && isFinite(newP) && oldP > 0 ? (newP - oldP) / oldP * 100 : NaN;
    var notice = isFinite(eff) && isFinite(today) ? Math.round((eff - today) / 86400000) : NaN;
    if (isFinite(pct)) {
      info.push("That's a rise of " + money(cur, newP - oldP) + unit + " (" + (Math.round(pct * 10) / 10) + "%).");
      if (group === "recurring" && freq) info.push("At " + FREQ[freq] + " visit" + (FREQ[freq] === 1 ? "" : "s") + " a year, it's " + money(cur, (newP - oldP) * FREQ[freq]) + " a year more from this customer: " + money(cur, oldP * FREQ[freq]) + " → " + money(cur, newP * FREQ[freq]) + ".");
      if (pct <= 0) notes.push("The new price isn't higher than the current one. Check the two prices.");
      if (pct > 20 && group === "recurring") notes.push("A rise over 20% for a long-standing recurring customer is a lot in one go. Think about phasing it: half now, half in six months, and say both dates in this message.");
    }
    if (isFinite(notice)) {
      if (notice < 0) notes.push("The start date is in the past. A price rise can only apply to work booked or done after you've told the customer.");
      else if (notice < 30 && group !== "regular") notes.push("Only " + notice + " day" + (notice === 1 ? "" : "s") + "' notice. Give at least 30 days to customers on a regular arrangement (and more if your terms or contract say so), so they can decide whether to carry on.");
      else if (notice < 14) notes.push("Only " + notice + " day" + (notice === 1 ? "" : "s") + "' notice. Fine for new quotes, but give regular customers a few weeks if you can.");
    }
    if (vat === "ex" && domestic) notes.push("Homeowners should see prices including VAT. Quote the VAT-inclusive figures in this message, or change the customer group if this is a business.");
    if (group === "commercial") notes.push("Check the contract or account terms for a price review clause and notice period before you send this, and follow them.");
    if (!isFinite(eff)) notes.push("Add the date the new price starts.");

    // why
    var rs = (o.reasons || []).filter(function (k) { return k in REASONS; }).map(function (k) { return REASONS[k]; });
    var other = lcFirst(clean(o.other).replace(/[.!?]+$/, ""));
    var sinceLast = isFinite(last) && last < thisYear ? (thisYear - last >= 2 ? "since our last price review in " + last : "over the last year") : "over the last year";
    var why;
    if (rs.length) why = "Our costs for " + list(rs) + " have gone up " + sinceLast + (other ? ", and " + other : "") + ".";
    else if (other) why = other.charAt(0).toUpperCase() + other.slice(1) + ".";
    else if (isFinite(last) && last < thisYear) why = "It's the first change to our prices since " + last + ", and our costs have gone up since then.";
    else why = "[One or two honest sentences on why, e.g. what's gone up and since when.]";
    var kept = lcFirst(clean(o.kept).replace(/[.!?]+$/, "")) || "keep the same standard of work";
    if (/^(the |same |our )/i.test(kept)) kept = "keep " + kept;

    var hi, thanks, change, quotes, exit = "", contactLine, sign, subject;
    var svcYour = (group === "recurring" ? "your " + (freq ? freq + " " : "") : "our ") + service;
    if (group === "recurring") {
      thanks = isFinite(since) && since < thisYear ? "Thank you for having us for the last " + (thisYear - since === 1 ? "year" : (thisYear - since) + " years") + "." : "Thank you for having us.";
      change = "From " + date + ", " + svcYour + " will be " + newS + unit + vatSfx + " (currently " + oldS + ").";
      quotes = "Visits before " + date + " stay at " + oldS + ".";
      exit = "If you'd rather not carry on at the new price, just let me know before then: there's nothing to pay beyond the visits already done.";
    } else if (group === "regular") {
      thanks = isFinite(since) && since < thisYear ? "Thanks for using us since " + since + "." : "Thanks for using us.";
      change = "From " + date + ", " + svcYour + " will be " + newS + unit + vatSfx + " (currently " + oldS + ").";
      quotes = "Any job already booked, or quoted before " + date + " and still within its quote period, stays at the price we agreed.";
    } else if (group === "agent") {
      thanks = "Thanks for the work you've sent our way" + (isFinite(since) && since < thisYear ? " since " + since : "") + ".";
      change = "From " + date + ", " + svcYour + " will be " + newS + unit + vatSfx + " (currently " + oldS + ").";
      quotes = "Jobs instructed before " + date + " stay at the current rate. Please update your contractor rate records and let your landlords know if they need to approve the change.";
    } else {
      thanks = "Thank you for your continued business" + (isFinite(since) && since < thisYear ? " since " + since : "") + ".";
      change = "From " + date + ", " + svcYour + " will be " + newS + unit + vatSfx + " (currently " + oldS + ").";
      quotes = "Orders and purchase orders placed before " + date + " stay at the current price. Please update your supplier records before then.";
    }
    contactLine = "If you have any questions, " + (o.format === "letter" ? "please call me" : "just reply or call me") + (contact ? " on " + contact : "") + ".";
    sign = (owner || "[your name]") + (biz ? "\n" + biz : "");
    subject = (group === "recurring" ? "Your " + (freq ? freq + " " : "") + service : (service.charAt(0).toUpperCase() + service.slice(1))) + " price from " + date;
    var greeting = group === "commercial" ? "Dear " + (name || "[name]") + "," : (o.format === "letter" ? "Dear " : "Hi ") + (name || "[name]") + ",";
    var body = [thanks + " " + change, why + " This lets us " + kept + ".", quotes + (exit ? " " + exit : ""), contactLine].join("\n\n");
    var message = greeting + "\n\n" + body + "\n\n" + (o.format === "letter" || group === "commercial" ? "Yours sincerely,\n" : "Thanks,\n") + sign;
    if (o.format === "letter") message = "[Your business name and address]\n[Date]\n\n[Customer's name and address]\n\n" + message;

    var sms = "Hi " + (name || "[name]") + ", from " + date + " " + svcYour + " will be " + newS + unit + " (now " + oldS + "). " +
      (group === "recurring" ? "Visits before then stay the same. " : "") + "Our costs have gone up; same standard of work. Any questions, just ask. " + (owner || "[name]");

    var pushback = {
      "\"That's a lot.\"": "I understand, and I don't put prices up lightly. Our costs have gone up, and the new price lets us " + kept + ". " +
        (group === "recurring" && freq && freq !== "monthly" ? "If it helps, we could make the visits less often instead, which would keep your monthly cost down. " : "") + "Let me know what you'd like to do. " + (owner || "[name]"),
      "\"Someone else is cheaper.\"": "Thanks for telling me. I can't match every price, but I can promise the same standard you've had from us. If you do decide to go elsewhere, no hard feelings, and we'd be glad to help again. " + (owner || "[name]"),
      "\"Can you keep me on the old price?\"": "I'm keeping the new price the same for everyone, but as you've been with us " + (isFinite(since) && since < thisYear ? "since " + since : "a long time") + ", I can hold " + oldS + " until [date], then " + newS + ". [Only if you want to: or delete this and hold the price.] " + (owner || "[name]"),
      "\"I'm cancelling.\"": "Thanks for letting me know, and thank you for having us. " + (group === "recurring" ? "I'll take you off the round after [last visit date]. " : "") + "If you ever need us again, just get in touch. " + (owner || "[name]")
    };

    return { group: GROUPS[group], subject: subject, message: message, sms: sms, pushback: pushback, pct: pct, notice: notice, info: info, notes: notes };
  }

  // Check a price-rise message someone has written (or edited).
  // o: {text, sms (bool)}
  function check(o) {
    var t = String(o.text == null ? "" : o.text), low = t.toLowerCase(), warn = [], good = [];
    if (!clean(t)) return { error: "Paste or write a message first." };
    var w = words(t);
    function flag(re, msg) { if (re.test(low)) warn.push(msg); }
    if (/\[[^\]]+\]/.test(t)) warn.push("There's a [placeholder] still in it.");
    var prices = t.match(/[£$€]\s?\d[\d,]*(\.\d{1,2})?/g) || [];
    if (prices.length === 0) warn.push("No prices. Give the exact new price (and the current one) so nobody has to guess.");
    else if (prices.length === 1) warn.push("Only one price. Give the current and the new price, e.g. \"£68 (currently £60)\".");
    var hasDate = new RegExp("\\b(" + MONTHS.join("|") + ")\\b|\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b", "i").test(t);
    if (!hasDate) warn.push("No start date. Say exactly when the new price starts (\"From 1 March 2027\").");
    flag(/\b(with immediate effect|effective immediately|from today|starting today|as of today)\b/, "\"With immediate effect\" gives no notice. Give a date a few weeks away (30 days for regular customers).");
    flag(/\b(sorry|apologi[sz]e|apologies|we regret|regrettably|unfortunately|sadly)\b/, "Apologising makes the rise sound optional or wrong. Explain it once, plainly, without saying sorry.");
    flag(/\b(beyond our control|no choice|no option|forced to|have to|had to|left with no|we must|reluctantly)\b/, "\"No choice\" / \"forced to\" sounds like a sob story and invites haggling. Give the reason in one plain sentence.");
    flag(/\b(hope you understand|we trust you will understand|thank you for your understanding|appreciate your understanding)\b/, "\"We hope you understand\" asks for permission. End with a way to ask questions instead.");
    flag(/\b(valued customer|dear customer|dear sir|sir\/madam|to whom it may concern)\b/, "Use their name. A form-letter greeting reads like a mass mailing.");
    flag(/\b(the government|the budget|chancellor|inflation is|everyone is putting|everyone else)\b/, "Talk about your costs, not politics or what other firms do. It keeps the message about the service.");
    flag(/\b(plus vat|\+ ?vat|ex\.? vat|excluding vat|exc\.? vat)\b/, "If this goes to homeowners, show prices including VAT. \"Plus VAT\" is fine only for business customers.");
    flag(/\b(cheapest|cheaper than|still the cheapest|best price|lowest price)\b/, "Avoid price-comparison claims you can't back up. Say what they get instead.");
    flag(/!/, "Drop the exclamation marks. A calm, plain message reads as confident.");
    if (/\b\d{1,3}(\.\d)?\s?%/.test(t)) warn.push("Check every percentage is true for your own costs. Don't quote national inflation figures as your reason unless your costs really rose by that much.");
    if (!/\b(question|reply|call|ring|text|get in touch|contact|let me know|let us know|just ask)\b/i.test(t)) warn.push("Add a way to ask questions: \"Any questions, just reply or call me.\"");
    if (o.recurring && !o.sms && !/\b(cancel|stop|carry on|continue|end|not to continue|let me know before)\b/i.test(t)) warn.push("Recurring customers should be able to stop without a penalty if they don't want the new price. Say so: \"If you'd rather not carry on, just let me know before then.\"");
    if (!/\b(booked|quoted|already|before (then|that|this)|stay(s)? at|still be|until)\b/i.test(t)) warn.push("Say what happens to work already booked or quoted. Honouring it at the old price builds trust.");
    if (o.sms) { if (t.length > 306) warn.push("Long for a text (" + t.length + " characters, more than two SMS). Keep it under about 300."); }
    else if (w > 170) warn.push("Long (" + w + " words). Under 150 words reads as confident; long explanations read as defensive.");
    if (!warn.length) good.push("Exact prices, a start date and a way to ask questions. Nothing apologetic or pushy.");
    return { warn: warn, good: good, words: w };
  }

  // Minimum day rate: (take-home + business costs) / billable days.
  // o: {takeHome, costs, days, hours}
  function dayRate(o) {
    var th = num(o.takeHome), c = num(o.costs), d = num(o.days), h = num(o.hours);
    if (!isFinite(th) || th < 0 || !isFinite(c) || c < 0) return { error: "Enter what you want to earn and your yearly business costs (0 if none)." };
    if (!isFinite(d) || d <= 0 || d > 366) return { error: "Enter your billable days a year (between 1 and 366)." };
    var need = th + c, rate = need / d;
    var r = { need: need, rate: rate, hourly: isFinite(h) && h > 0 ? rate / h : NaN, notes: [] };
    if (d > 230) r.notes.push("Over 230 billable days a year is a lot for one person once you take off quoting, travel, admin, holidays and sickness. Many sole traders bill 180 to 220.");
    return r;
  }

  var api = { build: build, check: check, dayRate: dayRate, GROUPS: GROUPS, FREQ: FREQ, REASONS: REASONS, money: money, fmtDate: fmtDate, parseDate: parseDate, words: words };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // ---- browser UI ----
  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) { var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  function copyBtn(label, src) {
    var b = el("button", label); b.type = "button";
    b.addEventListener("click", function () { navigator.clipboard.writeText(src.value != null ? src.value : src.textContent).then(function () { b.textContent = "Copied"; }); });
    return b;
  }
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function showCheck() {
    var out = $("pr-check-out"); out.textContent = "";
    var res = check({ text: $("pr-msg").value, recurring: $("pr-group").value === "recurring" });
    if (res.error) { out.appendChild(el("p", res.error, "li-err")); return; }
    out.appendChild(el("h3", res.warn.length ? "Check these before you send (" + res.warn.length + ")" : "Looks good (" + res.words + " words)"));
    var ul = el("ul", null, (res.warn.length ? "li-warn" : "qm-info") + " qm-list");
    (res.warn.length ? res.warn : res.good).forEach(function (w) { ul.appendChild(el("li", w)); });
    out.appendChild(ul);
  }
  function sync() { $("pr-freq-wrap").hidden = $("pr-group").value !== "recurring"; }
  document.addEventListener("DOMContentLoaded", function () {
    if ($("pr-form")) {
      if (!$("pr-effective").value) { var d = new Date(); d.setDate(d.getDate() + 35); $("pr-effective").value = iso(d); }
      sync(); $("pr-group").addEventListener("change", sync);
      $("pr-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var reasons = []; Array.prototype.forEach.call(document.querySelectorAll(".pr-reason:checked"), function (c) { reasons.push(c.value); });
        var res = build({
          group: $("pr-group").value, customer: $("pr-customer").value, owner: $("pr-owner").value, business: $("pr-business").value,
          contact: $("pr-contact").value, cur: $("pr-cur").value, service: $("pr-service").value, unit: $("pr-unit").value,
          freq: $("pr-freq").value, oldPrice: $("pr-old").value, newPrice: $("pr-new").value, effective: $("pr-effective").value,
          today: iso(new Date()), since: $("pr-since").value, lastReview: $("pr-last").value, reasons: reasons, other: $("pr-other").value,
          kept: $("pr-kept").value, vat: $("pr-vat").value, format: $("pr-format").value
        });
        var out = $("pr-out"); out.textContent = "";
        if (res.info.length || res.notes.length) {
          out.appendChild(el("h3", "Your numbers"));
          if (res.info.length) { var ui = el("ul", null, "qm-info qm-list"); res.info.forEach(function (w) { ui.appendChild(el("li", w)); }); out.appendChild(ui); }
          if (res.notes.length) { var un = el("ul", null, "li-warn qm-list"); res.notes.forEach(function (w) { un.appendChild(el("li", w)); }); out.appendChild(un); }
        }
        if ($("pr-format").value === "email") { out.appendChild(el("h3", "Subject line")); var ps = el("pre", res.subject, "email"); out.appendChild(ps); out.appendChild(copyBtn("Copy the subject", ps)); }
        out.appendChild(el("h3", "Text message version")); var pt = el("pre", res.sms, "email"); out.appendChild(pt); out.appendChild(copyBtn("Copy the text", pt));
        out.appendChild(el("p", pt.textContent.length + " characters", "small"));
        out.appendChild(el("h3", "Replies if they push back"));
        Object.keys(res.pushback).forEach(function (k) { out.appendChild(el("p", k)); var pp = el("pre", res.pushback[k], "email"); out.appendChild(pp); out.appendChild(copyBtn("Copy", pp)); });
        $("pr-msg").value = res.message;
        $("pr-msg-wrap").hidden = false;
        showCheck();
        $("pr-msg-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      $("pr-check").addEventListener("click", function () { $("pr-msg-wrap").hidden = false; showCheck(); });
      $("pr-copy").addEventListener("click", function () { var b = this; navigator.clipboard.writeText($("pr-msg").value).then(function () { b.textContent = "Copied"; }); });
    }
    if ($("dr-form")) {
      $("dr-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var cur = $("dr-cur").value, r = dayRate({ takeHome: $("dr-take").value, costs: $("dr-costs").value, days: $("dr-days").value, hours: $("dr-hours").value });
        var out = $("dr-out"); out.textContent = "";
        if (r.error) { out.appendChild(el("p", r.error, "li-err")); return; }
        out.appendChild(el("p", "You need " + money(cur, Math.round(r.need)) + " a year before tax. Your minimum day rate is " + money(cur, Math.ceil(r.rate)) + (isFinite(r.hourly) ? ", or " + money(cur, Math.ceil(r.hourly)) + " an hour" : "") + ".", "qm-info qm-list"));
        var cr = num($("dr-current").value);
        if (isFinite(cr) && cr > 0) out.appendChild(el("p", cr < r.rate ? "Your current rate (" + money(cur, cr) + ") is " + money(cur, Math.ceil(r.rate - cr)) + " a day short of it." : "Your current rate (" + money(cur, cr) + ") covers it, with " + money(cur, Math.floor(cr - r.rate)) + " a day to spare.", cr < r.rate ? "li-warn qm-list" : "qm-info qm-list"));
        r.notes.forEach(function (n) { out.appendChild(el("p", n, "li-warn qm-list")); });
      });
    }
  });
})();
