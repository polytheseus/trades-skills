// node tests/test-review-reply.js
var r = require("../docs/guides/review-reply.js");
var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("FAIL: " + m); } }
function has(arr, re) { return arr.some(function (s) { return re.test(s); }); }
var base = { reviewer: "Priya Shah", owner: "Dave Hale", role: "owner", business: "Hale Plumbing", contact: "07700 900123" };
function o(x) { var k, y = {}; for (k in base) y[k] = base[k]; for (k in x) y[k] = x[k]; return y; }

// every type builds a reply that passes its own check (with details filled in)
var filled = {
  positive: { job: "the kitchen rewire" },
  mixed: { job: "the bathroom", changed: "we now text an arrival time on the morning of every job" },
  fair: { job: "the boiler repair", fix: "come back free of charge on Thursday to put it right" },
  unfair: { job: "the price", fact: "We agreed the price in writing before starting and didn't add any extras" },
  nostar: {}, unknown: {}, serious: {}
};
Object.keys(r.TYPES).forEach(function (t) {
  var b = r.build(o(Object.assign({ type: t }, filled[t])));
  ok(/Dave, owner$/.test(b.reply), t + " signed " + b.reply);
  ok(!/\[/.test(b.reply), t + " no placeholder " + b.reply);
  var c = r.check({ reply: b.reply, type: t });
  ok(c.warn.length === 0, t + " own reply clean: " + c.warn.join(" | ") + " :: " + b.reply);
  ok(r.words(b.reply) <= 120, t + " under 120 words");
  ok(typeof b.report === "string" && b.report.length > 1, t + " report advice");
});
// first names only
var b = r.build(o({ type: "fair", job: "the leak" }));
ok(/Sorry, Priya\./.test(b.reply) && !/Shah/.test(b.reply), "first name only");
ok(/\[Say what/.test(b.reply), "fair without fix leaves placeholder");
ok(has(r.check({ reply: b.reply, type: "fair" }).warn, /placeholder/), "placeholder flagged");
ok(/Hi Priya/.test(b.private) && /07700 900123/.test(b.private), "private message");
ok(!/review/i.test(b.private.replace(/saw your review/, "")), "private doesn't ask about the review");
// missing owner / contact
b = r.build({ type: "unfair" });
ok(/\[your first name\], owner/.test(b.reply) && /\[your direct number/.test(b.reply), "defaults are placeholders");
b = r.build({ type: "nonsense", owner: "Al" }); ok(b.type === r.TYPES.fair, "unknown type falls back to fair");
// "we'll" prefix not doubled
b = r.build(o({ type: "fair", fix: "We'll come back on Monday" })); ok(/we'll come back on Monday\./.test(b.reply) && !/we'll we'll/i.test(b.reply), "fix prefix " + b.reply);
b = r.build(o({ type: "mixed", changed: "We have started texting arrival times" })); ok(/Since then, We have started texting/i.test(b.reply) && !/we.ve We/.test(b.reply), "changed prefix " + b.reply);
// serious + unknown notes
ok(r.build(o({ type: "serious" })).notes.length === 2, "serious notes");
ok(/insurer/.test(r.build(o({ type: "serious" })).notes[0]), "insurer note");
ok(/Reviews Management Tool/.test(r.build(o({ type: "unknown" })).report), "unknown report route");

function w(reply, type) { return r.check({ reply: reply, type: type || "unfair" }).warn; }
var good = "Thanks for your feedback, Mark. We agreed the price in writing before starting and didn't add any extras, but I'm sorry you're unhappy with the cost. I'd be glad to go through the invoice with you by phone: 07700 900123.\nDave, owner";
ok(w(good).length === 0, "good reply clean: " + w(good).join(" | "));
ok(r.check({ reply: "  " }).error, "empty error");
ok(has(w(good.replace("Thanks for your feedback, Mark.", "This is a lie.")), /accuse/), "lie");
ok(has(w(good.replace("Thanks for your feedback, Mark.", "Thanks Mark, this review is fake.")), /accuse/), "fake");
ok(has(w(good.replace("Thanks for your feedback, Mark.", "Probably a competitor. Thanks Mark.")), /accuse/), "competitor");
ok(has(w(good + "\nOur solicitor will be in touch."), /legal/), "solicitor");
ok(has(w(good.replace("Thanks for your feedback,", "Thanks, this is defamatory,")), /legal/), "defamatory");
ok(!has(w(good.replace("by phone", "at our office on Elm Court")), /legal/), "Court street name isn't legal talk");
ok(has(w(good.replace("I'd be glad", "We'll refund £50 if you remove this review. I'd be glad")), /never link/), "incentive for removal");
ok(has(w(good.replace("I'd be glad", "Happy to give 10% off if you update your rating. I'd be glad")), /never link/), "discount for update");
ok(has(w(good.replace("I'd be glad", "Please take this review down. I'd be glad")), /change or remove/), "asks removal");
ok(has(w(good.replace("Thanks for your feedback, Mark.", "Thanks Mark, it was our fault the ceiling flooded."), "serious"), /liability/), "liability");
ok(has(w(good.replace("I'm sorry you're unhappy with the cost", "we apologise for any inconvenience")), /non-apology/), "non-apology");
ok(has(w(good.replace("Thanks for your feedback, Mark.", "Thanks Mark, sorry if you were unhappy.")), /non-apology/), "sorry if you");
ok(has(w(good.replace("by phone", "at 12 Elm Road")), /address/), "street address");
ok(has(w(good.replace("by phone", "near LS6 2AB")), /postcode/), "postcode");
ok(has(w(good.replace("the cost", "the cost while pregnant")), /health/), "health");
ok(has(w(good.replace("the cost", "the cost, and your husband agreed")), /family/), "family");
ok(has(w(good.replace("the cost", "the £1,200 cost")), /price/), "price mentioned");
ok(has(w(good.replace("cost.", "cost!!")), /Double/), "double punctuation");
ok(has(w(good.replace("the cost", "the cost, which was AGREED")), /capitals/), "caps");
ok(!has(w(good.replace("the cost", "the cost including VAT")), /capitals/), "VAT allowed");
ok(has(w(good.replace("We agreed", "You agreed")), /argument/), "you agreed");
ok(has(w(good.replace(" by phone: 07700 900123", "")), /reach you/), "no contact");
ok(!has(w(good.replace(" by phone: 07700 900123", ", call me any time")), /reach you/), "call me counts");
ok(!has(w(good.replace("07700 900123", "dave@example.co.uk")), /reach you/), "email counts");
ok(!has(w(good.replace("07700 900123", "(555) 123-4567")), /reach you/), "US phone counts");
ok(has(w(good.replace("Dave, owner", "The Management")), /Sign off/), "management sign-off");
ok(has(w(good.replace("\nDave, owner", "")), /Sign off/), "no sign-off");
ok(has(w("Not true.\nDave"), /very short/), "short");
ok(has(w(new Array(160).join("word ") + "\nDave, owner"), /too long/), "long");
ok(has(w("Thanks for the lovely words, Sarah! Enjoy the new lights.\nDave, owner", "positive"), /x/) === false, "positive short ok");
ok(!has(w("Thanks for the lovely words, Sarah! Enjoy the new lights.\nDave, owner", "positive"), /reach you|apology/), "positive needs no contact");
ok(has(w("We came back twice. Call me on 07700 900123.\nDave, owner", "fair"), /No thanks or apology/), "no apology");
var bad = "This is completely untrue!! You were told the price BEFORE we started and you agreed to it. The job took 2 hours not 20 minutes as your neighbour at 14 Oak Road will confirm. Some people just don't want to pay for skilled work. If you post lies like this again you'll be hearing from our solicitor.\nRegards, The Management";
var bw = w(bad); ok(bw.length === 11, "bad reply 11 flags"); console.log("before/after bad reply flags (" + bw.length + "):\n - " + bw.join("\n - "));
ok(has(w(good.replace("Dave, owner", "Regards, The Management")), /Sign off/), "regards management");
var after = "Thanks for your feedback, Lee. The price was agreed in writing before we started, but I'm sorry the visit felt poor value, and I'm sorry we didn't leave the area tidy. That's not good enough and I've passed it on. I'd be glad to go through the invoice with you: 07700 900123.\nDave, owner";
ok(w(after).length === 0, "after reply clean: " + w(after).join(" | "));
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
