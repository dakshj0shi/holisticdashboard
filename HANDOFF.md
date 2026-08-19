# Founders Mentality Portal — Handoff

Training-management portal for Jaipur Rugs. Facilitators schedule sessions, track
per-trainee observations, send worksheets, and email batches; trainees see their
schedule, submit worksheets, and manage their own login.

Everything below is what you need to change this thing safely six months from now.
Read **Traps** before your first change — most of it is stuff that already bit us.

---

## 1. Stack

| | |
|---|---|
| Framework | Next.js **16.2.12**, App Router, Server Actions |
| React | 19.2.4 |
| DB | SQLite via Prisma **6.19.3** (`prisma/dev.db` locally) |
| Styling | Tailwind **v4** (CSS-first config in `src/app/globals.css`) |
| Mail | `nodemailer` (SMTP send) + `imapflow` (append to Sent) |
| AI | `@anthropic-ai/sdk` — only for the email composer |
| Node | >= 20.9 |

> `AGENTS.md` warns that this Next.js version differs from what an LLM has memorised.
> If you're using an AI assistant here, make it read `node_modules/next/dist/docs/`
> before writing routing/action code. That warning is real — `PageProps<"/route/[param]">`
> typing and async `params`/`searchParams` are not the old API.

---

## 2. Run it locally

```bash
npm install
cp .env.example .env      # then fill in the values — see §3
npm run db:push           # create prisma/dev.db from schema
npm run admin -- you@example.com "Your Name" --super --dev-password test1234
npm run dev               # http://localhost:3000
```

For local admin login without a real mailbox, set `DEV_SKIP_MAIL_VERIFY=true` in
`.env` and use the `--dev-password` you set above. **This is dev-only and cannot
work in production** — see §5.

Useful:

```bash
npx tsc --noEmit          # typecheck — run before every commit
npm run db:studio         # Prisma Studio, browse/edit data
npm run lint
```

If TypeScript reports errors inside `.next/dev/types/`, the route-type cache is
stale, not your code:

```bash
rm -rf .next && npx next typegen
```

---

## 3. Environment variables

