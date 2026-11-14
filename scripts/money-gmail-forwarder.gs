/**
 * Earned · Money — Gmail forwarder (Google Apps Script)
 *
 * Runs inside YOUR Google account. It finds bank alert emails, strips them to text and
 * posts them to your Earned server, which does all the parsing. It never sends anything
 * except mail from the senders listed below, and only to the URL you configure.
 *
 * Setup (once): see MONEY_SETUP.md in the repo.
 *   Script properties needed:  APP_URL  (e.g. https://your-app.up.railway.app)
 *                              INGEST_KEY (same value as MONEY_INGEST_KEY on the server)
 *   Then run `backfill` once by hand, and `install` once to create the hourly trigger.
 */

var SENDERS = [
  'alerts@hdfcbank.bank.in', 'alerts@hdfcbank.net',
  'credit_cards@icici.bank.in', 'cards@icici.bank.in', 'credit_cards@icicibank.com',
  'alerts@axis.bank.in', 'alerts@axisbank.com',
  'hello@splitwise.com'
];
var BATCH = 40;            // emails per request to the server
var PAGE = 50;             // Gmail threads per search page
var BACKFILL_DAYS = 180;
var MAX_RUN_MS = 4.5 * 60 * 1000; // stay under the 6-minute Apps Script limit

function props_() { return PropertiesService.getScriptProperties(); }
function query_(extra) { return 'from:(' + SENDERS.join(' OR ') + ') ' + extra; }

/** Hourly: forward everything since the last successful run (with an hour of overlap). */
function run() {
  var p = props_();
  var last = Number(p.getProperty('LAST_RUN') || 0);
  var startedAt = Date.now();
  var since = last ? Math.floor((last - 60 * 60 * 1000) / 1000) : Math.floor((startedAt - 3 * 24 * 60 * 60 * 1000) / 1000);
  var ok = forward_(query_('after:' + since), 0, since * 1000, startedAt).done;
  if (ok) p.setProperty('LAST_RUN', String(startedAt));
}

/** One-off: replay the last BACKFILL_DAYS days. Resumes where it stopped; reschedules itself until done. */
function backfill() {
  var p = props_();
  var offset = Number(p.getProperty('BACKFILL_OFFSET') || 0);
  var res = forward_(query_('newer_than:' + BACKFILL_DAYS + 'd'), offset, 0, Date.now());
  clearTriggers_('backfill');
  if (res.done) {
    p.deleteProperty('BACKFILL_OFFSET');
    Logger.log('Backfill complete.');
  } else {
    p.setProperty('BACKFILL_OFFSET', String(res.offset));
    ScriptApp.newTrigger('backfill').timeBased().after(60 * 1000).create();
    Logger.log('Backfill paused at thread ' + res.offset + '; continuing in a minute.');
  }
}

/** Creates the hourly trigger for run(). Safe to call again. */
function install() {
  clearTriggers_('run');
  ScriptApp.newTrigger('run').timeBased().everyHours(1).create();
}

function clearTriggers_(fn) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
  });
}

function forward_(query, offset, sinceMs, startedAt) {
  var batch = [];
  while (true) {
    var threads = GmailApp.search(query, offset, PAGE);
    if (!threads.length) break;
    var messages = GmailApp.getMessagesForThreads(threads);
    for (var i = 0; i < messages.length; i++) {
      for (var j = 0; j < messages[i].length; j++) {
        var m = messages[i][j];
        var from = m.getFrom().toLowerCase();
        if (m.getDate().getTime() < sinceMs) continue;
        if (!SENDERS.some(function (s) { return from.indexOf(s) > -1; })) continue;
        batch.push({
          id: m.getId(),
          from: from,
          subject: m.getSubject(),
          date: m.getDate().toISOString(),
          text: stripHtml_(m.getBody()).slice(0, 3000)
        });
        if (batch.length >= BATCH) { if (!post_(batch)) return { done: false, offset: offset }; batch = []; }
      }
    }
    offset += threads.length;
    if (Date.now() - startedAt > MAX_RUN_MS) {
      if (batch.length && !post_(batch)) return { done: false, offset: offset - threads.length };
      return { done: false, offset: offset };
    }
  }
  if (batch.length && !post_(batch)) return { done: false, offset: offset };
  return { done: true, offset: offset };
}

function post_(emails) {
  var p = props_();
  var url = (p.getProperty('APP_URL') || '').replace(/\/+$/, '');
  var key = p.getProperty('INGEST_KEY') || '';
  if (!url || !key) throw new Error('Set APP_URL and INGEST_KEY in Script properties.');
  var res = UrlFetchApp.fetch(url + '/api/money/ingest', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-key': key },
    payload: JSON.stringify({ emails: emails }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  Logger.log('Posted ' + emails.length + ' emails: ' + code + ' ' + res.getContentText().slice(0, 200));
  return code === 200;
}

/** HTML email body -> plain text the server can pattern-match. */
function stripHtml_(html) {
  return String(html || '')
    .replace(/<(style|script|head|title)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&rsquo;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
