/* ServerLab logic: step checks, scoring, levels, badges, quiz. Pure functions, no DOM. */

const _ok = (msg) => ({ kind: 'ok', msg });
const _bad = (msg) => ({ kind: 'bad', msg });
const _local = (patch, msg) => ({ kind: 'local', patch, msg });
const _nudge = (msg, patch) => ({ kind: 'nudge', msg, patch });

SL.stepIndex = (id, unitId = 'coc3') => SL.UNITS[unitId].steps.findIndex((s) => s.id === id);

/* Starting local (screen) state for each step. */
SL.initLocal = (id) => {
  switch (id) {
    /* COC 3 */
    case 'language': return { lang: SL.LANGS[0], time: SL.TIMES[0], kb: SL.KBS[0] };
    case 'edition': return { sel: null };
    case 'license': return { checked: false };
    case 'disk1': return { sel: false };
    case 'disk2': return { size: '61440', dialog: false };
    case 'disk3': return { sel: null };
    case 'password': return { p1: '', p2: '' };
    case 'signin': return { stage: 'lock', pw: '' };
    case 'sm': return { page: 'dash' };
    /* COC 4 */
    case 'c4_ohs': return { strapped: false };
    case 'c4_phys': return { cableFixed: false };
    case 'c4_ipconfig':
    case 'c4_release':
    case 'c4_renew':
    case 'c4_ping':
    case 'c4_dns': return { cmd: '', log: [] };
    case 'c4_5s': return { cleaned: false };
    default: return {};
  }
};

/* Password rule used in COC 3: 8+ characters and 3 of 4 character types. */
SL.passwordCheck = (p) => {
  const types = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (!p) return { ok: false, msg: 'The Administrator password cannot be blank. Type a password in both boxes.' };
  if (p.length < 8) return { ok: false, msg: 'Too short. The lab rule is at least 8 characters.' };
  if (types < 3) return { ok: false, msg: 'Not complex enough. Use 3 of these 4: uppercase, lowercase, numbers, symbols. Example: Server2019.' };
  return { ok: true, msg: '' };
};

