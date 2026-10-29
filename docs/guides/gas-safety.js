// Landlord gas safety check (CP12) renewal date calculator and reminder writer.
// Runs in the browser and in node (module.exports) for tests. Nothing typed
// is sent anywhere.
// Rules checked 29 Oct 2026:
// legislation.gov.uk/uksi/1998/2451/regulation/36 (check within 12 months of the
//   last one; before a new lease, a check in the 12 months before it starts; copy
//   to existing tenants within 28 days, new tenants before they move in; keep the
//   record until two further checks)
// legislation.gov.uk/uksi/1998/2451/regulation/36A (a check in the 2 months ending
//   with the deadline date counts as made on the deadline date; once per
//   appliance, a check in the 2 months from the deadline to align appliances)
// hse.gov.uk/pubns/indg285.pdf (rev3, 04/18) and hse.gov.uk/gas/domestic/faqlandlord.htm
// Date reading: the deadline is the same date 12 months after the check (a
// missing day, 29 February, becomes the last day of the month). The early window
// is the 2 months ending with the deadline, so it opens the day after the same
// date 2 months before (HSE's leaflet says "10 to 12 calendar months after").
(function () {
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var DAY = 86400000;

  function parse(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCMonth() === p[1] - 1 ? d : null;
  }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function fmt(d) { return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function fmtDay(d) { return DAYS[d.getUTCDay()] + " " + fmt(d); }
  function addDays(d, n) { return new Date(d.getTime() + n * DAY); }
  // Same day n months later; a day the month doesn't have becomes its last day.
  function addMonths(d, n) {
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(day, last)));
  }
  function between(a, b) { return Math.round((b.getTime() - a.getTime()) / DAY); }

  // First day of the 2-month window that ends with the deadline date.
  function windowStart(deadline) { return addDays(addMonths(deadline, -2), 1); }

  // o: { last, prevDeadline, today, tenancy }
  function calc(o) {
    var last = parse(o.last);
    if (!last) return { error: "Enter the date of the last gas safety check (it's on the record, often called the CP12)." };
    var today = parse(o.today) || null;
    if (today && last > today) return { error: "The last check date is in the future. Check the date on the record." };
    var notes = [];
    var counted = last, early = false, late = false, aligned = false;
    if (o.prevDeadline) {
      var pd = parse(o.prevDeadline);
      if (!pd) return { error: "The previous due date isn't a real date." };
      if (last <= pd && last >= windowStart(pd)) {
        counted = pd; early = true;
        notes.push("The check on " + fmt(last) + " was within 2 months of the previous due date (" + fmt(pd) +
          "), so it counts as made on " + fmt(pd) + " and the next one is due 12 months after that.");
      } else if (last < windowStart(pd)) {
        notes.push("The check on " + fmt(last) + " was more than 2 months before the previous due date (" + fmt(pd) +
          "), so the 12 months run from the day of the check. The months it was early are lost.");
      } else if (last <= addDays(addMonths(pd, 2), -1)) {
        late = true; aligned = true;
        notes.push("The check on " + fmt(last) + " was after the previous due date (" + fmt(pd) +
          "). That's only allowed once per appliance, within 2 months, to line its date up with another appliance in the same home. Otherwise the check was late.");
      } else {
        late = true;
        notes.push("The check on " + fmt(last) + " was after the previous due date (" + fmt(pd) + "), so it was late. The new 12 months run from the day of the check.");
      }
    }
    var deadline = addMonths(counted, 12);
    var openFrom = windowStart(deadline);
    var r = {
      last: last, lastText: fmt(last), counted: counted, countedText: fmt(counted),
      early: early, late: late, aligned: aligned,
      deadline: deadline, deadlineText: fmtDay(deadline),
      openFrom: openFrom, openFromText: fmtDay(openFrom),
      bookBy: addDays(deadline, -28), bookByText: fmt(addDays(deadline, -28)),
      tenantCopyBy: addDays(last, 28), tenantCopyByText: fmt(addDays(last, 28)),
      notes: notes
    };
    if (today) {
      r.today = today;
      r.daysLeft = between(today, deadline);
      if (r.daysLeft < 0) r.status = "overdue";
      else if (today >= openFrom) r.status = "window";
      else if (r.daysLeft <= 90) r.status = "soon";
      else r.status = "ok";
      if (between(last, today) <= 28 && today <= r.tenantCopyBy) r.copyDue = true;
    }
    if (o.tenancy) {
      var ts = parse(o.tenancy);
      if (!ts) return { error: "The new tenancy start date isn't a real date." };
      r.tenancy = ts; r.tenancyText = fmt(ts);
      // A new lease needs a check in the 12 months before it starts.
      if (ts < last) r.tenancyOk = "before";
      else r.tenancyOk = ts <= deadline ? "yes" : "no";
    }
    return r;
  }

  function fill(t, f) {
    return t.replace(/\{(\w+)\}/g, function (m, k) { return f[k] && String(f[k]).trim() ? String(f[k]).trim() : "[" + k.replace(/_/g, " ") + "]"; });
  }

  var TEMPLATES = {
    engineer_landlord: {
      title: "Engineer to landlord or agent: renewal reminder (email)",
      who: "gas engineer",
      text: "Subject: Gas safety check due by {deadline} – {address}\n\n" +
        "Hi {customer},\n\n" +
        "The landlord gas safety check at {address} is due by {deadline} (last check {last}).\n\n" +
        "If we do it any time from {open_from}, your renewal date stays at {next_deadline}, so you don't lose any months.\n\n" +
        "Reply with two or three days that suit, or let me know the best way to arrange access with the tenant, and I'll book it in. I'll send the new record the same day so you can give the tenant a copy within the 28 days.\n\n" +
        "Thanks,\n{business}\n{phone}"
    },
    engineer_landlord_sms: {
      title: "Engineer to landlord or agent: renewal reminder (text)",
      who: "gas engineer",
      text: "Hi {customer}, it's {business}. The gas safety check at {address} is due by {deadline}. Book any time from {open_from} and you keep the {next_deadline} renewal date. Which days suit? {phone}"
    },
    landlord_tenant: {
      title: "Landlord or agent to tenant: access for the check",
      who: "landlord",
      text: "Hi {tenant},\n\n" +
        "Your home's annual gas safety check is due. It's a legal check, done by a Gas Safe registered engineer, to make sure the boiler, cooker, fires and flues are safe to use.\n\n" +
        "The engineer can come on {visit} between {visit_time}. It takes about 30 to 60 minutes. Please reply to confirm, or suggest another day before {deadline} that suits you better.\n\n" +
        "You'll get a copy of the safety record within 28 days of the check.\n\n" +
        "Thanks,\n{business}\n{phone}"
    },
    missed_access: {
      title: "Card or note after a missed visit (attempt 1)",
      who: "landlord",
      text: "Sorry we missed you.\n\n" +
        "A Gas Safe registered engineer called on {visit} to carry out the annual gas safety check at {address}. The law requires this check every year, for your safety.\n\n" +
        "Please contact {business} on {phone} to arrange a new time. The check must be done by {deadline}."
    },
    second_letter: {
      title: "Second letter: why the check matters (attempt 2)",
      who: "landlord",
      text: "Dear {tenant},\n\n" +
        "Gas safety check at {address}\n\n" +
        "We tried to carry out the annual gas safety check on {visit} but couldn't get access. As your landlord, I'm required by law (the Gas Safety (Installation and Use) Regulations 1998) to have the gas appliances and flues in your home checked every year by a Gas Safe registered engineer. The check protects you from carbon monoxide and gas leaks.\n\n" +
        "Please either:\n" +
        "- call {phone} to choose a time that suits you, or\n" +
        "- let us know a day before {deadline} when someone will be in.\n\n" +
        "If there's a reason the visit is difficult, tell us and we'll work around it.\n\n" +
        "Yours sincerely,\n{business}"
    },
    final_letter: {
      title: "Third attempt: final request, keep a copy",
      who: "landlord",
      text: "Dear {tenant},\n\n" +
        "Gas safety check at {address}: third request\n\n" +
        "We have tried to arrange the annual gas safety check on {visit} and in earlier letters, without success. The check is a legal requirement and the deadline is {deadline}.\n\n" +
        "Please contact {phone} within 7 days to arrange a visit. If the engineer can't get in, I'll need to record that the check couldn't be done because access wasn't given, and consider what further steps the tenancy allows. We won't enter without your agreement.\n\n" +
        "Yours sincerely,\n{business}"
    },
    service_homeowner: {
      title: "Engineer to homeowner: annual boiler service reminder",
      who: "gas engineer",
      text: "Hi {customer},\n\n" +
        "It's about a year since we serviced your boiler at {address}, so it's due its annual service. Most manufacturers ask for one every 12 months to keep the warranty valid, and it's the best way to avoid a breakdown once the heating's on every day.\n\n" +
        "I have slots on {visit}. Reply with a day that suits and I'll book you in.\n\n" +
        "Thanks,\n{business}\n{phone}"
    },
    service_homeowner_sms: {
      title: "Engineer to homeowner: service reminder (text)",
      who: "gas engineer",
      text: "Hi {customer}, it's {business}. Your boiler's due its yearly service. I've got slots on {visit}. Want one? {phone}"
    }
  };

  function message(key, f) {
    var t = TEMPLATES[key];
    return t ? fill(t.text, f) : "";
  }

  // Fields for the templates from a calc result plus the user's details.
  function fields(r, u) {
    u = u || {};
    var next = r && r.deadline ? addMonths(r.deadline, 12) : null;
    return {
      customer: u.customer, tenant: u.tenant, address: u.address, business: u.business, phone: u.phone,
      visit: u.visit, visit_time: u.visit_time,
      deadline: r ? fmt(r.deadline) : "", last: r ? r.lastText : "",
      open_from: r ? fmt(r.openFrom) : "", next_deadline: next ? fmt(next) : ""
    };
  }

  // Calendar file: the window opening, 4 weeks before, and the deadline.
  function ics(r, label) {
    label = (label || "Gas safety check").replace(/[\r\n,;]/g, " ");
    var stamp = "20261029T000000Z";
    function ev(d, summary, uid) {
      var s = iso(d).replace(/-/g, ""), e = iso(addDays(d, 1)).replace(/-/g, "");
      return ["BEGIN:VEVENT", "UID:" + uid + "-" + s + "@polytheseus.com", "DTSTAMP:" + stamp,
        "DTSTART;VALUE=DATE:" + s, "DTEND;VALUE=DATE:" + e, "SUMMARY:" + summary, "END:VEVENT"];
    }
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//polytheseus//gas safety dates//EN", "CALSCALE:GREGORIAN"];
    lines = lines.concat(ev(r.openFrom, label + ": book now (keeps the same renewal date)", "gs-open"));
    lines = lines.concat(ev(r.bookBy, label + ": 4 weeks left", "gs-4w"));
    lines = lines.concat(ev(r.deadline, label + ": last day", "gs-due"));
    lines.push("END:VCALENDAR");
    return lines.join("\r\n") + "\r\n";
  }

  var api = { calc: calc, addMonths: addMonths, windowStart: windowStart, parse: parse, iso: iso, fmt: fmt,
    message: message, fields: fields, ics: ics, TEMPLATES: TEMPLATES };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // Browser wiring.
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, text, cls) { var e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
  var form = $("gs-form");
  if (!form) return;
  var now = new Date(), todayIso = iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  var last = null;
  function copyBtn(pre, label) {
    var b = el("button", label || "Copy"); b.type = "button";
    b.addEventListener("click", function () {
      navigator.clipboard.writeText(pre.textContent).then(function () { b.textContent = "Copied"; });
    });
    return b;
  }
  function user() {
    return { customer: $("gs-customer").value, tenant: $("gs-tenant").value, address: $("gs-address").value,
      business: $("gs-business").value, phone: $("gs-phone").value, visit: $("gs-visit").value,
      visit_time: $("gs-visit-time").value };
  }
  function renderMessages() {
    var box = $("gs-msgs"); box.textContent = "";
    var key = $("gs-template").value;
    var pre = el("pre", message(key, fields(last, user())), "email");
    box.appendChild(pre);
    box.appendChild(copyBtn(pre, "Copy the message"));
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var out = $("gs-out"); out.textContent = "";
    var r = calc({ last: $("gs-last").value, prevDeadline: $("gs-prev").value, today: todayIso, tenancy: $("gs-tenancy").value });
    if (r.error) { out.appendChild(el("p", r.error, "li-err")); $("gs-msg-wrap").hidden = true; return; }
    last = r;
    var status = {
      overdue: "Overdue by " + (-r.daysLeft) + " day" + (r.daysLeft === -1 ? "" : "s") + ". Book a check now. The next due date will be 12 months from the day it's done.",
      window: "In the early window now: book it. A check between now and the due date keeps the " + fmt(addMonths(r.deadline, 12)) + " renewal date.",
      soon: r.daysLeft + " days to go. The early window opens on " + fmt(r.openFrom) + ".",
      ok: r.daysLeft + " days to go."
    }[r.status];
    out.appendChild(el("p", status, r.status === "overdue" ? "li-err" : (r.status === "window" ? "li-warn" : "")));
    var t = el("table", null, "t");
    var rows = [["Next check due by", r.deadlineText],
      ["Book it any time from", r.openFromText + " (the date above stays the same)"],
      ["Aim to have it booked by", r.bookByText],
      ["Copy of the last record to existing tenants by", r.tenantCopyByText + " (28 days after the check)"]];
    if (r.tenancy) {
      rows.push(["New tenancy starting " + r.tenancyText, {
        yes: "Covered: the last check is within the 12 months before it starts. Give the new tenant a copy before they move in.",
        no: "Not covered: the tenancy starts after " + fmt(r.deadline) + ". Get a new check done before the tenant moves in.",
        before: "The tenancy starts before the last check, so this check can't cover its start. Check which record the tenant was given when they moved in."
      }[r.tenancyOk]]);
    }
    rows.forEach(function (row, i) {
      var tr = el("tr"); tr.appendChild(el("th", row[0])); var td = el("td", row[1]);
      if (i === 0) td.style.fontWeight = "800";
      tr.appendChild(td); t.appendChild(tr);
    });
    out.appendChild(t);
    r.notes.forEach(function (n) { out.appendChild(el("p", n, r.late && !r.aligned ? "li-warn" : "")); });
    var b = el("button", "Download calendar reminders (.ics)"); b.type = "button";
    b.addEventListener("click", function () {
      var label = $("gs-address").value.trim() ? "Gas safety check " + $("gs-address").value.trim() : "Gas safety check";
      var blob = new Blob([ics(r, label)], { type: "text/calendar" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "gas-safety-check.ics";
      document.body.appendChild(a); a.click(); a.remove();
    });
    out.appendChild(b);
    $("gs-msg-wrap").hidden = false;
    renderMessages();
  });
  ["gs-template", "gs-customer", "gs-tenant", "gs-address", "gs-business", "gs-phone", "gs-visit", "gs-visit-time"].forEach(function (id) {
    $(id).addEventListener("input", function () { if (last) renderMessages(); });
    $(id).addEventListener("change", function () { if (last) renderMessages(); });
  });
})();
