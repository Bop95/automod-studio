// ── State ──────────────────────────────────────────────────────────────────
const state = {
  rules: [],
  selected: -1,
  loading: true,
  dirty: false,
  notification: null,
  tab: 'visual',
  view: 'editor',
  devMode: false,
  sim: {
    contentType: 'comment',
    title: '',
    body: '',
    url: '',
    results: null,
  },
};

let rulesLoaded = false;

// ── YAML helpers ─────────────────────────────────────────────────────────────
function toYaml(obj) {
  var lines = [];
  Object.keys(obj).forEach(function(key) {
    var val = obj[key];
    if (val === undefined || val === null) return;
    var k = yamlKey(key);
    if (Array.isArray(val)) {
      if (!val.length) return;
      if (val.length === 1) { lines.push(k + ': ' + yamlVal(val[0])); }
      else { lines.push(k + ':'); val.forEach(function(v) { lines.push('  - ' + yamlVal(v)); }); }
    } else if (typeof val === 'object') {
      var subkeys = Object.keys(val).filter(function(k2) { return val[k2] !== undefined && val[k2] !== null; });
      if (!subkeys.length) return;
      lines.push(k + ':');
      subkeys.forEach(function(k2) { lines.push('  ' + k2 + ': ' + yamlVal(val[k2])); });
    } else {
      lines.push(k + ': ' + yamlVal(val));
    }
  });
  return lines.join('\n');
}