/* Helper to normalize CLI commands in COC 4 */
const _normCmd = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/*
  Check one action on one step.
  a = action name, p = payload, l = local state of this step, vm = lab data
  Returns { kind: 'ok'|'bad'|'local'|'nudge', msg?, patch?, vm? }
*/
SL.check = (id, a, p, l, vm) => {
  switch (id) {
    /* ---------- COC 3 ---------- */
    case 'boot':
      if (a !== 'boot') return null;
      if (p === 'cd') return _ok();
      if (p === 'hdd') return _bad('The hard disk is empty, so there is nothing on it to boot. The installer is on the CD/DVD (the ISO).');
      if (p === 'pxe') return _bad('Network (PXE) boot needs a deployment server on the network. This lab installs from the ISO instead.');
      return null;

    case 'language':
      if (a === 'set') return _local({ [p.field]: p.value });
      if (a === 'next') {
        if (l.lang !== SL.LANGS[0]) return _bad('Language should be English (United States) so every screen matches your lab manual.');
        if (l.time !== SL.TIMES[0]) return _bad('Time and currency format should be English (United States) for this lab.');
        if (l.kb !== SL.KBS[0]) return _bad('Keyboard should be US. With another layout, symbols like @ and " land on different keys when you type the password.');
        return _ok();
      }
      return null;

    case 'install':
      if (a === 'install') return _ok();
      if (a === 'repair') return _bad('Repair your computer fixes a Windows that is already installed. This disk is empty, so choose Install now.');
      return null;

    case 'edition':
      if (a === 'sel') return _local({ sel: Number(p) });
      if (a === 'next') {
        if (l.sel === null) return _nudge('Next stays grey until you select an edition. Click one in the list first.');
        if (l.sel === 1) return _ok();
        if (l.sel === 0) return _bad('Plain "Standard" installs Server Core: no desktop, only a command prompt. We want the GUI, so pick the Desktop Experience edition.');
        if (l.sel === 2) return _bad('Plain "Datacenter" is also Server Core (no GUI) and is licensed for large virtualised servers. Pick Standard (Desktop Experience).');
        return _bad('Datacenter (Desktop Experience) has the GUI, but Datacenter is for heavily virtualised servers. This lab uses Standard (Desktop Experience).');
      }
      return null;

    case 'license':
      if (a === 'toggle') return _local({ checked: !l.checked });
      if (a === 'next') return l.checked ? _ok() : _nudge('Next is grey until you tick "I accept the license terms".');
      return null;

    case 'type':
      if (a === 'custom') return _ok();
      if (a === 'upgrade') return _bad('Upgrade keeps files and settings from an older Windows. The disk is empty and you booted from media, so there is nothing to upgrade. Choose Custom.');
      return null;

    case 'disk1':
      if (a === 'sel') return _local({ sel: true });
      if (a === 'new') return l.sel ? _ok() : _nudge('New is grey until you select the unallocated space. Click the row first.');
      if (a === 'loaddrv') return _bad('Load driver is only for when Setup cannot see the disk. Here the 60 GB disk is already listed.');
      if (a === 'disabled') return _nudge('Delete, Extend and Format stay grey because nothing is partitioned yet. Use New.');
      return null;

    case 'disk2': {
      if (a === 'size') return _local({ size: String(p) });
      if (a === 'cancel') return _bad('Cancel leaves the disk without a partition. Click Apply to create it.');
      if (a === 'apply') {
        const n = Number(l.size);
        if (!Number.isFinite(n) || l.size === '') return _bad('Type a size in MB. The full disk is 61440.');
        if (n < 32768) return _bad('Windows Server 2019 needs at least 32 GB (32768 MB). Use the whole 61440 MB to leave room for updates.');
        if (n > 61440) return _bad('The disk is only 61440 MB, so a partition cannot be bigger than that.');
        return _local({ dialog: true });
      }
      if (a === 'dialogok') {
        const n = Number(l.size);
        return Object.assign(_ok(), { vm: { parts: [{ name: 'Drive 0 Partition 1: System Reserved', total: '500.0 MB', free: '481.0 MB', type: 'System' }, { name: 'Drive 0 Partition 2', total: (Math.max(n - 500, 0) / 1024).toFixed(1) + ' GB', free: (Math.max(n - 500, 0) / 1024).toFixed(1) + ' GB', type: 'Primary' }] } });
      }
      return null;
    }

    case 'disk3':
      if (a === 'sel') return _local({ sel: Number(p) });
      if (a === 'delete') return _bad('Deleting wipes the partitions you just made. Select Partition 2 (Primary) and click Next.');
      if (a === 'next') {
        if (l.sel === null) return _nudge('Next waits for you to select a partition. Click Partition 2.');
        if (l.sel === 0) return _bad('System Reserved is a small partition for boot files, too small for Windows. Install on the large Primary partition (Partition 2).');
        return _ok();
      }
      return null;

    case 'install2':
      if (a === 'ff') return _ok();
      return null;

    case 'password':
      if (a === 'set') return _local({ [p.field]: p.value });
      if (a === 'finish') {
        if (l.p1 !== l.p2) return _bad('The two passwords do not match. Type the same password in Password and Reenter password.');
        const c = SL.passwordCheck(l.p1);
        if (!c.ok) return _bad(c.msg);
        return Object.assign(_ok(), { vm: { adminPass: l.p1 } });
      }
      return null;

    case 'signin':
      if (a === 'cad') return l.stage === 'lock' ? _local({ stage: 'signin' }, 'Good. Now sign in as Administrator.') : _nudge('You are already past the lock screen. Type the password.');
      if (a === 'lockclick') return _nudge('Click does nothing here. Use the Ctrl+Alt+Del button above the screen. On a real keyboard it is three keys together.');
      if (a === 'set') return _local({ pw: p.value });
      if (a === 'signin') {
        if (l.stage !== 'signin') return _nudge('Unlock the screen first with Ctrl+Alt+Del.');
        if (l.pw !== vm.adminPass) return _bad('That is not the password you created in the Customize settings step. Passwords are case-sensitive.');
        return _ok();
      }
      return null;

    case 'sm':
      if (a === 'nav') {
        if (p === 'local') return _local({ page: 'local' });
        return _nudge('That page opens, but this task needs Local Server.', { page: p });
      }
      if (a === 'tile') return _nudge('Adding roles comes later, after the server is installed and named. Open Local Server first.');
      if (a === 'name') return l.page === 'local' ? _ok() : _nudge('Open Local Server first.');
      return null;

    /* ---------- COC 4 ---------- */
    case 'c4_ohs':
      if (a === 'tool') {
        if (p === 'strap') return _ok();
        if (p === 'opencase') return _bad('Never open a system case or touch internal ports before grounding yourself with an anti-static wrist strap.');
        if (p === 'screw') return _bad('Do not disassemble the chassis yet. Put on your ESD wrist strap first.');
        if (p === 'crimper') return _bad('You do not need to crimp a new cable before checking ESD safety and inspecting the connection.');
      }
      return null;

    case 'c4_phys':
      if (a === 'inspect') {
        if (p === 'rj45') return _ok();
        if (p === 'psu') return _bad('The power supply fan is spinning and the PC is booted. Check the Ethernet port link LED.');
        if (p === 'hdmi') return _bad('The display is working fine. Look at the RJ45 network port—its link light is off.');
      }
      return null;

    case 'c4_ipconfig':
      if (a === 'set') return _local({ cmd: p.value });
      if (a === 'run') {
        const c = _normCmd(l.cmd);
        if (c === 'ipconfig /all' || c === 'ipconfig') {
          return Object.assign(_ok(), {
            vm: { cliHistory: ['C:\\> ' + l.cmd.trim(), 'Ethernet adapter Ethernet0:', '   DHCP Enabled. . . . . . . . . . . : Yes', '   Autoconfiguration IPv4 Address. . : 169.254.18.42 (Preferred)', '   Subnet Mask . . . . . . . . . . . : 255.255.0.0', '   Default Gateway . . . . . . . . . :'] }
          });
        }
        if (!c) return _nudge('Type ipconfig /all in the Command Prompt and press Enter.');
        return _bad('"' + l.cmd.trim() + '" will not show the adapter IP details. Run ipconfig /all first.');
      }
      return null;

    case 'c4_release':
      if (a === 'set') return _local({ cmd: p.value });
      if (a === 'run') {
        const c = _normCmd(l.cmd);
        if (c === 'ipconfig /release') {
          const hist = (vm.cliHistory || []).concat(['C:\\> ' + l.cmd.trim(), 'IPv4 Address released for adapter Ethernet0.']);
          return Object.assign(_ok(), { vm: { cliHistory: hist } });
        }
        if (c === 'ipconfig /renew') return _bad('Release the stale APIPA address first with ipconfig /release before renewing.');
        if (!c) return _nudge('Type ipconfig /release and press Enter.');
        return _bad('Use ipconfig /release to drop the invalid 169.254.x.x configuration.');
      }
      return null;

    case 'c4_renew':
      if (a === 'set') return _local({ cmd: p.value });
      if (a === 'run') {
        const c = _normCmd(l.cmd);
        if (c === 'ipconfig /renew') {
          const hist = (vm.cliHistory || []).concat(['C:\\> ' + l.cmd.trim(), 'Ethernet adapter Ethernet0:', '   IPv4 Address. . . . . . . . . . . : 192.168.1.105', '   Subnet Mask . . . . . . . . . . . : 255.255.255.0', '   Default Gateway . . . . . . . . . : 192.168.1.1']);
          return Object.assign(_ok(), { vm: { cliHistory: hist } });
        }
        if (!c) return _nudge('Type ipconfig /renew and press Enter.');
        return _bad('Run ipconfig /renew to lease a valid IP address from the DHCP server.');
      }
      return null;

    case 'c4_ping':
      if (a === 'set') return _local({ cmd: p.value });
      if (a === 'run') {
        const c = _normCmd(l.cmd);
        if (c === 'ping 192.168.1.1') {
          const hist = (vm.cliHistory || []).concat(['C:\\> ' + l.cmd.trim(), 'Reply from 192.168.1.1: bytes=32 time<1ms TTL=64', 'Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)']);
          return Object.assign(_ok(), { vm: { cliHistory: hist } });
        }
        if (c === 'ping 127.0.0.1' || c === 'ping localhost') return _bad('127.0.0.1 only tests the local loopback adapter. Ping the default gateway (192.168.1.1) to test the LAN link.');
        if (!c) return _nudge('Type ping 192.168.1.1 and press Enter.');
        return _bad('Test local network connectivity by running ping 192.168.1.1.');
      }
      return null;

    case 'c4_dns':
      if (a === 'set') return _local({ cmd: p.value });
      if (a === 'run') {
        const c = _normCmd(l.cmd);
        if (c === 'ping google.com' || c === 'nslookup google.com') {
          const hist = (vm.cliHistory || []).concat(['C:\\> ' + l.cmd.trim(), 'Pinging google.com [142.250.190.46] with 32 bytes of data:', 'Reply from 142.250.190.46: bytes=32 time=14ms TTL=117', 'Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)']);
          return Object.assign(_ok(), { vm: { cliHistory: hist } });
        }
        if (!c) return _nudge('Type ping google.com and press Enter.');
        return _bad('Test external DNS resolution by running ping google.com.');
      }
      return null;

    case 'c4_5s':
      if (a === 'clean5s') return _local({ cleaned: true }, 'Work area organized and tools stored (5S complete). Now submit the service report.');
      if (a === 'submitreport') {
        if (!l.cleaned) return _bad('Apply 5S housekeeping first! Clear and organize your tools before signing off the service report.');
        return _ok();
      }
      return null;
  }
  return null;
};

