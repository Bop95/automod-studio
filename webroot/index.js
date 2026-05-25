const templates = [
  {
    id: 'anti-spam',
    icon: 'shield',
    name: 'Anti-spam basics',
    category: 'Anti-spam',
    conditions: 3,
    description: 'Remove comments that contain common spam phrases or links from accounts under 30 days old.',
    tags: ['Anti-spam', '3 conditions'],
    rule: {
      type: 'comment',
      action: 'remove',
      action_reason: 'Anti-spam basics',
      report_reason: 'Possible spam or promotional content',
      'body (includes)': ['buy now', 'limited offer', 'cheap followers'],
      comment: 'Your comment was removed because it looks promotional or spammy.',
    },
  },
  {
    id: 'new-accounts',
    icon: 'users',
    name: 'Restrict new accounts',
    category: 'New users',
    conditions: 2,
    description: 'Hold posts and comments from accounts younger than 14 days for manual review.',
    tags: ['New users', '2 conditions'],
    rule: {
      type: '',
      action: 'filter',
      action_reason: 'Restrict new accounts',
      report_reason: 'New account needs moderator review',
      author: { account_age: '< 7 days', combined_karma: '< 10' },
    },
  },
  {
    id: 'post-flair',
    icon: 'tag',
    name: 'Require post flair',
    category: 'Format checks',
    conditions: 2,
    description: 'Auto-remove unflaired posts and ask the OP to set one before reposting.',
    tags: ['Format checks', '2 conditions'],
    rule: {
      type: 'submission',
      action: 'filter',
      action_reason: 'Require post flair',
      report_reason: 'Missing required post flair',
      'title (includes)': ['[ flair required ]'],
    },
  },
  {
    id: 'personal-attacks',
    icon: 'frown',
    name: 'No personal attacks',
    category: 'Civility',
    conditions: 4,
    description: 'Flag comments containing slurs or known harassment patterns for mod review.',
    tags: ['Civility', '4 conditions'],
    rule: {
      type: 'comment',
      action: 'filter',
      action_reason: 'No personal attacks',
      report_reason: 'Potential personal attack',
      'body (regex)': ['(?i)(idiot|moron|kill yourself)'],
    },
  },
  {
    id: 'link-farming',
    icon: 'link',
    name: 'Block link farming',
    category: 'Anti-spam',
    conditions: 3,
    description: 'Filter repeated domains and referral links from accounts with low community history.',
    tags: ['Anti-spam', '3 conditions'],
    rule: {
      type: 'link',
      action: 'filter',
      action_reason: 'Block link farming',
      report_reason: 'Possible link farming',
      'url (includes)': ['ref=', 'utm_source=', 'bit.ly'],
      author: { combined_karma: '< 50' },
    },
  },
  {
    id: 'title-format',
    icon: 'text',
    name: 'Title format checks',
    category: 'Content quality',
    conditions: 1,
    description: 'Filter posts with all-caps titles, vague help requests, or missing required context.',
    tags: ['Content quality', '1 condition'],
    rule: {
      type: 'submission',
      action: 'filter',
      action_reason: 'Title format checks',
      report_reason: 'Title format needs review',
      'title (regex)': ['^[A-Z\\s!?]{18,}$'],
    },
  },
];

const state = {
  rules: [],
  serverRules: [],
  selected: -1,
  loading: true,
  saving: false,
  dirty: false,
  view: 'templates',
  theme: localStorage.getItem('cg-theme') || 'light',
  sidebarCollapsed: localStorage.getItem('ams-sidebar-collapsed') === 'true',
  subredditName: 'ModQueueLab',
  currentUsername: null,
  canSave: true,
  wikiRevisions: [],
  wikiRevisionCache: {},
  notification: null,
  parserWarnings: [],
  sim: {
    contentType: 'comment',
    title: '',
    body: '',
    url: '',
    results: null,
    inlineResult: null,
  },
  ui: {
    templateSearch: '',
    templateCategory: 'all',
    sidePanelScroll: 0,
    contentScroll: 0,
    openDetails: [],
    focusSelector: null,
    historySelectedId: null,
    historyDiffMode: 'visual',
  },
  history: [],
};

let rulesLoaded = false;
let persistDraftTimer = null;
let builderChromeTimer = null;
const DRAFT_STORAGE_KEY = 'ams-automod-draft-v1';
const HISTORY_STORAGE_KEY = 'ams-automod-history-v1';
const HISTORY_MAX_ENTRIES = 30;
const AUTOMOD_WIKI_HELP = 'https://www.reddit.com/r/automoderator/wiki/config/automoderator';

