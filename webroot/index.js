// ── State ─────────────────────────────────────────────────────────────────
const state = {
  rules: [],
  selected: -1,
  loading: true,
  dirty: false,
  notification: null,
  tab: 'visual',
  view: 'editor',         // 'editor' | 'simulator'
  sim: {
    contentType: 'comment',
    title: '',
    body: '',
    results: null,        // null = not run yet
  },
};

let rulesLoaded = false;

// ── Devvit messaging ───────────────────────────────────────────────────────
function sendToDevvit(msg) {
  window.parent.postMessage(msg, '*');
}

window.addEventListener('message', (ev) => {
  const raw = ev.data;
  let msg;
  if (raw && raw.type === 'devvit-message') {
    msg = (raw.data && raw.data.message) ? raw.data.message : raw.data;
  } else {
    msg = raw;
  }
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
      document.getElementById('headerSub').textContent =
        state.rules.length + ' rule' + (state.rules.length !== 1 ? 's' : '');
      refreshAll();
      break;
    case 'SAVE_SUCCESS':
      state.dirty = false;
      state.notification = { type: 'success', text: 'Changes saved successfully!' };
      updateSaveBtn();
      renderEditor();
      setTimeout(function() { state.notification = null; renderEditor(); }, 3000);
      break;
    case 'ERROR':
      state.loading = false;
      state.notification = { type: 'error', text: msg.message || 'An error occurred.' };
      refreshAll();
      break;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
function requestRules() {
  sendToDevvit({ type: 'GET_RULES' });
}

window.addEventListener('load', function() {
  requestRules();
  setTimeout(function() { if (!rulesLoaded) requestRules(); }, 2000);
  setTimeout(function() {
    if (!rulesLoaded) {
      state.loading = false;
      state.notification = {
        type: 'error',
        text: 'Could not load rules. Click Reload to try again.',
      };
      refreshAll();
    }
  }, 8000);
});

// ── View switching ─────────────────────────────────────────────────────────
document.getElementById('tabEditor').addEventListener('click', function() {
  state.view = 'editor';
  document.getElementById('tabEditor').classList.add('active');
  document.getElementById('tabSimulator').classList.remove('active');
  document.getElementById('mainArea').style.display = 'flex';
  document.getElementById('simulatorArea').style.display = 'none';
});

document.getElementById('tabSimulator').addEventListener('click', function() {
  state.view = 'simulator';
  document.getElementById('tabSimulator').classList.add('active');
  document.getElementById('tabEditor').classList.remove('active');
  document.getElementById('mainArea').style.display = 'none';
  document.getElementById('simulatorArea').style.display = 'block';
  renderSimulator();
});

// ── Static button listeners ────────────────────────────────────────────────
document.getElementById('reloadBtn').addEventListener('click', function() {
  state.loading = true;
  state.notification = null;
  rulesLoaded = false;
  refreshAll();
  requestRules();
});

document.getElementById('saveBtn').addEventListener('click', function() {
  sendToDevvit({ type: 'SAVE', rules: state.rules });
});

document.getElementById('addRuleBtn').addEventListener('click', function() {
  state.rules.push({ type: 'comment', action: 'remove' });
  state.selected = state.rules.length - 1;
  state.tab = 'visual';
  markDirty();
  refreshAll();
});

// ── Event delegation — clicks ──────────────────────────────────────────────
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.dataset.action;
  var idx = parseInt(el.dataset.index || '-1', 10);

  if (action === 'selectRule') { selectRule(idx); }
  else if (action === 'deleteRule') { deleteRule(idx); }
  else if (action === 'switchTab') { switchTab(el.dataset.tab); }
});