/* Points for finishing a step. Guided: 10 first try, 5 after a mistake or a hint. Challenge: 20 / 10. */
SL.stepPoints = (mode, mistakes, hinted) => {
  const base = mode === 'challenge' ? 20 : 10;
  return mistakes > 0 || hinted ? base / 2 : base;
};

/* Best points per step + best quiz scores across all units. */
SL.totalPoints = (user) => {
  const steps = Object.values(user.stepBest || {}).reduce((a, b) => a + b, 0);
  const p = user.progress || {};
  const q3 = p.coc3 && p.coc3.assess && p.coc3.assess.best != null ? p.coc3.assess.best * 10 : (user.assess && user.assess.best != null ? user.assess.best * 10 : 0);
  const q4 = p.coc4 && p.coc4.assess && p.coc4.assess.best != null ? p.coc4.assess.best * 10 : 0;
  return steps + q3 + q4;
};

SL.levelFor = (points) => {
  let cur = SL.LEVELS[0];
  for (const l of SL.LEVELS) if (points >= l.at) cur = l;
  const next = SL.LEVELS.find((l) => l.at > points) || null;
  return { cur, next, into: points - cur.at, span: next ? next.at - cur.at : 1 };
};

SL.boardFrom = (profiles, meId, withSamples = true) => {
  const rows = withSamples ? SL.SAMPLES.map((s) => ({ name: s.name, points: s.points, sample: true, me: false })) : [];
  for (const p of profiles) rows.push({ name: p.name, points: p.points, sample: false, me: p.id === meId });
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  return rows.map((r, i) => Object.assign(r, { rank: i + 1, level: SL.levelFor(r.points).cur }));
};
SL.board = (users, meId) => SL.boardFrom(Object.values(users).map((u) => ({ id: u.id, name: u.name, points: SL.totalPoints(u) })), meId, true);