const FIELD_TIPS = {
  ruleName: {
    text: 'Short name for mods. Used in logs and as the default removal reason.',
    example: 'Anti-spam basics',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  contentType: {
    text: 'Which content this rule checks. Use a specific type plus match phrases—avoid “Any” with no conditions.',
    example: 'comment',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  priority: {
    text: 'Lower numbers run first when several rules could match.',
    example: '10',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  modExempt: {
    text: 'When checked, moderator posts and comments are not affected.',
    example: 'moderators_exempt: true',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  primaryAction: {
    text: 'What AutoMod does when all conditions match. Filter is safest while you are still editing.',
    example: 'filter',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  reportReason: {
    text: 'Text mods see in the mod queue and removal logs.',
    example: 'Possible spam — needs review',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  autoReply: {
    text: 'Optional comment or modmail sent to the author when the rule fires.',
    example: 'Your post was removed for breaking rule 2.',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  lockContent: {
    text: 'Locks matched posts or comments so users cannot reply.',
    example: 'lock: true',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  banUser: {
    text: 'Bans the author. Use only for serious or repeated violations.',
    example: 'ban: true',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  bodyIncludes: {
    text: 'One phrase per line (case insensitive). Rule runs only if the body contains at least one phrase.',
    example: 'buy now',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  bodyExcludes: {
    text: 'If the body contains any listed phrase, the rule will not match.',
    example: 'trusted member',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  titleIncludes: {
    text: 'For posts and link submissions. One phrase per line.',
    example: 'free money',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  urlIncludes: {
    text: 'Matches if the URL contains any of these substrings.',
    example: 'bit.ly',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  bodyRegex: {
    text: 'Perl-style regex, one pattern per line. Test in the simulator before deploy.',
    example: '(?i)buy.?now',
    learnMore: 'https://www.reddit.com/r/automoderator/wiki/regex',
  },
  combinedKarma: {
    text: 'Comparison on total karma. Use AutoMod operators like <, >, =.',
    example: '< 10',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  commentKarma: {
    text: 'Only matches authors below (or above) this comment karma threshold.',
    example: '< 5',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  postKarma: {
    text: 'Only matches authors below (or above) this post karma threshold.',
    example: '< 5',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  accountAge: {
    text: 'Account age comparison. Very common for new-account rules.',
    example: '< 7 days',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  linkFlair: {
    text: 'Match posts that have this link flair text. One value per line.',
    example: 'News',
    learnMore: AUTOMOD_WIKI_HELP,
  },
  setFlair: {
    text: 'Flair applied automatically when the rule matches (set_flair in YAML).',
    example: 'Answered',
    learnMore: AUTOMOD_WIKI_HELP,
  },
};

document.documentElement.dataset.theme = state.theme;

function notify(type, text, options) {
  state.notification = { type: type, text: text, retryAction: options && options.retryAction };
}

function confirmUnsavedLeave() {
  if (!state.dirty) return true;
  return window.confirm(
    'You have unsaved changes on this device. Leave without deploying? Your draft stays saved locally until you discard it.'
  );
}

function captureUiState() {
  const side = document.querySelector('.side-panel');
  const content = document.querySelector('.content');
  if (side) state.ui.sidePanelScroll = side.scrollTop;
  if (content) state.ui.contentScroll = content.scrollTop;
  state.ui.openDetails = [];
  document.querySelectorAll('.builder-panel').forEach(function(panel, index) {
    if (panel.open) state.ui.openDetails.push(index);
  });
  const active = document.activeElement;
  if (active && active.id) state.ui.focusSelector = '#' + active.id;
  else if (active && active.matches('[data-action="selectRule"]')) {
    state.ui.focusSelector = '[data-action="selectRule"][data-index="' + active.dataset.index + '"]';
  } else state.ui.focusSelector = null;
}

function restoreUiState() {
  requestAnimationFrame(function() {
    const side = document.querySelector('.side-panel');
    const content = document.querySelector('.content');
    if (side) side.scrollTop = state.ui.sidePanelScroll;
    if (content) content.scrollTop = state.ui.contentScroll;
    const panels = document.querySelectorAll('.builder-panel');
    panels.forEach(function(panel, index) {
      panel.open = state.ui.openDetails.indexOf(index) >= 0;
    });
    if (state.ui.focusSelector) {
      const el = document.querySelector(state.ui.focusSelector);
      if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
    }
  });
}

function scheduleBuilderChromeUpdate() {
  clearTimeout(builderChromeTimer);
  builderChromeTimer = setTimeout(updateBuilderChrome, 120);
}

function renderBuilderMetaHtml(rule) {
  const condCount = countRuleConditions(rule);
  const broad = isRuleTooBroad(rule);
  const dup = findDuplicateRuleIndex(rule, state.selected) >= 0;
  return `
    <span class="meta-chip brand" title="Content type">${h(rule.type ? capitalize(rule.type) : 'Any')}</span>
    <span class="meta-chip ${actionChip(rule.action)}" title="Action">${h(capitalize(rule.action || 'filter'))}</span>
    <span class="meta-chip neutral" title="Match conditions">${condCount} ${condCount === 1 ? 'condition' : 'conditions'}</span>
    ${broad ? '<span class="meta-chip warning">Incomplete</span>' : ''}
    ${dup ? '<span class="meta-chip danger">Duplicate</span>' : ''}
  `;
}

function renderBuilderSafetyHtml(rule, index) {
  const broad = isRuleTooBroad(rule);
  const dup = findDuplicateRuleIndex(rule, index) >= 0;
  let html = '';
  if (broad) {
    html += '<div class="safety-callout">' + icon('alert-triangle') + '<div><strong>Safe mode:</strong> Add at least one match condition (body phrase, title, URL, author limit, or flair) before deploying. Without conditions, this rule could match all ' + h(rule.type ? rule.type + 's' : 'content') + '.</div></div>';
  }
  if (dup) {
    html += '<div class="safety-callout warn">Another rule has the same settings. Rename or change conditions so mods can tell them apart.</div>';
  }
  return html;
}

function updateBuilderChrome() {
  if (state.view !== 'builder' || state.selected < 0) return;
  const rule = state.rules[state.selected];
  if (!rule) return;
  const meta = document.querySelector('.builder-meta');
  if (meta) meta.innerHTML = renderBuilderMetaHtml(rule);
  const callouts = document.getElementById('builderSafetyCallouts');
  if (callouts) callouts.innerHTML = renderBuilderSafetyHtml(rule, state.selected);
  const tabsList = document.querySelector('.builder-rule-tabs-list');
  if (tabsList) tabsList.innerHTML = renderBuilderTabsInnerHtml();
  bindBuilderTabKeys();
}

function renderBuilderTabsInnerHtml() {
  return state.rules.map(function(rule, index) {
    const active = index === state.selected;
    const dup = findDuplicateRuleIndex(rule, index) >= 0;
    const broad = isRuleTooBroad(rule);
    const flagTitle = dup ? 'Duplicate of another rule' : broad ? 'Needs match conditions' : '';
    return `
      <button
        type="button"
        class="builder-rule-tab ${active ? 'active' : ''} ${dup ? 'is-dup' : ''} ${broad ? 'is-broad' : ''}"
        data-action="selectRule"
        data-index="${index}"
        role="tab"
        id="builder-rule-tab-${index}"
        aria-selected="${active}"
        aria-controls="builder-rule-panel"
        tabindex="${active ? '0' : '-1'}"
      >
        <span class="builder-rule-tab-label">${h(getRuleName(rule))}</span>
        ${dup || broad ? `<span class="builder-rule-tab-flag" title="${h(flagTitle)}"></span>` : ''}
      </button>
    `;
  }).join('');
}

function bindBuilderTabKeys() {
  /* keyboard handled globally — see keydown listener below */
}

function getFilteredTemplates() {
  const q = state.ui.templateSearch.trim().toLowerCase();
  return templates.filter(function(t) {
    if (state.ui.templateCategory !== 'all' && t.category !== state.ui.templateCategory) return false;
    if (!q) return true;
    const hay = (t.name + ' ' + t.category + ' ' + t.description).toLowerCase();
    return hay.indexOf(q) >= 0;
  });
}

function sendToDevvit(msg) {
  window.parent.postMessage(msg, '*');
}

window.addEventListener('message', function(ev) {
  const raw = ev.data;
  const msg = raw && raw.type === 'devvit-message'
    ? ((raw.data && raw.data.message) ? raw.data.message : raw.data)
    : raw;
  if (msg && msg.type) handleDevvitMsg(msg);
});

window.addEventListener('load', function() {
  bindStaticEvents();
  requestRules();
  renderShell();
  setTimeout(function() { if (!rulesLoaded) requestRules(); }, 2000);
  setTimeout(function() {
    if (!rulesLoaded) {
      state.loading = false;
      state.notification = null;
      if (!state.rules.length) {
        state.view = 'rules';
        state.selected = -1;
      }
      renderShell();
    }
  }, 8000);
});

window.addEventListener('beforeunload', function(e) {
  if (state.dirty) {
    persistDraft();
    e.preventDefault();
    e.returnValue = '';
  }
});

function bindStaticEvents() {
  document.querySelectorAll('.nav-item[data-view]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setView(btn.dataset.view);
    });
  });
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('sideNavToggle').addEventListener('click', toggleSidebar);
  document.getElementById('newRuleBtn').addEventListener('click', createBlankRule);
  document.getElementById('deployBtn').addEventListener('click', deployRules);
  document.getElementById('saveBarBtn').addEventListener('click', deployRules);
  document.getElementById('resetBtn').addEventListener('click', function() {
    clearDraft();
    state.rules = clone(state.serverRules || []);
    ensureRuleIds(state.rules);
    state.dirty = false;
    state.selected = state.rules.length ? 0 : -1;
    state.notification = { type: 'success', text: 'Discarded local draft.' };
    updateDirtyState();
    renderShell();
  });
  const saveDraftBtn = document.getElementById('saveDraftBtn');
  if (saveDraftBtn) saveDraftBtn.addEventListener('click', saveDraftOnly);
  document.getElementById('reloadBtn').addEventListener('click', function() {
    if (state.dirty && !window.confirm('Reload from Reddit and discard unsaved changes on this device?')) return;
    clearDraft();
    state.dirty = false;
    state.loading = true;
    state.notification = null;
    renderShell();
    requestRules();
  });
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.help-tip-wrap.is-open').forEach(function(w) {
      w.classList.remove('is-open');
      const b = w.querySelector('.help-tip');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
    return;
  }
  if (state.view !== 'builder' || !state.rules.length) return;
  if (!e.target.closest('.builder-rule-tabs-list')) return;
  let next = state.selected;
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    next = Math.min(state.rules.length - 1, state.selected + 1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    next = Math.max(0, state.selected - 1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    next = 0;
  } else if (e.key === 'End') {
    e.preventDefault();
    next = state.rules.length - 1;
  } else return;
  if (next !== state.selected) selectBuilderRule(next);
});

function requestRules() {
  rulesLoaded = false;
  sendToDevvit({ type: 'GET_RULES' });
}

function requestWikiRevisions() {
  sendToDevvit({ type: 'GET_WIKI_REVISIONS' });
}

function historyItemKey(source, id) {
  return source + ':' + id;
}

function parseHistoryItemKey(key) {
  if (!key || key.indexOf(':') < 0) return null;
  const parts = key.split(':');
  return { source: parts[0], id: parts.slice(1).join(':') };
}

function getHistoryTimeline() {
  const items = [];
  state.wikiRevisions.forEach(function(rev) {
    items.push({
      key: historyItemKey('reddit', rev.id),
      source: 'reddit',
      id: rev.id,
      savedAt: rev.date,
      title: rev.reason || 'Wiki revision',
      detail: 'Reddit wiki · config/automoderator',
      author: rev.author || 'unknown',
      ruleCount: null,
      rules: state.wikiRevisionCache[rev.id] ? state.wikiRevisionCache[rev.id].rules : null,
      kind: 'reddit',
    });
  });
  state.history.forEach(function(entry) {
    items.push({
      key: historyItemKey('local', entry.id),
      source: 'local',
      id: entry.id,
      savedAt: entry.savedAt,
      title: entry.title,
      detail: entry.detail,
      author: entry.author || 'You',
      ruleCount: entry.ruleCount,
      rules: entry.rules,
      kind: entry.kind,
    });
  });
  items.sort(function(a, b) { return b.savedAt - a.savedAt; });
  return items;
}

function getSelectedHistoryItem() {
  const timeline = getHistoryTimeline();
  if (!timeline.length) return { item: null, index: -1, timeline: timeline };
  const key = state.ui.historySelectedId;
  if (key) {
    const idx = timeline.findIndex(function(item) { return item.key === key; });
    if (idx >= 0) return { item: timeline[idx], index: idx, timeline: timeline };
  }
  return { item: timeline[0], index: 0, timeline: timeline };
}

function loadWikiRevisionContent(revisionId) {
  if (!revisionId) return;
  if (state.wikiRevisionCache[revisionId]) return;
  sendToDevvit({ type: 'GET_WIKI_REVISION', revisionId: revisionId });
}

function handleDevvitMsg(msg) {
  if (msg.type === 'INIT') {
    rulesLoaded = true;
    state.saving = false;
    state.serverRules = clone(msg.rules || []);
    ensureRuleIds(state.serverRules);
    state.parserWarnings = Array.isArray(msg.warnings) ? msg.warnings : [];
    const draft = loadDraftFromStorage();
    if (draft && draft.dirty && Array.isArray(draft.rules) && draft.rules.length) {
      state.rules = draft.rules;
      ensureRuleIds(state.rules);
      state.selected = typeof draft.selected === 'number' ? draft.selected : 0;
      state.dirty = true;
      notify('success', 'Restored unsaved draft from this device (' + formatDraftTime(draft.savedAt) + ').');
    } else {
      state.rules = clone(state.serverRules);
      state.dirty = false;
      state.selected = state.rules.length ? 0 : -1;
      state.notification = null;
    }
    if (msg.subredditName) state.subredditName = msg.subredditName;
    state.currentUsername = msg.currentUsername || null;
    state.canSave = msg.canSave !== false;
    state.loading = false;
    if (!state.rules.length) {
      state.view = 'rules';
      state.selected = -1;
    }
    if (state.parserWarnings.length) {
      const warnText = state.parserWarnings.length === 1
        ? state.parserWarnings[0]
        : state.parserWarnings.length + ' sections in your wiki YAML were skipped. Check the wiki if rules are missing.';
      if (state.notification) {
        state.notification.text += ' ' + warnText;
      } else {
        notify('error', warnText);
      }
    }
    state.history = loadHistoryFromStorage();
    ensureHistoryBaseline();
    if (state.history.length && !state.ui.historySelectedId) {
      state.ui.historySelectedId = historyItemKey('local', state.history[0].id);
    }
    updateDirtyState();
    applySubredditUI();
    renderShell();
  }
  if (msg.type === 'SAVE_SUCCESS') {
    state.saving = false;
    state.dirty = false;
    clearDraft();
    state.serverRules = clone(state.rules);
    notify('success', 'Rules saved to r/' + state.subredditName.replace(/^r\//i, '') + '/wiki/config/automoderator.');
    const entry = pushHistoryEntry({
      kind: 'deploy',
      title: 'Updated AutoModerator config',
      detail: state.rules.length + ' rule' + (state.rules.length === 1 ? '' : 's') + ' saved to config/automoderator',
      rules: state.rules,
      author: msg.savedBy || state.currentUsername || 'You',
    });
    if (entry) state.ui.historySelectedId = historyItemKey('local', entry.id);
    updateDirtyState();
    renderShell();
  }
  if (msg.type === 'SAVE_WIKI_ERROR') {
    state.saving = false;
    notify('error', msg.message || 'Could not save to the subreddit wiki.');
    updateDirtyState();
    renderShell();
  }
  if (msg.type === 'WIKI_REVISIONS') {
    state.wikiRevisions = Array.isArray(msg.revisions) ? msg.revisions : [];
    if (msg.error) {
      notify('error', 'Could not load Reddit wiki revisions: ' + msg.error);
    }
    const timeline = getHistoryTimeline();
    if (timeline.length && !state.ui.historySelectedId) {
      state.ui.historySelectedId = timeline[0].key;
    }
    if (state.view === 'history' && timeline.length) {
      const selected = getSelectedHistoryItem();
      if (selected.item && selected.item.source === 'reddit') {
        loadWikiRevisionContent(selected.item.id);
      }
    }
    renderShell();
  }
  if (msg.type === 'WIKI_REVISION') {
    const revisionId = msg.revisionId;
    if (revisionId) {
      const rules = clone(msg.rules || []);
      ensureRuleIds(rules);
      state.wikiRevisionCache[revisionId] = {
        rules: rules,
        warnings: Array.isArray(msg.warnings) ? msg.warnings : [],
      };
      if (state.view === 'history') renderShell();
    }
  }
  if (msg.type === 'REVERT_SUCCESS') {
    state.rules = clone(msg.rules || []);
    ensureRuleIds(state.rules);
    state.serverRules = clone(state.rules);
    state.selected = state.rules.length ? 0 : -1;
    state.dirty = false;
    state.saving = false;
    clearDraft();
    notify('success', 'Wiki reverted on Reddit. Loaded the restored config/automoderator.');
    requestWikiRevisions();
    renderShell();
  }
  if (msg.type === 'ERROR') {
    state.loading = false;
    state.saving = false;
    notify('error', msg.message || 'An error occurred.', { retryAction: 'retryLoad' });
    updateDirtyState();
    renderShell();
  }
}

window.handleDevvitMsg = handleDevvitMsg;

function selectBuilderRule(index) {
  const next = Number(index);
  if (Number.isNaN(next) || next < 0 || next >= state.rules.length) return;
  if (next === state.selected && state.view === 'builder') return;
  state.selected = next;
  if (state.view === 'builder') {
    renderShell();
    return;
  }
  setView('builder');
}

function setView(view) {
  if (view === state.view) return;
  if (!confirmUnsavedLeave()) return;
  if (view === 'simulator' && state.selected >= 0 && state.rules[state.selected]) {
    const rule = state.rules[state.selected];
    if (!state.sim.body && getArr(rule, 'body (includes)').length) {
      state.sim.body = getArr(rule, 'body (includes)')[0];
    }
  }
  state.view = view;
  if (view === 'builder' && state.rules.length && (state.selected < 0 || !state.rules[state.selected])) {
    state.selected = 0;
  }
  if (view === 'history') requestWikiRevisions();
  renderShell();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('cg-theme', state.theme);
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  localStorage.setItem('ams-sidebar-collapsed', String(state.sidebarCollapsed));
  applySidebarState();
}

function createBlankRule() {
  const rule = createSafeDefaultRule();
  const dupIndex = findDuplicateRuleIndex(rule, -1);
  state.rules.push(rule);
  state.selected = state.rules.length - 1;
  state.view = 'builder';
  if (dupIndex >= 0) {
    state.notification = {
      type: 'error',
      text: 'This looks like a duplicate of "' + getRuleName(state.rules[dupIndex]) + '". Rename it or add conditions so you can tell them apart.',
    };
  } else {
    state.notification = {
      type: 'success',
      text: 'Safe starter rule created: filter + mod review. Add at least one match condition before deploying.',
    };
  }
  markDirty();
  renderShell();
}

function createSafeDefaultRule() {
  return {
    _id: generateRuleId(),
    action: 'filter',
    action_reason: nextRuleName(),
    report_reason: 'Held for moderator review',
    moderators_exempt: true,
  };
}

function useTemplate(id) {
  const template = templates.find(function(item) { return item.id === id; });
  if (!template) return;
  const rule = clone(template.rule);
  rule._id = generateRuleId();
  state.rules.push(rule);
  state.selected = state.rules.length - 1;
  state.view = 'builder';
  notify('success', 'Template “' + template.name + '” added. Review conditions, then Save rule to update your wiki.');
  markDirty();
  renderShell();
}

function deployRules() {
  if (!state.dirty || state.saving) return;
  if (!state.canSave) {
    notify('error', 'You must be signed in as a moderator to save to the subreddit wiki.');
    renderShell();
    return;
  }
  const blockers = validateRulesForDeploy(state.rules);
  if (blockers.length) {
    notify('error', blockers[0]);
    renderShell();
    return;
  }
  const sub = formatSubredditLabel(state.subredditName);
  const n = state.rules.length;
  const ok = window.confirm(
    'Save to ' + sub + ' wiki?\n\n' +
    'This replaces the entire config/automoderator page with ' + n + ' rule' + (n === 1 ? '' : 's') + ' from this editor. ' +
    'Rules that exist on Reddit but are not loaded here will be removed.'
  );
  if (!ok) return;
  const payload = state.rules.map(function(rule) {
    const copy = clone(rule);
    delete copy._id;
    return copy;
  });
  state.saving = true;
  notify('success', 'Saving to Reddit…');
  updateDirtyState();
  renderShell();
  sendToDevvit({ type: 'SAVE', rules: payload });
}

function saveDraftOnly() {
  persistDraft();
  state.notification = { type: 'success', text: 'Draft saved on this device. You can close and return later before deploying.' };
  renderShell();
}

function markDirty() {
  state.dirty = true;
  updateDirtyState();
  clearTimeout(persistDraftTimer);
  persistDraftTimer = setTimeout(persistDraft, 400);
  scheduleBuilderChromeUpdate();
}

function persistDraft() {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      rules: state.rules,
      selected: state.selected,
      view: state.view,
      dirty: true,
      savedAt: Date.now(),
    }));
  } catch (_) { /* storage full or private mode */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (_) { /* ignore */ }
}

function loadHistoryFromStorage() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function(entry) {
      return entry && entry.id && Array.isArray(entry.rules);
    });
  } catch (_) {
    return [];
  }
}

function saveHistoryToStorage() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history.slice(0, HISTORY_MAX_ENTRIES)));
  } catch (_) { /* ignore */ }
}

function generateHistoryId() {
  return 'hist_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function pushHistoryEntry(meta) {
  const rules = clone(meta.rules || []);
  ensureRuleIds(rules);
  const entry = {
    id: generateHistoryId(),
    savedAt: Date.now(),
    kind: meta.kind || 'deploy',
    title: meta.title || 'Config update',
    detail: meta.detail || '',
    ruleCount: rules.length,
    rules: rules,
    author: meta.author || 'You',
  };
  state.history.unshift(entry);
  if (state.history.length > HISTORY_MAX_ENTRIES) {
    state.history.length = HISTORY_MAX_ENTRIES;
  }
  saveHistoryToStorage();
  return entry;
}

function ensureHistoryBaseline() {
  if (state.history.length) return;
  if (!state.serverRules.length) return;
  pushHistoryEntry({
    kind: 'baseline',
    title: 'Loaded from Reddit',
    detail: 'Snapshot of config/automoderator when opened in AutoMod Studio',
    rules: state.serverRules,
  });
}


function formatHistoryTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatHistoryRelative(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' min ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' hr ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  return formatHistoryTime(ts);
}

function diffRulesSnapshot(beforeRules, afterRules) {
  const before = beforeRules || [];
  const after = afterRules || [];
  const changes = [];
  const usedBefore = new Set();

  after.forEach(function(rule) {
    const sig = ruleSignature(rule);
    const exact = before.findIndex(function(r, i) {
      return !usedBefore.has(i) && ruleSignature(r) === sig;
    });
    if (exact >= 0) {
      usedBefore.add(exact);
      return;
    }
    const byName = before.findIndex(function(r, i) {
      return !usedBefore.has(i) && getRuleName(r) === getRuleName(rule);
    });
    if (byName >= 0) {
      usedBefore.add(byName);
      changes.push({
        type: 'mod',
        label: 'MOD',
        name: getRuleName(rule),
        detail: summarizeRule(rule),
      });
      return;
    }
    changes.push({
      type: 'add',
      label: 'ADD',
      name: getRuleName(rule),
      detail: summarizeRule(rule),
    });
  });

  before.forEach(function(rule, i) {
    if (usedBefore.has(i)) return;
    changes.push({
      type: 'rem',
      label: 'REM',
      name: getRuleName(rule),
      detail: summarizeRule(rule),
    });
  });

  return changes;
}

function getHistoryDiffForItem(item, timeline, index) {
  if (!item || !item.rules) return null;
  const prev = timeline[index + 1];
  const beforeRules = prev && prev.rules
    ? prev.rules
    : (index === timeline.length - 1 ? [] : state.serverRules);
  return diffRulesSnapshot(beforeRules, item.rules);
}

function rulesSnapshotToYaml(rules) {
  return (rules || []).map(function(rule) {
    return toYaml(rule);
  }).join('\n\n---\n\n');
}

function restoreHistoryVersion() {
  const selected = getSelectedHistoryItem();
  const item = selected.item;
  if (!item) return;
  if (!item.rules) {
    notify('error', 'Revision content is still loading. Select it again in a moment.');
    renderShell();
    return;
  }
  const count = item.rules.length;
  const ok = window.confirm(
    'Restore “' + item.title + '” (' + count + ' rule' + (count === 1 ? '' : 's') + ') to the editor?\n\n' +
    'Your current draft will be replaced. Nothing is sent to Reddit until you Save rule.'
  );
  if (!ok) return;
  state.rules = clone(item.rules);
  ensureRuleIds(state.rules);
  state.selected = state.rules.length ? 0 : -1;
  state.dirty = true;
  markDirty();
  notify('success', 'Restored version from ' + formatHistoryTime(item.savedAt) + '. Review and Save rule to update Reddit.');
  state.view = 'builder';
  renderShell();
}

function revertWikiRevision() {
  const selected = getSelectedHistoryItem();
  const item = selected.item;
  if (!item || item.source !== 'reddit') return;
  const ok = window.confirm(
    'Revert config/automoderator on Reddit to this wiki revision?\n\n' +
    'This updates the live wiki immediately (not just your local editor).'
  );
  if (!ok) return;
  state.saving = true;
  notify('success', 'Reverting wiki on Reddit…');
  renderShell();
  sendToDevvit({ type: 'REVERT_WIKI', revisionId: item.id });
}

function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function formatDraftTime(ts) {
  if (!ts) return 'recently';
  return new Date(ts).toLocaleString();
}

function generateRuleId() {
  return 'rule_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function ensureRuleIds(rules) {
  rules.forEach(function(rule) {
    if (!rule._id) rule._id = generateRuleId();
  });
}

function nextRuleName() {
  let n = 1;
  while (state.rules.some(function(r) { return r.action_reason === 'New rule ' + n; })) n += 1;
  return 'New rule ' + n;
}

function hasMatchConditions(rule) {
  if (getArr(rule, 'body (includes)').length) return true;
  if (getArr(rule, 'body (excludes)').length) return true;
  if (getArr(rule, 'title (includes)').length) return true;
  if (getArr(rule, 'url (includes)').length) return true;
  if (getArr(rule, 'body (regex)').length) return true;
  if (getArr(rule, 'link_flair_text (includes)').length) return true;
  if (rule.author && typeof rule.author === 'object' && Object.keys(rule.author).length) return true;
  return false;
}

function isRuleTooBroad(rule) {
  return !hasMatchConditions(rule);
}

function validateRulesForDeploy(rules) {
  const blockers = [];
  rules.forEach(function(rule, index) {
    const name = getRuleName(rule);
    if (isRuleTooBroad(rule)) {
      blockers.push('Rule "' + name + '" has no match conditions and could affect all ' + (rule.type ? rule.type + 's' : 'content') + '. Add phrases, regex, or author limits first.');
    }
    const dup = findDuplicateRuleIndex(rule, index);
    if (dup >= 0) {
      blockers.push('Rules "' + name + '" and "' + getRuleName(rules[dup]) + '" are identical. Change or delete one before deploying.');
    }
  });
  return blockers;
}

function ruleSignature(rule) {
  const copy = clone(rule);
  delete copy._id;
  delete copy.action_reason;
  return JSON.stringify(copy);
}

function findDuplicateRuleIndex(rule, skipIndex) {
  const sig = ruleSignature(rule);
  for (let i = 0; i < state.rules.length; i += 1) {
    if (i === skipIndex) continue;
    if (ruleSignature(state.rules[i]) === sig) return i;
  }
  return -1;
}

function ruleMetaLine(rule) {
  const type = rule.type ? capitalize(rule.type) : 'Any';
  const action = capitalize(rule.action || 'filter');
  return type + ' → ' + action;
}

function updateDirtyState() {
  const saveBar = document.getElementById('saveBar');
  const deployBtn = document.getElementById('deployBtn');
  const topSaveActions = document.getElementById('topSaveActions');
  const topDeployBtn = document.getElementById('topDeployBtn');
  const topResetBtn = document.getElementById('topResetBtn');
  const topSaveDraftBtn = document.getElementById('topSaveDraftBtn');
  const canSave = state.dirty && !state.saving && state.canSave !== false;
  if (saveBar) saveBar.classList.toggle('visible', canSave && state.view !== 'builder');
  if (topSaveActions) topSaveActions.classList.toggle('visible', false);
  if (topDeployBtn) topDeployBtn.disabled = !canSave;
  if (topResetBtn) topResetBtn.disabled = !state.dirty || state.saving;
  if (topSaveDraftBtn) topSaveDraftBtn.disabled = !state.dirty || state.saving;
  if (deployBtn) deployBtn.disabled = !canSave;
  const shell = document.getElementById('appShell');
  if (shell) shell.classList.toggle('is-saving', state.saving);
}

function renderShell() {
  captureUiState();
  const titles = {
    templates: ['Build / Templates', 'Templates'],
    rules: ['Build / My rules', 'My rules'],
    builder: ['Build / Builder', state.selected >= 0 ? getRuleName(state.rules[state.selected]) : 'Builder'],
    simulator: ['Build / Simulator', 'Simulator'],
    history: ['Monitor / Version history', 'Version history'],
    settings: ['Monitor / Settings', 'Settings'],
  };
  const current = titles[state.view] || titles.templates;
  const topbar = document.querySelector('.topbar');
  const pageTitle = document.getElementById('pageTitle');
  const topActions = document.querySelector('.top-actions');
  applySidebarState();
  applySubredditUI();
  const breadcrumbEl = document.getElementById('breadcrumb');
  if (topbar) {
    topbar.classList.toggle('simulator-mode', state.view === 'simulator');
    topbar.classList.toggle('builder-mode', state.view === 'builder' && state.selected >= 0);
  }
  if (state.view === 'builder' && state.selected >= 0 && state.rules[state.selected]) {
    if (breadcrumbEl) breadcrumbEl.textContent = '';
    pageTitle.innerHTML = renderBuilderBreadcrumbs();
    if (topActions) topActions.innerHTML = renderBuilderTopActions();
  } else if (state.view === 'simulator') {
    if (breadcrumbEl) breadcrumbEl.textContent = current[0];
    const ruleName = state.selected >= 0 && state.rules[state.selected]
      ? getRuleName(state.rules[state.selected])
      : null;
    pageTitle.innerHTML = ruleName
      ? '<span class="top-crumb">My rules</span><span class="top-chevron">' + icon('chevron-right') + '</span><span class="top-crumb">' + h(ruleName) + '</span><span class="top-chevron">' + icon('chevron-right') + '</span><span>Simulator</span>'
      : '<span>Simulator</span>';
    if (topActions) topActions.innerHTML = renderTopActions(state.view);
  } else {
    if (breadcrumbEl) breadcrumbEl.textContent = current[0];
    pageTitle.textContent = current[1];
    if (topActions) topActions.innerHTML = renderTopActions(state.view);
  }
  document.getElementById('rulesNavCount').textContent = String(state.rules.length);
  const historyNavCount = document.getElementById('historyNavCount');
  if (historyNavCount) historyNavCount.textContent = String(state.history.length);
  document.querySelectorAll('.nav-item[data-view]').forEach(function(btn) {
    let activeView = state.view;
    if (shouldShowNewUserEmptyState()) activeView = 'rules';
    else if (state.view === 'builder') activeView = 'rules';
    btn.classList.toggle('active', btn.dataset.view === activeView);
  });
  renderBanner();
  renderView();
  bindHelpTips();
  updateDirtyState();
  restoreUiState();
  if (state.view === 'builder') bindBuilderTabKeys();
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.help-tip-wrap')) {
    document.querySelectorAll('.help-tip-wrap.is-open').forEach(function(w) {
      w.classList.remove('is-open');
      const b = w.querySelector('.help-tip');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
});

function formatSubredditLabel(name) {
  const bare = String(name || '').replace(/^r\//i, '').trim();
  return bare ? 'r/' + bare : 'r/subreddit';
}

function subredditInitials(name) {
  const bare = String(name || '').replace(/^r\//i, '').trim();
  if (bare.length >= 2) return bare.slice(0, 2).toUpperCase();
  return bare.slice(0, 1).toUpperCase() || '?';
}

function applySubredditUI() {
  const label = formatSubredditLabel(state.subredditName);
  const railLabel = document.getElementById('sidebarSubredditLabel');
  const topCommunityName = document.getElementById('topbarCommunityName');
  const topCommunityAvatar = document.querySelector('.community-pill-avatar');
  if (railLabel) {
    railLabel.textContent = label;
    railLabel.title = label;
  }
  if (topCommunityName) {
    topCommunityName.textContent = label;
    topCommunityName.title = label;
  }
  if (topCommunityAvatar) topCommunityAvatar.textContent = subredditInitials(state.subredditName);
}

function renderBuilderBreadcrumbs() {
  const ruleName = state.selected >= 0 && state.rules[state.selected]
    ? getRuleName(state.rules[state.selected])
    : 'Rule';
  return `
    <nav class="builder-crumbs" aria-label="Breadcrumb">
      <button type="button" class="top-crumb-link" data-action="goTemplates">Templates</button>
      <span class="top-chevron" aria-hidden="true">${icon('chevron-right')}</span>
      <span class="top-crumb-current">${h(ruleName)}</span>
    </nav>
  `;
}

function renderBuilderTopActions() {
  const label = formatSubredditLabel(state.subredditName);
  return `
    <div class="topbar-builder-actions">
      ${renderLegalLinks()}
      ${state.dirty ? '<span class="topbar-dirty"><span class="save-dot"></span>Unsaved</span>' : ''}
      <button type="button" class="community-pill" title="${h(label)}">
        <span class="community-pill-avatar">${h(subredditInitials(state.subredditName))}</span>
        <span class="community-pill-name" id="topbarCommunityName">${h(label)}</span>
        <span class="community-pill-chev" aria-hidden="true">${icon('chevron-down')}</span>
      </button>
      <button type="button" class="btn btn-secondary btn-toolbar" data-action="testRule" ${state.saving ? 'disabled' : ''}>${icon('play')}Test rule</button>
      <button type="button" class="btn btn-primary btn-toolbar" id="topDeployBtn" data-action="deployRules" ${state.dirty && !state.saving ? '' : 'disabled'}>${icon('save')}${state.saving ? 'Saving…' : 'Save rule'}</button>
    </div>
    <div class="top-separator" aria-hidden="true"></div>
    <button class="btn btn-ghost icon-btn" title="Notifications">${icon('bell')}</button>
    <button class="btn btn-ghost icon-btn" data-action="toggleTheme" title="Toggle theme">${icon('sun')}</button>
    <div class="avatar">8M</div>
    <button class="btn btn-primary" id="deployBtn" disabled style="display:none">Deploy</button>
  `;
}

function scrollToBuilderPanel(selector) {
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applySidebarState() {
  const shell = document.getElementById('appShell');
  const toggle = document.getElementById('sideNavToggle');
  if (!shell || !toggle) return;
  shell.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  toggle.setAttribute('aria-expanded', String(!state.sidebarCollapsed));
  toggle.setAttribute('aria-label', state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
  toggle.setAttribute('title', state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
}

function renderTopActions(view) {
  if (view === 'simulator') {
    return `
      ${renderLegalLinks()}
      <button class="btn btn-ghost" data-action="goRules">${icon('chevron-left')}Back to editor</button>
      <button class="btn btn-primary btn-new" data-action="goRules">${icon('check')}Done</button>
      <div class="top-separator"></div>
      <button class="btn btn-ghost icon-btn" title="Notifications">${icon('bell')}</button>
      <button class="btn btn-ghost icon-btn" data-action="toggleTheme" title="Toggle theme">${icon('sun')}</button>
      <div class="avatar">8M</div>
      <button class="btn btn-primary" id="deployBtn" disabled style="display:none">Deploy</button>
    `;
  }
  if (view === 'builder') {
    return renderBuilderTopActions();
  }
  return `
    ${renderLegalLinks()}
    <button class="btn btn-primary btn-new" data-action="blank">${icon('plus')}New rule</button>
    <div class="top-separator"></div>
    <button class="btn btn-ghost icon-btn" title="Notifications">${icon('bell')}</button>
    <button class="btn btn-ghost icon-btn" data-action="toggleTheme" title="Toggle theme">${icon('sun')}</button>
    <div class="avatar">8M</div>
    <button class="btn btn-primary" id="deployBtn" disabled style="display:none">Deploy</button>
  `;
}

function renderLegalLinks() {
  return `
    <nav class="legal-links" aria-label="Legal and support links">
      <a href="https://github.com/Bop95/automod-studio/blob/main/TERMS.md" target="_blank" rel="noopener noreferrer">Terms</a>
      <span aria-hidden="true">|</span>
      <a href="https://github.com/Bop95/automod-studio/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">Privacy</a>
      <span aria-hidden="true">|</span>
      <a href="https://developers.reddit.com/docs/" target="_blank" rel="noopener noreferrer">Docs</a>
      <span aria-hidden="true">|</span>
      <a href="https://www.reddit.com/r/Devvit/" target="_blank" rel="noopener noreferrer">r/Devvit</a>
    </nav>
  `;
}

function renderBanner() {
  const banner = document.getElementById('banner');
  if (!state.notification) {
    banner.className = 'banner';
    banner.textContent = '';
    banner.innerHTML = '';
    return;
  }
  banner.className = 'banner visible ' + state.notification.type;
  let html = h(state.notification.text);
  if (state.notification.retryAction === 'retryLoad') {
    html += ' <button type="button" class="banner-action" data-action="retryLoad">Try again</button>';
  }
  banner.innerHTML = html;
}

function shouldShowNewUserEmptyState() {
  return !state.loading && !state.rules.length && state.view === 'builder';
}

function renderRulesLoadingState() {
  return `
    <div class="empty empty-state-center" role="status" aria-busy="true">
      <div class="empty-state-inner">
        <div class="empty-state-icon">${icon('shield')}</div>
        <h2>Loading rules…</h2>
        <p>Reading config/automoderator from ${h(formatSubredditLabel(state.subredditName))}.</p>
      </div>
    </div>
  `;
}

function renderView() {
  const root = document.getElementById('viewRoot');
  const main = document.querySelector('.main');
  if (state.loading && state.view === 'builder') {
    if (main) main.classList.remove('is-empty-state');
    root.innerHTML = `<div class="panel empty"><div><h2>Loading rules...</h2><p>Reading r/subreddit/wiki/config/automoderator.</p></div></div>`;
    return;
  }
  if (state.view === 'rules' && !state.rules.length) {
    if (main) main.classList.add('is-empty-state');
    root.innerHTML = state.loading ? renderRulesLoadingState() : renderNewUserEmptyState();
    return;
  }
  if (shouldShowNewUserEmptyState()) {
    if (main) main.classList.add('is-empty-state');
    root.innerHTML = renderNewUserEmptyState();
    return;
  }
  if (main) main.classList.remove('is-empty-state');
  if (state.view === 'templates') root.innerHTML = renderTemplates();
  if (state.view === 'rules') root.innerHTML = renderRules();
  if (state.view === 'builder') root.innerHTML = renderBuilder();
  if (state.view === 'simulator') root.innerHTML = renderSimulator();
  if (state.view === 'history') root.innerHTML = renderHistory();
  if (state.view === 'settings') root.innerHTML = renderSettings();
}

function templateCategoryCounts() {
  const counts = { all: templates.length };
  templates.forEach(function(t) {
    counts[t.category] = (counts[t.category] || 0) + 1;
  });
  return counts;
}

function renderTemplates() {
  const filtered = getFilteredTemplates();
  const counts = templateCategoryCounts();
  const categories = ['all', 'Anti-spam', 'New users', 'Content quality', 'Civility', 'Format checks'];
  return `
    <div class="templates-page">
      <div class="templates-heading">
        <h1>Templates</h1>
        <p>Start from a tested rule. You can customize everything before saving.</p>
      </div>
      <div class="template-tools">
        <label class="search-box">${icon('search')}<input type="search" id="templateSearchInput" value="${h(state.ui.templateSearch)}" placeholder="Search templates..." aria-label="Search templates" data-action="templateSearch"></label>
      </div>
      <div class="category-tabs" aria-label="Template categories">
        ${categories.map(function(cat) {
          const label = cat === 'all' ? 'All' : cat;
          const active = state.ui.templateCategory === cat;
          const n = counts[cat] || 0;
          return `<button type="button" class="category-pill ${active ? 'active' : ''}" data-action="templateCategory" data-category="${h(cat)}">${h(label)} <span>${n}</span></button>`;
        }).join('')}
      </div>
      <div class="template-grid">
        ${filtered.length ? filtered.map(function(template) {
          return `
            <article class="panel template-card">
              <div class="template-top">
                <div class="template-icon">${icon(template.icon)}</div>
              </div>
              <h3>${h(template.name)}</h3>
              <div class="template-meta">${h(template.category)} · ${template.conditions} condition${template.conditions === 1 ? '' : 's'}</div>
              <p>${h(template.description)}</p>
              <button class="btn btn-secondary" data-action="useTemplate" data-template="${h(template.id)}">Use template</button>
            </article>
          `;
        }).join('') : '<div class="panel panel-pad empty-filter">No templates match your search. Try another category or clear the search box.</div>'}
      </div>
    </div>
  `;
}

function renderRules() {
  const rows = state.rules.map(function(rule, index) {
    const broad = isRuleTooBroad(rule);
    return {
      name: getRuleName(rule),
      conditions: countRuleConditions(rule),
      status: broad ? 'Needs conditions' : 'Ready',
      action: rule.action === 'remove' ? 'Remove' : capitalize(rule.action || 'filter'),
      broad: broad,
      dup: findDuplicateRuleIndex(rule, index) >= 0,
    };
  });
  return `
    <div class="page-shell rules-page">
      <div class="page-heading">
        <h1>My rules</h1>
        <p>Click a row to edit. Save rule only when each rule has match conditions configured.</p>
      </div>
      <div class="panel table-scroll rules-card">
        <table class="rules-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Status</th>
              <th>Action</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(function(row, index) {
              const needsWork = row.broad || row.dup;
              return `
                <tr data-action="editRule" data-index="${index}">
                  <td>
                    <div class="rule-name">${h(row.name)}${row.dup ? ' <span class="dup-tag">duplicate</span>' : ''}</div>
                    <div class="rule-desc">${row.conditions} condition${row.conditions === 1 ? '' : 's'}${row.broad ? ' · add match phrases' : ''}</div>
                  </td>
                  <td><span class="status-pill ${needsWork ? 'paused' : ''}"><span class="status-dot"></span>${h(row.status)}</span></td>
                  <td>${h(row.action)}</td>
                  <td class="chevron-cell">${icon('chevron-right')}</td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="4" class="muted-cell" style="padding:24px;text-align:center">No rules loaded.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="rules-actions">
        <button class="btn btn-primary btn-new" data-action="blank">${icon('plus')}New rule</button>
      </div>
    </div>
  `;
}

function renderNewUserEmptyState() {
  return renderEmptyState(
    'No rules yet',
    'Create your first AutoModerator rule, or start from a template. Nothing is sent to Reddit until you deploy.',
    'Create new rule',
    'blank',
    { secondaryLabel: 'Browse templates', secondaryAction: 'goTemplates' }
  );
}

function renderEmptyState(title, desc, ctaLabel, ctaAction, options) {
  options = options || {};
  const secondary = options.secondaryLabel && options.secondaryAction
    ? `<button class="btn btn-secondary" type="button" data-action="${h(options.secondaryAction)}">${h(options.secondaryLabel)}</button>`
    : '';
  return `
    <div class="empty empty-state-center" role="status">
      <div class="empty-state-inner">
        <div class="empty-state-icon">${icon('shield')}</div>
        <h2>${h(title)}</h2>
        <p>${h(desc)}</p>
        <div class="empty-state-actions">
          <button class="btn btn-primary btn-new" type="button" data-action="${h(ctaAction)}">${icon('plus')}${h(ctaLabel)}</button>
          ${secondary}
        </div>
      </div>
    </div>
  `;
}

function getFieldTip(tipKey) {
  const raw = FIELD_TIPS[tipKey];
  if (!raw) return null;
  if (typeof raw === 'string') return { text: raw, example: '', learnMore: AUTOMOD_WIKI_HELP };
  return raw;
}

function tipPlaceholder(tipKey, fallback) {
  const tip = getFieldTip(tipKey);
  if (tip && tip.example) return tip.example;
  return fallback || '';
}

function fieldHint(tipKey) {
  const tip = getFieldTip(tipKey);
  if (!tip) return '';
  let html = `<p class="field-hint">${h(tip.text)}</p>`;
  if (tip.example) {
    html += `<p class="field-example">Example: <code>${h(tip.example)}</code></p>`;
  }
  if (tip.learnMore) {
    html += `<p class="field-learn"><a class="learn-more" href="${h(tip.learnMore)}" target="_blank" rel="noopener noreferrer">Learn more</a></p>`;
  }
  return html;
}

function helpTooltipMarkup(tip, labelForAria) {
  return `
    <span class="help-tip-wrap">
      <button type="button" class="help-tip" aria-label="Help: ${h(labelForAria)}" aria-expanded="false">?</button>
      <span class="help-tooltip" role="tooltip">
        <span class="help-tooltip-text">${h(tip.text)}</span>
        ${tip.example ? `<span class="help-tooltip-example">e.g. <code>${h(tip.example)}</code></span>` : ''}
        ${tip.learnMore ? `<a class="help-tooltip-link" href="${h(tip.learnMore)}" target="_blank" rel="noopener noreferrer">Learn more</a>` : ''}
      </span>
    </span>
  `;
}

function fieldLabel(text, tipKey) {
  const tip = getFieldTip(tipKey);
  if (!tip) {
    return `<span class="label-row"><span class="label">${h(text)}</span></span>`;
  }
  return `
    <span class="label-row">
      <span class="label">${h(text)}</span>
      ${helpTooltipMarkup(tip, text)}
    </span>
  `;
}

function fieldHelpOnly(tipKey, labelForAria) {
  const tip = getFieldTip(tipKey);
  if (!tip) return '';
  return helpTooltipMarkup(tip, labelForAria || tipKey);
}

function learnMoreLink() {
  return `<a class="learn-more" href="${AUTOMOD_WIKI_HELP}" target="_blank" rel="noopener noreferrer">Learn more on AutoModerator wiki</a>`;
}

function bindHelpTips() {
  document.querySelectorAll('.help-tip').forEach(function(btn) {
    if (btn.dataset.boundHelp) return;
    btn.dataset.boundHelp = '1';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const wrap = btn.closest('.help-tip-wrap');
      if (!wrap) return;
      const open = wrap.classList.contains('is-open');
      document.querySelectorAll('.help-tip-wrap.is-open').forEach(function(w) {
        w.classList.remove('is-open');
        const b = w.querySelector('.help-tip');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

function builderPanel(title, subtitle, open, bodyHtml, stepNum) {
  return `
    <details class="builder-panel section" ${open ? 'open' : ''}>
      <summary class="section-head builder-panel-summary">
        ${stepNum ? `<span class="section-step" aria-hidden="true">${stepNum}</span>` : ''}
        <div class="section-head-text">
          <div class="section-head-title">${h(title)}</div>
          ${subtitle ? `<div class="section-head-desc">${h(subtitle)}</div>` : ''}
        </div>
        <span class="panel-chevron">${icon('chevron-down')}</span>
      </summary>
      <div class="section-body">${bodyHtml}</div>
    </details>
  `;
}

function renderBuilderRuleList() {
  return `
    <div class="builder-rule-tabs">
      <div class="builder-rule-tabs-list" role="tablist" aria-label="Rules in this draft">
        ${renderBuilderTabsInnerHtml()}
      </div>
      <button type="button" class="builder-rule-tab builder-rule-tab-add" data-action="blank" aria-label="Create new rule" title="Create new rule">
        ${icon('plus')}
      </button>
    </div>
  `;
}

function renderBuilder() {
  if (!state.rules.length) {
    return renderNewUserEmptyState();
  }
  if (state.selected < 0 || !state.rules[state.selected]) {
    return `
      <div class="empty empty-state-center" role="status">
        <div class="empty-state-inner">
          <div class="empty-state-icon">${icon('shield')}</div>
          <h2>Select a rule to edit</h2>
          <p>Choose a rule below or create a new one.</p>
          <div class="empty-state-actions">
            <button class="btn btn-primary btn-new" type="button" data-action="blank">${icon('plus')}Create new rule</button>
          </div>
        </div>
      </div>
    `;
  }
  const rule = state.rules[state.selected];
  const condCount = countRuleConditions(rule);
  const broad = isRuleTooBroad(rule);
  const dup = findDuplicateRuleIndex(rule, state.selected) >= 0;
  return `
    <div class="builder-grid">
      <div class="builder-stack" id="builder-rule-panel" role="tabpanel" aria-labelledby="builder-rule-tab-${state.selected}">
        ${renderBuilderRuleList()}
        <header class="builder-hero">
          <div class="builder-hero-main">
            <div class="page-kicker">Rule builder</div>
            <div class="builder-hero-row">
              <h1 class="builder-title">${h(getRuleName(rule))}</h1>
              <button class="btn btn-secondary builder-delete" type="button" data-action="deleteRule" data-index="${state.selected}">${icon('trash')} Delete</button>
            </div>
            <p class="builder-lead">Configure required actions first, then expand optional match conditions. ${learnMoreLink()}</p>
            <div class="builder-meta">${renderBuilderMetaHtml(rule)}</div>
          </div>
        </header>
        <div id="builderSafetyCallouts">${renderBuilderSafetyHtml(rule, state.selected)}</div>
        <div class="builder-category">
          <h3 class="builder-category-label">What <span class="cat-tag required">required</span></h3>
          ${renderEnforcementSection(rule)}
          ${renderMetadataSection(rule)}
        </div>
        <div class="builder-category">
          <h3 class="builder-category-label">When <span class="cat-tag optional">optional — expand to add</span></h3>
          ${renderAuthorPanel(rule)}
          ${renderBodyTitlePanel(rule)}
          ${renderUrlPanel(rule)}
          ${renderFlairPanel(rule)}
        </div>
        <div class="builder-category">
          <h3 class="builder-category-label">Extra</h3>
          ${renderSetFlairPanel(rule)}
        </div>
      </div>
      <aside class="side-panel">
        <div class="panel panel-pad logic-card" id="builderSummaryPanel">
          <div class="logic-title">Rule summary</div>
          <div class="logic-text" id="summaryText">${h(summarizeRule(rule))}</div>
        </div>
        <div class="panel panel-pad" id="builderTestPanel">
          <div class="logic-title">Test this rule</div>
          ${renderInlineTester()}
        </div>
        <div class="panel panel-pad" id="builderYamlPanel">
          <div class="logic-title">YAML preview</div>
          <pre class="yaml-block" id="yamlPreview">${h(toYaml(rule))}</pre>
        </div>
      </aside>
    </div>
  `;
}

function renderEnforcementSection(rule) {
  const actions = [
    { id: 'filter', label: 'Filter', desc: 'Hold for mod review (safest default)', icon: 'filter' },
    { id: 'report', label: 'Report', desc: 'Flag in mod queue', icon: 'bell' },
    { id: 'remove', label: 'Remove', desc: 'Delete immediately — requires conditions', icon: 'alert-triangle' },
    { id: 'approve', label: 'Approve', desc: 'Auto-approve matches', icon: 'check-circle' },
    { id: 'spam', label: 'Spam', desc: 'Train spam filter', icon: 'shield' },
  ];
  const body = `
    <div class="field">
      ${fieldLabel('Primary action', 'primaryAction')}
      <div class="action-cards" role="group" aria-label="Enforcement action">
        ${actions.map(function(item) {
          const active = rule.action === item.id;
          return `
            <button type="button" class="action-card ${active ? 'active' : ''}" data-action="setAction" data-value="${item.id}">
              <span class="action-card-icon">${icon(item.icon)}</span>
              <span class="action-card-label">${h(item.label)}</span>
              <span class="action-card-desc">${h(item.desc)}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
    ${fieldHint('primaryAction')}
    <label class="field">
      ${fieldLabel('Report reason', 'reportReason')}
      <input class="input" value="${h(rule.report_reason || '')}" data-action="setField" data-key="report_reason" placeholder="${h(tipPlaceholder('reportReason', 'Possible spam — needs review'))}">
      ${fieldHint('reportReason')}
    </label>
    <label class="field">
      ${fieldLabel('Auto-reply to author', 'autoReply')}
      <textarea class="textarea" data-action="setField" data-key="comment" placeholder="${h(tipPlaceholder('autoReply', 'Optional message when the rule fires'))}">${h(rule.comment || '')}</textarea>
      ${fieldHint('autoReply')}
    </label>
    <div class="grid-2">
      <label class="toggle-card">
        <input type="checkbox" ${rule.lock ? 'checked' : ''} data-action="setCheckbox" data-key="lock">
        <span><span class="toggle-title-row"><strong>Lock content</strong>${fieldHelpOnly('lockContent', 'Lock content')}</span><span>Prevent further replies.</span></span>
      </label>
      <label class="toggle-card">
        <input type="checkbox" ${rule.ban ? 'checked' : ''} data-action="setCheckbox" data-key="ban">
        <span><span class="toggle-title-row"><strong>Ban user</strong>${fieldHelpOnly('banUser', 'Ban user')}</span><span>Severe violations only.</span></span>
      </label>
    </div>
  `;
  return builderPanel('Enforcement actions', 'What happens when this rule matches', true, body, 1);
}

function renderMetadataSection(rule) {
  const types = [
    { value: '', label: 'Any' },
    { value: 'comment', label: 'Comment' },
    { value: 'submission', label: 'Post' },
    { value: 'link', label: 'Link' },
  ];
  const body = `
    <label class="field">
      ${fieldLabel('Rule name', 'ruleName')}
      <input class="input" value="${h(rule.action_reason || '')}" data-action="setField" data-key="action_reason" placeholder="${h(tipPlaceholder('ruleName', 'Anti-spam basics'))}">
      ${fieldHint('ruleName')}
    </label>
    <div class="field">
      ${fieldLabel('Applies to', 'contentType')}
      <div class="type-segmented" role="group" aria-label="Content type">
        ${types.map(function(t) {
          const active = String(rule.type || '') === t.value;
          return `<button type="button" class="type-segment ${active ? 'active' : ''}" data-action="setContentType" data-value="${h(t.value)}">${h(t.label)}</button>`;
        }).join('')}
      </div>
      ${fieldHint('contentType')}
    </div>
    <label class="field">
      ${fieldLabel('Priority', 'priority')}
      <input class="input mono" type="number" value="${h(rule.priority != null ? String(rule.priority) : '')}" data-action="setPriority" placeholder="${h(tipPlaceholder('priority', 'Leave empty for default'))}">
      ${fieldHint('priority')}
    </label>
    <label class="toggle-card">
      <input type="checkbox" ${rule.moderators_exempt === false ? '' : 'checked'} data-action="setModExempt">
      <span><span class="toggle-title-row"><strong>Moderators are exempt</strong>${fieldHelpOnly('modExempt', 'Moderators are exempt')}</span><span>Recommended: mods will not be actioned.</span></span>
    </label>
  `;
  return builderPanel('Metadata & type', 'Name, content type, and priority', true, body, 2);
}

function renderAuthorPanel(rule) {
  const author = rule.author && typeof rule.author === 'object' ? rule.author : {};
  const hasAuthor = Object.keys(author).length > 0;
  const body = `
    <div class="author-grid">
      ${nestedField('Combined karma', 'author', 'combined_karma', author.combined_karma || '', 'combinedKarma')}
      ${nestedField('Comment karma', 'author', 'comment_karma', author.comment_karma || '', 'commentKarma')}
      ${nestedField('Post karma', 'author', 'post_karma', author.post_karma || '', 'postKarma')}
      ${nestedField('Account age', 'author', 'account_age', author.account_age || '', 'accountAge')}
    </div>
  `;
  return builderPanel('Author conditions', 'Karma and account age limits', hasAuthor, body, 3);
}

function renderBodyTitlePanel(rule) {
  const regexVal = arr(rule, 'body (regex)');
  const hasBody = getArr(rule, 'body (includes)').length || getArr(rule, 'body (excludes)').length
    || getArr(rule, 'title (includes)').length || regexVal;
  const body = `
    <div class="condition-grid">
      ${textareaField('Body contains', 'body (includes)', arr(rule, 'body (includes)'), 'bodyIncludes')}
      ${textareaField('Body excludes', 'body (excludes)', arr(rule, 'body (excludes)'), 'bodyExcludes')}
      ${textareaField('Title contains', 'title (includes)', arr(rule, 'title (includes)'), 'titleIncludes')}
    </div>
    ${textareaField('Body regex', 'body (regex)', regexVal, 'bodyRegex')}
  `;
  return builderPanel('Body & title', 'Phrases or regex in post/comment text', hasBody, body, 4);
}

function renderUrlPanel(rule) {
  const hasUrl = getArr(rule, 'url (includes)').length > 0;
  const body = textareaField('URL / domain contains', 'url (includes)', arr(rule, 'url (includes)'), 'urlIncludes');
  return builderPanel('URL & domain', 'Match links and domains', hasUrl, body, 5);
}

function renderFlairPanel(rule) {
  const hasFlair = getArr(rule, 'link_flair_text (includes)').length > 0;
  const body = textareaField('Link flair contains', 'link_flair_text (includes)', arr(rule, 'link_flair_text (includes)'), 'linkFlair');
  return builderPanel('Flair conditions', 'Match posts with specific flair', hasFlair, body, 6);
}

function renderSetFlairPanel(rule) {
  const flair = rule.set_flair != null ? String(rule.set_flair) : '';
  const hasFlair = Boolean(flair.trim());
  const body = `
    <label class="field">
      ${fieldLabel('Set flair on match', 'setFlair')}
      <input class="input" value="${h(flair)}" data-action="setField" data-key="set_flair" placeholder="${h(tipPlaceholder('setFlair', 'Answered'))}">
      ${fieldHint('setFlair')}
    </label>
  `;
  return builderPanel('Set flair on match', 'Optional flair to assign', hasFlair, body, 7);
}

function renderInlineTester() {
  const result = state.sim.inlineResult;
  const ruleName = state.selected >= 0 && state.rules[state.selected]
    ? getRuleName(state.rules[state.selected])
    : 'this rule';
  return `
    <div class="field">
      ${fieldLabel('Sample body', 'bodyIncludes')}
      <textarea class="textarea" id="inlineTestBody" placeholder="${h(tipPlaceholder('bodyIncludes', 'Paste a comment or post body'))}">${h(state.sim.body)}</textarea>
      <p class="field-hint">Approximate check for <strong>${h(ruleName)}</strong> only — not identical to Reddit’s AutoMod engine.</p>
    </div>
    <div style="height:10px"></div>
    <button class="btn btn-secondary" data-action="runInlineTest" ${state.saving ? 'disabled' : ''}>Run test</button>
    ${result ? `<div class="test-result" style="margin-top:12px">${renderResult(result)}</div>` : ''}
  `;
}

function renderSimulator() {
  const sim = state.sim;
  const results = sim.results;
  const firing = results ? results.filter(function(r) { return r.fires; }) : [];
  const typeLabel = { comment: 'Comment', submission: 'Post', link: 'Link post' }[sim.contentType] || 'Comment';
  const resultBlock = !results
    ? '<p class="muted-cell sim-empty-result">Run a test to see which draft rules would match this sample. Author karma and account age are not simulated.</p>'
    : firing.length
      ? firing.map(function(r) { return renderResult(r); }).join('')
      : '<p class="muted-cell sim-empty-result">No rules in this draft would match the sample you entered.</p>';

  return `
    <div class="page-shell simulator-page">
      <div class="simulator-title-row">
        <div class="page-heading-stack">
          <div class="page-kicker">Testing</div>
          <h1 class="page-heading-title">Rule simulator</h1>
        </div>
        <div class="simulator-note">Approximate · tests all ${state.rules.length} draft rule${state.rules.length === 1 ? '' : 's'} · does not change ${h(formatSubredditLabel(state.subredditName))}</div>
      </div>
      <div class="sim-shell">
        <section class="sim-column">
          <div>
            <div class="page-kicker sim-section-kicker">Test input</div>
            <div class="segmented" role="tablist" aria-label="Content type">
              <button class="segment ${sim.contentType === 'comment' ? 'active' : ''}" type="button" data-action="setSimType" data-value="comment">Comment</button>
              <button class="segment ${sim.contentType === 'submission' ? 'active' : ''}" type="button" data-action="setSimType" data-value="submission">Post</button>
              <button class="segment ${sim.contentType === 'link' ? 'active' : ''}" type="button" data-action="setSimType" data-value="link">Link</button>
            </div>
          </div>
          <input type="hidden" id="simType" value="${h(sim.contentType)}">
          <div class="sim-form">
            <label class="sim-field">
              <span class="sim-label">Title</span>
              <input class="input" id="simTitle" value="${h(sim.title)}" placeholder="Post title (for submissions)">
            </label>
            <label class="sim-field">
              <span class="sim-label">Body</span>
              <textarea class="textarea comment-box-input" id="simBody" rows="6" placeholder="Paste comment or post body">${h(sim.body)}</textarea>
            </label>
            <label class="sim-field">
              <span class="sim-label">URL</span>
              <input class="input mono" id="simUrl" value="${h(sim.url)}" placeholder="https://example.com/...">
            </label>
          </div>
          <div class="sim-actions">
            <div class="sim-run-row">
              <button class="btn btn-primary" data-action="runSimulator" ${state.saving || !state.rules.length ? 'disabled' : ''}>${icon('play')}Run test</button>
              <button class="btn btn-secondary icon-btn" type="button" data-action="simReset" title="Clear results">${icon('refresh')}</button>
            </div>
            ${!state.rules.length ? '<p class="field-hint">Add at least one rule in the builder before running tests.</p>' : ''}
          </div>
          <div class="sim-section-footer">
            <div class="page-kicker sim-section-kicker">Quick examples</div>
            <div class="quick-pills">
              <button class="quick-pill" type="button" data-action="simExample" data-example="spam">Spam link comment</button>
              <button class="quick-pill" type="button" data-action="simExample" data-example="civil">Civil post</button>
              <button class="quick-pill" type="button" data-action="simExample" data-example="clean">Clean comment</button>
            </div>
          </div>
        </section>
        <section class="sim-column result">
          <div class="page-kicker sim-section-kicker">Result · ${h(typeLabel)}</div>
          <div class="sim-results">${resultBlock}</div>
        </section>
      </div>
    </div>
  `;
}

function renderResult(result) {
  return `
    <div class="panel panel-pad ${result.fires ? 'logic-card' : ''}" style="padding:12px">
      <div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px">
        <strong style="font-size:13px">${h(getRuleName(state.rules[result.index] || {}))}</strong>
        <span class="chip ${result.fires ? 'danger' : ''}">${result.fires ? 'Would fire' : 'No match'}</span>
      </div>
      ${result.reasons.map(function(reason) {
        const mark = reason.status === 'pass' ? '✓' : reason.status === 'fail' ? '×' : '–';
        return `<div class="result-line ${reason.status}"><span>${mark}</span><span>${h(reason.text)}</span></div>`;
      }).join('')}
    </div>
  `;
}

function renderHistoryVersionItem(item, index) {
  const selected = getSelectedHistoryItem();
  const isSelected = selected.item && selected.item.key === item.key;
  const isLatest = index === 0;
  const badges = [];
  if (isLatest) badges.push('<span class="version-chip brand">Latest</span>');
  if (item.source === 'reddit') badges.push('<span class="version-chip">Reddit</span>');
  else if (item.kind === 'baseline') badges.push('<span class="version-chip">Baseline</span>');
  else if (item.kind === 'deploy') badges.push('<span class="version-chip">Deploy</span>');

  const ruleCount = item.ruleCount != null
    ? item.ruleCount
    : (item.rules ? item.rules.length : null);
  const ruleLabel = ruleCount != null
    ? ruleCount + ' rule' + (ruleCount === 1 ? '' : 's')
    : 'Loading…';

  return `
    <button
      type="button"
      class="version-item ${isSelected ? 'selected' : ''}"
      data-action="selectHistoryVersion"
      data-key="${h(item.key)}"
      aria-current="${isSelected ? 'true' : 'false'}"
    >
      <div class="version-badges">${badges.join('')}</div>
      <div class="version-title">${h(item.title)}</div>
      <div class="version-meta">${h(formatHistoryRelative(item.savedAt))} · ${h(ruleLabel)}</div>
    </button>
  `;
}

function renderHistoryDiffVisual(changes, entry) {
  if (changes === null) {
    return '<p class="diff-empty-copy">Loading revision content from Reddit…</p>';
  }
  if (!changes.length) {
    return `
      <div class="diff-visual diff-visual-neutral">
        <h3>${h(entry.title)} <span class="soft-pill">Snapshot</span></h3>
        <p class="diff-empty-copy">Full snapshot with ${entry.ruleCount} rule${entry.ruleCount === 1 ? '' : 's'}. No changes compared to the previous entry in this list.</p>
      </div>
    `;
  }
  const groups = { add: [], mod: [], rem: [] };
  changes.forEach(function(c) { groups[c.type].push(c); });

  let html = '';
  if (groups.add.length) {
    html += '<div class="diff-visual"><h3>Added <span class="soft-pill soft-pill-success">ADD</span></h3>';
    groups.add.forEach(function(c) {
      html += `<div class="diff-row"><span class="diff-label">${h(c.label)}</span><span><span class="green-code">${h(c.name)}</span></span></div>`;
      html += `<div class="diff-row diff-row-detail"><span class="diff-label"></span><span class="diff-detail">${h(c.detail)}</span></div>`;
    });
    html += '</div>';
  }
  if (groups.mod.length) {
    html += '<div class="diff-visual diff-visual-mod"><h3>Updated <span class="soft-pill soft-pill-warn">MOD</span></h3>';
    groups.mod.forEach(function(c) {
      html += `<div class="diff-row"><span class="diff-label">${h(c.label)}</span><span><span class="code-pill">${h(c.name)}</span></span></div>`;
      html += `<div class="diff-row diff-row-detail"><span class="diff-label"></span><span class="diff-detail">${h(c.detail)}</span></div>`;
    });
    html += '</div>';
  }
  if (groups.rem.length) {
    html += '<div class="diff-visual diff-visual-rem"><h3>Removed <span class="soft-pill soft-pill-danger">REM</span></h3>';
    groups.rem.forEach(function(c) {
      html += `<div class="diff-row"><span class="diff-label">${h(c.label)}</span><span><span class="red-code">${h(c.name)}</span></span></div>`;
    });
    html += '</div>';
  }
  return html;
}

function renderHistoryDiffYaml(entry) {
  return `
    <div class="history-yaml-wrap">
      <pre class="yaml-block history-yaml-block">${h(rulesSnapshotToYaml(entry.rules))}</pre>
    </div>
  `;
}

function renderHistory() {
  const timeline = getHistoryTimeline();
  if (!timeline.length) {
    return renderEmptyState(
      'No versions yet',
      'Save a rule or load wiki revisions from Reddit to see history here.',
      'Create new rule',
      'blank',
      { secondaryLabel: 'Go to My rules', secondaryAction: 'goRules' }
    );
  }

  const selected = getSelectedHistoryItem();
  const item = selected.item;
  const index = selected.index;
  const changes = item ? getHistoryDiffForItem(item, timeline, index) : [];
  const diffMode = state.ui.historyDiffMode === 'yaml' ? 'yaml' : 'visual';
  const diffBody = !item
    ? '<p class="diff-empty-copy">Select a version to view changes.</p>'
    : diffMode === 'yaml' && item.rules
      ? renderHistoryDiffYaml({ rules: item.rules })
      : renderHistoryDiffVisual(changes, item);

  const redditCount = state.wikiRevisions.length;
  const localCount = state.history.length;
  const calloutHtml = redditCount
    ? `<div class="history-callout panel panel-pad history-callout-info">
        ${icon('check-circle')}
        <div>
          <strong>Reddit + local snapshots</strong>
          <p>Reddit wiki revisions (${redditCount}) are loaded from the API. Local entries (${localCount}) are saved in this browser when you use Save rule.</p>
        </div>
      </div>`
    : `<div class="history-callout panel panel-pad">
        ${icon('alert-triangle')}
        <div>
          <strong>Local snapshots</strong>
          <p>Showing saves from this browser. Reddit wiki revisions could not be loaded or this page is new.</p>
        </div>
      </div>`;

  const ruleCountLabel = item && item.rules
    ? item.rules.length + ' rule' + (item.rules.length === 1 ? '' : 's')
    : '…';

  const revertBtn = item && item.source === 'reddit'
    ? `<button type="button" class="btn btn-secondary" data-action="revertWikiRevision" ${state.saving ? 'disabled' : ''}>${icon('refresh')}Revert on Reddit</button>`
    : '';

  return `
    <div class="page-shell history-page">
      <div class="page-heading">
        <h1>Version history</h1>
        <p>Compare wiki revisions and local saves. Restore to the editor or revert on Reddit when viewing a Reddit revision.</p>
      </div>
      ${calloutHtml}
      <div class="history-layout">
        <aside class="version-list-card" aria-label="Version list">
          <div class="version-list-head">
            <span>${timeline.length} version${timeline.length === 1 ? '' : 's'}</span>
            <span>${icon('diff')} Newest first</span>
          </div>
          <div class="version-list-body">
            ${timeline.map(function(entry, i) { return renderHistoryVersionItem(entry, i); }).join('')}
          </div>
        </aside>
        <section class="history-detail" aria-label="Version detail">
          <div class="history-detail-head">
            <div>
              <h2>${h(item.title)}</h2>
              <div class="detail-meta">
                <span class="tiny-avatar" aria-hidden="true">${h(String(item.author || 'You').slice(0, 2).toUpperCase())}</span>
                <span>${h(item.author || 'You')}</span>
                <span>·</span>
                <span>${h(formatHistoryTime(item.savedAt))}</span>
                <span>·</span>
                <span>${h(ruleCountLabel)}</span>
              </div>
              <p class="history-detail-desc">${h(item.detail)}</p>
            </div>
            <div class="history-detail-actions">
              <button type="button" class="btn btn-secondary" data-action="restoreHistoryVersion" ${!item.rules || state.saving ? 'disabled' : ''}>${icon('refresh')}Restore to editor</button>
              ${revertBtn}
            </div>
          </div>
          <div class="change-card">
            <div class="change-head">
              <span>Changes</span>
              <div class="tab-switch" role="tablist" aria-label="Diff view">
                <button type="button" class="${diffMode === 'visual' ? 'active' : ''}" data-action="setHistoryDiffTab" data-mode="visual" role="tab" aria-selected="${diffMode === 'visual'}">Visual</button>
                <button type="button" class="${diffMode === 'yaml' ? 'active' : ''}" data-action="setHistoryDiffTab" data-mode="yaml" role="tab" aria-selected="${diffMode === 'yaml'}">YAML</button>
              </div>
            </div>
            <div class="change-body">
              ${diffBody}
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="page-shell">
      <div class="page-heading">
        <h1>Settings</h1>
        <p>Control display preferences, workspace identity, and deployment behavior for this moderator workspace.</p>
      </div>
      <div class="settings-grid">
        <article class="panel settings-card">
          <div class="page-kicker">Appearance</div>
          <h2>Design system mode</h2>
          <p>The UI now uses the reusable light/dark token map from the reddit-hackathon CollabGuard theme.</p>
          <div class="token-swatch-row">
            <span class="token-swatch" style="background:var(--background)"></span>
            <span class="token-swatch" style="background:var(--primary)"></span>
            <span class="token-swatch" style="background:var(--success)"></span>
            <span class="token-swatch" style="background:var(--warning)"></span>
            <span class="token-swatch" style="background:var(--info)"></span>
          </div>
          <div style="height:18px"></div>
          <button class="btn btn-secondary" data-action="toggleTheme">Toggle theme</button>
        </article>
        <article class="panel settings-card">
          <div class="page-kicker">Workspace</div>
          <h2>${h(formatSubredditLabel(state.subredditName))}</h2>
          <p>Loaded from your playtest subreddit via Devvit.</p>
          <button class="btn btn-secondary">Manage workspace</button>
        </article>
        <article class="panel settings-card">
          <div class="page-kicker">Deployment</div>
          <h2>AutoModerator wiki</h2>
          <p>Save rule writes YAML to <span class="mono">config/automoderator</span> via Reddit’s API (replaces the full wiki page).</p>
          <button class="btn btn-primary" data-action="blank">${icon('plus')}New rule</button>
        </article>
        <article class="panel settings-card">
          <div class="page-kicker">Typography</div>
          <h2>Inter + JetBrains Mono</h2>
          <p>Headings, body text, labels, pills, and code samples now inherit shared type scale variables.</p>
        </article>
      </div>
    </div>
  `;
}

function renderLegacySettings() {
  return `
    <div class="grid-2">
      <div class="panel panel-pad">
        <button class="btn btn-secondary" data-action="toggleTheme">Toggle theme</button>
      </div>
      <div class="panel panel-pad">
        <div class="logic-title">Deployment</div>
        <p class="hint">Deploy writes the generated YAML to <span class="mono">config/automoderator</span> through the existing Devvit integration.</p>
      </div>
    </div>
  `;
}

document.addEventListener('click', function(e) {
  const el = e.target.closest('[data-action], .nav-item[data-view]');
  if (!el) return;
  const action = el.dataset.action;
  if (!action) return;
  if (action === 'blank') createBlankRule();
  if (action === 'deployRules') deployRules();
  if (action === 'saveDraft') saveDraftOnly();
  if (action === 'resetDraft') {
    clearDraft();
    state.rules = clone(state.serverRules || []);
    ensureRuleIds(state.rules);
    state.loading = false;
    state.dirty = false;
    state.selected = state.rules.length ? 0 : -1;
    state.notification = { type: 'success', text: 'Discarded local draft and restored rules from Reddit.' };
    updateDirtyState();
    renderShell();
  }
  if (action === 'selectRule') {
    selectBuilderRule(el.dataset.index);
  }
  if (action === 'useTemplate') useTemplate(el.dataset.template);
  if (action === 'goTemplates') setView('templates');
  if (action === 'goRules') setView('rules');
  if (action === 'testRule') scrollToBuilderPanel('#builderTestPanel');
  if (action === 'editRule') {
    state.selected = Number(el.dataset.index);
    setView('builder');
  }
  if (action === 'deleteRule') {
    const index = Number(el.dataset.index);
    const name = getRuleName(state.rules[index] || {});
    if (!window.confirm('Delete rule “' + name + '”? This cannot be undone until you reload from Reddit without saving.')) return;
    state.rules.splice(index, 1);
    if (!state.rules.length) {
      state.selected = -1;
      state.view = 'rules';
    } else {
      state.selected = Math.min(index, state.rules.length - 1);
    }
    notify('success', 'Rule removed from this draft. Save rule to apply changes on Reddit.');
    if (state.view === 'builder' && state.rules.length) {
      state.ui.focusSelector = '#builder-rule-tab-' + state.selected;
    }
    markDirty();
    renderShell();
  }
  if (action === 'setSimType') {
    state.sim.contentType = el.dataset.value || 'comment';
    renderShell();
  }
  if (action === 'simExample') {
    const examples = {
      spam: { contentType: 'comment', title: '', body: 'Hey everyone! click here and DM me for the link — free money fast.', url: '' },
      civil: { contentType: 'submission', title: 'Weekly discussion — what are you working on?', body: '', url: '' },
      clean: { contentType: 'comment', title: '', body: 'Thanks for the guide, this helped a lot.', url: '' },
    };
    const sample = examples[el.dataset.example];
    if (sample) {
      Object.assign(state.sim, sample);
      state.sim.results = null;
    }
    renderShell();
  }
  if (action === 'simReset') {
    state.sim.results = null;
    renderShell();
  }
  if (action === 'retryLoad') {
    state.loading = true;
    state.notification = null;
    renderShell();
    requestRules();
  }
  if (action === 'templateCategory') {
    state.ui.templateCategory = el.dataset.category || 'all';
    renderShell();
  }
  if (action === 'selectHistoryVersion') {
    state.ui.historySelectedId = el.dataset.key;
    const parsed = parseHistoryItemKey(el.dataset.key);
    if (parsed && parsed.source === 'reddit') loadWikiRevisionContent(parsed.id);
    renderShell();
  }
  if (action === 'revertWikiRevision') revertWikiRevision();
  if (action === 'setHistoryDiffTab') {
    state.ui.historyDiffMode = el.dataset.mode === 'yaml' ? 'yaml' : 'visual';
    renderShell();
  }
  if (action === 'restoreHistoryVersion') restoreHistoryVersion();
  if (action === 'setAction') {
    const rule = selectedRule();
    if (!rule) return;
    rule.action = el.dataset.value;
    markDirty();
    renderShell();
  }
  if (action === 'setContentType') {
    const rule = selectedRule();
    if (!rule) return;
    const value = el.dataset.value;
    if (value) rule.type = value;
    else delete rule.type;
    markDirty();
    renderShell();
  }
  if (action === 'runInlineTest') {
    const body = document.getElementById('inlineTestBody');
    state.sim.body = body ? body.value : '';
    if (state.selected < 0) return;
    state.sim.inlineResult = evaluateRuleMatch(
      state.rules[state.selected],
      state.sim.contentType,
      state.sim.title,
      state.sim.body,
      state.sim.url,
      state.selected
    );
    renderShell();
  }
  if (action === 'runSimulator') {
    readSimulatorFields();
    state.sim.results = runSimulator(state.sim.contentType, state.sim.title, state.sim.body, state.sim.url);
    renderShell();
  }
  if (action === 'toggleTheme') toggleTheme();
});

document.addEventListener('input', function(e) {
  const el = e.target;
  const action = el.dataset.action;
  if (action === 'templateSearch') {
    state.ui.templateSearch = el.value;
    renderShell();
    const input = document.getElementById('templateSearchInput');
    if (input) {
      const pos = input.value.length;
      input.focus();
      try { input.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
    }
    return;
  }
  if (!action) return;
  const rule = selectedRule();
  if (!rule) return;
  if (action === 'setField') setField(rule, el.dataset.key, el.value);
  if (action === 'setPriority') setField(rule, 'priority', el.value !== '' ? Number(el.value) : undefined);
  if (action === 'setArrayField') setArrayField(rule, el.dataset.key, el.value);
  if (action === 'setNestedField') setNestedField(rule, el.dataset.obj, el.dataset.key, el.value);
  updateLivePreview();
  markDirty();
});

document.addEventListener('change', function(e) {
  const el = e.target;
  const action = el.dataset.action;
  if (!action) return;
  const rule = selectedRule();
  if (!rule) return;
  if (action === 'setField') setField(rule, el.dataset.key, el.value);
  if (action === 'setPriority') setField(rule, 'priority', el.value !== '' ? Number(el.value) : undefined);
  if (action === 'setModExempt') rule.moderators_exempt = el.checked;
  if (action === 'setCheckbox') {
    if (el.checked) rule[el.dataset.key] = true;
    else delete rule[el.dataset.key];
  }
  updateLivePreview();
  markDirty();
});

function selectedRule() {
  return state.selected >= 0 ? state.rules[state.selected] : null;
}

function updateLivePreview() {
  const rule = selectedRule();
  if (!rule) return;
  const summary = document.getElementById('summaryText');
  const yaml = document.getElementById('yamlPreview');
  if (summary) summary.textContent = summarizeRule(rule);
  if (yaml) yaml.textContent = toYaml(rule);
}

function readSimulatorFields() {
  const type = document.getElementById('simType');
  const title = document.getElementById('simTitle');
  const body = document.getElementById('simBody');
  const url = document.getElementById('simUrl');
  state.sim.contentType = type ? type.value : state.sim.contentType;
  state.sim.title = title ? title.value : '';
  state.sim.body = body ? body.value : '';
  state.sim.url = url ? url.value : '';
}

function setField(rule, key, value) {
  if (value === undefined || value === '') delete rule[key];
  else rule[key] = value;
}

function setArrayField(rule, key, raw) {
  const lines = raw.split('\n').map(function(line) { return line.trim(); }).filter(Boolean);
  if (!lines.length) delete rule[key];
  else rule[key] = lines.length === 1 ? lines[0] : lines;
}

function setNestedField(rule, obj, key, value) {
  if (!value || !String(value).trim()) {
    if (rule[obj] && typeof rule[obj] === 'object') {
      delete rule[obj][key];
      if (!Object.keys(rule[obj]).length) delete rule[obj];
    }
    return;
  }
  if (!rule[obj] || typeof rule[obj] !== 'object') rule[obj] = {};
  rule[obj][key] = String(value).trim();
}

function textareaField(label, key, value, tipKey) {
  const phraseCount = value ? value.split('\n').map(function(line) { return line.trim(); }).filter(Boolean).length : 0;
  const ph = tipPlaceholder(tipKey, '');
  return `
    <label class="field">
      <div class="field-top">
        ${fieldLabel(label, tipKey)}
        ${phraseCount ? `<span class="phrase-count">${phraseCount} phrase${phraseCount === 1 ? '' : 's'}</span>` : ''}
      </div>
      <textarea class="textarea mono" data-action="setArrayField" data-key="${h(key)}" placeholder="${h(ph)}">${h(value)}</textarea>
      ${fieldHint(tipKey)}
    </label>
  `;
}

function nestedField(label, obj, key, value, tipKey) {
  const tip = getFieldTip(tipKey);
  const ph = tip && tip.example ? tip.example : '< 10';
  return `
    <label class="field author-field">
      ${fieldLabel(label, tipKey)}
      <input class="input mono" data-action="setNestedField" data-obj="${h(obj)}" data-key="${h(key)}" value="${h(value)}" placeholder="${h(ph)}">
      ${fieldHint(tipKey)}
    </label>
  `;
}

function option(value, label, current) {
  return `<option value="${h(value)}" ${String(current || '') === String(value) ? 'selected' : ''}>${h(label)}</option>`;
}

function actionChip(action) {
  return { remove: 'danger', report: 'warning', filter: 'info', approve: 'success', spam: 'brand' }[action] || '';
}

function getRuleName(rule) {
  if (typeof rule.action_reason === 'string' && rule.action_reason.trim()) return rule.action_reason.trim().split('\n')[0].slice(0, 64);
  if (typeof rule.comment === 'string' && rule.comment.trim()) return rule.comment.trim().split('\n')[0].slice(0, 64);
  const bodyInc = getArr(rule, 'body (includes)');
  if (bodyInc.length) return `${capitalize(rule.action || 'match')} if body contains "${bodyInc[0]}"`;
  return `${rule.type ? capitalize(rule.type) : 'Any content'} ${rule.action || 'rule'}`;
}

function summarizeRule(rule) {
  const action = {
    remove: 'Removes',
    report: 'Reports',
    approve: 'Approves',
    spam: 'Marks as spam',
    filter: 'Filters',
  }[rule.action] || 'Matches';
  const type = { comment: 'comments', submission: 'posts', link: 'link posts' }[rule.type] || 'content';
  const conditions = [];

  addCondition(conditions, getArr(rule, 'body (includes)'), 'body contains');
  addCondition(conditions, getArr(rule, 'body (excludes)'), 'body excludes');
  addCondition(conditions, getArr(rule, 'title (includes)'), 'title contains');
  addCondition(conditions, getArr(rule, 'url (includes)'), 'URL contains');
  addCondition(conditions, getArr(rule, 'body (regex)'), 'body matches regex');

  const author = rule.author;
  if (author && typeof author === 'object') {
    Object.keys(author).forEach(function(key) {
      conditions.push(`author ${key.replace(/_/g, ' ')} is ${author[key]}`);
    });
  }

  if (!conditions.length) {
    return '⚠️ ' + action + ' all ' + type + ' — add match conditions before deploying.';
  }
  const shown = conditions.slice(0, 3).join(', ');
  const extra = conditions.length > 3 ? ` (+${conditions.length - 3} more)` : '';
  return `${action} ${type} where ${shown}${extra}.`;
}

function countRuleConditions(rule) {
  let count = 0;
  ['body (includes)', 'body (excludes)', 'title (includes)', 'url (includes)', 'body (regex)', 'link_flair_text (includes)'].forEach(function(key) {
    if (getArr(rule, key).length) count += 1;
  });
  if (rule.author && typeof rule.author === 'object') count += Object.keys(rule.author).length;
  if (rule.set_flair) count += 1;
  return count;
}

function addCondition(target, values, label) {
  if (!values.length) return;
  target.push(`${label} "${values[0]}"${values.length > 1 ? ` or ${values.length - 1} more` : ''}`);
}

function evaluateRuleMatch(rule, contentType, title, body, url, index) {
  const bodyLow = (body || '').toLowerCase();
  const titleLow = (title || '').toLowerCase();
  const urlLow = (url || '').toLowerCase();
  const reasons = [];
  let fires = true;

  if (rule.type && rule.type !== contentType) {
    return { index: index, fires: false, action: rule.action, reasons: [{ status: 'fail', text: 'Rule targets ' + rule.type + ', sample is ' + contentType }] };
  }
  if (rule.type) reasons.push({ status: 'pass', text: 'Type matches ' + rule.type });

  checkIncludes(getArr(rule, 'body (includes)'), bodyLow, 'Body', reasons, function() { fires = false; });
  checkExcludes(getArr(rule, 'body (excludes)'), bodyLow, 'Body', reasons, function() { fires = false; });
  checkIncludes(getArr(rule, 'title (includes)'), titleLow, 'Title', reasons, function() { fires = false; });
  checkIncludes(getArr(rule, 'url (includes)'), urlLow, 'URL', reasons, function() { fires = false; });
  checkRegex(getArr(rule, 'body (regex)'), body || '', 'Body', reasons, function() { fires = false; });

  const author = rule.author;
  if (author && typeof author === 'object') {
    Object.keys(author).forEach(function(key) {
      reasons.push({ status: 'skip', text: 'Author ' + key.replace(/_/g, ' ') + ' requires Reddit account data' });
    });
  }
  if (!reasons.length) reasons.push({ status: 'pass', text: 'No conditions, matches all content' });
  return { index: index, fires: fires, action: rule.action, reasons: reasons };
}

function runSimulator(contentType, title, body, url) {
  return state.rules.map(function(rule, index) {
    return evaluateRuleMatch(rule, contentType, title, body, url, index);
  });
}

function checkIncludes(values, text, label, reasons, fail) {
  if (!values.length) return;
  const hits = values.filter(function(value) { return text.includes(String(value).toLowerCase()); });
  if (hits.length) reasons.push({ status: 'pass', text: `${label} contains ${hits.join(', ')}` });
  else {
    reasons.push({ status: 'fail', text: `${label} does not contain ${values.join(', ')}` });
    fail();
  }
}

function checkExcludes(values, text, label, reasons, fail) {
  if (!values.length) return;
  const hits = values.filter(function(value) { return text.includes(String(value).toLowerCase()); });
  if (hits.length) {
    reasons.push({ status: 'fail', text: `${label} contains excluded phrase ${hits.join(', ')}` });
    fail();
  } else {
    reasons.push({ status: 'pass', text: `${label} excludes are clear` });
  }
}

function checkRegex(values, text, label, reasons, fail) {
  if (!values.length) return;
  const hit = values.some(function(pattern) {
    try { return new RegExp(pattern, 'i').test(text); }
    catch (_) { return false; }
  });
  if (hit) reasons.push({ status: 'pass', text: `${label} matches regex` });
  else {
    reasons.push({ status: 'fail', text: `${label} does not match regex` });
    fail();
  }
}

function getArr(rule, key) {
  const value = rule[key];
  if (!value) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

function arr(rule, key) {
  return getArr(rule, key).join('\n');
}

function toYaml(obj) {
  const lines = [];
  Object.keys(obj).forEach(function(key) {
    const value = obj[key];
    if (value === undefined || value === null || value === '') return;
    const safeKey = yamlKey(key);
    if (Array.isArray(value)) {
      if (!value.length) return;
      lines.push(`${safeKey}:`);
      value.forEach(function(item) { lines.push(`  - ${yamlVal(item)}`); });
    } else if (typeof value === 'object') {
      const subkeys = Object.keys(value).filter(function(subkey) {
        return value[subkey] !== undefined && value[subkey] !== null && value[subkey] !== '';
      });
      if (!subkeys.length) return;
      lines.push(`${safeKey}:`);
      subkeys.forEach(function(subkey) { lines.push(`  ${yamlKey(subkey)}: ${yamlVal(value[subkey])}`); });
    } else {
      lines.push(`${safeKey}: ${yamlVal(value)}`);
    }
  });
  return lines.join('\n');
}

function yamlKey(key) {
  return /[\s()[\]{}:#,|>&*!?]/.test(key) ? `"${key}"` : key;
}

function yamlVal(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  const str = String(value);
  if (!str) return '""';
  if (/^[>|#{}&*!%@`[\]<]/.test(str) || /^[-?:,](\s|$)/.test(str) || /:\s/.test(str) || str.includes(' #') || /^[\s]|[\s]$/.test(str) || /^(true|false|yes|no|on|off|null|~)$/i.test(str)) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

function capitalize(str) {
  str = String(str || '');
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function icon(name) {
  const icons = {
    'alert-triangle': '<path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-left': '<path d="M15 18l-6-6 6-6"/>',
    'chevron-right': '<path d="M9 18l6-6-6-6"/>',
    diff: '<path d="M8 7h12"/><path d="M8 17h12"/><path d="M4 4v6"/><path d="M1 7h6"/><path d="M1 17h6"/>',
    filter: '<path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"/>',
    frown: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M8 16s1.5-2 4-2 4 2 4 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>',
    play: '<path d="M8 5v14l11-7-11-7z"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h-4"/><path d="M6 22v-4h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    shield: '<path d="M12 3l7 3v5c0 4.4-2.8 8.3-7 10-4.2-1.7-7-5.6-7-10V6l7-3z"/><path d="M9.5 12l1.7 1.7 3.8-4"/>',
    sun: '<path d="M12 3v2"/><path d="M12 19v2"/><path d="M5.6 5.6 7 7"/><path d="M17 17l1.4 1.4"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M5.6 18.4 7 17"/><path d="M17 7l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
    code: '<path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    tag: '<path d="M20 13 13 20 4 11V4h7l9 9z"/><path d="M7.5 7.5h.01"/>',
    text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  };
  return '<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || icons.shield) + '</svg>';
}

function h(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
