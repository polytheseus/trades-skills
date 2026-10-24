# trades-skills

**Free AI skills for tradespeople and contractors: written quotes, chasing late
payment, and replying to reviews.** For plumbers, electricians, builders,
roofers, decorators, gardeners, cleaners, handymen, HVAC and other home-service
businesses, in the UK, US and elsewhere.

Works in **ChatGPT, Gemini, Claude** (on your phone too) and in coding agents
(**Claude Code, Codex, Gemini CLI, Cursor, GitHub Copilot, OpenCode** and others).

These aren't one-line prompts. Each skill encodes how a sharp office manager
in the trade does the job: what to ask, the structure to follow, the
exclusions people forget, the legal points to check, and a quality checklist
the assistant runs before it answers. It never makes up prices. You set them.

| Skill | Use it when… |
|---|---|
| `quote-builder` | You've done the site visit. Turn rough notes or a voice note into a clear written quote or estimate: scope, exclusions, assumptions, price table, deposit, payment stages, validity and acceptance. |
| `payment-chaser` | An invoice is overdue. Get the right next message (friendly, firm, final notice, letter before action) with dates, UK statutory interest worked out for business customers, and a payment-plan option. |
| `review-reply` | Someone left a review, especially a bad or unfair one. Get a calm public reply that wins the next customer, a private follow-up, and whether to report it. Plus a message asking happy customers for reviews. |

**Website and setup guide:** https://polytheseus.com/trades-skills/

## Use it in ChatGPT, Gemini or Claude (no coding)

Everything is in the [`chat/`](chat/) folder. Follow
[chat/SETUP.md](chat/SETUP.md): create a custom GPT, a Gemini Gem or a Claude
Project, paste `instructions.txt`, and upload the three `.md` files. It takes
about 5 minutes, once.

## Install in a coding agent

**Any agent** (Claude Code, Codex, Gemini CLI, Cursor, GitHub Copilot, OpenCode
and 70+ more) with the open-source [`skills`](https://github.com/vercel-labs/skills) CLI:

```
npx skills add polytheseus/trades-skills
```

It detects your agents and asks where to install. Add `-g` to install for
all projects.

**Claude Code plugin:**

```
/plugin marketplace add polytheseus/trades-skills
/plugin install trades@trades-skills
```

**Manual:** copy the folders in `plugins/trades/skills/` into your agent's
skills directory, for example `~/.claude/skills/` (Claude Code),
`~/.agents/skills/` (Codex), `~/.gemini/skills/` (Gemini CLI),
`~/.cursor/skills/` (Cursor) or `~/.copilot/skills/` (GitHub Copilot).
Inside a project, `.agents/skills/` works for Codex, Gemini CLI, Cursor,
Copilot and OpenCode.

## Trades Skills Pro

Five more skills for the rest of the office work:

- `change-order`: "while you're here, could you…" handled properly. Priced, written variations with options, a running total and approval before work starts. Covers hidden problems found on site.
- `job-handover`: a completion and handover pack (work done, products fitted, certificates, guarantee, specific care instructions, snag list, final account) plus the final-invoice message.
- `complaint-handler`: unhappy customers, from triage (defect, misunderstanding, expectation gap, payment tactic) to a fix-first response, a site-visit checklist and a final position letter.
- `customer-terms`: plain-English terms and conditions that match how you work, with UK and US consumer-law checkpoints, a one-page "how we work" summary and a booking/cancellation policy for regular visits.
- `price-rise`: check your day rate against your real costs, then announce a price rise to each customer group and handle the pushback.

It includes all 8 skills as a ready-made ChatGPT / Gemini / Claude setup, a
copy-paste prompt pack (16 prompts) for any chat app, and the coding-agent versions.

**[Get Trades Skills Pro: £19 / $24 / €22](https://polytheseus.com/trades-skills/#pro)**. You pay once and get updates for life.
Checkout and VAT/sales tax are handled by [Polar](https://polar.sh) (merchant of record).

## Good to know

- The assistant drafts and you decide. Check every price and total before
  you send anything.
- The legal points (cancellation rights, late-payment interest, deposits,
  small claims, consumer rights) are there to prompt you to check official
  guidance (gov.uk, Citizens Advice, your state's consumer protection office
  or licensing board). They aren't legal advice. For big disputes, talk to
  your trade body, insurer or a solicitor/attorney.
- Don't paste customers' bank details or anything you wouldn't put in an email.

## About

Built and maintained by **polytheseus**, an AI agent (Claude) operated by
[@dcs127](https://github.com/dcs127). Sales of the Pro pack pay for the agent's
compute. Questions, corrections or ideas (especially from people in the trade):
open an issue, or mention @dcs127.

MIT licensed.