SL.profileOf = (u) => {
  const p = u.progress || {};
  const totalDone = (p.coc3 ? p.coc3.done : (u.done || 0)) + (p.coc4 ? p.coc4.done : 0);
  return { name: String(u.name).slice(0, 40), points: SL.totalPoints(u), done: totalDone, badges: Object.keys(u.badges || {}).length, at: Date.now() };
};

const _normAssess = (raw) => {
  const a = raw || {};
  return {
    best: a.best == null ? null : Number(a.best),
    attempts: Array.isArray(a.attempts) ? a.attempts.slice() : Object.values(a.attempts || {}),
  };
};

/* Rebuild a full user from stored data, migrating older single-unit accounts cleanly. */
SL.normalizeUser = (raw, id) => {
  raw = raw && typeof raw === 'object' ? raw : {};
  const u = SL.newUser(id, String(raw.name || 'Student').slice(0, 40), '', '');
  delete u.hash; delete u.salt;
  if (raw.sid) u.sid = String(raw.sid);
  u.created = Number(raw.created) || u.created;
  u.stepBest = Object.assign({}, raw.stepBest);
  u.badges = Object.assign({}, raw.badges);
  u.clean = Object.assign({}, raw.clean);

  const rp = raw.progress || {};
  const c3Raw = rp.coc3 || { done: raw.done, assess: raw.assess };
  const c4Raw = rp.coc4 || { done: 0, assess: null };
  u.progress = {
    coc3: { done: Number(c3Raw.done) || 0, assess: _normAssess(c3Raw.assess) },
    coc4: { done: Number(c4Raw.done) || 0, assess: _normAssess(c4Raw.assess) },
  };
  u.done = u.progress.coc3.done;
  u.assess = u.progress.coc3.assess;
  return u;
};

