# Set up Trades Assistant in ChatGPT, Gemini or Claude

No coding needed. Setup takes about 5 minutes, once. You then have a helper that
writes quotes, chases late payments and replies to reviews the way a sharp
office manager would.

**You need these four files from this folder:**
`instructions.txt`, `quote-builder.md`, `payment-chaser.md` and `review-reply.md`.
To download them, open each file on GitHub and click the download button
(the arrow icon, top right of the file). Or download the whole pack as a zip:
green **Code** button → **Download ZIP**, then unzip it and open the `chat` folder.

---

## ChatGPT (custom GPT)

Creating a GPT needs a paid ChatGPT plan. On a free plan, use the
"ChatGPT Project" or "Any chat" options below instead.

1. Go to chatgpt.com and click **GPTs** in the left sidebar, then **+ Create**.
2. Click the **Configure** tab (not "Create").
3. **Name**: `Trades Assistant`. **Description**: `Quotes, payment chasing and review replies`.
4. Open `instructions.txt`, copy everything, and paste it into **Instructions**.
5. Under **Knowledge**, click **Upload files** and add the three `.md` files.
6. Click **Create** (top right) and choose **Only me**. Done: it appears in
   your sidebar.

**ChatGPT Project (works on more plans):** in the sidebar click **New project**,
name it `Trades Assistant`, open the project's **Instructions** and paste
`instructions.txt`, then add the three `.md` files under **Files**. Start
every chat inside that project.

## Gemini (Gem)

1. Go to gemini.google.com. In the left menu, open **Gems** (you may need
   **Explore Gems**), then **New Gem**.
2. **Name**: `Trades Assistant`.
3. Paste everything from `instructions.txt` into **Instructions**.
4. Under **Knowledge**, add the three `.md` files.
5. Click **Save**. Find it later under Gems in the left menu.

## Claude (Project)

1. Go to claude.ai and click **Projects**, then **Create project**. Name it
   `Trades Assistant`.
2. Click **Set project instructions** (or the instructions pencil), paste
   `instructions.txt`, and save.
3. Under **Project knowledge**, click **+** and upload the three `.md` files.
4. Start every chat inside the project.

## Any chat, any app (no setup)

Start a new chat, paste the contents of `instructions.txt`, then paste the
matching `.md` file (for example `quote-builder.md`) and finish with your
request. This works in any AI chat app, including free plans. It's just a
little more pasting each time.

---

## Try it

- "Quote for a combi boiler swap, Worcester 30kW, £2,850 inc VAT, customer is a homeowner in Leeds, 50% deposit, 2 days' work. Notes: …"
- "Invoice 1043 for £1,240 is 21 days overdue. The customer is a letting agent. What do I send now?"
- "Someone left a 1-star Google review saying I overcharged. The price was agreed in writing. Help me reply."

**Tips:** it works great from your phone: type rough notes or use voice input.
Always check prices and totals before sending. Legal points (cancellation
rights, late-payment interest) are prompts to check, not legal advice.

If a menu name has changed since this guide was written, the apps' help
pages show the current steps: search "create a GPT", "create a Gem" or
"Claude projects".
