# Money module setup

Money fills itself from bank alert emails. Three pieces: a password on the app, a key for the
email forwarder, and a small Google Apps Script in your own Google account.

## 1. Server (Railway variables)

| Variable | Value |
| --- | --- |
| `APP_PASSWORD` | The password you will type to unlock the app. Without it the app stays open and Money stays off. |
| `MONEY_INGEST_KEY` | A long random string. The forwarder sends it with every request. |
| `SESSION_SECRET` | Optional. Another long random string; changing it signs everyone out. |

Generate random strings with `openssl rand -hex 32`. Never commit them: this repo is public.

## 2. Settings in the app

Open Money, tap the sliders icon, and fill in the cap, rent, salary, your name as banks print
it, and the last four digits of the spend-fund account. These live in the database, not in code.

## 3. Gmail forwarder

1. Go to script.google.com, create a project, and paste in `scripts/money-gmail-forwarder.gs`.
2. Project Settings → Script properties: add `APP_URL` (your Railway URL) and `INGEST_KEY`
   (the same value as `MONEY_INGEST_KEY`).
3. Run `backfill` once and approve the Gmail permission. It replays the last 180 days and
   reschedules itself until it finishes.
4. Run `install` once. That creates the hourly trigger.

The script only reads mail from the bank senders listed at its top and only posts to `APP_URL`.
All parsing happens on the server (`money/parse.js`), so a bank changing its wording is fixed
with a normal deploy; affected emails show up under Review as "could not read".

## Adding a bank or card

Add the sender to `SENDERS` in the script, a parser in `money/parse.js`, and a test with a
synthetic email in `tests/moneyParse.test.js`.