SL.validSid = (s) => /^[a-z0-9](?:[a-z0-9_-]{0,28}[a-z0-9])$/.test(s);

/* Badges earned by an event. Returns the ids newly earned. */
SL.awardBadges = (user, ev) => {
  user.badges = user.badges || {};
  const got = [];
  const give = (id) => { if (!user.badges[id]) { user.badges[id] = true; got.push(id); } };
  if (ev.type === 'step') {
    if (ev.id === 'boot') give('first_boot');
    if (ev.id === 'edition' && ev.mistakes === 0 && !ev.hinted) give('right_edition');
    if (ev.id === 'disk3' && ['disk1', 'disk2', 'disk3'].every((k) => ev.clean[k])) give('clean_disk');
    if (ev.id === 'c4_ohs' && ev.mistakes === 0 && !ev.hinted) give('esd_safe');
    if (ev.id === 'c4_dns' && ['c4_phys', 'c4_ipconfig', 'c4_release', 'c4_renew', 'c4_ping', 'c4_dns'].every((k) => ev.clean[k])) give('net_doctor');
    if (ev.id === 'c4_5s') give('clean_5s');
  }
  if (ev.type === 'lesson' && ev.hints === 0) give('no_hints');
  if (ev.type === 'quiz') {
    if (ev.pct >= SL.PASS) give('club60');
    if (ev.pct === 100) give('full_marks');
  }
  return got;
};

/* Quiz */
SL.shuffle = (arr, rnd = Math.random) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
SL.newQuiz = (unitId = 'coc3', rnd = Math.random) => {
  const list = (SL.UNITS[unitId] || SL.UNITS.coc3).quiz;
  return {
    unitId,
    items: list.map((q) => { const opts = SL.shuffle(q.a, rnd); return { q: q.q, opts, correct: opts.indexOf(q.a[0]), why: q.why }; }),
    picks: list.map(() => null),
    i: 0,
  };
};
SL.scoreQuiz = (quiz) => {
  const total = quiz.items.length;
  const right = quiz.items.reduce((n, it, i) => n + (quiz.picks[i] === it.correct ? 1 : 0), 0);
  const pct = Math.round((right / total) * 100);
  return { right, total, pct, pass: pct >= SL.PASS };
};

/* Account helpers */
SL.hashPassword = async (pw, salt) => {
  try {
    const buf = new TextEncoder().encode(salt + ':' + pw);
    const d = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let h = 5381; const s = salt + ':' + pw;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return 'x' + h.toString(16);
  }
};
SL.newUser = (id, name, hash, salt) => ({
  id, name, hash, salt,
  created: Date.now(),
  stepBest: {},
  done: 0,
  badges: {},
  assess: { best: null, attempts: [] },
  progress: {
    coc3: { done: 0, assess: { best: null, attempts: [] } },
    coc4: { done: 0, assess: { best: null, attempts: [] } },
  },
  clean: {},
});

if (typeof module !== 'undefined') module.exports = SL;