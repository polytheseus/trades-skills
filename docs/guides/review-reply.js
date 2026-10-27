// Review reply writer and checker for trades and local service businesses.
// Runs in the browser and in node (module.exports) for tests. Nothing typed
// is sent anywhere.
// Rules checked 27 Oct 2026:
// support.google.com/business/answer/3474050 (replying: the reviewer is
//   notified; replies must follow Google's content policies; edit or delete
//   any time);
// support.google.com/business/answer/4596773 (report a review in the Reviews
//   Management Tool; statuses; one appeal; only policy-breaking reviews are
//   removed, not ones you disagree with);
// UK: Digital Markets, Competition and Consumers Act 2024, Sch. 20 para 13,
//   fake reviews and concealed incentivised reviews banned from 6 April 2025
//   (CMA guidance CMA208, which also lists suppressing negative reviews);
// US: FTC Trade Regulation Rule on the Use of Consumer Reviews and
//   Testimonials (16 CFR Part 465), in force 21 October 2024: bans buying
//   reviews and suppressing them by threats or intimidation.
// Upkeep: none time-bound. Re-check the Google help pages if the reporting
//   flow changes.
(function () {
  var TYPES = {
    positive: "Positive",
    mixed: "Mixed (good, with a complaint)",
    fair: "Negative, and they have a point",
    unfair: "Negative, and it isn't accurate",
    nostar: "One star, no words",
    unknown: "Can't find them as a customer",
    serious: "Alleges damage, injury, a safety issue, or threatens legal action"
  };

  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function first(s) { return clean(s).split(" ")[0] || ""; }
  function stop(s) { s = clean(s); return s && !/[.!?]$/.test(s) ? s + "." : s; }
  function lc(s) { s = clean(s).replace(/[.!?]+$/, ""); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function words(s) { var m = clean(s).match(/\S+/g); return m ? m.length : 0; }

  // Build a public reply, a private follow-up and reporting advice.
  // o: {type, reviewer, owner, role, business, contact, job, fact, fix, changed}
  function build(o) {
    var type = o.type in TYPES ? o.type : "fair";
    var name = first(o.reviewer), hi = name ? ", " + name : "";
    var owner = first(o.owner), sign = owner ? owner + (clean(o.role) ? ", " + clean(o.role) : "") : "[your first name], owner";
    var contact = clean(o.contact) || "[your direct number or email]";
    var job = lc(o.job), fact = stop(o.fact), fix = lc(o.fix), changed = lc(o.changed);
    var biz = clean(o.business) || "us";
    var r = [], priv = "", report = "", notes = [];

    if (type === "positive") {
      r.push("Thanks" + hi + ".");
      r.push(job ? "We really enjoyed " + job + ", and it's great to hear you're happy with it." : "It's great to hear you're happy with the work.");
      r.push("Thanks for choosing " + biz + ", and give us a shout if you ever need us again.");
      report = "No.";
    } else if (type === "mixed") {
      r.push("Thanks for the review" + hi + ", and I'm glad you're pleased with " + (job || "the work") + ".");
      r.push("You're right to raise the problem, and I'm sorry about it. That's not how we want to work.");
      r.push(changed ? "Since then, " + (/^we\b/i.test(changed) ? changed : "we've " + changed) + "." : "[Say what you've changed so it doesn't happen again.]");
      priv = "Hi " + (name || "[name]") + ", thanks for your review and for pointing out the problem. I'm sorry about it. " +
        (changed ? (/^we\b/i.test(changed) ? "W" + changed.slice(1) : "We've " + changed) + ". " : "") + "If there's anything still not right, call me on " + contact + ". " + (owner || "[your name]");
      report = "No. Mixed reviews look genuine to readers and usually help you.";
    } else if (type === "fair") {
      r.push("Sorry" + hi + ". " + (job ? "Having a problem with " + job + " isn't" : "This isn't") + " the standard we work to.");
      r.push(fix ? "I've been in touch, and we'll " + fix.replace(/^we('ll| will)\s+/i, "") + "." : "I'd like to put it right. [Say what you're offering: a return visit, a fix, a call.]");
      r.push("You can reach me directly on " + contact + ".");
      priv = "Hi " + (name || "[name]") + ", I saw your review and I'm sorry " + (job ? "about the problem with " + job : "about the problem") + ". " +
        (fix ? "I'd like to " + fix.replace(/^we('ll| will)\s+/i, "") + ". " : "I'd like to put it right. ") + "When suits you? You can call me on " + contact + ". " + (owner || "[your name]");
      report = "No. The review is fair: fix the problem and let them decide whether to update it.";
    } else if (type === "unfair") {
      r.push("Thanks for your feedback" + hi + ".");
      r.push(fact || "[One calm fact, e.g. \"We agreed the price in writing before starting and didn't add any extras.\"]");
      r.push("I'm sorry you're unhappy" + (job ? " with " + job : "") + ", and I'd be glad to talk it through: " + contact + ".");
      priv = "Hi " + (name || "[name]") + ", I saw your review and I'm sorry you're unhappy. I'd like to understand what went wrong and see if we can sort it. Could we talk this week? I'm on " + contact + ". " + (owner || "[your name]");
      report = "Usually no. A review isn't removed for being unfair or one-sided, only for breaking the platform's policies (fake engagement, off-topic, conflict of interest, harassment, personal information).";
    } else if (type === "nostar") {
      r.push("Hi" + (name ? " " + name : "") + ", we're sorry to see a low rating.");
      r.push("We'd like to know what went wrong so we can put it right. Could you contact me on " + contact + "?");
      report = "Only if you can't match it to any customer (see \"Can't find them as a customer\"). A rating with no text is allowed.";
    } else if (type === "unknown") {
      r.push("Hi" + (name ? " " + name : "") + ", we can't find a job under this name or for the work described, so we'd like to understand what happened.");
      r.push("Could you contact me on " + contact + " so we can look into it?");
      report = "Yes, if you've checked your records and there's no such job. On Google: Reviews Management Tool → report a new review for removal → Report → pick the reason → Submit. Check the status in the same tool; if it stays up, you get one appeal.";
      notes.push("Check your records first: invoices, the job diary, the name of whoever booked (a partner or tenant may have written it).");
    } else if (type === "serious") {
      r.push("Hi" + (name ? " " + name : "") + ", we take this seriously and I've contacted you directly to arrange a time to talk.");
      r.push("You can also reach me on " + contact + ".");
      priv = "Hi " + (name || "[name]") + ", I've seen your review and I want to look into this properly. When can we talk? I'm on " + contact + ". " + (owner || "[your name]");
      report = "No, unless it breaks the platform's policies (threats, personal information).";
      notes.push("Speak to your insurer before you say anything more, in public or private. Don't admit fault or offer money in writing yet.");
      notes.push("If there's a live safety risk (a gas smell, exposed wiring, water near electrics), contact the customer today, not just online.");
    }

    var reply = r.join(" ") + "\n" + sign;
    return { reply: reply, private: priv, report: report, notes: notes, type: TYPES[type] };
  }

  var PRIVATE = [
    [/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, "A UK postcode: don't post where the customer lives."],
    [/\b\d+[a-z]?\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\s+(Road|Rd|Street|St|Avenue|Ave|Lane|Ln|Close|Drive|Dr|Way|Crescent|Court|Gardens|Grove|Place|Terrace|Boulevard|Blvd)\b/, "A street address: don't post where the customer lives."],
    [/\b(pregnan\w*|disab\w*|dementia|cancer|illness|wheelchair|mental health|divorce\w*|benefits|universal credit|bailiff\w*|debt\w*|arrears)\b/i, "Something about their health, family or money: leave it out of a public reply."],
    [/\b(neighbour|neighbor|wife|husband|partner|son|daughter|kids|children|tenant)s?\b/i, "It mentions their family, tenants or neighbours: leave them out unless the reviewer did."]
  ];
  var ACCUSE = /\b(liar|lying|lie|lies|lied|fake|fabricat\w*|made (this|it) up|making (this|it) up|competitor|troll|scam\w*|dishonest|delusional|crazy|mad|drunk|rude|nightmare|entitled|deluded|ridiculous|pathetic|disgrace\w*|shame on you|how dare you)\b/i;
  var LEGAL = /\b(solicitor|lawyer|attorney|sue|suing|take you to court|small claims|defamation|defamatory|libel\w*|slander\w*|legal action|cease and desist|police|report(ed)? you)\b/i;
  var INCENTIVE_A = /\b(refund\w*|discount\w*|voucher\w*|money back|free (visit|service|job)|gift|£\s?\d+|\$\s?\d+|\d+\s?% off|compensation)\b/i;
  var INCENTIVE_B = /\btake (this |the |your |that )?(review |rating |comment )?down\b|\b(remove|removing|delete|deleting|take (it|this) down|change|update|amend|edit|revise)\b[^.]{0,40}\b(review|rating|stars?|comment)\b|\b(review|rating|stars?|comment)\b[^.]{0,40}\b(removed|deleted|taken down|changed|updated|amended)\b/i;
  var LIABLE = /\b(our fault|my fault|we('re| are) liable|liable|we (damaged|broke|caused|flooded|cracked|burst)|i (damaged|broke|caused)|negligen\w*|we('ll| will) pay for (all|the|any) damage)\b/i;
  var NONAPOLOGY = /\b(any inconvenience|sorry (that )?you feel|sorry if you|sorry you think|if you were (upset|unhappy|offended)|we apologi[sz]e for any)\b/i;

  // Check a reply before posting. o: {reply, type}
  function check(o) {
    var t = String(o.reply || ""), type = o.type || "", warn = [], good = [];
    var n = words(t), neg = /^(fair|unfair|nostar|unknown|serious|mixed)$/.test(type);
    if (!clean(t)) return { error: "Paste or write a reply to check.", warn: [], good: [], words: 0 };
    if (/\[[^\]]+\]/.test(t)) warn.push("There's still a [placeholder] in square brackets: fill it in or delete it.");
    if (n > 150) warn.push(n + " words: too long. Long replies read as defensive. Aim for 40 to 120.");
    else if (n < 15 && type !== "positive") warn.push(n + " words: very short. Readers may think you don't care. Aim for 40 to 120.");
    else if (n < 8) warn.push(n + " words: add one specific detail from the job.");
    var lines = t.trim().split(/\n/), last = clean(lines[lines.length - 1]);
    if (!/^[A-Z][a-z'’-]+\b/.test(last) || words(last) > 6 || /^(regards|kind regards|thanks|many thanks|best)\W*$/i.test(last) || /\b(management|the team)\b/i.test(last))
      warn.push("Sign off with a real first name and role (\"Dave, owner\"). A person beats \"The Management\".");
    var m;
    if ((m = t.match(ACCUSE))) warn.push("\"" + m[0] + "\": don't accuse or label the reviewer. If you think it's fake, say you can't find the job and report it.");
    if ((m = t.match(LEGAL))) warn.push("\"" + m[0] + "\": no legal talk in public. Threatening reviewers can count as review suppression (FTC rule in the US; the CMA lists suppressing negative reviews as banned in the UK). Get advice privately if you need it.");
    if (INCENTIVE_A.test(t) && INCENTIVE_B.test(t)) warn.push("Money or a discount next to changing or removing the review: never link the two. Platforms ban it, and so do UK (DMCC Act 2024) and US (FTC) fake-review rules. Fix the problem and let them decide about the review.");
    else if (INCENTIVE_B.test(t)) warn.push("Don't ask them to change or remove the review in public. Fix the problem; they may update it themselves.");
    if ((m = t.match(LIABLE))) warn.push("\"" + m[0] + "\": don't admit legal liability in public. Talk to your insurer first, and keep the reply to \"we take this seriously and have contacted you\".");
    if ((m = t.match(NONAPOLOGY))) warn.push("\"" + m[0] + "\" reads as a non-apology. Say sorry for the specific thing (\"sorry the leak came back\").");
    PRIVATE.forEach(function (p) { if (p[0].test(t)) warn.push(p[1]); });
    if (/£\s?\d|\$\s?\d/.test(t) && !INCENTIVE_A.test(t.replace(/£\s?\d[\d,.]*|\$\s?\d[\d,.]*/g, "")) && type !== "positive")
      warn.push("It mentions a price. Only include what they paid if they posted it themselves.");
    if (/!{2,}|\?{2,}/.test(t)) warn.push("Double punctuation (!! or ??) reads as angry. One at most.");
    var caps = t.match(/\b[A-Z]{4,}\b/g) || [];
    caps = caps.filter(function (w) { return !/^(VAT|HMRC|NICEIC|CORGI|PAYE|ASAP|MOT|LED|TRV|RCD|UPVC|GDPR)$/.test(w); });
    if (caps.length) warn.push("Words in capitals (" + caps.slice(0, 3).join(", ") + ") read as shouting.");
    var yous = (t.match(/\byou(r|'re|’re)?\b/gi) || []).length, wes = (t.match(/\b(we|i|our|us|my|me)\b/gi) || []).length;
    if (neg && /\byou (never|didn't|did not|refused|failed|should have|were told|agreed)\b/i.test(t)) warn.push("\"You never / you didn't / you agreed\" sounds like an argument. State the fact neutrally (\"We agreed the price in writing\").");
    if (neg && type !== "mixed" && !/(\b0\d{3,4}\s?\d{3}\s?\d{3,4}\b|\b07\d{3}\s?\d{6}\b|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}|@|\bcall me\b|\bphone me\b|\bring me\b|\bemail me\b|\bcontacted you\b|\bbeen in touch\b|\bin touch\b|\bcontact me\b|\bmessage me\b)/i.test(t))
      warn.push("No way to reach you: add a direct number or email so the conversation moves offline.");
    if (neg && !/^(unknown|serious)$/.test(type) && !/\b(sorry|apologi[sz]e|thanks|thank you)\b/i.test(t)) warn.push("No thanks or apology. Start with one: it's for the next customer reading, not the reviewer.");
    if (type === "positive" && words(t) > 80) warn.push("Keep thank-you replies short: 20 to 60 words.");
    if (!warn.length) good.push("Nothing to fix. Read it once more as a stranger deciding whether to hire you.");
    if (yous > wes * 2 && neg) warn.push("It's mostly about the reviewer (\"you\" " + yous + " times). Talk about what you'll do.");
    return { warn: warn, good: good, words: n };
  }

  var api = { build: build, check: check, TYPES: TYPES, words: words };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  function $(id) { return document.getElementById(id); }
  function el(tag, text, cls) { var e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  function copyBtn(label, pre) {
    var b = el("button", label); b.type = "button";
    b.addEventListener("click", function () { navigator.clipboard.writeText(pre.value != null ? pre.value : pre.textContent).then(function () { b.textContent = "Copied"; }); });
    return b;
  }
  function showCheck() {
    var out = $("rr-check-out"); out.textContent = "";
    var res = check({ reply: $("rr-reply").value, type: $("rr-type").value });
    if (res.error) { out.appendChild(el("p", res.error, "li-err")); return; }
    out.appendChild(el("h3", res.warn.length ? "Check these before you post (" + res.warn.length + ")" : "Looks good (" + res.words + " words)"));
    var ul = el("ul", null, (res.warn.length ? "li-warn" : "qm-info") + " qm-list");
    (res.warn.length ? res.warn : res.good).forEach(function (w) { ul.appendChild(el("li", w)); });
    out.appendChild(ul);
  }
  function sync() { $("rr-fact-wrap").hidden = $("rr-type").value !== "unfair"; $("rr-fix-wrap").hidden = $("rr-type").value !== "fair"; $("rr-changed-wrap").hidden = $("rr-type").value !== "mixed"; }
  document.addEventListener("DOMContentLoaded", function () {
    if (!$("rr-form")) return;
    sync(); $("rr-type").addEventListener("change", sync);
    $("rr-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var res = build({
        type: $("rr-type").value, reviewer: $("rr-reviewer").value, owner: $("rr-owner").value, role: $("rr-role").value,
        business: $("rr-business").value, contact: $("rr-contact").value, job: $("rr-job").value,
        fact: $("rr-fact").value, fix: $("rr-fix").value, changed: $("rr-changed").value
      });
      var out = $("rr-out"); out.textContent = "";
      out.appendChild(el("h3", "Your reply (" + res.type.toLowerCase() + ")"));
      out.appendChild(el("p", "Edit it below so it sounds like you, then check it.", "small"));
      $("rr-reply").value = res.reply;
      $("rr-reply-wrap").hidden = false;
      if (res.private) { out.appendChild(el("h3", "Private message to send them")); var pp = el("pre", res.private, "email"); out.appendChild(pp); out.appendChild(copyBtn("Copy the message", pp)); }
      out.appendChild(el("h3", "Should you report it?")); out.appendChild(el("p", res.report));
      if (res.notes.length) { var ul = el("ul", null, "li-warn qm-list"); res.notes.forEach(function (w) { ul.appendChild(el("li", w)); }); out.appendChild(ul); }
      showCheck();
      $("rr-reply-wrap").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("rr-check").addEventListener("click", function () { $("rr-reply-wrap").hidden = false; showCheck(); });
    $("rr-copy").addEventListener("click", function () { var b = this; navigator.clipboard.writeText($("rr-reply").value).then(function () { b.textContent = "Copied"; }); });
  });
})();