Local file is `.env`. **On the server it is `.env.production`** (see §4).

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | e.g. `file:./dev.db` |
| `CREDENTIAL_ENC_KEY` | yes | **64-char hex (32 bytes)**. Encrypts the admin mailbox password on the session row. Wrong length throws at runtime. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MAIL_HOST` | prod | `mail.jaipurrugs.com`. **If unset, all mail is simulated to console** and logged with status `simulated` — no email leaves the box. |
| `MAIL_SMTP_PORT` / `MAIL_IMAP_PORT` | prod | send / append-to-Sent |
| `SESSION_TTL_DAYS` | no | default 30 |
| `ANTHROPIC_API_KEY` | no | only the AI email composer needs it |
| `DEV_SKIP_MAIL_VERIFY` | dev only | `true` bypasses live mailbox check. Hard-gated off when `NODE_ENV=production`. |

`.env*` is gitignored. So are `prisma/*.db`, `people.csv`, and `/exports/` —
they hold real trainee PII. **Never commit any of them**, including "temporarily"
or because the repo is private.

---

## 4. Deployment (the live server)

Internal LAN box, plain HTTP, no TLS.

| | |
|---|---|
| URL | `http://192.168.0.82:3001` |
| Repo | `github.com/dakshj0shi/holisticdashboard` |
| Process manager | PM2, app name **`holistic-dashboard`** |
| Env file | **`.env.production`** (not `.env`) |
| Database | **its own SQLite file, completely separate from local** |

Deploy:

```bash
git pull && npm run build && pm2 restart holistic-dashboard --update-env
```

If the pull brought a new folder into `prisma/migrations/`, apply it before restarting —
the server database is its own file and `git pull` does not touch data:

```bash
set -a; source .env.production; set +a
npm run db:migrate
```

### Deployment traps (all of these cost us hours)

- **`--update-env` is not optional.** Without it PM2 reuses a stale env snapshot and
  the restart appears to do nothing.
- **`pm2 logs` shows stale tail content.** Old crash lines (`sh: 1: next: not found`)
  sit in the log file long after the process recovered. Do not diagnose from them.
  Verify a restart actually worked with:
  ```bash
  pm2 list                        # uptime should reset to seconds
  ss -ltnp | grep 3001            # something is actually bound
  curl -sI http://localhost:3001/login
  ```
- **One-off `node -e` scripts fail with "Environment variable not found: DATABASE_URL".**
  Next.js auto-loads `.env.production`; plain `node` does not. Always:
  ```bash
  set -a; source .env.production; set +a
  node -e "..."
  ```
- **A second unrelated PM2 app (`jaipurrugs-foundation`, port 3002) lives on the same
  box.** Different project. Don't touch it.
- **Code deploys never touch data.** Any DB change (adding an admin, fixing a date,
  a password reset) must be run separately on each environment.

---

## 5. Auth — read this before touching anything auth-shaped

Two completely different login paths behind one form (`src/lib/auth.ts`):

**Trainees** — ordinary bcrypt `passwordHash` on the `User` row, compared locally.
This is the only role where an in-app "change password" makes sense.

**Admins / facilitators** — *there is no stored admin password*. The entered
password is verified by opening a **live SMTP connection to the org mail server**
with it (`verifyMailCredentials` in `src/lib/mailer.ts`). On success it's AES-256-GCM
encrypted into that one login's `Session.mailPasswordEnc`, and used to send mail *as
that admin* for the life of the session. Logout deletes the row and the secret with it.

Consequences worth internalising:

- Creating a facilitator is just **allowlisting an email** (`role: "admin"`). You never
  set a password. If their mailbox works, they're in.
- Admin login requires the mail server to be reachable. Mail server down = no admin logins.
- `DEV_SKIP_MAIL_VERIFY=true` swaps in a bcrypt compare for local work. It is gated on
  `NODE_ENV !== "production"` *in code*, so a stray env var on the server cannot
  downgrade admin auth. **Leave that guard alone.**
- `isSuperAdmin` only widens the facilitator-report export scope (own sessions vs
  everyone's). It grants nothing else.
- `active: false` cuts off *existing* sessions too — `getCurrentUser()` re-checks it
  on every request, not just at login.

### The session cookie is deliberately `secure: false`

In `createSession()`. The server is plain HTTP, and browsers silently drop `secure`
cookies over HTTP — this is what broke every login, Excel import, and batch creation
until we found it. There's a `ponytail:` comment marking it. **Flip it back to
`process.env.NODE_ENV === "production"` the day the server gets HTTPS.**

---

## 6. Layout of the code

```
src/
  app/
    (app)/          trainee-facing — dashboard, schedule, worksheets, results, account
    (console)/      admin-facing  — /admin/*
    actions.ts      barrel: re-exports everything in actions/*
    actions/        server actions, one file per domain
    api/export/     Excel downloads (roster, facilitators)
  components/       all client components
  lib/              server-only logic: auth, mailer, scheduling, crypto, imports…
prisma/             schema + one-off maintenance scripts (see §8)
```

**Import server actions from `@/app/actions`**, not the individual file — `actions.ts`
is the barrel and every component already does this. Add a new action file? Re-export
it there too.

Route groups `(app)` and `(console)` each have their own layout and nav. A new
trainee page needs a `RouteTabs` entry in `src/app/(app)/layout.tsx`; a new admin
page needs an entry in the `NAV` array in `src/components/ConsoleSidebar.tsx`
(`{ href, label, Icon }` — icons come from `src/components/Icons.tsx`).

### Design tokens (`src/app/globals.css`)

`canvas` `paper` `paper-2` `ink` `muted` `faint` `line` `line-strong` `indigo`
`indigo-deep` `slate` `amber` `teal` `rose`.

Conventions already in use — follow them: **`text-teal` for success**, **`text-rose`
for errors**, `bg-indigo` for primary buttons, bordered `hover:bg-paper-2` for
secondary. Success is teal, *not* emerald/green.

---

## 7. How the main workflows actually work

### Scheduling & email (`src/lib/scheduling.ts`)

Three distinct paths — pick the right one, they are not interchangeable:

| Action | Conflict check | Emails trainees | Changes status |
|---|---|---|---|
| `scheduleSessionSlot` | yes | yes | → `scheduled` |
| `rescheduleSessionSlot` | yes | yes | → `rescheduled` |
| `correctSessionDate` | **no** | **no** | **no** |

`correctSessionDate` exists because fixing a wrong imported date was impossible:
the conflict check blocks any day another batch already uses (routine for historical
data), and a successful reschedule would email everyone about a session that already
happened *and* flip a completed session back to `rescheduled`. It's wired to the
**"Change date (no email)"** button on every session row. Use it for data-entry
fixes only.

#### Fixing wrong dates — do it in this order

The tracker spreadsheet has a recurring typo where a year is entered as `27`
instead of `26`, so the import lands sessions a year out. Two tools, cheapest first:

1. **Bulk, scripted** — `npm run fix:years -- --dry-run`, read the output, then run it
   for real. It shifts 2027→2026 only where doing so keeps that batch's sessions in
   ascending order; anything genuinely booked far ahead is reported and left untouched.
   This handles the majority in one pass.
2. **Individually, in the UI** — for whatever the script deliberately skipped, or any
   date wrong in some other way, use **"Change date (no email)"** on the session row.

Neither path emails anyone. Remember the server has its own database — run step 1
there too, after sourcing `.env.production` (§4).

Slot status lifecycle: `unscheduled → scheduled → rescheduled → completed`.
**`completed` is set in exactly one place** — `sendSlotSummary`, when the recap email
goes out. That's also the moment `BatchSessionSlot.facilitatorId` is snapshotted from
`Batch.facilitatorId`, so past sessions keep crediting whoever actually taught them
even after the batch's facilitator changes. It never overwrites an existing snapshot.

Every send is written to `EmailLog` with a status: `sent`, `sent_no_sentfolder`,
`simulated`, `failed`, `skipped_no_email`. Trainees with no email get `skipped_no_email`
rather than blowing up the send — hence the "missing email" counters in the UI.

#### The wording of those emails

All three automated sends are editable in the UI at **Emails → Templates**. The built-in
text lives in `src/lib/emailTemplates.ts`; an `EmailTemplate` row (keyed by the same
string as `EmailLog.kind`) overrides one. **No row means "never edited"**, so a fresh or
reset database sends exactly what the portal always sent, and "Restore default" is just
re-saving that built-in text.

Bodies are plain text with `{{name}}` `{{batch}}` `{{session}}` `{{date}}` `{{summary}}`
placeholders. Blank lines become paragraph breaks; inline tags like `<strong>` pass
through. A placeholder that template doesn't have is **rejected on save** rather than
mailed to a whole batch verbatim — `{{summary}}` exists only on the summary template.

`emailTemplates.ts` deliberately has no `server-only` and no `db` import, so the editor's
preview can call the same `renderTemplate()` the mailer uses — the preview *is* the
email. Values substituted into the HTML part are HTML-escaped. `npm run check:templates`
pins the defaults to the exact text and markup that went out before templates existed, so
editing those defaults can't silently change what trainees receive.

One deliberate difference from the pre-template version: "New date:" is no longer wrapped
in `<strong>`. Put the tag back in the template if you want it.

The **Sent log** tab expands each row's subject to show the body as sent — that, plus the
preview, is how you check what is actually going out.

### Excel import (`prisma/xlsxImportCore.mjs`)

Shared by the CLI (`npm run import`) and the in-app admin upload, so a fix in the core
lands in both. Sheet layouts are declared as objects (`SHEET1_LAYOUT`, `SHEET2_LAYOUT`)
with column indices — **if the spreadsheet's shape changes, edit the layout object**,
not the loop. Trainee emails come from `emailCol: 1` (column B, "MAIL") on sheet 1.

Import is deliberately non-destructive: an email is only filled in when the trainee
has none, and it refuses to take an address another account already owns (warns
instead). Imported sessions with a date are created as `status: "scheduled"`.

### Batches & programs

`Batch.program` is a plain string with a `@@unique([program, name])`. The "New batch"
form's Program field is a free-text input backed by a `<datalist>` of programs already
in use — **adding a new program needs no migration**, just type it.

### Worksheets

Generic engine: `Worksheet → WorksheetItem` (types `likert5` | `text` | `mcq`) →
assigned to a batch (`pre`/`post`/`standalone`) → `WorksheetSubmission` (unique per
assignment+user, so submit-once is enforced by the DB) → `WorksheetAnswer`.

---

## 8. Maintenance scripts

All in `prisma/`, run with `npm run <name>` or `node prisma/<file>`.
**On the server, source `.env.production` first** (§4).

| Command | What |
|---|---|
| `npm run admin -- <email> "<Name>"` | Allowlist a facilitator. `--list`, `--revoke <email>`, `--super`, `--revoke-super`, `--dev-password <pw>`. Re-running never silently demotes a super admin. |
| `npm run import -- "<file.xlsx>"` | Import the SESSION LIST spreadsheet. Idempotent — re-running against an updated copy upserts rather than duplicating batches/trainees/records. |
| `npm run fix:years` | Bulk-fix dates typed with the wrong year (2027→2026). `--dry-run` first. Only shifts a date if the batch's sessions stay in ascending order; anything genuinely booked ahead is reported and left alone. |
| `npm run trainees` | Bulk trainee setup |
| `npm run clean` | Remove test data |
| `npm run demo` / `npm run mock` | Seed demo/mock data |
| `npm run reset` | **Wipes the DB.** |
| `npm run check:mail` | Verify SMTP/IMAP connectivity |
| `npm run check:templates` | Self-check the email template renderer. No DB, no network — safe anywhere. |

Facilitators can also be added from the UI now: **batch → Settings tab → "New
facilitator"** panel. Same effect as the CLI (allowlist an email as `role: "admin"`),
no password involved.

There is deliberately **no saved script for bulk password resets.** The one we ran
was a one-off command, kept out of the repo so nobody ever accidentally overwrites
trainees' self-chosen passwords later.

---

## 9. Traps

- **Local and server databases are unrelated.** `git pull` never migrates data. Every
  data fix runs twice, once per environment.
- **Don't trust `pm2 logs`** for whether a restart worked. See §4.
- **Never commit PII.** `prisma/*.db`, `people.csv`, `/exports/`, `.env*`. "The repo is
  private" is not a containment boundary — history survives, and anyone added later
  gets all of it.
- **Reschedule ≠ correct a date.** Reschedule emails everyone. §7.
- **The conflict check is global**, not per-batch: any other batch's `scheduled` or
  `rescheduled` slot on that calendar day blocks the booking. Historical imported data
  trips it constantly.
- **Success colour is teal**, not emerald. Grep before inventing a class.
- **Trainees can have no email.** Guard for it; the UI surfaces counts of them.
- **`revalidatePath` is what refreshes server-rendered props** after an action. If a
  dropdown doesn't update after a create, that's the missing piece.
- **Stale `.next` types** produce errors in files you never touched. `rm -rf .next`.
- A **typo in a manually-entered email** looks exactly like an auth bug. Before
  debugging login, query the row and read the address character by character. That
  exact thing (`@jaipurrug.com` vs `@jaipurrugs.com`) burned an afternoon.

---

## 10. Known debt

- Session cookie pinned to `secure: false` until the server has HTTPS (§5).
- SQLite. `schema.prisma` says swapping `provider` to `postgresql` is all that's needed
  if concurrency ever becomes a problem.
- `correctSessionDate` leaves `notifiedAt` / `notifiedForDate` pointing at the old date.
  Harmless today — they only feed the duplicate-send guard — but worth knowing.
- No automated tests. Verification is manual through the running app.

---

## 11. The mail path — and the 2026-08-13 lockout

Admin login opens a live SMTP connection (§5). That makes the **network path to the
mail server part of the auth path**, and on 2026-08-13 it broke:

- The firewall stopped permitting `192.168.0.0/24` (this server, `192.168.0.82`) to
  reach `mail.jaipurrugs.com` = `202.131.121.138`. All ports: 465, 587, 993.
- A laptop on `192.168.5.0/24` reached the same IP and port fine throughout, so the
  mail server itself was never at fault.
- Symptom: **every admin login hung ~2 minutes then said "wrong email or password".**
  Trainees were unaffected — their passwords are compared locally.
- It went unnoticed for five days because a 30-day session cookie kept an admin signed
  in, and no email was sent between Aug 13 and Aug 18.

Diagnosing it the fast way, in order — each rules out a whole layer:

```bash
timeout 10 bash -c '</dev/tcp/mail.jaipurrugs.com/465' && echo OPEN || echo BLOCKED
set -a; source .env.production; set +a; node scripts/check-mail.mjs
```

`ping` is useless here: ICMP succeeded the entire time. Only TCP was dropped.

Three changes came out of it:

- **`mailer.ts` has explicit timeouts.** Without them nodemailer waits out its own
  defaults (30s greeting, 2min connect) and the form just spins. Now it fails in 10s.
- **`verifyMailCredentials` logs the error code.** `EAUTH` = bad password;
  `ETIMEDOUT`/`ECONNECTION` = can't reach the server. These are indistinguishable to
  the user and telling them apart is the whole diagnosis. Check `pm2 logs` for
  `[mail] verify failed`.
- **`secure` follows `MAIL_SMTP_PORT`.** It was hardcoded `true`, so setting the port to
  587 would have silently hung — 587 needs STARTTLS, not implicit TLS.

### `ADMIN_PASSWORD_LOGIN` — the way back in

Leave it unset. If the mail server is unreachable and admins are locked out:

```bash
node prisma/add-admin.mjs someone@jaipurrugs.com "Their Name" --dev-password <pw>
# add ADMIN_PASSWORD_LOGIN=true to .env.production
pm2 restart holistic-dashboard --update-env
```

Unlike `DEV_SKIP_MAIL_VERIFY` this **works in production** — deliberately, and that is
why it is a separate flag. It only helps admins who have a password hash, logs every
use, and does **not** capture a mailbox credential, so those sessions still cannot send
mail. Unset it once the network is fixed.

### Sent-folder appends are serialised

`appendToSent` opens one IMAP connection per email. A batch fired them simultaneously
and the server refused partway through — mail delivered, Sent copy silently missing.
They now run one at a time with a 500ms gap (`queueImap`). The merchant email tool hit
the identical problem on this same mail server. Don't reintroduce parallel appends.