// ── Event delegation — changes ─────────────────────────────────────────────
document.addEventListener('change', function(e) {
  var el = e.target;
  var action = el.dataset.action;
  if (!action) return;
  var i = parseInt(el.dataset.ruleindex || '-1', 10);
  var key = el.dataset.key || '';
  var obj = el.dataset.obj || '';

  if (action === 'setField') {
    setField(i, key, el.value || undefined);
  } else if (action === 'setArrayField') {
    setArrayField(i, key, el.value);
  } else if (action === 'setNestedField') {
    setNestedField(i, obj, key, el.value);
  } else if (action === 'setPriority') {
    setField(i, 'priority', el.value !== '' ? Number(el.value) : undefined);
  } else if (action === 'setModExempt') {
    setField(i, 'moderators_exempt', el.checked);
  } else if (action === 'applyRaw') {
    applyRaw(i, el.value);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function markDirty() { state.dirty = true; updateSaveBtn(); }

function updateSaveBtn() {
  var btn = document.getElementById('saveBtn');
  btn.disabled = !state.dirty;
  btn.textContent = state.dirty ? 'Save Changes' : 'No Changes';
}

function refreshAll() { renderRuleList(); renderEditor(); }

function h(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getRuleName(rule, idx) {
  // 1. Use mod-supplied label (action_reason is most descriptive)
  if (typeof rule.action_reason === 'string' && rule.action_reason.trim()) {
    return rule.action_reason.trim().split('\n')[0].substring(0, 52);
  }
  // 2. Use auto-reply comment first line
  if (typeof rule.comment === 'string' && rule.comment.trim()) {
    return rule.comment.trim().split('\n')[0].substring(0, 52);
  }
  // 3. Generate from body conditions
  var bodyInc = getArr(rule, 'body (includes)');
  if (bodyInc.length) {
    var act = rule.action ? capitalize(rule.action) : 'Match';
    var preview = bodyInc.slice(0, 2).map(function(s) { return '"' + s + '"'; }).join(', ');
    return act + ' if body contains ' + preview + (bodyInc.length > 2 ? '…' : '');
  }
  // 4. Generate from title conditions
  var titleInc = getArr(rule, 'title (includes)');
  if (titleInc.length) {
    return 'Title contains: ' + titleInc.slice(0, 2).join(', ');
  }
  // 5. Generate from author conditions
  var author = rule.author;
  if (author && typeof author === 'object') {
    var firstKey = Object.keys(author)[0];
    if (firstKey) return 'Author ' + firstKey + ': ' + author[firstKey];
  }
  // 6. Fallback: type + action
  var type = rule.type ? capitalize(rule.type) : 'Any';
  var action = rule.action || 'no action';
  return type + ' → ' + action;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getBadge(action) {
  var map = { remove: 'badge-remove', report: 'badge-report', approve: 'badge-approve', spam: 'badge-spam', filter: 'badge-filter' };
  return map[action] || 'badge-none';
}

// ── Rules list ─────────────────────────────────────────────────────────────
function renderRuleList() {
  var list = document.getElementById('ruleList');
  var count = document.getElementById('ruleCount');

  if (state.loading) {
    list.innerHTML = '<div style="padding:14px;color:#818384;text-align:center;font-size:13px">Loading...</div>';
    count.textContent = '';
    return;
  }

  count.textContent = '(' + state.rules.length + ')';

  if (!state.rules.length) {
    list.innerHTML = '<div style="padding:16px;color:#818384;text-align:center;font-size:13px;line-height:1.6">No AutoMod rules found.<br><span style="color:#ff4500;font-weight:600">Click "+ Add Rule"</span><br>to create your first rule.</div>';
    return;
  }

  list.innerHTML = state.rules.map(function(rule, i) {
    var name = getRuleName(rule, i);
    var action = String(rule.action || '');
    var type = String(rule.type || 'any');
    var activeClass = i === state.selected ? ' active' : '';
    return '<div class="rule-item' + activeClass + '" data-action="selectRule" data-index="' + i + '">' +
      '<div class="rule-name">' + h(name) + '</div>' +
      '<div class="rule-meta">' +
        '<span class="badge ' + getBadge(action) + '">' + h(action || 'no action') + '</span>' +
        '<span class="type-label">' + h(type) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function selectRule(i) {
  state.selected = i;
  state.tab = 'visual';
  state.notification = null;
  renderRuleList();
  renderEditor();
}

function deleteRule(i) {
  if (!confirm('Delete this rule?')) return;
  state.rules.splice(i, 1);
  state.selected = Math.min(state.selected, state.rules.length - 1);
  markDirty();
  refreshAll();
}

function switchTab(tab) { state.tab = tab; renderEditor(); }

// ── Editor ─────────────────────────────────────────────────────────────────
function renderEditor() {
  var panel = document.getElementById('editorPanel');

  if (state.loading) {
    panel.innerHTML = '<div class="loading-state">Loading AutoMod rules...</div>';
    return;
  }

  if (state.selected < 0 || state.selected >= state.rules.length) {
    panel.innerHTML = '<div class="editor-empty"><div class="editor-empty-icon">📋</div><div>Select a rule to edit</div><div class="editor-empty-hint">or click "+ Add Rule" to create one</div></div>';
    return;
  }

  var rule = state.rules[state.selected];
  var i = state.selected;
  var name = getRuleName(rule, i);

  var notifHtml = '';
  if (state.notification) {
    notifHtml = '<div class="banner banner-' + state.notification.type + '">' + h(state.notification.text) + '</div>';
  }

  var tabContent = state.tab === 'raw' ? renderRawTab(rule, i) : renderVisualTab(rule, i);

  panel.innerHTML = notifHtml +
    '<div class="editor-top">' +
      '<div class="editor-title">' + h(name) + '</div>' +
      '<button class="delete-btn" data-action="deleteRule" data-index="' + i + '">Delete</button>' +
    '</div>' +
    '<div class="tabs">' +
      '<div class="tab' + (state.tab === 'visual' ? ' active' : '') + '" data-action="switchTab" data-tab="visual">Visual Editor</div>' +
      '<div class="tab' + (state.tab === 'raw' ? ' active' : '') + '" data-action="switchTab" data-tab="raw">Raw JSON</div>' +
    '</div>' +
    tabContent;
}

function arr(rule, k) {
  var v = rule[k];
  if (!v) return '';
  if (Array.isArray(v)) return v.join('\n');
  return String(v);
}

function nested(rule, obj, k) {
  var o = rule[obj];
  if (!o || typeof o !== 'object') return '';
  var v = o[k];
  return v != null ? String(v) : '';
}

function renderVisualTab(rule, i) {
  var ri = String(i);
  return '<div class="form-section">' +
      '<div class="section-title">Label</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Action reason <span style="color:#818384;font-weight:400">(shows in mod log — also used as rule name)</span></label>' +
        '<input class="form-control" type="text" placeholder="e.g. Spam filter, Low karma new account…" value="' + h(rule.action_reason || '') + '" data-action="setField" data-ruleindex="' + ri + '" data-key="action_reason">' +
      '</div>' +
    '</div>' +
    '<div class="form-section">' +
      '<div class="section-title">Match Type</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Content type to match</label>' +
        '<select class="form-control" data-action="setField" data-ruleindex="' + ri + '" data-key="type">' +
          opt('', 'Any', !rule.type) +
          opt('comment', 'Comment', rule.type === 'comment') +
          opt('submission', 'Submission (Post)', rule.type === 'submission') +
          opt('link', 'Link post', rule.type === 'link') +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="form-section">' +
      '<div class="section-title">Conditions — what to match</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Body must contain (one per line)</label>' +
        '<textarea class="form-control" placeholder="e.g. spam" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="body (includes)">' + h(arr(rule, 'body (includes)')) + '</textarea>' +
        '<div class="form-hint">Rule fires if body contains ANY of these strings</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Body must NOT contain (one per line)</label>' +
        '<textarea class="form-control" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="body (excludes)">' + h(arr(rule, 'body (excludes)')) + '</textarea>' +
      '</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Title must contain (one per line)</label>' +
        '<textarea class="form-control" data-action="setArrayField" data-ruleindex="' + ri + '" data-key="title (includes)">' + h(arr(rule, 'title (includes)')) + '</textarea>' +
      '</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Author — comment karma threshold</label>' +
        '<input class="form-control" type="text" placeholder="e.g. &lt; 10" value="' + h(nested(rule, 'author', 'comment_karma')) + '" data-action="setNestedField" data-ruleindex="' + ri + '" data-obj="author" data-key="comment_karma">' +
        '<div class="form-hint">Reddit comparison syntax: &lt; 10, &gt; 100, etc.</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Author — account age threshold</label>' +
        '<input class="form-control" type="text" placeholder="e.g. &lt; 7 days" value="' + h(nested(rule, 'author', 'account_age')) + '" data-action="setNestedField" data-ruleindex="' + ri + '" data-obj="author" data-key="account_age">' +
      '</div>' +
    '</div>' +
    '<div class="form-section">' +
      '<div class="section-title">Actions — what to do</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Action</label>' +
        '<select class="form-control" data-action="setField" data-ruleindex="' + ri + '" data-key="action">' +
          opt('', '(none)', !rule.action) +
          opt('approve', 'Approve', rule.action === 'approve') +
          opt('remove', 'Remove', rule.action === 'remove') +
          opt('report', 'Report to mod queue', rule.action === 'report') +
          opt('spam', 'Mark as spam', rule.action === 'spam') +
          opt('filter', 'Filter', rule.action === 'filter') +
        '</select>' +
      '</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Auto-reply comment (leave empty to skip)</label>' +
        '<textarea class="form-control" placeholder="Comment posted automatically..." data-action="setField" data-ruleindex="' + ri + '" data-key="comment">' + h(rule.comment || '') + '</textarea>' +
      '</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Report reason</label>' +
        '<input class="form-control" type="text" placeholder="e.g. Needs review" value="' + h(rule.report_reason || '') + '" data-action="setField" data-ruleindex="' + ri + '" data-key="report_reason">' +
      '</div>' +
    '</div>' +
    '<div class="form-section">' +
      '<div class="section-title">Metadata</div>' +
      '<div class="form-row">' +
        '<label class="form-label">Priority</label>' +
        '<input class="form-control" type="number" placeholder="(default)" value="' + h(rule.priority != null ? String(rule.priority) : '') + '" data-action="setPriority" data-ruleindex="' + ri + '">' +
      '</div>' +
      '<div class="form-row">' +
        '<label class="form-check">' +
          '<input type="checkbox"' + (rule.moderators_exempt === false ? '' : ' checked') + ' data-action="setModExempt" data-ruleindex="' + ri + '">' +
          '<span>Moderators exempt from this rule</span>' +
        '</label>' +
      '</div>' +
    '</div>';
}

function opt(value, label, selected) {
  return '<option value="' + h(value) + '"' + (selected ? ' selected' : '') + '>' + h(label) + '</option>';
}

function renderRawTab(rule, i) {
  return '<div class="form-section">' +
    '<div class="section-title">Raw rule data (JSON)</div>' +
    '<textarea class="raw-area" data-action="applyRaw" data-ruleindex="' + i + '">' + h(JSON.stringify(rule, null, 2)) + '</textarea>' +
    '<div class="raw-hint">Edit the raw JSON for this rule. Invalid JSON is ignored.</div>' +
  '</div>';
}

// ── Field setters ──────────────────────────────────────────────────────────
function setField(i, key, value) {
  if (value === undefined || value === '') {
    delete state.rules[i][key];
  } else {
    state.rules[i][key] = value;
  }
  markDirty();
  renderRuleList();
}

function setArrayField(i, key, raw) {
  var lines = raw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
  if (!lines.length) {
    delete state.rules[i][key];
  } else {
    state.rules[i][key] = lines.length === 1 ? lines[0] : lines;
  }
  markDirty();
  renderRuleList();
}

function setNestedField(i, obj, key, value) {
  var rule = state.rules[i];
  if (!value || !value.trim()) {
    if (rule[obj] && typeof rule[obj] === 'object') {
      delete rule[obj][key];
      if (!Object.keys(rule[obj]).length) delete rule[obj];
    }
  } else {
    if (!rule[obj] || typeof rule[obj] !== 'object') rule[obj] = {};
    rule[obj][key] = value.trim();
  }
  markDirty();
}

function applyRaw(i, jsonStr) {
  try {
    state.rules[i] = JSON.parse(jsonStr);
    markDirty();
    renderRuleList();
  } catch (_) {}
}

// ── Simulator ──────────────────────────────────────────────────────────────
function renderSimulator() {
  var area = document.getElementById('simulatorArea');
  var resultsHtml = '';

  if (state.sim.results !== null) {
    resultsHtml = '<div class="sim-card"><div class="sim-title">Results</div>' +
      state.sim.results.map(function(r) {
        var cardClass = r.fires ? 'fires' : 'no-match';
        var icon = r.fires ? '🔴' : '⚪';
        var statusText = r.fires
          ? '<span style="color:#f87171;font-weight:700">WOULD FIRE → ' + h(r.action || 'action') + '</span>'
          : '<span style="color:#818384">no match</span>';
        var reasons = r.reasons.map(function(rr) {
          return '<li class="' + rr.status + '">' + (rr.status === 'pass' ? '✓' : rr.status === 'fail' ? '✗' : '–') + ' ' + h(rr.text) + '</li>';
        }).join('');
        return '<div class="result-card ' + cardClass + '">' +
          '<div class="result-header">' +
            '<span class="result-icon">' + icon + '</span>' +
            '<span class="result-name">Rule ' + (r.index + 1) + ': ' + h(getRuleName(state.rules[r.index], r.index)) + '</span>' +
            statusText +
          '</div>' +
          '<ul class="result-reasons">' + reasons + '</ul>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  area.innerHTML =
    '<div class="sim-card">' +
      '<div class="sim-title">Test your rules against sample content</div>' +
      '<div class="sim-row">' +
        '<label class="form-label">Content type</label>' +
        '<div class="sim-radio-group">' +
          '<label class="sim-radio"><input type="radio" name="simType" value="comment" id="simTypeComment"' + (state.sim.contentType === 'comment' ? ' checked' : '') + '><span>Comment</span></label>' +
          '<label class="sim-radio"><input type="radio" name="simType" value="submission" id="simTypeSubmission"' + (state.sim.contentType === 'submission' ? ' checked' : '') + '><span>Submission (Post)</span></label>' +
          '<label class="sim-radio"><input type="radio" name="simType" value="link" id="simTypeLink"' + (state.sim.contentType === 'link' ? ' checked' : '') + '><span>Link</span></label>' +
        '</div>' +
      '</div>' +
      '<div class="sim-row" id="simTitleRow" style="' + (state.sim.contentType !== 'comment' ? '' : 'display:none') + '">' +
        '<label class="form-label">Post title</label>' +
        '<input class="form-control" type="text" id="simTitle" placeholder="e.g. Check out this deal!" value="' + h(state.sim.title) + '">' +
      '</div>' +
      '<div class="sim-row">' +
        '<label class="form-label">Body / comment text</label>' +
        '<textarea class="form-control" id="simBody" style="min-height:100px" placeholder="Paste the content to test against your rules...">' + h(state.sim.body) + '</textarea>' +
      '</div>' +
      '<button class="sim-run-btn" id="simRunBtn">▶ Test Rules</button>' +
    '</div>' +
    resultsHtml;

  // Wire up simulator controls (re-attach each render since innerHTML replaces them)
  document.querySelectorAll('input[name="simType"]').forEach(function(radio) {
    radio.addEventListener('change', function() {
      state.sim.contentType = this.value;
      var titleRow = document.getElementById('simTitleRow');
      if (titleRow) titleRow.style.display = this.value !== 'comment' ? '' : 'none';
    });
  });

  var simRunBtn = document.getElementById('simRunBtn');
  if (simRunBtn) {
    simRunBtn.addEventListener('click', function() {
      state.sim.body = (document.getElementById('simBody') || {}).value || '';
      state.sim.title = (document.getElementById('simTitle') || {}).value || '';
      state.sim.results = runSimulator(state.sim.contentType, state.sim.title, state.sim.body);
      renderSimulator();
    });
  }
}

function getArr(rule, key) {
  var v = rule[key];
  if (!v) return [];
  return Array.isArray(v) ? v : [String(v)];
}

function runSimulator(contentType, title, body) {
  var bodyLow = body.toLowerCase();
  var titleLow = title.toLowerCase();

  return state.rules.map(function(rule, i) {
    var reasons = [];
    var allPass = true;

    // Type check
    if (rule.type && rule.type !== contentType) {
      reasons.push({ status: 'fail', text: 'Type: rule targets "' + rule.type + '", testing "' + contentType + '"' });
      return { index: i, fires: false, action: rule.action, reasons: reasons };
    } else if (rule.type) {
      reasons.push({ status: 'pass', text: 'Type matches: ' + rule.type });
    }

    // body (includes)
    var includes = getArr(rule, 'body (includes)');
    if (includes.length) {
      var hits = includes.filter(function(p) { return bodyLow.includes(p.toLowerCase()); });
      if (hits.length) {
        reasons.push({ status: 'pass', text: 'Body contains: "' + hits.join('", "') + '"' });
      } else {
        allPass = false;
        reasons.push({ status: 'fail', text: 'Body does not contain any of: "' + includes.join('", "') + '"' });
      }
    }

    // body (excludes)
    var excludes = getArr(rule, 'body (excludes)');
    if (excludes.length) {
      var blocked = excludes.filter(function(p) { return bodyLow.includes(p.toLowerCase()); });
      if (blocked.length) {
        allPass = false;
        reasons.push({ status: 'fail', text: 'Body contains excluded phrase: "' + blocked.join('", "') + '"' });
      } else {
        reasons.push({ status: 'pass', text: 'Body does not contain excluded phrases' });
      }
    }

    // body (regex)
    var regexes = getArr(rule, 'body (regex)');
    if (regexes.length) {
      var regexHit = regexes.some(function(pat) {
        try { return new RegExp(pat, 'i').test(body); } catch (_) { return false; }
      });
      if (regexHit) {
        reasons.push({ status: 'pass', text: 'Body matches regex pattern' });
      } else {
        allPass = false;
        reasons.push({ status: 'fail', text: 'Body does not match regex: ' + regexes.join(', ') });
      }
    }

    // title (includes)
    var titleInc = getArr(rule, 'title (includes)');
    if (titleInc.length) {
      var titleHits = titleInc.filter(function(p) { return titleLow.includes(p.toLowerCase()); });
      if (titleHits.length) {
        reasons.push({ status: 'pass', text: 'Title contains: "' + titleHits.join('", "') + '"' });
      } else {
        allPass = false;
        reasons.push({ status: 'fail', text: 'Title does not contain: "' + titleInc.join('", "') + '"' });
      }
    }

    // author conditions (cannot simulate without real user data)
    var author = rule.author;
    if (author && typeof author === 'object') {
      Object.keys(author).forEach(function(k) {
        reasons.push({ status: 'skip', text: 'Author.' + k + ': ' + author[k] + ' (requires real user data)' });
      });
    }

    // No conditions at all
    if (reasons.length === 0) {
      reasons.push({ status: 'pass', text: 'No content conditions — matches all ' + (rule.type || 'content') + 's' });
    }

    return { index: i, fires: allPass, action: rule.action, reasons: reasons };
  });
}
