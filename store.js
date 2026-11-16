/* ServerLab storage: where accounts, progress and the leaderboard are kept.

   There are two stores with the same functions, so ui.js does not care which one is running:
     local  - this browser only. Needs no setup, but nothing is shared and the browser can clear it.
     cloud  - Firebase. Every account and its progress is saved online, so a student can log in from any
              device, and the leaderboard shows every student who has an account.
   createStore() at the bottom picks cloud when config.js has the two Firebase values, otherwise local.

   Functions both stores have (all async):
     resume()                 the user already logged in on this device, or null
     signUp(sid, name, pw)    -> { ok: true, user } or { ok: false, msg }
     signIn(sid, pw)          -> { ok: true, user } or { ok: false, msg }
     signOut()
     save(user)               store the user's progress and refresh their leaderboard entry
     profiles()               -> [{ id, name, points }] for the leaderboard                      */

/* Browser storage that never throws (private windows and some in-app previews block it) and falls back to memory. */
SL.device = (() => {
  const mem = {};
  let works = null;
  return {
    get(key) {
      try { const v = localStorage.getItem(key); if (v !== null) return JSON.parse(v); } catch (e) { /* use memory */ }
      return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
    },
    set(key, value) { mem[key] = value; try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* memory only */ } },
    remove(key) { delete mem[key]; try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
    /* false when the browser blocks storage: whatever is saved here would be gone after a reload */
    persistent() {
      if (works === null) {
        try { localStorage.setItem('serverlab.probe', '1'); works = localStorage.getItem('serverlab.probe') === '1'; localStorage.removeItem('serverlab.probe'); } catch (e) { works = false; }
      }
      return works;
    },
  };
})();

/* ---------- local store: this browser only ---------- */
SL.makeLocalStore = () => {
  const KEY = 'serverlab.v1';
  const db = { users: Object.create(null), session: null };
  const raw = SL.device.get(KEY);
  if (raw && typeof raw === 'object') {
    if (raw.users && typeof raw.users === 'object') {
      for (const k of Object.keys(raw.users)) { const r = raw.users[k], u = SL.normalizeUser(r, k); u.hash = r.hash; u.salt = r.salt; db.users[k] = u; }
    }
    db.session = raw.session || null;
  }
  const persist = () => SL.device.set(KEY, db);
  return {
    kind: 'local',
    shared: false,
    async resume() { return (db.session && db.users[db.session]) || null; },
    async signUp(sid, name, pw) {
      if (db.users[sid]) return { ok: false, msg: 'That student ID already has an account. Use Log in.' };
      const salt = Math.random().toString(36).slice(2);
      const u = SL.newUser(sid, name.slice(0, 40), await SL.hashPassword(pw, salt), salt);
      db.users[sid] = u; db.session = sid; persist();
      return { ok: true, user: u };
    },
    async signIn(sid, pw) {
      const u = db.users[sid];
      if (!u) return { ok: false, msg: 'No account with that student ID on this device. Check it, or create an account.' };
      if ((await SL.hashPassword(pw, u.salt)) !== u.hash) return { ok: false, msg: 'That password is not right. Passwords are case-sensitive.' };
      db.session = sid; persist();
      return { ok: true, user: u };
    },
    async signOut() { db.session = null; persist(); },
    async save(user) { db.users[user.id] = user; persist(); },
    async profiles() { return Object.values(db.users).map((u) => ({ id: u.id, name: u.name, points: SL.totalPoints(u) })); },
  };
};

