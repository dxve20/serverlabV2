/* ServerLab UI: renders screens from state and wires clicks. Uses SL from data.js + logic.js. */
(function () {
  const $app = document.getElementById('app');
  const $toasts = document.getElementById('toasts');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = (n) => String(n).trim().split(/\s+/)[0];
  const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

  /* ---------- storage & theme ---------- */
  const store = SL.createStore();
  const MODE_KEY = 'serverlab.mode';
  const THEME_KEY = 'serverlab.theme';
  const savedTheme = SL.device.get(THEME_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.setAttribute('data-theme', savedTheme);

  const S = {
    view: 'home',
    unit: 'coc3',
    user: null,
    booting: true,
    busy: false,
    profiles: [],
    boardErr: '',
    mode: SL.device.get(MODE_KEY) === 'challenge' ? 'challenge' : 'guided',
    run: null,
    quiz: null,
    result: null,
    authTab: 'create',
    authErr: '',
    authVals: { name: '', sid: '' },
    sheet: null,
    confirmReset: false,
  };

  const activeUnit = (id = S.unit) => SL.UNITS[id] || SL.UNITS.coc3;
  const unitProg = (id = S.unit) => {
    if (!S.user.progress) S.user.progress = { coc3: { done: S.user.done || 0, assess: S.user.assess || { best: null, attempts: [] } }, coc4: { done: 0, assess: { best: null, attempts: [] } } };
    if (!S.user.progress[id]) S.user.progress[id] = { done: 0, assess: { best: null, attempts: [] } };
    return S.user.progress[id];
  };

  /* Save queue */
  let saving = false, saveAgain = false, saveWarned = false;
  async function save() {
    if (!S.user) return;
    if (saving) { saveAgain = true; return; }
    saving = true;
    try { await store.save(S.user); saveWarned = false; }
    catch (e) {
      if (!saveWarned) { saveWarned = true; toast('Could not save online. Check your connection. I will keep trying.'); }
      setTimeout(save, 10000);
    }
    saving = false;
    if (saveAgain) { saveAgain = false; save(); }
  }

  /* Leaderboard */
  let boardBusy = false;
  async function refreshBoard() {
    if (!S.user || boardBusy) return;
    boardBusy = true;
    try { S.profiles = await store.profiles(); S.boardErr = ''; } catch (e) { S.boardErr = 'Could not load the class leaderboard. Check your connection and press Refresh.'; }
    boardBusy = false;
    if (S.user && (S.view === 'home' || S.view === 'board')) render();
  }
  const boardRows = () => SL.boardFrom(S.profiles.filter((p) => p.id !== S.user.id).concat({ id: S.user.id, name: S.user.name, points: pts() }), S.user.id, !store.shared);

  /* ---------- small pieces ---------- */
  function forgeSvg(mood) {
    const edge = 'style="fill:var(--forge-edge)"', led = 'style="fill:var(--forge-led)"', ln = 'style="fill:none;stroke:var(--forge-led);stroke-width:3;stroke-linecap:round"';
    return `<svg class="forge-svg" data-mood="${mood}" viewBox="0 0 104 104" role="img" aria-label="Forge, your guide">
      <rect x="50" y="4" width="4" height="10" rx="2" ${edge}/><circle class="led-top" cx="52" cy="6" r="6" style="fill:var(--accent)"/>
      <rect x="30" y="84" width="44" height="14" rx="6" ${edge}/><rect x="2" y="34" width="8" height="26" rx="3" ${edge}/><rect x="94" y="34" width="8" height="26" rx="3" ${edge}/>
      <rect x="10" y="12" width="84" height="72" rx="16" style="fill:var(--forge-body);stroke:var(--forge-edge);stroke-width:3"/>
      <rect x="22" y="26" width="60" height="42" rx="10" style="fill:var(--forge-face)"/>
      <g class="e e-idle"><ellipse class="eye-led" cx="40" cy="43.5" rx="5" ry="6.5" ${led}/><ellipse class="eye-led" cx="64" cy="43.5" rx="5" ry="6.5" ${led}/></g>
      <rect class="m m-idle" x="45" y="56" width="14" height="3" rx="1.5" ${led}/>
      <g class="e e-happy"><path d="M33 47 A7 7 0 0 1 47 47" ${ln}/><path d="M57 47 A7 7 0 0 1 71 47" ${ln}/></g>
      <path class="m m-happy" d="M42 54 Q52 66 62 54" ${ln}/>
      <g class="e e-oops"><ellipse cx="40" cy="45" rx="5" ry="3" ${led}/><ellipse cx="64" cy="45" rx="5" ry="3" ${led}/></g>
      <path class="m m-oops" d="M44 62 Q52 54 60 62" ${ln}/></svg>`;
  }
  const logo = () => `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="6" style="fill:var(--primary)"/><rect x="5" y="6" width="18" height="4" rx="1" style="fill:var(--primary-ink)"/><rect x="5" y="12" width="18" height="4" rx="1" style="fill:var(--primary-ink)"/><rect x="5" y="18" width="18" height="4" rx="1" style="fill:var(--primary-ink)"/></svg>`;
  function leds(doneCount, cur, total, bad) {
    let h = '<div class="leds" aria-hidden="true">';
    for (let i = 0; i < total; i++) h += `<i class="${i < doneCount ? 'on' : i === cur ? (bad ? 'bad' : 'cur') : ''}"></i>`;
    return h + '</div>';
  }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = '<i></i>' + esc(msg);
    $toasts.appendChild(t); setTimeout(() => t.remove(), 2800);
    while ($toasts.children.length > 2) $toasts.firstChild.remove();
  }
  const rankOf = () => { const me = boardRows().find((r) => r.me); return me ? me.rank : 1; };
  const pts = () => SL.totalPoints(S.user);
  const isDark = () => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  /* ---------- login / sign up ---------- */
  function authView() {
    const c = S.authTab === 'create';
    return `<main class="auth"><div class="wrap auth-grid">
      <section class="auth-pitch">
        <div class="brand">${logo()}<span>ServerLab</span></div>
        <div class="eyebrow" style="margin-top:22px">COC 3 &amp; COC 4 · CSS</div>
        <h1>Master server setup and network repair hands-on.</h1>
        <p>A fast, interactive simulator for TESDA CSS NC II. Every right click and command earns points, and Forge explains every mistake.</p>
        <div class="pitch-forge">${forgeSvg('idle')}<div class="bubble"><span class="say-tag">Hi</span><p>I am Forge. Create an account so I can save your points and badges.</p></div></div>
      </section>
      <section class="auth-card" aria-labelledby="auth-h">
        <h2 id="auth-h" class="sr">${c ? 'Create account' : 'Log in'}</h2>
        <div class="seg" role="tablist"><button role="tab" aria-selected="${c}" data-act="authtab" data-p="create">Create account</button><button role="tab" aria-selected="${!c}" data-act="authtab" data-p="login">Log in</button></div>
        <form id="authform" class="auth-card" style="padding:0;border:0;box-shadow:none;background:none" novalidate>
          ${S.authErr ? `<div class="form-err" role="alert">${esc(S.authErr)}</div>` : ''}
          ${c ? `<div class="field"><label for="f-name">Full name</label><input id="f-name" name="name" autocomplete="name" placeholder="Mara Santos" value="${esc(S.authVals.name)}"></div>` : ''}
          <div class="field"><label for="f-sid">Student ID</label><input id="f-sid" name="sid" autocomplete="username" placeholder="e.g. 2026-0142" value="${esc(S.authVals.sid)}"></div>
          <div class="field"><label for="f-pw">Password</label><input id="f-pw" name="pw" type="password" autocomplete="${c ? 'new-password' : 'current-password'}" placeholder="${c ? 'At least 6 characters' : 'Your password'}"></div>
          <button class="btn primary" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Please wait…' : c ? 'Create account' : 'Log in'}</button>
          ${savingNote()}
        </form>
      </section></div></main>`;
  }
  function savingNote() {
    if (store.shared) return '<p class="fine">Your account, points and badges are saved online, so you can log in from any device or browser. The leaderboard is shared with your whole class.</p>';
    if (!SL.device.persistent()) return '<p class="form-warn" role="status"><b>This browser is blocking storage.</b> An account made here will be lost when you close the page. Open ServerLab in a normal browser tab, or ask your teacher to turn on online saving.</p>';
    return '<p class="fine">Online saving is off. Your account and points are kept in this browser only, so another device or browser will not see them. Turn on Firebase in config.js to sync across devices.</p>';
  }
  async function onAuth(form) {
    if (S.busy) return;
    const fd = new FormData(form), sid = String(fd.get('sid') || '').trim().toLowerCase(), pw = String(fd.get('pw') || '');
    S.authVals = { name: String(fd.get('name') || S.authVals.name || ''), sid: String(fd.get('sid') || '') };
    const fail = (m) => { S.busy = false; S.authErr = m; render(); const pwEl = document.getElementById('f-pw'); if (pwEl) pwEl.focus(); };
    const creating = S.authTab === 'create';
    let name = '';
    if (creating) {
      if (!SL.validSid(sid)) return fail('Enter your student ID: 2 to 30 letters or numbers. Dashes and underscores are fine in the middle.');
      name = String(fd.get('name') || '').trim();
      if (name.length < 2) return fail('Enter your full name.');
      if (pw.length < 6) return fail('Password needs at least 6 characters.');
    } else {
      if (sid.length < 2) return fail('Enter your student ID.');
      if (!pw) return fail('Type your password.');
    }
    S.busy = true; S.authErr = ''; render();
    const r = creating ? await store.signUp(sid, name, pw) : await store.signIn(sid, pw);
    if (!r.ok) return fail(r.msg);
    S.busy = false; S.user = r.user; S.authErr = ''; S.authVals = { name: '', sid: '' }; S.view = 'home';
    refreshBoard(); render();
    toast(creating ? 'Account created. Welcome, ' + first(name) + '.' : 'Welcome back, ' + first(r.user.name) + '.');
  }

  /* ---------- shell ---------- */
  function shell() {
    const u = S.user, tab = S.view === 'board' ? 'board' : S.view === 'badges' ? 'badges' : 'home';
    const tabs = [['home', 'Lessons'], ['board', 'Leaderboard'], ['badges', 'Badges']].map(([k, l]) => `<button class="tab" ${tab === k ? 'aria-current="page"' : ''} data-go="${k}">${l}</button>`).join('');
    return `<header class="appbar"><div class="wrap appbar-in">
      <div class="brand">${logo()}<span>ServerLab</span></div>
      <nav class="tabs" aria-label="Main">${tabs}</nav><span class="grow"></span>
      <span class="chip" aria-label="Your points"><i></i>${pts()} pts</span>
      <button class="iconbtn" data-act="theme" aria-label="Toggle color theme" title="Toggle light/dark theme">${isDark() ? '☀' : '☾'}</button>
      <button class="userbtn" data-act="account" aria-label="Account"><span class="avatar">${esc(initials(u.name))}</span><span>${esc(first(u.name))}</span></button>
    </div></header>
    <main class="wrap view" id="view">${bodyView()}</main>${sheetView()}`;
  }
  function bodyView() {
    switch (S.view) {
      case 'lesson': return S.run ? lessonView() : homeView();
      case 'board': return boardView();
      case 'badges': return badgesView();
      case 'quiz': return S.quiz ? quizView() : homeView();
      case 'result': return S.result ? resultView() : homeView();
      default: return homeView();
    }
  }

  /* ---------- home ---------- */
  function homeView() {
    const u = S.user, p = pts(), lv = SL.levelFor(p);
    const unitsList = Object.values(SL.UNITS);
    const totalAllSteps = unitsList.reduce((acc, un) => acc + un.steps.length, 0);
    const doneAllSteps = unitsList.reduce((acc, un) => acc + Math.min(unitProg(un.id).done || 0, un.steps.length), 0);

    const head = doneAllSteps === 0 ? `Start your first lab, ${esc(first(u.name))}.` : doneAllSteps >= totalAllSteps ? `All ${totalAllSteps} steps done, ${esc(first(u.name))}.` : `${doneAllSteps} of ${totalAllSteps} lab steps done, ${esc(first(u.name))}.`;

    const cards = unitsList.map((un) => {
      const total = un.steps.length;
      const prog = unitProg(un.id);
      const done = Math.min(prog.done || 0, total);
      const best = prog.assess ? prog.assess.best : null;
      const qLen = un.quiz.length;
      const bestPct = best == null ? null : Math.round((best / qLen) * 100);
      const startLabel = done === 0 ? 'Start lesson' : done >= total ? 'Replay lesson' : 'Continue lesson';
      const locked = done < total;
      const bestTxt = bestPct == null ? '' : `Best score ${bestPct}% ${bestPct >= SL.PASS ? '(passed)' : '(not passed yet)'}`;

      return `<article class="unit"><div class="ear l"></div><div class="unit-body">
        <div class="unit-top"><div><span class="unit-tag">${esc(un.tag)}</span><h3 style="margin-top:6px">${esc(un.title)}</h3></div>${leds(done, done, total)}</div>
        <p>${esc(un.desc)}</p>
        <div class="unit-actions">
          <button class="btn primary" data-act="startlesson" data-unit="${un.id}">${startLabel}</button>
          <button class="btn" data-act="study" data-unit="${un.id}">Study sheet</button>
          <button class="btn ${locked ? 'locked' : ''}" data-act="startquiz" data-unit="${un.id}" ${locked ? 'aria-disabled="true"' : ''}>Take assessment</button>
          <span class="note-lock">${locked ? 'Finish the lesson to unlock the assessment. Pass mark ' + SL.PASS + '%.' : bestTxt}</span>
        </div>
      </div><div class="ear r"></div></article>`;
    }).join('');

    return `<section class="hero">
      <div><div class="eyebrow">Welcome back</div><h1>${head}</h1>
        <div class="lvl"><div class="lvl-row"><span>Level ${lv.cur.n} · ${lv.cur.name}</span><span>${lv.next ? p + ' / ' + lv.next.at + ' pts' : p + ' pts · top level'}</span></div>
        <div class="meter" role="img" aria-label="Level progress"><b style="width:${lv.next ? Math.round((lv.into / lv.span) * 100) : 100}%"></b></div></div></div>
      <div class="stats"><div class="stat"><b>${p}</b><span>Points</span></div><div class="stat"><b>#${rankOf()}</b><span>Class rank</span></div>
        <div class="stat"><b>${doneAllSteps} / ${totalAllSteps}</b><span>Steps done</span></div><div class="stat"><b>${Object.keys(u.badges).length} / ${SL.BADGES.length}</b><span>Badges</span></div></div></section>
      <section><div class="sec-head"><h2>Your rack</h2></div><div class="units">${cards}</div></section>`;
  }

  /* ---------- leaderboard + badges ---------- */
  function boardView() {
    const rows = boardRows().map((r) => `<tr class="${r.me ? 'me' : ''}"><td class="rk">${r.rank}</td><td>${esc(r.name)}${r.me ? ' (you)' : ''}${r.sample ? '<span class="tag">sample</span>' : ''}<small class="lv">Lv ${r.level.n} · ${r.level.name}</small></td><td>Lv ${r.level.n} · ${r.level.name}</td><td class="num">${r.points}</td></tr>`).join('');
    const foot = store.shared ? 'Everyone with an account shows up here. Your points are saved when you finish a step. Press Refresh to see other students’ latest points.' : 'Sample classmates are placeholders, and online saving is off, so only accounts made in this browser show up here.';
    return `<section><div class="eyebrow">Leaderboard</div><h1 style="font-size:clamp(1.7rem,4.5vw,2.4rem);margin-block:4px 8px">Class leaderboard</h1>
      <p class="muted" style="max-width:62ch">A correct step earns 10 points on the first try (20 in Challenge mode), or half after a mistake or hint. Each question you get right in an assessment adds 10.</p></section>
      <section>${S.boardErr ? `<div class="form-err" role="alert">${esc(S.boardErr)}</div>` : ''}<div class="board-wrap"><table class="board"><thead><tr><th>Rank</th><th>Student</th><th>Level</th><th class="num">Points</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="board-foot"><p class="fine">${foot}</p><button class="btn small" data-act="refreshboard">Refresh</button></div></section>`;
  }
  function badgesView() {
    const u = S.user;
    const b = SL.BADGES.map((x) => `<div class="badge ${u.badges[x.id] ? 'got' : ''}"><div class="plate">${x.code}</div><div><h3>${x.title}</h3><p>${x.desc}</p></div></div>`).join('');
    const c3Att = (unitProg('coc3').assess.attempts || []).map((a) => Object.assign({ unit: 'COC 3' }, a));
    const c4Att = (unitProg('coc4').assess.attempts || []).map((a) => Object.assign({ unit: 'COC 4' }, a));
    const allAtt = c3Att.concat(c4Att).sort((a, b) => b.at - a.at);
    const att = allAtt.map((a) => `<div class="hrow"><span><b>${a.unit}</b> · ${new Date(a.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${a.right} of ${a.total} correct</span><b style="color:var(--${a.pass ? 'good' : 'bad'})">${a.pct}% ${a.pass ? 'passed' : 'not passed'}</b></div>`).join('');
    return `<section><div class="eyebrow">Achievements</div><h1 style="font-size:clamp(1.7rem,4.5vw,2.4rem);margin-block:4px 8px">Badges · ${Object.keys(u.badges).length} of ${SL.BADGES.length}</h1></section>
      <section><div class="badges">${b}</div></section>
      <section><div class="sec-head"><h2>Assessment history</h2></div><div class="history">${att || '<p class="muted">No attempts yet. Finish a lesson to unlock its assessment.</p>'}</div></section>`;
  }

  /* ---------- lesson ---------- */
  function defaultVm(unitId, from) {
    if (unitId === 'coc4') {
      return {
        cliHistory: from >= 2 ? ['Microsoft Windows [Version 10.0.17763.1]', '(c) 2018 Microsoft Corporation. All rights reserved.'] : [],
      };
    }
    const vm = { compName: 'WIN-' + Array.from({ length: 11 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('') };
    if (from >= 8) vm.parts = [{ name: 'Drive 0 Partition 1: System Reserved', total: '500.0 MB', free: '481.0 MB', type: 'System' }, { name: 'Drive 0 Partition 2', total: '59.5 GB', free: '59.5 GB', type: 'Primary' }];
    if (from >= 11) vm.adminPass = 'Lab@2019';
    return vm;
  }
  function startRun(from, unitId = S.unit) {
    S.unit = unitId;
    const un = activeUnit(unitId);
    const id = un.steps[from].id;
    S.run = { unitId, step: from, local: SL.initLocal(id), vm: defaultVm(unitId, from), mistakes: 0, hinted: false, hintsTotal: 0, mode: S.mode, say: { kind: 'goal' }, mood: 'idle', clean: {}, finished: false, shake: false };
    if (unitId === 'coc3' && from === 11) S.run.say = { kind: 'nudge', msg: 'Welcome back. Passwords are not saved, so your lab password is now Lab@2019.' };
    S.view = 'lesson';
  }
  const goalText = (run) => {
    const steps = activeUnit(run.unitId).steps;
    return run.mode === 'challenge' ? 'Challenge mode: do this step from memory. I only speak up when you slip.' : steps[run.step].goal;
  };

  function bubbleView(run) {
    const say = run.say || { kind: 'goal' };
    let tag = 'Goal', cls = '', msg = say.msg || goalText(run), next = '';
    if (say.kind === 'good') { tag = say.pts ? 'Correct +' + say.pts : 'Correct'; cls = 'good'; next = ['Next step', run.finished ? 'Lesson complete. Take the assessment to check what stuck.' : goalText(run)]; }
    else if (say.kind === 'bad') { tag = 'Not quite'; cls = 'bad'; next = ['Try again', goalText(run)]; }
    else if (say.kind === 'hint') { tag = 'Hint'; next = ['Your step', goalText(run)]; }
    else if (say.kind === 'nudge') { tag = 'Heads up'; next = ['Your step', goalText(run)]; }
    return `<div class="bubble"><span class="say-tag ${cls}">${tag}</span><p>${esc(msg)}</p>${next ? `<div class="next"><small>${next[0]}</small>${esc(next[1])}</div>` : ''}</div>`;
  }
  function lessonView() {
    const run = S.run, un = activeUnit(run.unitId), steps = un.steps, total = steps.length;
    const step = steps[run.step], n = run.step + 1;
    const shake = run.shake; run.shake = false;
    const guided = run.mode === 'guided';
    const isC3 = run.unitId === 'coc3';
    const cad = isC3 && step.id === 'signin' && run.local.stage === 'lock', ff = isC3 && step.id === 'install2';
    const barBtns = isC3
      ? `<button class="vm-btn ${cad ? 'pulse' : ''}" data-act="cad">Ctrl+Alt+Del</button><button class="vm-btn ${ff ? 'pulse' : ''}" data-act="ff">Fast-forward</button><button class="vm-btn" data-act="vmreset">Restart VM</button>`
      : `<button class="vm-btn" data-act="vmreset">Reset step</button>`;

    return `<div class="simbar"><div><div class="eyebrow">${esc(un.shortTitle)}</div><h2>${run.finished ? 'Lesson complete' : guided ? `Step ${n} of ${total}: ${step.title}` : `Step ${n} of ${total}`}</h2></div>
        <div class="unit-actions"><button class="btn small" data-act="study" data-unit="${run.unitId}">Study sheet</button><button class="btn small ghost" data-act="restart">Restart lesson</button><button class="btn small ghost" data-go="home">Back to lessons</button></div></div>
      <div class="sim">
        <div class="vm"><div class="vm-bar"><div class="title"><i></i><span>${isC3 ? 'WS2019-LAB · running' : 'WORKSTATION-04 · diagnostic bench'}</span></div>
          ${barBtns}</div>
          <div class="vm-screen ${shake ? 'shake' : ''}">${vmView(run)}</div></div>
        <aside class="forge" aria-live="polite" aria-label="Forge, your guide">
          <div class="forge-top"><div class="forge-fig">${forgeSvg(run.mood)}<div class="forge-meta"><b>Forge</b><span class="modepill">${guided ? 'Guided' : 'Challenge'}</span></div></div>${bubbleView(run)}</div>
          <div class="forge-foot">${leds(run.finished ? total : run.step, run.step, total, run.mistakes > 0)}<span class="runpts">Total ${pts()} pts</span></div>
          ${run.finished
            ? `<div class="done-box"><button class="btn primary" data-act="startquiz" data-unit="${run.unitId}">Take the assessment</button><button class="btn" data-go="home">Back to lessons</button></div>`
            : `<div class="forge-actions"><button class="btn small" data-act="hint">Need a hint?</button><button class="btn small ghost" data-act="mode">${guided ? 'Try Challenge mode' : 'Back to Guided'}</button></div>
               <p class="fine">This step: +${SL.stepPoints(run.mode, run.mistakes, run.hinted)} pts${run.mistakes || run.hinted ? ' (reduced)' : ''}</p>`}
        </aside></div>`;
  }

  /* VM & Workbench screens */
  const wbtn = (act, label, on, extra = '') => `<button class="wbtn ${on ? 'primary' : 'dim'}" data-act="${act}" ${on ? '' : 'aria-disabled="true"'} ${extra}>${label}</button>`;
  const win = (body, foot, cap = 'Windows Setup') => `<div class="setup"><div class="setup-win"><div class="setup-cap">${cap}</div><div class="setup-body">${body}</div>${foot ? `<div class="setup-foot">${foot}</div>` : ''}</div></div>`;
  const opts = (list, val) => list.map((o) => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('');
  function diskTable(rows, sel, interactive) {
    return `<div class="tbl" role="listbox"><div class="trow dk head"><span>Name</span><span>Total size</span><span>Free space</span></div>${rows.map((r, i) => `<button class="trow dk" role="option" aria-selected="${sel === i}" ${interactive ? `data-act="sel" data-p="${i}"` : 'tabindex="-1"'}><span>${esc(r[0])}</span><span>${r[1]}</span><span>${r[2]}</span></button>`).join('')}</div>`;
  }
  function cliScreen(run, placeholder) {
    const lines = (run.vm.cliHistory || ['Microsoft Windows [Version 10.0.17763.1]', '(c) 2018 Microsoft Corporation. All rights reserved.']).map((ln) => `<div>${esc(ln)}</div>`).join('');
    return `<div class="cli">
      <div class="cli-head">Administrator: Command Prompt</div>
      <div class="cli-out">${lines}</div>
      <div class="cli-in"><span>C:\\&gt;</span><input id="v-cmd" type="text" data-field="cmd" data-enter="run" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(run.local.cmd || '')}"><button class="vm-btn" data-act="run">Run</button></div>
    </div>`;
  }
  function vmView(run) {
    const l = run.local, vm = run.vm, id = activeUnit(run.unitId).steps[run.step].id, guided = run.mode === 'guided';
    switch (id) {
      /* COC 3 screens */
      case 'boot': return `<div class="fw"><div class="fw-h">Virtual BIOS · Boot menu</div><p>Select the device to boot from:</p>
        <button class="fw-opt" data-act="boot" data-p="hdd"><span>1</span>Hard Disk (empty)</button><button class="fw-opt" data-act="boot" data-p="cd"><span>2</span>CD/DVD Drive: Windows Server 2019</button><button class="fw-opt" data-act="boot" data-p="pxe"><span>3</span>Network boot (PXE)</button>
        <div class="fw-f">Click a device<span class="cursor"></span></div></div>`;
      case 'language': return win(`<h3>Windows Server 2019</h3>
        <div class="vmfield"><label for="v-lang">Language to install:</label><select id="v-lang" data-field="lang">${opts(SL.LANGS, l.lang)}</select></div>
        <div class="vmfield"><label for="v-time">Time and currency format:</label><select id="v-time" data-field="time">${opts(SL.TIMES, l.time)}</select></div>
        <div class="vmfield"><label for="v-kb">Keyboard or input method:</label><select id="v-kb" data-field="kb">${opts(SL.KBS, l.kb)}</select></div>`, wbtn('next', 'Next', true));
      case 'install': return win(`<div class="center-install"><h3>Windows Server 2019</h3><button class="wbtn primary big-install" data-act="install">Install now</button></div>`, '<button class="linkbtn" data-act="repair">Repair your computer</button>');
      case 'edition': {
        const d = l.sel === null ? 'Select an edition in the list to see what it installs.' : SL.EDITIONS[l.sel].desc;
        return win(`<h3>Select the operating system you want to install</h3><div class="tbl" role="listbox"><div class="trow ed head"><span>Operating system</span><span>Architecture</span></div>${SL.EDITIONS.map((e, i) => `<button class="trow ed" role="option" aria-selected="${l.sel === i}" data-act="sel" data-p="${i}"><span>${e.name}</span><span>x64</span></button>`).join('')}</div><div class="desc"><b>Description:</b> ${d}</div>`, wbtn('next', 'Next', l.sel !== null));
      }
      case 'license': return win(`<h3>Applicable notices and license terms</h3><div class="licbox" tabindex="0"><p><b>Sample text for the simulator.</b> The real screen shows the Microsoft Software License Terms for Windows Server 2019.</p><p>1. You may install and use the software on the server you are setting up.</p><p>2. Read the terms on the real installer before you accept them.</p><p>3. You must accept the terms to continue with the installation.</p></div>
        <label class="chk"><input type="checkbox" data-act="toggle" ${l.checked ? 'checked' : ''}> I accept the license terms</label>`, wbtn('next', 'Next', l.checked));
      case 'type': return win(`<h3>Which type of installation do you want?</h3>
        <button class="opt" data-act="upgrade"><b>Upgrade: Install Windows and keep files, settings, and applications</b><span>Files, settings and applications are moved to Windows with this option. It is only available when a supported version of Windows is already running.</span></button>
        <button class="opt" data-act="custom"><b>Custom: Install Windows only (advanced)</b><span>Files, settings and applications are not moved to Windows with this option. Use it to change partitions and drives.</span></button>`);
      case 'disk1': {
        const sel = l.sel;
        return win(`<h3>Where do you want to install Windows?</h3>${diskTable([['Drive 0 Unallocated Space', '60.0 GB', '60.0 GB']], sel ? 0 : -1, true)}
          <div class="dkbtns"><button class="linkbtn" tabindex="-1">Refresh</button><button class="linkbtn" aria-disabled="true" data-act="disabled">Delete</button><button class="linkbtn" aria-disabled="true" data-act="disabled">Format</button><button class="linkbtn ${sel ? '' : 'off'}" ${sel ? '' : 'aria-disabled="true"'} data-act="new">New</button><button class="linkbtn" data-act="loaddrv">Load driver</button><button class="linkbtn" aria-disabled="true" data-act="disabled">Extend</button></div>`, wbtn('noop', 'Next', false));
      }
      case 'disk2': return `<div style="position:relative">${win(`<h3>Where do you want to install Windows?</h3>${diskTable([['Drive 0 Unallocated Space', '60.0 GB', '60.0 GB']], 0, false)}
          <div class="vmfield"><label for="v-size">Size:</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="v-size" type="text" inputmode="numeric" data-field="size" data-enter="apply" value="${esc(l.size)}" style="max-width:140px"> MB <button class="wbtn primary" data-act="apply">Apply</button><button class="wbtn" data-act="cancel">Cancel</button></div></div>`, '')}
          ${l.dialog ? `<div class="vm-dialog" role="alertdialog" aria-label="Windows Setup message"><div class="win"><div class="cap">Windows Setup</div><div class="bd"><p>To ensure that all Windows features work correctly, Windows might create additional partitions for system files.</p></div><div class="ft"><button class="wbtn primary" data-act="dialogok">OK</button></div></div></div>` : ''}</div>`;
      case 'disk3': return win(`<h3>Where do you want to install Windows?</h3>${diskTable(vm.parts.map((p) => [p.name, p.total, p.free]), l.sel === null ? -1 : l.sel, true)}
          <div class="dkbtns"><button class="linkbtn" tabindex="-1">Refresh</button><button class="linkbtn" data-act="delete">Delete</button><button class="linkbtn" aria-disabled="true" data-act="disabled">Format</button><button class="linkbtn" aria-disabled="true" data-act="disabled">New</button><button class="linkbtn" aria-disabled="true" data-act="disabled">Extend</button></div>`, wbtn('next', 'Next', l.sel !== null));
      case 'install2': return win(`<h3>Installing Windows</h3><ul class="phases">${['Copying Windows files', 'Getting files ready for installation', 'Installing features', 'Installing updates', 'Finishing up'].map((t) => `<li class="todo">${t}</li>`).join('')}</ul><p class="skip-note">In real life this takes a while and the server restarts several times. Use Fast-forward above the screen to skip the wait.</p>`, '', 'Installing Windows');
      case 'password': return `<div class="bluepage"><h3>Customize settings</h3><p>Type a password for the built-in administrator account that you can use to sign in to this computer.</p>
        <div class="vmfield"><label for="v-user">User name</label><input id="v-user" type="text" value="Administrator" readonly></div>
        <div class="vmfield"><label for="v-p1">Password</label><input id="v-p1" type="password" data-field="p1" data-enter="finish" autocomplete="off" value="${esc(l.p1)}"></div>
        <div class="vmfield"><label for="v-p2">Reenter password</label><input id="v-p2" type="password" data-field="p2" data-enter="finish" autocomplete="off" value="${esc(l.p2)}"></div>
        ${guided ? '<p style="font-size:.85rem;opacity:.85">Lab rule: 8+ characters, with 3 of: uppercase, lowercase, numbers, symbols.</p>' : ''}
        <button class="wbtn primary" data-act="finish">Finish</button></div>`;
      case 'signin': {
        if (l.stage === 'lock') { const d = new Date(); return `<div class="bluepage lock" data-act="lockclick" role="button" tabindex="0"><div class="clock">${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '')}</div><div class="day">${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div><div class="msg">Press Ctrl+Alt+Delete to unlock</div></div>`; }
        return `<div class="bluepage signin"><div class="face"><svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="20" r="11" fill="#fff"/><path d="M6 52c2-13 12-19 22-19s20 6 22 19z" fill="#fff"/></svg></div><h3 style="font-size:1.4rem">Administrator</h3>
          <div class="row"><input type="password" aria-label="Password" placeholder="Password" data-field="pw" data-enter="signin" autocomplete="off" value="${esc(l.pw)}"><button data-act="signin" aria-label="Sign in">&rarr;</button></div></div>`;
      }
      case 'sm': {
        const nav = [['dash', 'Dashboard'], ['local', 'Local Server'], ['all', 'All Servers'], ['files', 'File and Storage Services']].map(([k, t]) => `<button class="${l.page === k ? 'on' : ''}" data-act="nav" data-p="${k}">${t}</button>`).join('');
        let main;
        if (l.page === 'local') main = `<div class="props"><h4>PROPERTIES For ${esc(vm.compName)}</h4><dl><dt>Computer name</dt><dd class="hl"><button class="linkbtn" data-act="name">${esc(vm.compName)}</button></dd><dt>Workgroup</dt><dd>WORKGROUP</dd><dt>Remote management</dt><dd>Enabled</dd><dt>Remote Desktop</dt><dd>Disabled</dd><dt>Operating system version</dt><dd>Microsoft Windows Server 2019 Standard</dd></dl></div>`;
        else if (l.page === 'dash') main = `<div class="welcome"><h4>WELCOME TO SERVER MANAGER</h4><ul><li><button data-act="tile"><span>1</span>Configure this local server</button></li><li><button data-act="tile"><span>2</span>Add roles and features</button></li><li><button data-act="tile"><span>3</span>Add other servers to manage</button></li><li><button data-act="tile"><span>4</span>Create a server group</button></li></ul></div>`;
        else main = `<p>This page works in the real Server Manager. This lesson only needs Local Server.</p>`;
        return `<div class="sm"><div class="sm-nav">${nav}</div><div class="sm-main"><div class="sm-head">Server Manager <small>› ${{ dash: 'Dashboard', local: 'Local Server', all: 'All Servers', files: 'File and Storage Services' }[l.page]}</small></div><div class="sm-body">${main}</div></div></div>`;
      }

      /* COC 4 screens */
      case 'c4_ohs': return `<div class="bench"><div class="fw-h">Technician Bench · OHS &amp; ESD Preparation</div><p>Ticket #409: Workstation-04 reports "No Internet / Unidentified Network". Select your first action:</p>
        <button class="fw-opt" data-act="tool" data-p="strap"><span>1</span>Equip Anti-Static Wrist Strap (ESD Grounding)</button>
        <button class="fw-opt" data-act="tool" data-p="opencase"><span>2</span>Remove side panel &amp; touch motherboard</button>
        <button class="fw-opt" data-act="tool" data-p="screw"><span>3</span>Unscrew power supply unit (PSU)</button>
        <button class="fw-opt" data-act="tool" data-p="crimper"><span>4</span>Cut and re-crimp the wall patch cable</button></div>`;
      case 'c4_phys': return `<div class="bench"><div class="fw-h">Rear I/O Panel · Physical Layer Inspection</div><p>ESD strap grounded. Inspect the rear ports of Workstation-04:</p>
        <button class="fw-opt" data-act="inspect" data-p="psu"><span>PWR</span>AC Power Cord &amp; PSU Fan — Spinning normally (Green LED)</button>
        <button class="fw-opt" data-act="inspect" data-p="hdmi"><span>VID</span>HDMI Display Port — Monitor active (1080p @ 60Hz)</button>
        <button class="fw-opt" data-act="inspect" data-p="rj45"><span>NIC</span>RJ45 Ethernet Port — Clip unlatched / cable loose (Link LED: OFF)</button></div>`;
      case 'c4_ipconfig': return cliScreen(run, 'Type ipconfig /all');
      case 'c4_release': return cliScreen(run, 'Type ipconfig /release');
      case 'c4_renew': return cliScreen(run, 'Type ipconfig /renew');
      case 'c4_ping': return cliScreen(run, 'Type ping 192.168.1.1');
      case 'c4_dns': return cliScreen(run, 'Type ping google.com');
      case 'c4_5s': return `<div class="bench"><div class="fw-h">Post-Repair Inspection, 5S &amp; Service Report</div>
        <p>Connectivity verified (Gateway &amp; DNS responding). Complete final wrap-up:</p>
        <div class="bench-card">
          <div><b>Status:</b> ${l.cleaned ? '5S Work Area Organized &amp; Tools Stored' : 'Tools still on bench (5S pending)'}</div>
          <div class="fw-actions" style="margin-top:12px">
            <button class="fw-btn" data-act="clean5s" ${l.cleaned ? 'disabled' : ''}>${l.cleaned ? '✓ 5S Cleanup Done' : '1. Apply 5S Cleanup'}</button>
            <button class="fw-btn" data-act="submitreport">2. Submit Service Report</button>
          </div>
        </div></div>`;
    }
    return '';
  }

  /* step actions */
  function act(a, p) {
    const run = S.run; if (!run || run.finished) return;
    const un = activeUnit(run.unitId);
    const step = un.steps[run.step];
    const r = SL.check(step.id, a, p, run.local, run.vm);
    if (!r) return;
    if (r.patch) Object.assign(run.local, r.patch);
    if (r.vm) Object.assign(run.vm, r.vm);
    if (r.kind === 'local') { run.mood = 'idle'; if (r.msg) run.say = { kind: 'good', msg: r.msg, pts: 0 }; }
    else if (r.kind === 'nudge') { run.mood = 'idle'; run.say = { kind: 'nudge', msg: r.msg }; }
    else if (r.kind === 'bad') { run.mistakes++; run.mood = 'oops'; run.shake = true; run.say = { kind: 'bad', msg: r.msg }; }
    else if (r.kind === 'ok') return completeStep(step);
    render();
  }
  function completeStep(step) {
    const run = S.run, u = S.user, un = activeUnit(run.unitId), total = un.steps.length;
    const earned = SL.stepPoints(run.mode, run.mistakes, run.hinted), prev = u.stepBest[step.id] || 0, gain = Math.max(0, earned - prev);
    u.stepBest[step.id] = Math.max(prev, earned);
    run.clean[step.id] = run.mistakes === 0 && !run.hinted;
    const prog = unitProg(run.unitId);
    prog.done = Math.max(prog.done || 0, run.step + 1);
    if (run.unitId === 'coc3') u.done = prog.done;
    const got = SL.awardBadges(u, { type: 'step', id: step.id, mistakes: run.mistakes, hinted: run.hinted, clean: run.clean });
    const last = run.step === total - 1;
    if (last) got.push(...SL.awardBadges(u, { type: 'lesson', hints: run.hintsTotal }));
    save();
    run.say = { kind: 'good', msg: step.ok, pts: gain }; run.mood = 'happy';
    if (last) run.finished = true; else { run.step++; run.local = SL.initLocal(un.steps[run.step].id); run.mistakes = 0; run.hinted = false; }
    render();
    const chip = document.querySelector('.chip'); if (chip && gain) chip.classList.add('pop');
    toast(gain ? '+' + gain + ' pts' : 'Correct. Points for this step were already counted.');
    for (const id of got) toast('Badge earned: ' + SL.BADGES.find((b) => b.id === id).title);
  }

  /* ---------- assessment ---------- */
  function quizView() {
    const q = S.quiz, un = activeUnit(q.unitId), it = q.items[q.i], last = q.i === q.items.length - 1;
    return `<section class="quiz"><div class="simbar"><div><div class="eyebrow">Assessment · ${q.unitId.toUpperCase()}</div><h2>Question ${q.i + 1} of ${q.items.length}</h2></div><span class="chip"><i></i>Pass mark ${SL.PASS}%</span></div>
      <div class="meter" role="img" aria-label="Quiz progress"><b style="width:${Math.round(((q.i + 1) / q.items.length) * 100)}%;background:var(--primary)"></b></div>
      <div class="qcard"><h2>${esc(it.q)}</h2><div class="choices" role="radiogroup" aria-label="Answers">${it.opts.map((o, j) => `<button class="choice" role="radio" aria-checked="${q.picks[q.i] === j}" data-act="pick" data-p="${j}"><span class="key">${'ABCD'[j]}</span><span>${esc(o)}</span></button>`).join('')}</div>
        <div class="qnav"><button class="btn ghost" data-act="qprev" ${q.i === 0 ? 'aria-disabled="true" style="visibility:hidden"' : ''}>Back</button><button class="btn primary" data-act="qnext">${last ? 'Finish assessment' : 'Next question'}</button></div></div></section>`;
  }
  function submitQuiz() {
    const u = S.user, q = S.quiz, sc = SL.scoreQuiz(q), prog = unitProg(q.unitId);
    prog.assess.attempts.push({ at: Date.now(), right: sc.right, total: sc.total, pct: sc.pct, pass: sc.pass });
    const prevBest = prog.assess.best == null ? -1 : prog.assess.best;
    prog.assess.best = Math.max(prevBest, sc.right);
    if (q.unitId === 'coc3') u.assess = prog.assess;
    const got = SL.awardBadges(u, { type: 'quiz', pct: sc.pct });
    save();
    S.result = Object.assign({ gain: Math.max(0, sc.right - Math.max(prevBest, 0)) * 10, quiz: q }, sc);
    S.quiz = null; S.view = 'result'; render(); window.scrollTo(0, 0);
    for (const id of got) toast('Badge earned: ' + SL.BADGES.find((b) => b.id === id).title);
  }
  function resultView() {
    const r = S.result, q = r.quiz, missed = q.items.map((it, i) => ({ it, i })).filter(({ it, i }) => q.picks[i] !== it.correct);
    const rev = missed.map(({ it, i }) => `<div class="ritem no"><b>Question ${i + 1} · ${esc(it.q)}</b><span>You chose: ${q.picks[i] == null ? 'no answer' : '"' + esc(it.opts[q.picks[i]]) + '"'}. Correct: "${esc(it.opts[it.correct])}".</span><span class="why">${esc(it.why)}</span></div>`).join('');
    return `<section class="quiz"><div class="qcard"><div class="score"><div class="ring" style="--p:${r.pct};--ringc:var(--${r.pass ? 'good' : 'bad'})"><div>${r.pct}%</div></div>
      <div><h2 class="verdict ${r.pass ? 'pass' : 'fail'}">${r.pass ? 'Passed' : 'Not yet'}</h2><p>You got ${r.right} of ${r.total} right. The pass mark is ${SL.PASS}%.</p><p class="muted">${r.gain ? '+' + r.gain + ' pts added to your total.' : 'No new points. Your best score still counts.'}</p></div></div>
      <div class="forge-top" style="align-items:flex-end"><div class="forge-fig">${forgeSvg(r.pass ? 'happy' : 'oops')}</div><div class="bubble" style="flex:1"><span class="say-tag ${r.pass ? 'good' : 'bad'}">${r.pass ? 'Well done' : 'Keep going'}</span><p>${r.pass ? (missed.length ? 'You know where each choice leads. Look at the ones you missed below.' : 'Every answer right. You know this topic cold.') : 'You need ' + Math.ceil(r.total * SL.PASS / 100) + ' right to pass. Read the reasons below, check the study sheet and try again.'}</p></div></div>
      ${missed.length ? `<div class="review"><h3>Review the ones you missed</h3>${rev}</div>` : ''}
      <div class="unit-actions"><button class="btn primary" data-go="home">Back to lessons</button><button class="btn" data-act="startquiz" data-unit="${q.unitId}">Retake assessment</button><button class="btn ghost" data-act="study" data-unit="${q.unitId}">Study sheet</button></div></div></section>`;
  }

  /* ---------- sheets ---------- */
  function sheetView() {
    if (S.sheet === 'study') {
      const un = activeUnit(S.unit);
      return `<div class="overlay" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-h"><h2 id="sh-h">Study sheet: ${esc(un.title)}</h2><p class="muted">Learn the order, then switch Forge to Challenge mode and run it from memory.</p><ol>${un.steps.map((s) => `<li><b>${s.title}.</b> ${s.short}.</li>`).join('')}</ol><button class="btn primary" data-act="closesheet">Close</button></div></div>`;
    }
    if (S.sheet === 'account') return `<div class="overlay" data-act="closesheet"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-h"><h2 id="sh-h">Your account</h2><p><b>${esc(S.user.name)}</b><br><span class="muted">Student ID ${esc(S.user.sid || S.user.id)}</span></p>
      <div class="unit-actions"><button class="btn" data-act="logout">Log out</button><button class="btn ${S.confirmReset ? 'primary' : ''}" data-act="reset">${S.confirmReset ? 'Yes, reset my progress' : 'Reset my progress'}</button><button class="btn ghost" data-act="closesheet">Close</button></div>
      <p class="fine">Reset clears your points, badges and scores for this account. ${store.shared ? 'Your progress is saved online.' : 'Progress is saved in this browser only.'}</p></div></div>`;
    return '';
  }

  /* ---------- render + events ---------- */
  function render() {
    const ae = document.activeElement, key = ae && ae !== document.body ? { act: ae.getAttribute('data-act'), p: ae.getAttribute('data-p'), id: ae.id, go: ae.getAttribute('data-go'), field: ae.getAttribute('data-field') } : null;
    $app.innerHTML = S.booting ? '<main class="auth"><div class="wrap"><p class="muted" role="status">Loading ServerLab…</p></div></main>' : S.user ? shell() : authView();
    if (key) {
      let el = null;
      if (key.id) el = document.getElementById(key.id);
      if (!el && key.field) el = $app.querySelector(`[data-field="${key.field}"]`);
      if (!el && key.act) el = $app.querySelector(`[data-act="${key.act}"]` + (key.p != null ? `[data-p="${key.p}"]` : ''));
      if (!el && key.go) el = $app.querySelector(`[data-go="${key.go}"]`);
      if (el && el.focus) el.focus({ preventScroll: true });
    }
  }
  function go(view) { S.view = view; S.sheet = null; render(); window.scrollTo(0, 0); if (view === 'board' || view === 'home') refreshBoard(); }
  function startQuiz(unitId = S.unit) {
    const un = activeUnit(unitId);
    if ((unitProg(unitId).done || 0) < un.steps.length) return toast('Finish the lesson first to unlock the assessment.');
    S.unit = unitId; S.quiz = SL.newQuiz(unitId); S.view = 'quiz'; S.sheet = null; render(); window.scrollTo(0, 0);
  }
  const handlers = {
    authtab: (p) => { S.authTab = p; S.authErr = ''; render(); },
    theme: () => {
      const next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      SL.device.set(THEME_KEY, next);
      render();
    },
    account: () => { S.sheet = 'account'; S.confirmReset = false; render(); },
    closesheet: (p, e) => { if (e.target.classList.contains('overlay') || e.target.closest('button')) { S.sheet = null; render(); } },
    study: (p, e, el) => { const u = el && el.getAttribute('data-unit'); if (u) S.unit = u; S.sheet = 'study'; render(); },
    refreshboard: () => { refreshBoard(); },
    logout: () => { store.signOut(); S.profiles = []; S.authErr = ''; S.authVals = { name: '', sid: '' }; S.user = null; S.run = null; S.quiz = null; S.sheet = null; S.view = 'home'; render(); },
    reset: () => {
      if (!S.confirmReset) { S.confirmReset = true; return render(); }
      const u = S.user; u.stepBest = {}; u.done = 0; u.badges = {}; u.assess = { best: null, attempts: [] };
      u.progress = { coc3: { done: 0, assess: { best: null, attempts: [] } }, coc4: { done: 0, assess: { best: null, attempts: [] } } };
      u.clean = {};
      S.run = null; S.confirmReset = false; S.sheet = null; save(); S.view = 'home'; render(); toast('Progress reset.');
    },
    startlesson: (p, e, el) => {
      const unitId = (el && el.getAttribute('data-unit')) || S.unit;
      const total = activeUnit(unitId).steps.length;
      const d = unitProg(unitId).done || 0;
      startRun(d >= total ? 0 : d, unitId); render(); window.scrollTo(0, 0);
    },
    restart: () => { startRun(0, S.unit); render(); },
    startquiz: (p, e, el) => { const unitId = (el && el.getAttribute('data-unit')) || S.unit; startQuiz(unitId); },
    hint: () => { const run = S.run; if (!run || run.finished) return; if (!run.hinted) run.hintsTotal++; run.hinted = true; run.mood = 'idle'; run.say = { kind: 'hint', msg: activeUnit(run.unitId).steps[run.step].hint }; render(); },
    mode: () => { const run = S.run; if (!run) return; run.mode = run.mode === 'guided' ? 'challenge' : 'guided'; S.mode = run.mode; SL.device.set(MODE_KEY, S.mode); run.say = { kind: 'nudge', msg: run.mode === 'challenge' ? 'Challenge mode on. Steps are worth double, and I stop giving the goal.' : 'Guided mode on. I will give the goal for each step again.' }; render(); },
    vmreset: () => { const run = S.run; if (!run || run.finished) return; run.local = SL.initLocal(activeUnit(run.unitId).steps[run.step].id); run.mood = 'idle'; run.say = { kind: 'nudge', msg: 'Step reset to how it started.' }; render(); },
    cad: () => { if (!S.run) return; if (activeUnit(S.run.unitId).steps[S.run.step].id === 'signin') act('cad'); else { S.run.say = { kind: 'nudge', msg: 'Ctrl+Alt+Del is only needed at the sign-in screen.' }; S.run.mood = 'idle'; render(); } },
    ff: () => { if (!S.run) return; if (activeUnit(S.run.unitId).steps[S.run.step].id === 'install2') act('ff'); else { S.run.say = { kind: 'nudge', msg: 'Fast-forward is for the installation wait. Nothing to skip right now.' }; S.run.mood = 'idle'; render(); } },
    pick: (p) => { S.quiz.picks[S.quiz.i] = Number(p); render(); },
    qprev: () => { if (S.quiz.i > 0) { S.quiz.i--; render(); } },
    qnext: () => {
      const q = S.quiz;
      if (q.picks[q.i] == null) return toast('Pick an answer first.');
      if (q.i < q.items.length - 1) { q.i++; render(); window.scrollTo(0, 0); return; }
      const left = q.picks.filter((x) => x == null).length;
      if (left) { q.i = q.picks.findIndex((x) => x == null); render(); return toast(left + ' question' + (left > 1 ? 's' : '') + ' still unanswered.'); }
      submitQuiz();
    },
  };
  const stepActs = new Set(['boot', 'next', 'install', 'repair', 'sel', 'toggle', 'upgrade', 'custom', 'new', 'loaddrv', 'disabled', 'apply', 'cancel', 'dialogok', 'delete', 'finish', 'lockclick', 'signin', 'nav', 'tile', 'name', 'noop', 'tool', 'inspect', 'run', 'clean5s', 'submitreport']);

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); return go(g.getAttribute('data-go')); }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.getAttribute('data-act'), p = el.getAttribute('data-p');
    if (a === 'noop') { if (S.run) { S.run.say = { kind: 'nudge', msg: 'Next is grey. Finish the task on this screen first.' }; render(); } return; }
    if (a === 'closesheet' && el.classList.contains('overlay') === false && !el.matches('button')) return;
    if (handlers[a]) return handlers[a](p, e, el);
    if (stepActs.has(a) && S.view === 'lesson') act(a, p);
  });
  function syncField(e) {
    const el = e.target.closest('[data-field]'); if (!el || !S.run || S.view !== 'lesson') return;
    const id = activeUnit(S.run.unitId).steps[S.run.step].id, f = el.getAttribute('data-field');
    if (id === 'disk2' && f === 'size') { S.run.local.size = el.value; return; }
    if (id === 'signin') { S.run.local.pw = el.value; return; }
    const r = SL.check(id, 'set', { field: f, value: el.value }, S.run.local, S.run.vm);
    if (r && r.patch) Object.assign(S.run.local, r.patch);
  }
  document.addEventListener('input', syncField);
  document.addEventListener('change', syncField);
  document.addEventListener('submit', (e) => { if (e.target.id === 'authform') { e.preventDefault(); onAuth(e.target); } });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.sheet) { S.sheet = null; render(); return; }
    if (e.key === 'Enter') {
      const el = e.target.closest && e.target.closest('[data-enter]');
      if (el && S.run) { e.preventDefault(); act(el.getAttribute('data-enter')); }
      else if (e.target.matches && e.target.matches('.lock[data-act]')) act('lockclick');
    }
  });

  /* Start */
  render();
  (async () => {
    try { S.user = await store.resume(); } catch (e) { S.authErr = e.message || 'Cannot reach the class server.'; }
    S.booting = false;
    render();
    if (S.user) refreshBoard();
  })();
})();