function yamlKey(k) {
  if (/[\s()\[\]{}:#,|>&*!?]/.test(k)) return '"' + k + '"';
  return k;
}

function yamlVal(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  var s = String(v);
  if (!s) return '""';
  if (/[\n\r]/.test(s)) return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '') + '"';
  if (/^[>|#{}&*!%@`\[\]<]/.test(s) || /^[-?:,](\s|$)/.test(s) || /:\s/.test(s) || s.includes(' #') || /^[\s]|[\s]$/.test(s) || /^(true|false|yes|no|on|off|null|~)$/i.test(s)) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
}

// ── YAML serializer (for save) ────────────────────────────────────────────────
function serializeAllRulesToYaml() {
  if (!state.rules.length) return '';
  return state.rules.map(function(rule) { return toYaml(rule); }).join('\n---\n');
}

// ── Devvit messaging ──────────────────────────────────────────────────────────
function sendToDevvit(msg) { window.parent.postMessage(msg, '*'); }

window.addEventListener('message', function(ev) {
  var raw = ev.data;
  var msg;
  if (raw && raw.type === 'devvit-message') {
    msg = (raw.data && raw.data.message) ? raw.data.message : raw.data;
  } else { msg = raw; }
  if (!msg || !msg.type) return;
  handleDevvitMsg(msg);
});

function handleDevvitMsg(msg) {
  switch (msg.type) {
    case 'INIT':
      rulesLoaded = true;
      state.rules = msg.rules || [];
      state.loading = false;
      state.dirty = false;
      state.selected = state.rules.length > 0 ? 0 : -1;
      document.getElementById('headerSub').textContent = state.rules.length + ' rule' + (state.rules.length !== 1 ? 's' : '');
      document.getElementById('liveDot').classList.add('pulse');
      refreshAll();
      break;
    case 'SAVE_SUCCESS':
      state.dirty = false;
      state.notification = { type: 'success', text: 'Changes saved successfully!' };
      updateDirtyState();
      renderEditor();
      setTimeout(function() { state.notification = null; renderEditor(); }, 3000);
      break;
    case 'SAVE_WIKI_ERROR':
      state.notification = { type: 'error', text: msg.message || 'Save failed.', yaml: msg.yaml || '' };
      renderEditor();
      break;
    case 'ERROR':
      state.loading = false;
      state.notification = { type: 'error', text: msg.message || 'An error occurred.' };
      refreshAll();
      break;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function requestRules() { sendToDevvit({ type: 'GET_RULES' }); }

window.addEventListener('load', function() {
  requestRules();
  setTimeout(function() { if (!rulesLoaded) requestRules(); }, 2000);
  setTimeout(function() {
    if (!rulesLoaded) {
      state.loading = false;
      state.notification = { type: 'error', text: 'Could not load rules. Click RELOAD to try again.' };
      refreshAll();
    }
  }, 8000);
});

// ── Static listeners ──────────────────────────────────────────────────────────
document.getElementById('reloadBtn').addEventListener('click', function() {
  state.loading = true; state.notification = null; rulesLoaded = false; refreshAll(); requestRules();
});

document.getElementById('resetBtn').addEventListener('click', function() {
  state.loading = true; state.notification = null; state.dirty = false; rulesLoaded = false;
  updateDirtyState(); refreshAll(); requestRules();
});

document.getElementById('saveBtn').addEventListener('click', function() {
  sendToDevvit({ type: 'SAVE', yaml: serializeAllRulesToYaml() });
});

document.getElementById('savePillBtn').addEventListener('click', function() {
  sendToDevvit({ type: 'SAVE', yaml: serializeAllRulesToYaml() });
});

document.getElementById('addRuleBtn').addEventListener('click', function() {
  state.rules.push({ type: 'comment', action: 'remove' });
  state.selected = state.rules.length - 1;
  state.tab = 'visual';
  markDirty();
  refreshAll();
});

document.getElementById('tabVisual').addEventListener('click', function() {
  state.view = 'editor'; state.tab = 'visual'; syncView();
});
document.getElementById('tabYaml').addEventListener('click', function() {
  state.view = 'editor'; state.tab = 'yaml'; syncView();
});
document.getElementById('tabRaw').addEventListener('click', function() {
  state.view = 'editor'; state.tab = 'raw'; syncView();
});
document.getElementById('tabSimulator').addEventListener('click', function() {
  state.view = 'simulator'; syncView();
});

document.getElementById('devToggle').addEventListener('click', function() {
  state.devMode = !state.devMode;
  this.classList.toggle('on', state.devMode);
  document.getElementById('tabRaw').classList.toggle('hidden', !state.devMode);
  if (!state.devMode && state.tab === 'raw') { state.tab = 'visual'; renderEditor(); }
  updateTabStates();
});

// ── View sync ─────────────────────────────────────────────────────────────────
function syncView() {
  var canvas = document.getElementById('editorCanvas');
  var sim = document.getElementById('simulatorArea');
  if (state.view === 'simulator') {
    canvas.style.display = 'none'; sim.style.display = 'block'; renderSimulator();
  } else {
    canvas.style.display = ''; sim.style.display = 'none'; renderEditor();
  }
  updateTabStates();
}

function updateTabStates() {
  var inEditor = state.view === 'editor';
  document.getElementById('tabVisual').classList.toggle('active', inEditor && state.tab !== 'yaml' && state.tab !== 'raw');
  document.getElementById('tabYaml').classList.toggle('active', inEditor && state.tab === 'yaml');
  document.getElementById('tabRaw').classList.toggle('active', inEditor && state.tab === 'raw');
  document.getElementById('tabSimulator').classList.toggle('active', state.view === 'simulator');
}

// ── Dirty state ───────────────────────────────────────────────────────────────
function markDirty() { state.dirty = true; updateDirtyState(); }

function updateDirtyState() {
  document.getElementById('savePill').classList.toggle('visible', state.dirty);
  document.getElementById('saveBtn').disabled = !state.dirty;
}

function refreshAll() { renderRuleList(); renderEditor(); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function h(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function getRuleName(rule) {
  if (typeof rule.action_reason === 'string' && rule.action_reason.trim())
    return rule.action_reason.trim().split('\n')[0].substring(0, 52);
  if (typeof rule.comment === 'string' && rule.comment.trim())
    return rule.comment.trim().split('\n')[0].substring(0, 52);
  var bodyInc = getArr(rule, 'body (includes)');
  if (bodyInc.length) {
    var act = rule.action ? capitalize(rule.action) : 'Match';
    var preview = bodyInc.slice(0, 2).map(function(s) { return '"' + s + '"'; }).join(', ');
    return act + ' if body contains ' + preview + (bodyInc.length > 2 ? '…' : '');
  }
  var titleInc = getArr(rule, 'title (includes)');
  if (titleInc.length) return 'Title contains: ' + titleInc.slice(0, 2).join(', ');
  var urlInc = getArr(rule, 'url (includes)');
  if (urlInc.length) return 'URL contains: ' + urlInc.slice(0, 2).join(', ');
  var author = rule.author;
  if (author && typeof author === 'object') {
    var firstKey = Object.keys(author)[0];
    if (firstKey) return 'Author ' + firstKey + ': ' + author[firstKey];
  }
  return (rule.type ? capitalize(rule.type) : 'Any') + ' → ' + (rule.action || 'no action');
}

function getRuleMeta(rule) {
  var parts = [];
  parts.push({ comment: 'Comments', submission: 'Posts', link: 'Link posts' }[rule.type] || 'All content');
  var a = rule.author || {};
  if (a.comment_karma) parts.push('Karma ' + a.comment_karma);
  else if (a.combined_karma) parts.push('Karma ' + a.combined_karma);
  if (a.account_age) parts.push('Age ' + a.account_age);
  return parts.slice(0, 3).join(' • ');
}

function getCardBadgeClass(action) {
  return { remove: 'cb-remove', report: 'cb-report', approve: 'cb-approve', spam: 'cb-spam', filter: 'cb-filter' }[action] || 'cb-none';
}

// ── Plain-English summary ─────────────────────────────────────────────────────
function summarizeRule(rule) {
  var action = rule.action;
  var type = rule.type;
  var actionWord = { remove: 'Removes', report: 'Reports', approve: 'Approves', spam: 'Marks as spam', filter: 'Filters' }[action] || 'Matches';
  var typeWord = { comment: 'comments', submission: 'posts', link: 'link posts' }[type] || 'content';
  var conds = [];

  var bodyInc = getArr(rule, 'body (includes)');
  if (bodyInc.length === 1) conds.push('body contains "' + bodyInc[0] + '"');
  else if (bodyInc.length > 1) conds.push('body contains "' + bodyInc[0] + '" or ' + (bodyInc.length - 1) + ' other term' + (bodyInc.length > 2 ? 's' : ''));

  var bodyExc = getArr(rule, 'body (excludes)');
  if (bodyExc.length) conds.push('body does not contain "' + bodyExc[0] + '"');

  var bodyRe = getArr(rule, 'body (regex)');
  if (bodyRe.length) conds.push('body matches /' + bodyRe[0] + '/');

  var titleInc = getArr(rule, 'title (includes)');
  if (titleInc.length === 1) conds.push('title contains "' + titleInc[0] + '"');
  else if (titleInc.length > 1) conds.push('title contains "' + titleInc[0] + '" or more');

  var titleExc = getArr(rule, 'title (excludes)');
  if (titleExc.length) conds.push('title does not contain "' + titleExc[0] + '"');

  var titleRe = getArr(rule, 'title (regex)');
  if (titleRe.length) conds.push('title matches /' + titleRe[0] + '/');

  var urlInc = getArr(rule, 'url (includes)');
  if (urlInc.length) conds.push('URL contains "' + urlInc[0] + '"');

  var domains = getArr(rule, 'domain');
  if (domains.length) conds.push('domain is ' + domains.slice(0, 2).join(' or '));

  var author = rule.author;
  if (author && typeof author === 'object') {
    if (author.comment_karma) conds.push('comment karma is ' + author.comment_karma);
    if (author.post_karma) conds.push('post karma is ' + author.post_karma);
    if (author.combined_karma) conds.push('combined karma is ' + author.combined_karma);
    if (author.account_age) conds.push('account age is ' + author.account_age);
    if (author.is_gold) conds.push('user has Reddit Gold');
    if (author.is_shadowbanned) conds.push('user is shadowbanned');
    if (author.is_contributor) conds.push('user is an approved submitter');
    if (author.name) {
      var names = Array.isArray(author.name) ? author.name : [author.name];
      conds.push('username is ' + names.slice(0, 2).join(' or '));
    }
  }

  var authorFlair = getArr(rule, 'author_flair_text (includes)');
  if (authorFlair.length) conds.push('author flair contains "' + authorFlair[0] + '"');

  var linkFlair = getArr(rule, 'link_flair_text (includes)');
  if (linkFlair.length) conds.push('link flair contains "' + linkFlair[0] + '"');

  if (!conds.length) return actionWord + ' all ' + typeWord + '.';

  var shown = conds.slice(0, 4);
  var extra = conds.length - 4;
  var joined;
  if (shown.length === 1) joined = shown[0];
  else if (shown.length === 2) joined = shown[0] + ' and ' + shown[1];
  else joined = shown.slice(0, -1).join(', ') + ', and ' + shown[shown.length - 1];
  if (extra > 0) joined += ' (+' + extra + ' more)';
  return actionWord + ' ' + typeWord + ' where ' + joined + '.';
}

// ── Comparison helpers ────────────────────────────────────────────────────────
function parseComparison(str) {
  if (!str) return { op: '<', val: '', val2: '' };
  var s = str.trim();
  var between = /^(\d+)\.\.(\d+)$/.exec(s);
  if (between) return { op: 'between', val: between[1], val2: between[2] };
  var match = /^([<>=]=?)\s*(\d+)/.exec(s);
  if (match) return { op: match[1], val: match[2], val2: '' };
  if (/^\d+$/.test(s)) return { op: '=', val: s, val2: '' };
  return { op: '<', val: s.replace(/\D/g, ''), val2: '' };
}

function serializeComparison(op, val, val2) {
  if (val === '' || val === undefined || val === null) return '';
  if (op === 'between') return val + '..' + (val2 || val);
  return op + ' ' + val;
}

// ── Sidebar render ────────────────────────────────────────────────────────────
function renderRuleList() {
  var list = document.getElementById('ruleList');
  var sub  = document.getElementById('headerSub');
  if (state.loading) { list.innerHTML = '<div style="padding:14px;color:var(--muted);text-align:center;font-size:13px">Loading…</div>'; sub.textContent = ''; return; }
  sub.textContent = state.rules.length + ' rule' + (state.rules.length !== 1 ? 's' : '');
  if (!state.rules.length) {
    list.innerHTML = '<div style="padding:20px 14px;color:var(--muted);text-align:center;font-size:13px;line-height:1.7">No rules found.<br>Click <strong style="color:var(--text)">+ Create New Rule</strong></div>';
    return;
  }
  var last = state.rules.length - 1;
  list.innerHTML = state.rules.map(function(rule, i) {
    var activeClass = i === state.selected ? ' active' : '';
    var flags = (rule.lock ? ' 🔒' : '') + (rule.ban ? ' 🔨' : '');
    return (
      '<div class="rule-card' + activeClass + '" data-action="selectRule" data-index="' + i + '">' +
        '<div class="rule-card-top">' +
          '<span class="card-badge ' + getCardBadgeClass(rule.action || '') + '">' + h(rule.action || 'none') + '</span>' +
          '<div class="reorder-btns">' +
            '<button class="reorder-btn" data-action="moveUp" data-index="' + i + '" title="Move up"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
            '<button class="reorder-btn" data-action="moveDown" data-index="' + i + '" title="Move down"' + (i === last ? ' disabled' : '') + '>▼</button>' +
          '</div>' +
        '</div>' +
        '<div class="rule-card-name">' + h(getRuleName(rule)) + h(flags) + '</div>' +
        '<div class="rule-card-meta">' + h(getRuleMeta(rule)) + '</div>' +
      '</div>'
    );
  }).join('');
}

function moveRule(i, dir) {
  var j = i + dir;
  if (j < 0 || j >= state.rules.length) return;
  var tmp = state.rules[i]; state.rules[i] = state.rules[j]; state.rules[j] = tmp;
  state.selected = j; markDirty(); refreshAll();
}

function selectRule(i) {
  state.selected = i; state.tab = 'visual'; state.notification = null;
  renderRuleList(); updateTabStates(); renderEditor();
}

function deleteRule(i) {
  state.rules.splice(i, 1);
  state.selected = Math.min(state.selected, state.rules.length - 1);
  markDirty(); refreshAll();
}

// ── Editor ────────────────────────────────────────────────────────────────────
function renderEditor() {
  var panel = document.getElementById('editorPanel');
  if (state.loading) {
    panel.innerHTML = '<div class="state-center" style="height:300px"><div class="state-icon">⌛</div><div class="state-title">Loading rules…</div></div>';
    return;
  }
  if (state.selected < 0 || state.selected >= state.rules.length) {
    panel.innerHTML = '<div class="state-center" style="height:300px"><div class="state-icon">📋</div><div class="state-title">No rule selected</div><div class="state-hint">Select a rule or create a new one</div></div>';
    return;
  }
  var rule = state.rules[state.selected];
  var i = state.selected;
  var notifHtml = '';
  if (state.notification) {
    notifHtml = '<div class="banner banner-' + state.notification.type + '">' + h(state.notification.text);
    if (state.notification.yaml) {
      notifHtml += '<div style="margin-top:8px;display:flex;gap:8px;align-items:center">' +
        '<button id="copyYamlBtn" style="background:#27272a;border:1px solid #3f3f46;color:#f4f4f5;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;font-family:var(--mono);cursor:pointer">Copy YAML</button>' +
        '<span style="font-size:11px;color:#a1a1aa">Paste to r/subreddit/wiki/config/automoderator</span>' +
        '</div>';
    }
    notifHtml += '</div>';
  }
  var content;
  if (state.tab === 'yaml') content = renderYamlTab(rule);
  else if (state.tab === 'raw') content = renderRawTab(rule, i);
  else content = renderVisualTab(rule, i);

  panel.innerHTML = (
    notifHtml +
    '<div class="editor-hdr">' +
      '<div class="editor-title">' + h(getRuleName(rule)) + '</div>' +
      '<button class="btn-delete" data-action="deleteRule" data-index="' + i + '">Delete rule</button>' +
    '</div>' +
    content
  );
}

// ── Group helper ──────────────────────────────────────────────────────────────
function renderGroup(id, icon, label, body, hasValues, alwaysOpen) {
  var collapsed = !hasValues && !alwaysOpen;
  return (
    '<div class="group' + (collapsed ? ' collapsed' : '') + '" id="grp-' + id + '">' +
      '<div class="group-hdr" data-action="toggleGroup" data-group="' + id + '">' +
        '<div class="group-icon">' + icon + '</div>' +
        '<span class="group-label">' + label + '</span>' +
        '<svg class="group-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
      '</div>' +
      '<div class="group-body">' + body + '</div>' +
    '</div>'
  );
}

function hasAny(rule, keys) {
  return keys.some(function(k) {
    if (typeof k === 'string') { var v = rule[k]; return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length); }
    if (k.nested) return rule[k.obj] && typeof rule[k.obj] === 'object' && Object.keys(rule[k.obj]).length > 0;
    if (k.arr) return getArr(rule, k.arr).length > 0;
    return false;
  });
}

function renderOpVal(rule, obj, key, ri, unit) {
  var raw = obj ? nested(rule, obj, key) : (rule[key] != null ? String(rule[key]) : '');
  var p = parseComparison(raw);
  var attrObj = obj ? 'data-obj="' + h(obj) + '"' : '';
  return (
    '<div class="op-val" data-ruleindex="' + ri + '" ' + attrObj + ' data-key="' + h(key) + '">' +
      '<select class="op-select" data-action="setComparison" data-role="op">' +
        '<option value="<"'       + (p.op === '<'       ? ' selected' : '') + '>&lt;</option>' +
        '<option value=">"'       + (p.op === '>'       ? ' selected' : '') + '>&gt;</option>' +
        '<option value="="'       + (p.op === '='       ? ' selected' : '') + '>=</option>' +
        '<option value="between"' + (p.op === 'between' ? ' selected' : '') + '>&#8943;</option>' +
      '</select>' +
      '<input class="val-input" type="number" min="0" placeholder="0" value="' + h(p.val) + '" data-action="setComparison" data-role="val">' +
      '<input class="val-input" type="number" min="0" placeholder="0" value="' + h(p.val2 || '') + '" data-action="setComparison" data-role="val2"' + (p.op !== 'between' ? ' style="display:none"' : '') + '>' +
      '<span class="val-unit">' + h(unit || '') + '</span>' +
    '</div>'
  );
}

// ── Visual tab ────────────────────────────────────────────────────────────────
function renderVisualTab(rule, i) {
  var ri = String(i);
  var authorObj = (rule.author && typeof rule.author === 'object') ? rule.author : {};

  var summaryHtml = '<div class="summary-card"><div class="summary-label">Rule Logic Summary</div><div class="summary-text" id="ruleSummaryText">' + h(summarizeRule(rule)) + '</div></div>';

  // Author
  var authorBody = (
    '<div class="field-2">' +
      '<div class="field"><div class="flabel">Comment Karma</div>' + renderOpVal(rule, 'author', 'comment_karma', ri, 'KARMA') + '</div>' +
      '<div class="field"><div class="flabel">Post Karma</div>' + renderOpVal(rule, 'author', 'post_karma', ri, 'KARMA') + '</div>' +
      '<div class="field"><div class="flabel">Combined Karma</div>' + renderOpVal(rule, 'author', 'combined_karma', ri, 'KARMA') + '</div>' +
      '<div class="field"><div class="flabel">Account Age</div><input class="input mono" type="text" placeholder="e.g. &lt; 7 days" value="' + h(nested(rule, 'author', 'account_age')) + '" data-action="setNestedField" data-ruleindex="' + ri + '" data-obj="author" data-key="account_age"></div>' +
    '</div>' +
    '<div class="field"><div class="flabel">Username (one per line)</div><textarea class="ftextarea mono" placeholder="e.g. spammer123" data-action="setNestedArrayField" data-ruleindex="' + ri + '" data-obj="author" data-key="name">' + h(arr(authorObj, 'name')) + '</textarea><div class="fhint">Block or allowlist specific usernames</div></div>' +
    '<div class="fdivider"></div>' +
    '<label class="check-row"><input type="checkbox"' + (nested(rule, 'author', 'is_gold')        === 'true' ? ' checked' : '') + ' data-action="setNestedCheckbox" data-ruleindex="' + ri + '" data-obj="author" data-key="is_gold"><span class="check-label">User must have Reddit Gold</span></label>' +
    '<label class="check-row"><input type="checkbox"' + (nested(rule, 'author', 'is_shadowbanned') === 'true' ? ' checked' : '') + ' data-action="setNestedCheckbox" data-ruleindex="' + ri + '" data-obj="author" data-key="is_shadowbanned"><span class="check-label">User must be shadowbanned</span></label>' +
    '<label class="check-row"><input type="checkbox"' + (nested(rule, 'author', 'is_contributor')  === 'true' ? ' checked' : '') + ' data-action="setNestedCheckbox" data-ruleindex="' + ri + '" data-obj="author" data-key="is_contributor"><span class="check-label">User must be an approved submitter</span></label>'
  );

  // Body & Title
  var bodyTitleBody = (
    '<div class="field-2">' +
      '<div class="field"><div class="flabel">Body must contain</div><textarea class="ftextarea mono" placeholder="e.g. spam" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="body (includes)">' + h(arr(rule, 'body (includes)')) + '</textarea><div class="fhint">One per line — fires if body matches ANY</div></div>' +
      '<div class="field"><div class="flabel">Body must NOT contain</div><textarea class="ftextarea mono" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="body (excludes)">' + h(arr(rule, 'body (excludes)')) + '</textarea></div>' +
      '<div class="field"><div class="flabel">Body regex</div><textarea class="ftextarea mono" placeholder="e.g. (?i)buy.?now" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="body (regex)">' + h(arr(rule, 'body (regex)')) + '</textarea></div>' +
      '<div class="field"><div class="flabel">Title must contain</div><textarea class="ftextarea mono" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="title (includes)">' + h(arr(rule, 'title (includes)')) + '</textarea></div>' +
      '<div class="field"><div class="flabel">Title must NOT contain</div><textarea class="ftextarea mono" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="title (excludes)">' + h(arr(rule, 'title (excludes)')) + '</textarea></div>' +
      '<div class="field"><div class="flabel">Title regex</div><textarea class="ftextarea mono" placeholder="e.g. (?i)giveaway" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="title (regex)">' + h(arr(rule, 'title (regex)')) + '</textarea></div>' +
    '</div>'
  );

  // URL & Domain
  var urlBody = (
    '<div class="field-2">' +
      '<div class="field"><div class="flabel">URL must contain</div><textarea class="ftextarea mono" placeholder="e.g. bit.ly" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="url (includes)">' + h(arr(rule, 'url (includes)')) + '</textarea></div>' +
      '<div class="field"><div class="flabel">URL must NOT contain</div><textarea class="ftextarea mono" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="url (excludes)">' + h(arr(rule, 'url (excludes)')) + '</textarea></div>' +
      '<div class="field"><div class="flabel">URL regex</div><textarea class="ftextarea mono" placeholder="e.g. (?i)\\?ref=" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="url (regex)">' + h(arr(rule, 'url (regex)')) + '</textarea></div>' +
      '<div class="field"><div class="flabel">Domain (exact, one per line)</div><textarea class="ftextarea mono" placeholder="e.g. youtube.com" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="domain">' + h(arr(rule, 'domain')) + '</textarea><div class="fhint">Exact hostname — not subdomains</div></div>' +
    '</div>'
  );

  // Flair
  var flairBody = (
    '<div class="field"><div class="flabel">Author flair text contains (one per line)</div><textarea class="ftextarea mono" placeholder="e.g. Verified" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="author_flair_text (includes)">' + h(arr(rule, 'author_flair_text (includes)')) + '</textarea></div>' +
    '<div class="field-2">' +
      '<div class="field"><div class="flabel">Link flair text contains</div><textarea class="ftextarea mono" placeholder="e.g. Discussion" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="link_flair_text (includes)">' + h(arr(rule, 'link_flair_text (includes)')) + '</textarea></div>' +
      '<div class="field"><div class="flabel">Link flair CSS class</div><textarea class="ftextarea mono" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="link_flair_css_class (includes)">' + h(arr(rule, 'link_flair_css_class (includes)')) + '</textarea></div>' +
    '</div>'
  );

  // Actions
  var currentAction = rule.action || '';
  var actionBtns = ['remove','report','filter','approve','spam'].map(function(v) {
    return '<button class="action-btn' + (currentAction === v ? ' ab-active' : '') + '" data-action="setAction" data-ruleindex="' + ri + '" data-value="' + v + '">' + capitalize(v) + '</button>';
  }).join('');

  var actionsBody = (
    '<div class="field"><div class="flabel">Action</div><div class="action-picker">' + actionBtns + '</div></div>' +
    '<div class="field"><div class="flabel">Action reason / rule label</div><input class="input" type="text" placeholder="e.g. Spam filter…" value="' + h(rule.action_reason || '') + '" data-action="setField" data-ruleindex="' + ri + '" data-key="action_reason"><div class="fhint">Appears in the mod log — also used as the rule\'s display name</div></div>' +
    '<div class="field"><div class="flabel">Auto-reply comment</div><textarea class="ftextarea" placeholder="Comment posted automatically when rule fires…" data-action="setField" data-ruleindex="' + ri + '" data-key="comment">' + h(rule.comment || '') + '</textarea></div>' +
    '<div class="field"><div class="flabel">Report reason</div><input class="input" type="text" placeholder="e.g. Needs review" value="' + h(rule.report_reason || '') + '" data-action="setField" data-ruleindex="' + ri + '" data-key="report_reason"></div>' +
    '<div class="fdivider"></div>' +
    '<label class="check-row"><input type="checkbox"' + (rule.lock ? ' checked' : '') + ' data-action="setCheckbox" data-ruleindex="' + ri + '" data-key="lock"><span class="check-label">Lock post / comment after action 🔒</span></label>' +
    '<label class="check-row"><input type="checkbox"' + (rule.ban  ? ' checked' : '') + ' data-action="setCheckbox" data-ruleindex="' + ri + '" data-key="ban"><span class="check-label">Ban user 🔨</span></label>'
  );

  // Set Flair
  var setFlairBody = (
    '<div class="field-2">' +
      '<div class="field"><div class="flabel">Author flair text</div><input class="input" type="text" placeholder="e.g. Verified Poster" value="' + h(nested(rule, 'set_flair', 'text')) + '" data-action="setNestedField" data-ruleindex="' + ri + '" data-obj="set_flair" data-key="text"></div>' +
      '<div class="field"><div class="flabel">Author flair CSS class</div><input class="input mono" type="text" placeholder="e.g. verified" value="' + h(nested(rule, 'set_flair', 'css_class')) + '" data-action="setNestedField" data-ruleindex="' + ri + '" data-obj="set_flair" data-key="css_class"></div>' +
    '</div>'
  );

  // Metadata
  var metaBody = (
    '<div class="field-2">' +
      '<div class="field"><div class="flabel">Content type</div><select class="fselect" data-action="setField" data-ruleindex="' + ri + '" data-key="type">' +
        '<option value=""'           + (!rule.type                  ? ' selected' : '') + '>Any</option>' +
        '<option value="comment"'    + (rule.type === 'comment'     ? ' selected' : '') + '>Comment</option>' +
        '<option value="submission"' + (rule.type === 'submission'  ? ' selected' : '') + '>Post (submission)</option>' +
        '<option value="link"'       + (rule.type === 'link'        ? ' selected' : '') + '>Link post</option>' +
      '</select></div>' +
      '<div class="field"><div class="flabel">Priority</div><input class="input mono" type="number" placeholder="(default)" value="' + h(rule.priority != null ? String(rule.priority) : '') + '" data-action="setPriority" data-ruleindex="' + ri + '"><div class="fhint">Lower = runs first</div></div>' +
    '</div>' +
    '<label class="check-row"><input type="checkbox"' + (rule.moderators_exempt === false ? '' : ' checked') + ' data-action="setModExempt" data-ruleindex="' + ri + '"><span class="check-label">Moderators are exempt from this rule</span></label>'
  );

  return (
    summaryHtml +
    renderGroup('author',   '@', 'Author Conditions',   authorBody,    hasAny(rule, [{ nested: true, obj: 'author' }])) +
    renderGroup('body',     'T', 'Body &amp; Title',     bodyTitleBody, hasAny(rule, [{ arr: 'body (includes)' }, { arr: 'body (excludes)' }, { arr: 'body (regex)' }, { arr: 'title (includes)' }, { arr: 'title (excludes)' }, { arr: 'title (regex)' }])) +
    renderGroup('url',      '↗', 'URL &amp; Domain',     urlBody,       hasAny(rule, [{ arr: 'url (includes)' }, { arr: 'url (excludes)' }, { arr: 'url (regex)' }, { arr: 'domain' }])) +
    renderGroup('flair',    '◈', 'Flair Conditions',     flairBody,     hasAny(rule, [{ arr: 'author_flair_text (includes)' }, { arr: 'link_flair_text (includes)' }, { arr: 'link_flair_css_class (includes)' }])) +
    renderGroup('actions',  '→', 'Enforcement Actions',  actionsBody,   true, true) +
    renderGroup('setflair', '◎', 'Set Flair on Match',   setFlairBody,  hasAny(rule, [{ nested: true, obj: 'set_flair' }])) +
    renderGroup('meta',     '⚙', 'Metadata &amp; Type',  metaBody,      rule.priority != null || rule.moderators_exempt === false || !!rule.type)
  );
}

function renderYamlTab(rule) {
  return '<div class="yaml-wrap"><div class="yaml-label">YAML Preview — read only</div><pre class="yaml-block">' + h(toYaml(rule)) + '</pre><div class="yaml-hint">This is the YAML written to r/subreddit/wiki/config/automoderator when you save.</div></div>';
}

function renderRawTab(rule, i) {
  return '<div class="raw-wrap"><div class="yaml-label">Raw JSON — developer mode</div><textarea class="raw-area" data-action="applyRaw" data-ruleindex="' + i + '">' + h(JSON.stringify(rule, null, 2)) + '</textarea><div class="raw-hint">Edit the raw JSON directly. Invalid JSON is silently ignored.</div></div>';
}

// ── Field value helpers ───────────────────────────────────────────────────────
function arr(rule, k) {
  var v = rule[k];
  if (!v) return '';
  return Array.isArray(v) ? v.join('\n') : String(v);
}

function nested(rule, obj, k) {
  var o = rule[obj];
  if (!o || typeof o !== 'object') return '';
  var v = o[k];
  return v != null ? String(v) : '';
}

function updateSummaryCard(ri) {
  var el = document.getElementById('ruleSummaryText');
  if (el && state.rules[ri] !== undefined) el.textContent = summarizeRule(state.rules[ri]);
}

// ── Field setters ─────────────────────────────────────────────────────────────
function setField(i, key, value) {
  if (value === undefined || value === '') delete state.rules[i][key];
  else state.rules[i][key] = value;
  markDirty(); renderRuleList();
}

function setArrayField(i, key, raw) {
  var lines = raw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
  if (!lines.length) delete state.rules[i][key];
  else state.rules[i][key] = lines.length === 1 ? lines[0] : lines;
  markDirty(); renderRuleList();
}

function setNestedField(i, obj, key, value) {
  var rule = state.rules[i];
  if (!value || !String(value).trim()) {
    if (rule[obj] && typeof rule[obj] === 'object') { delete rule[obj][key]; if (!Object.keys(rule[obj]).length) delete rule[obj]; }
  } else {
    if (!rule[obj] || typeof rule[obj] !== 'object') rule[obj] = {};
    rule[obj][key] = String(value).trim();
  }
  markDirty();
}

function setNestedArrayField(i, obj, key, raw) {
  var rule = state.rules[i];
  var lines = raw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
  if (!lines.length) {
    if (rule[obj] && typeof rule[obj] === 'object') { delete rule[obj][key]; if (!Object.keys(rule[obj]).length) delete rule[obj]; }
  } else {
    if (!rule[obj] || typeof rule[obj] !== 'object') rule[obj] = {};
    rule[obj][key] = lines.length === 1 ? lines[0] : lines;
  }
  markDirty();
}

function setCheckboxField(i, key, checked) {
  if (checked) state.rules[i][key] = true;
  else delete state.rules[i][key];
  markDirty();
}

function setNestedCheckbox(i, obj, key, checked) {
  var rule = state.rules[i];
  if (checked) {
    if (!rule[obj] || typeof rule[obj] !== 'object') rule[obj] = {};
    rule[obj][key] = true;
  } else {
    if (rule[obj] && typeof rule[obj] === 'object') { delete rule[obj][key]; if (!Object.keys(rule[obj]).length) delete rule[obj]; }
  }
  markDirty();
}

function applyRaw(i, jsonStr) {
  try { state.rules[i] = JSON.parse(jsonStr); markDirty(); renderRuleList(); } catch (_) {}
}

// ── Event delegation — clicks ──────────────────────────────────────────────────
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.dataset.action;
  var idx = parseInt(el.dataset.index || '-1', 10);

  if (el.id === 'copyYamlBtn') {
    var yaml = (state.notification && state.notification.yaml) ? state.notification.yaml : serializeAllRulesToYaml();
    navigator.clipboard.writeText(yaml).then(function() {
      el.textContent = 'Copied!';
      setTimeout(function() { el.textContent = 'Copy YAML'; }, 2000);
    }).catch(function() {
      el.textContent = 'Copy YAML';
    });
    return;
  }
  if (action === 'selectRule') {
    selectRule(idx);
  } else if (action === 'deleteRule') {
    if (el.dataset.confirm === '1') {
      deleteRule(idx);
    } else {
      el.dataset.confirm = '1';
      el.textContent = 'Confirm delete?';
      el.style.background = '#b61827'; el.style.color = '#fff'; el.style.borderColor = '#b61827';
      setTimeout(function() {
        if (el.dataset.confirm === '1') {
          el.dataset.confirm = '0'; el.textContent = 'Delete rule';
          el.style.background = ''; el.style.color = ''; el.style.borderColor = '';
        }
      }, 3000);
    }
  } else if (action === 'moveUp') {
    e.stopPropagation(); moveRule(idx, -1);
  } else if (action === 'moveDown') {
    e.stopPropagation(); moveRule(idx, 1);
  } else if (action === 'toggleGroup') {
    var grp = document.getElementById('grp-' + el.dataset.group);
    if (grp) grp.classList.toggle('collapsed');
  } else if (action === 'setAction') {
    var ri = parseInt(el.dataset.ruleindex || '-1', 10);
    var val = el.dataset.value || '';
    setField(ri, 'action', val || undefined);
    var picker = el.closest('.action-picker');
    if (picker) picker.querySelectorAll('.action-btn').forEach(function(btn) { btn.classList.toggle('ab-active', btn.dataset.value === val); });
    updateSummaryCard(ri);
  }
});

// ── Event delegation — changes ─────────────────────────────────────────────────
document.addEventListener('change', function(e) {
  var el = e.target;
  var action = el.dataset.action;
  if (!action) return;
  var i   = parseInt(el.dataset.ruleindex || '-1', 10);
  var key = el.dataset.key || '';
  var obj = el.dataset.obj || '';

  if (action === 'setField')            { setField(i, key, el.value || undefined); updateSummaryCard(i); }
  else if (action === 'setArrayField')  { setArrayField(i, key, el.value); updateSummaryCard(i); }
  else if (action === 'setNestedField') { setNestedField(i, obj, key, el.value); updateSummaryCard(i); }
  else if (action === 'setNestedArrayField') { setNestedArrayField(i, obj, key, el.value); updateSummaryCard(i); }
  else if (action === 'setPriority')    { setField(i, 'priority', el.value !== '' ? Number(el.value) : undefined); }
  else if (action === 'setModExempt')   { setField(i, 'moderators_exempt', el.checked); }
  else if (action === 'setCheckbox')    { setCheckboxField(i, key, el.checked); updateSummaryCard(i); renderRuleList(); }
  else if (action === 'setNestedCheckbox') { setNestedCheckbox(i, obj, key, el.checked); updateSummaryCard(i); }
  else if (action === 'applyRaw')       { applyRaw(i, el.value); }
  else if (action === 'setComparison') {
    var container = el.closest('.op-val');
    if (!container) return;
    var ci   = parseInt(container.dataset.ruleindex || '-1', 10);
    var cobj = container.dataset.obj || '';
    var ckey = container.dataset.key || '';
    var opEl   = container.querySelector('[data-role="op"]');
    var valEl  = container.querySelector('[data-role="val"]');
    var val2El = container.querySelector('[data-role="val2"]');
    var op   = opEl  ? opEl.value  : '<';
    var val  = valEl ? valEl.value : '';
    var val2 = val2El ? val2El.value : '';
    if (val2El) val2El.style.display = op === 'between' ? '' : 'none';
    var serialized = serializeComparison(op, val, val2);
    if (cobj) setNestedField(ci, cobj, ckey, serialized);
    else setField(ci, ckey, serialized || undefined);
    updateSummaryCard(ci);
  }
});

// ── Event delegation — input (real-time dirty + state sync) ──────────────────
document.addEventListener('input', function(e) {
  var el = e.target;
  var action = el.dataset.action;
  if (!action) return;
  var i   = parseInt(el.dataset.ruleindex || '-1', 10);
  var key = el.dataset.key || '';
  var obj = el.dataset.obj || '';

  if (action === 'setField')                 { setField(i, key, el.value || undefined); updateSummaryCard(i); }
  else if (action === 'setArrayField')       { setArrayField(i, key, el.value); updateSummaryCard(i); }
  else if (action === 'setNestedField')      { setNestedField(i, obj, key, el.value); updateSummaryCard(i); }
  else if (action === 'setNestedArrayField') { setNestedArrayField(i, obj, key, el.value); updateSummaryCard(i); }
  else if (action === 'setPriority')         { setField(i, 'priority', el.value !== '' ? Number(el.value) : undefined); }
  else if (action === 'applyRaw')            { applyRaw(i, el.value); }
  else if (action === 'setComparison') {
    var container = el.closest('.op-val');
    if (!container) return;
    var ci   = parseInt(container.dataset.ruleindex || '-1', 10);
    var cobj = container.dataset.obj || '';
    var ckey = container.dataset.key || '';
    var opEl   = container.querySelector('[data-role="op"]');
    var valEl  = container.querySelector('[data-role="val"]');
    var val2El = container.querySelector('[data-role="val2"]');
    var op   = opEl  ? opEl.value  : '<';
    var val  = valEl ? valEl.value : '';
    var val2 = val2El ? val2El.value : '';
    var serialized = serializeComparison(op, val, val2);
    if (cobj) setNestedField(ci, cobj, ckey, serialized);
    else setField(ci, ckey, serialized || undefined);
    updateSummaryCard(ci);
  }
});

// ── Simulator ──────────────────────────────────────────────────────────────────
function renderSimulator() {
  var area = document.getElementById('simulatorArea');
  var resultsHtml = '';
  if (state.sim.results !== null) {
    resultsHtml = state.sim.results.map(function(r) {
      var reasons = r.reasons.map(function(rr) {
        return '<li class="' + rr.status + '">' + (rr.status === 'pass' ? '✓' : rr.status === 'fail' ? '✗' : '–') + ' ' + h(rr.text) + '</li>';
      }).join('');
      return (
        '<div class="result-card ' + (r.fires ? 'fires' : 'no-match') + '">' +
          '<div class="result-header">' +
            '<span class="result-icon">' + (r.fires ? '🔴' : '⚪') + '</span>' +
            '<span class="result-name">Rule ' + (r.index + 1) + ': ' + h(getRuleName(state.rules[r.index])) + '</span>' +
            (r.fires ? '<span class="result-fires">WOULD FIRE → ' + h(r.action || 'action') + '</span>' : '<span class="result-miss">no match</span>') +
          '</div>' +
          '<ul class="result-reasons">' + reasons + '</ul>' +
        '</div>'
      );
    }).join('');
  }

  var isLink    = state.sim.contentType === 'link';
  var isComment = state.sim.contentType === 'comment';

  area.innerHTML = (
    '<div class="sim-wrap">' +
      '<div class="sim-card">' +
        '<div class="sim-title">Test your rules against sample content</div>' +
        '<div class="sim-row"><div class="flabel" style="margin-bottom:8px">Content type</div>' +
          '<div class="sim-radio-group">' +
            '<label class="sim-radio"><input type="radio" name="simType" value="comment"'    + (state.sim.contentType === 'comment'    ? ' checked' : '') + '><span>Comment</span></label>' +
            '<label class="sim-radio"><input type="radio" name="simType" value="submission"' + (state.sim.contentType === 'submission' ? ' checked' : '') + '><span>Post</span></label>' +
            '<label class="sim-radio"><input type="radio" name="simType" value="link"'       + (state.sim.contentType === 'link'       ? ' checked' : '') + '><span>Link post</span></label>' +
          '</div>' +
        '</div>' +
        '<div class="sim-row" id="simTitleRow"' + (isComment ? ' style="display:none"' : '') + '><div class="flabel" style="margin-bottom:5px">Post title</div><input class="input" type="text" id="simTitle" placeholder="e.g. Check out this deal!" value="' + h(state.sim.title) + '"></div>' +
        '<div class="sim-row" id="simUrlRow"'   + (!isLink  ? ' style="display:none"' : '') + '><div class="flabel" style="margin-bottom:5px">Link URL</div><input class="input mono" type="text" id="simUrl" placeholder="e.g. https://bit.ly/abc123" value="' + h(state.sim.url || '') + '"></div>' +
        '<div class="sim-row"><div class="flabel" style="margin-bottom:5px">Body / comment text</div><textarea class="ftextarea" id="simBody" style="min-height:100px" placeholder="Paste content to test…">' + h(state.sim.body) + '</textarea></div>' +
        '<button class="btn-sim-run" id="simRunBtn">▶ Test Rules</button>' +
      '</div>' +
      (resultsHtml ? '<div class="sim-card"><div class="sim-title">Results</div>' + resultsHtml + '</div>' : '') +
    '</div>'
  );

  document.querySelectorAll('input[name="simType"]').forEach(function(radio) {
    radio.addEventListener('change', function() {
      state.sim.contentType = this.value;
      var titleRow = document.getElementById('simTitleRow');
      var urlRow   = document.getElementById('simUrlRow');
      if (titleRow) titleRow.style.display = this.value !== 'comment' ? '' : 'none';
      if (urlRow)   urlRow.style.display   = this.value === 'link'    ? '' : 'none';
    });
  });

  var runBtn = document.getElementById('simRunBtn');
  if (runBtn) {
    runBtn.addEventListener('click', function() {
      state.sim.body  = (document.getElementById('simBody')  || {}).value || '';
      state.sim.title = (document.getElementById('simTitle') || {}).value || '';
      state.sim.url   = (document.getElementById('simUrl')   || {}).value || '';
      state.sim.results = runSimulator(state.sim.contentType, state.sim.title, state.sim.body, state.sim.url);
      renderSimulator();
    });
  }
}

// ── Simulator engine ──────────────────────────────────────────────────────────
function getArr(rule, key) {
  var v = rule[key];
  if (!v) return [];
  return Array.isArray(v) ? v : [String(v)];
}

function runSimulator(contentType, title, body, url) {
  var bodyLow  = body.toLowerCase();
  var titleLow = title.toLowerCase();
  var urlLow   = (url || '').toLowerCase();

  return state.rules.map(function(rule, i) {
    var reasons = [];
    var allPass = true;

    if (rule.type && rule.type !== contentType) {
      reasons.push({ status: 'fail', text: 'Type: rule targets "' + rule.type + '", testing "' + contentType + '"' });
      return { index: i, fires: false, action: rule.action, reasons: reasons };
    } else if (rule.type) {
      reasons.push({ status: 'pass', text: 'Type matches: ' + rule.type });
    }

    function checkIncludes(arr, low, label) {
      if (!arr.length) return;
      var hits = arr.filter(function(p) { return low.includes(p.toLowerCase()); });
      if (hits.length) reasons.push({ status: 'pass', text: label + ' contains: "' + hits.join('", "') + '"' });
      else { allPass = false; reasons.push({ status: 'fail', text: label + ' does not contain: "' + arr.join('", "') + '"' }); }
    }

    function checkExcludes(arr, low, label) {
      if (!arr.length) return;
      var blocked = arr.filter(function(p) { return low.includes(p.toLowerCase()); });
      if (blocked.length) { allPass = false; reasons.push({ status: 'fail', text: label + ' contains excluded: "' + blocked.join('", "') + '"' }); }
      else reasons.push({ status: 'pass', text: label + ' does not contain excluded phrases' });
    }

    function checkRegex(arr, text, label) {
      if (!arr.length) return;
      var hit = arr.some(function(p) { try { return new RegExp(p, 'i').test(text); } catch (_) { return false; } });
      if (hit) reasons.push({ status: 'pass', text: label + ' matches regex' });
      else { allPass = false; reasons.push({ status: 'fail', text: label + ' does not match regex: ' + arr.join(', ') }); }
    }

    checkIncludes(getArr(rule, 'body (includes)'),   bodyLow,  'Body');
    checkExcludes(getArr(rule, 'body (excludes)'),   bodyLow,  'Body');
    checkRegex(   getArr(rule, 'body (regex)'),      body,     'Body');
    checkIncludes(getArr(rule, 'title (includes)'),  titleLow, 'Title');
    checkExcludes(getArr(rule, 'title (excludes)'),  titleLow, 'Title');
    checkRegex(   getArr(rule, 'title (regex)'),     title,    'Title');

    var urlInc = getArr(rule, 'url (includes)');
    if (urlInc.length) {
      if (urlLow) checkIncludes(urlInc, urlLow, 'URL');
      else reasons.push({ status: 'skip', text: 'URL condition present but no URL provided' });
    }
    var urlExc = getArr(rule, 'url (excludes)');
    if (urlExc.length) {
      if (urlLow) checkExcludes(urlExc, urlLow, 'URL');
      else reasons.push({ status: 'skip', text: 'URL condition present but no URL provided' });
    }
    var urlRe = getArr(rule, 'url (regex)');
    if (urlRe.length) {
      if (urlLow) checkRegex(urlRe, url, 'URL');
      else reasons.push({ status: 'skip', text: 'URL regex present but no URL provided' });
    }

    var domains = getArr(rule, 'domain');
    if (domains.length) {
      if (urlLow) {
        try {
          var host = new URL(url).hostname.toLowerCase();
          if (domains.some(function(d) { return host === d.toLowerCase(); })) reasons.push({ status: 'pass', text: 'Domain matches' });
          else { allPass = false; reasons.push({ status: 'fail', text: 'Domain "' + host + '" not in: ' + domains.join(', ') }); }
        } catch (_) { reasons.push({ status: 'skip', text: 'Could not parse URL' }); }
      } else reasons.push({ status: 'skip', text: 'Domain condition present but no URL provided' });
    }

    if (getArr(rule, 'author_flair_text (includes)').length)   reasons.push({ status: 'skip', text: 'Author flair: requires real post data' });
    if (getArr(rule, 'link_flair_text (includes)').length)     reasons.push({ status: 'skip', text: 'Link flair: requires real post data' });
    if (getArr(rule, 'link_flair_css_class (includes)').length) reasons.push({ status: 'skip', text: 'Link flair CSS: requires real post data' });

    var author = rule.author;
    if (author && typeof author === 'object') {
      Object.keys(author).forEach(function(k) {
        reasons.push({ status: 'skip', text: 'Author.' + k + ': ' + author[k] + ' (requires real user data)' });
      });
    }

    if (reasons.length === 0) reasons.push({ status: 'pass', text: 'No conditions — matches all ' + (rule.type || 'content') });

    return { index: i, fires: allPass, action: rule.action, reasons: reasons };
  });
}