/* ---------- cloud store: Firebase Authentication + Realtime Database, called with plain fetch ---------- */
SL.makeCloudStore = (cfg) => {
  const doFetch = cfg.fetch || ((...a) => fetch(...a));   // cfg.fetch / authBase / tokenBase exist so tests can run without the internet
  const AUTH = (cfg.authBase || 'https://identitytoolkit.googleapis.com').replace(/\/+$/, '');
  const TOKEN = (cfg.tokenBase || 'https://securetoken.googleapis.com').replace(/\/+$/, '');
  const DB = String(cfg.databaseURL).replace(/\/+$/, '');
  const KEY = 'serverlab.cloud.v1';
  let sess = null;   // { uid, sid, refresh, idToken, exp }: who is logged in on this device

  const BAD_LOGIN = 'That student ID and password do not match. Check both, or create an account.';
  const MSG = {
    EMAIL_EXISTS: 'That student ID already has an account. Use Log in.',
    EMAIL_NOT_FOUND: BAD_LOGIN, INVALID_PASSWORD: BAD_LOGIN, INVALID_LOGIN_CREDENTIALS: BAD_LOGIN,
    WEAK_PASSWORD: 'Password needs at least 6 characters.',
    INVALID_EMAIL: 'That student ID cannot be used to log in. Use letters, numbers, dashes or underscores.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries from this device. Wait a few minutes, then try again.',
    USER_DISABLED: 'This account was disabled. Ask your teacher.',
    OPERATION_NOT_ALLOWED: 'Online accounts are not switched on yet. In Firebase open Authentication, then Sign-in method, and enable Email/Password.',
    API_KEY_INVALID: 'The apiKey in config.js is not right. Copy it again from the Firebase project settings.',
    denied: 'The class server refused to save. Your teacher needs to check the Realtime Database rules (see README.md).',
    network: 'Cannot reach the class server. Check your internet connection and try again.',
  };
  const fail = (code, status) => Object.assign(new Error(code), { code, status });
  const say = (e) => MSG[e && e.code] || 'Something went wrong (' + ((e && e.code) || 'unknown') + '). Try again.';

  async function call(url, opts) {
    let res, body = null;
    try { res = await doFetch(url, opts); } catch (e) { throw fail('network'); }
    try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) {
      const raw = String((body && body.error && (body.error.message || body.error)) || '');
      let code = raw.split(/[ :]/)[0];
      if (/api key/i.test(raw)) code = 'API_KEY_INVALID';
      else if (res.status === 401 || res.status === 403) code = MSG[code] ? code : 'denied';
      throw fail(code || 'http_' + res.status, res.status);
    }
    return body;
  }

  /* --- login session --- */
  const setSession = (s) => { sess = s; SL.device.set(KEY, { uid: s.uid, sid: s.sid, refresh: s.refresh }); };
  const clearSession = () => { sess = null; SL.device.remove(KEY); };
  async function refresh() {
    const d = await call(`${TOKEN}/v1/token?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(sess.refresh),
    });
    setSession({ uid: d.user_id || sess.uid, sid: sess.sid, refresh: d.refresh_token || sess.refresh, idToken: d.id_token, exp: Date.now() + (Number(d.expires_in) || 3600) * 1000 });
  }
  async function token() {
    if (!sess) throw fail('no_session');
    if (!sess.idToken || Date.now() > sess.exp - 60000) await refresh();   // ID tokens last about an hour
    return sess.idToken;
  }
  async function authCall(kind, sid, pw) {
    const d = await call(`${AUTH}/v1/accounts:${kind}?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // the student ID becomes the login name: 2026-0142 -> 2026-0142@students.serverlab.app (not a real mailbox, nothing is ever sent to it)
      body: JSON.stringify({ email: sid + '@students.serverlab.app', password: pw, returnSecureToken: true }),
    });
    setSession({ uid: d.localId, sid, refresh: d.refreshToken, idToken: d.idToken, exp: Date.now() + (Number(d.expiresIn) || 3600) * 1000 });
  }

  /* --- database: accounts/<uid> is private to its owner, profiles/<uid> is the public leaderboard entry --- */
  async function rtdb(method, path, data, retried) {
    const t = await token();
    const opts = { method };
    if (data !== undefined) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(data); }
    try { return await call(`${DB}/${path}.json?auth=${encodeURIComponent(t)}`, opts); }
    catch (e) {
      // "refused" can just mean the login token expired (or this computer's clock is off): get a fresh one and try once more
      if (e.status === 401 && !retried) { await refresh(); return rtdb(method, path, data, true); }
      throw e;
    }
  }
  async function saveUser(user) {
    const record = Object.assign({}, user); delete record.hash; delete record.salt;
    await Promise.all([rtdb('PUT', 'accounts/' + user.id, record), rtdb('PUT', 'profiles/' + user.id, SL.profileOf(user))]);
  }
  async function loadUser() {
    const raw = await rtdb('GET', 'accounts/' + sess.uid);
    if (raw) return SL.normalizeUser(raw, sess.uid);
    const u = SL.normalizeUser({ name: sess.sid, sid: sess.sid }, sess.uid);   // login worked but the record never got saved: start a fresh one
    await saveUser(u);
    return u;
  }

  return {
    kind: 'cloud',
    shared: true,
    async resume() {
      const s = SL.device.get(KEY);
      if (!s || !s.refresh) return null;
      sess = { uid: s.uid, sid: s.sid, refresh: s.refresh, idToken: '', exp: 0 };
      try { await refresh(); return await loadUser(); }
      catch (e) {
        if (e.code === 'network' || e.code === 'denied') throw Object.assign(e, { message: say(e) });   // keep the login, the problem is not the account
        clearSession(); return null;                                                                   // token no longer valid: log in again
      }
    },
    async signUp(sid, name, pw) {
      try { await authCall('signUp', sid, pw); } catch (e) { return { ok: false, msg: say(e) }; }
      const user = SL.normalizeUser({ name, sid, created: Date.now() }, sess.uid);
      try { try { await saveUser(user); } catch (e) { await saveUser(user); } }   // one retry, then give up
      catch (e) { clearSession(); return { ok: false, msg: 'Your login was created but the account could not be saved yet. Log in to finish setting it up. (' + say(e) + ')' }; }
      return { ok: true, user };
    },
    async signIn(sid, pw) {
      try { await authCall('signInWithPassword', sid, pw); return { ok: true, user: await loadUser() }; }
      catch (e) { return { ok: false, msg: say(e) }; }
    },
    async signOut() { clearSession(); },
    async save(user) { await saveUser(user); },
    async profiles() {
      const all = (await rtdb('GET', 'profiles')) || {};
      return Object.keys(all).map((id) => ({ id, name: String((all[id] && all[id].name) || 'Student'), points: Number(all[id] && all[id].points) || 0 }));
    },
    say,
  };
};

/* Pick the store from config.js */
SL.createStore = () => {
  const c = (SL.CONFIG && SL.CONFIG.firebase) || {};
  return c.apiKey && c.databaseURL ? SL.makeCloudStore(c) : SL.makeLocalStore();
};