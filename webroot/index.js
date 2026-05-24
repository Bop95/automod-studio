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
      'link_flair_text (includes)': [''],
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
  selected: -1,
  loading: true,
  dirty: false,
  view: 'templates',
  theme: localStorage.getItem('cg-theme') || 'light',
  sidebarCollapsed: localStorage.getItem('ams-sidebar-collapsed') === 'true',
  notification: null,
  sim: {
    contentType: 'comment',
    title: '',
    body: '',
    url: '',
    results: null,
  },
  history: [],
};

let rulesLoaded = false;

const previewRules = [
  { name: 'Anti-spam basics', conditions: 3, status: 'Active', action: 'Remove + send modmail', fired: 47, last: '2h ago' },
  { name: 'Restrict new accounts', conditions: 2, status: 'Active', action: 'Filter for review', fired: 8, last: '12m ago' },
  { name: 'Require post flair', conditions: 2, status: 'Active', action: 'Remove + send modmail', fired: 3, last: 'Yesterday' },
  { name: 'No personal attacks', conditions: 4, status: 'Paused', action: 'Filter for review', fired: 0, last: '3 days ago' },
  { name: 'Limit low-karma posters', conditions: 2, status: 'Active', action: 'Filter for review', fired: 12, last: '5h ago' },
];

document.documentElement.dataset.theme = state.theme;

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
      renderShell();
    }
  }, 8000);
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
    state.loading = true;
    state.dirty = false;
    state.notification = null;
    updateDirtyState();
    renderShell();
    requestRules();
  });
  document.getElementById('reloadBtn').addEventListener('click', function() {
    state.loading = true;
    state.notification = null;
    renderShell();
    requestRules();
  });
}

function requestRules() {
  rulesLoaded = false;
  sendToDevvit({ type: 'GET_RULES' });
}

function handleDevvitMsg(msg) {
  if (msg.type === 'INIT') {
    rulesLoaded = true;
    state.rules = msg.rules || [];
    state.loading = false;
    state.dirty = false;
    state.selected = state.rules.length ? 0 : -1;
    state.notification = null;
    updateDirtyState();
    renderShell();
  }
  if (msg.type === 'SAVE_SUCCESS') {
    state.dirty = false;
    state.notification = { type: 'success', text: 'Rules deployed to Reddit wiki.' };
    state.history.unshift({
      title: 'Updated AutoModerator config',
      detail: `${state.rules.length} rule${state.rules.length === 1 ? '' : 's'} deployed from CollabGuard`,
      time: 'Just now',
    });
    updateDirtyState();
    renderShell();
  }
  if (msg.type === 'ERROR') {
    state.loading = false;
    state.notification = { type: 'error', text: msg.message || 'An error occurred.' };
    renderShell();
  }
}

window.handleDevvitMsg = handleDevvitMsg;

function setView(view) {
  state.view = view;
  if (view === 'builder' && state.selected < 0 && state.rules.length) state.selected = 0;
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
  state.rules.push({
    type: 'comment',
    action: 'filter',
    action_reason: 'Untitled rule',
  });
  state.selected = state.rules.length - 1;
  state.view = 'builder';
  markDirty();
  renderShell();
}

function useTemplate(id) {
  const template = templates.find(function(item) { return item.id === id; });
  if (!template) return;
  state.rules.push(clone(template.rule));
  state.selected = state.rules.length - 1;
  state.view = 'builder';
  markDirty();
  renderShell();
}

function deployRules() {
  if (!state.dirty) return;
  sendToDevvit({ type: 'SAVE', rules: state.rules });
}

function markDirty() {
  state.dirty = true;
  updateDirtyState();
}

function updateDirtyState() {
  const saveBar = document.getElementById('saveBar');
  const deployBtn = document.getElementById('deployBtn');
  const topSaveActions = document.getElementById('topSaveActions');
  const topDeployBtn = document.getElementById('topDeployBtn');
  const topResetBtn = document.getElementById('topResetBtn');
  if (saveBar) saveBar.classList.remove('visible');
  if (topSaveActions) topSaveActions.classList.toggle('visible', state.dirty && state.view === 'builder');
  if (topDeployBtn) topDeployBtn.disabled = !state.dirty;
  if (topResetBtn) topResetBtn.disabled = !state.dirty;
  if (deployBtn) deployBtn.disabled = !state.dirty;
}

function renderShell() {
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
  if (topbar) topbar.classList.toggle('simulator-mode', state.view === 'simulator');
  document.getElementById('breadcrumb').textContent = current[0];
  if (state.view === 'simulator') {
    pageTitle.innerHTML = '<span class="top-crumb">My rules</span><span class="top-chevron">' + icon('chevron-right') + '</span><span class="top-crumb">Anti-spam basics</span><span class="top-chevron">' + icon('chevron-right') + '</span><span>Simulator</span>';
  } else {
    pageTitle.textContent = current[1];
  }
  if (topActions) topActions.innerHTML = renderTopActions(state.view);
  document.getElementById('rulesNavCount').textContent = String(state.rules.length || 5);
  document.querySelectorAll('.nav-item[data-view]').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
  renderBanner();
  renderView();
  updateDirtyState();
}

function applySidebarState() {
  const shell = document.getElementById('appShell');
  const toggle = document.getElementById('sideNavToggle');
  if (!shell || !toggle) return;
  shell.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  toggle.setAttribute('aria-label', state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
  toggle.setAttribute('title', state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
}

function renderTopActions(view) {
  if (view === 'simulator') {
    return `
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
    return `
      <div class="top-save-actions ${state.dirty ? 'visible' : ''}" id="topSaveActions">
        <span class="save-copy" style="padding-left:0"><span class="save-dot"></span><span>Unsaved rule changes</span></span>
        <button class="btn btn-secondary" id="topResetBtn" data-action="resetDraft" ${state.dirty ? '' : 'disabled'}>Reset</button>
        <button class="btn btn-primary" id="topDeployBtn" data-action="deployRules" ${state.dirty ? '' : 'disabled'}>Deploy rules</button>
      </div>
      <button class="btn btn-primary btn-new" data-action="blank">${icon('plus')}New rule</button>
      <div class="top-separator"></div>
      <button class="btn btn-ghost icon-btn" title="Notifications">${icon('bell')}</button>
      <button class="btn btn-ghost icon-btn" data-action="toggleTheme" title="Toggle theme">${icon('sun')}</button>
      <div class="avatar">8M</div>
      <button class="btn btn-primary" id="deployBtn" disabled style="display:none">Deploy</button>
    `;
  }
  return `
    <button class="btn btn-primary btn-new" data-action="blank">${icon('plus')}New rule</button>
    <div class="top-separator"></div>
    <button class="btn btn-ghost icon-btn" title="Notifications">${icon('bell')}</button>
    <button class="btn btn-ghost icon-btn" data-action="toggleTheme" title="Toggle theme">${icon('sun')}</button>
    <div class="avatar">8M</div>
    <button class="btn btn-primary" id="deployBtn" disabled style="display:none">Deploy</button>
  `;
}

function renderBanner() {
  const banner = document.getElementById('banner');
  if (!state.notification) {
    banner.className = 'banner';
    banner.textContent = '';
    return;
  }
  banner.className = 'banner visible ' + state.notification.type;
  banner.textContent = state.notification.text;
}

function renderView() {
  const root = document.getElementById('viewRoot');
  if (state.loading && state.view === 'builder') {
    root.innerHTML = `<div class="panel empty"><div><h2>Loading rules...</h2><p>Reading r/subreddit/wiki/config/automoderator.</p></div></div>`;
    return;
  }
  if (state.view === 'templates') root.innerHTML = renderTemplates();
  if (state.view === 'rules') root.innerHTML = renderRules();
  if (state.view === 'builder') root.innerHTML = renderBuilder();
  if (state.view === 'simulator') root.innerHTML = renderSimulator();
  if (state.view === 'history') root.innerHTML = renderHistory();
  if (state.view === 'settings') root.innerHTML = renderSettings();
}

function renderTemplates() {
  return `
    <div class="templates-page">
      <div class="templates-heading">
        <h1>Templates</h1>
        <p>Start from a tested rule. You can customize everything before saving.</p>
      </div>
      <div class="template-tools">
        <label class="search-box">${icon('search')}<input type="search" placeholder="Search templates..." aria-label="Search templates"></label>
        <button class="filter-box" type="button">${icon('filter')}<span>All categories</span><span style="margin-left:auto">${icon('chevron-down')}</span></button>
      </div>
      <div class="category-tabs" aria-label="Template categories">
        <button class="category-pill active">All <span>6</span></button>
        <button class="category-pill">Anti-spam <span>2</span></button>
        <button class="category-pill">New users <span>1</span></button>
        <button class="category-pill">Content quality <span>1</span></button>
        <button class="category-pill">Civility <span>1</span></button>
        <button class="category-pill">Format checks <span>1</span></button>
      </div>
      <div class="template-grid">
        ${templates.map(function(template) {
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
        }).join('')}
      </div>
    </div>
  `;
}

function renderRules() {
  const rows = state.rules.length
    ? state.rules.map(function(rule, index) {
      return {
        name: getRuleName(rule),
        conditions: countRuleConditions(rule),
        status: index === 3 ? 'Paused' : 'Active',
        action: rule.action === 'remove' ? 'Remove + send modmail' : 'Filter for review',
        fired: [47, 8, 3, 0, 12][index] || 0,
        last: ['2h ago', '12m ago', 'Yesterday', '3 days ago', '5h ago'][index] || 'just now',
      };
    })
    : previewRules;
  return `
    <div class="page-shell rules-page">
      <div class="page-heading">
        <h1>My rules</h1>
        <p>Live rules currently running on r/ModQueueLab. Click a row to edit, or pause to stop a rule without deleting it.</p>
      </div>
      <div class="panel table-scroll rules-card">
        <table class="rules-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Status</th>
              <th>Action</th>
              <th style="text-align:right">Fired today</th>
              <th>Last fired</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(function(row, index) {
              const paused = row.status === 'Paused';
              return `
                <tr data-action="${state.rules.length ? 'editRule' : 'blank'}" data-index="${index}">
                  <td>
                    <div class="rule-name">${h(row.name)}</div>
                    <div class="rule-desc">${row.conditions} condition${row.conditions === 1 ? '' : 's'}</div>
                  </td>
                  <td><span class="status-pill ${paused ? 'paused' : ''}"><span class="status-dot"></span>${h(row.status)}</span></td>
                  <td>${h(row.action)}</td>
                  <td class="numeric-cell">${row.fired}</td>
                  <td class="muted-cell">${h(row.last)}</td>
                  <td class="chevron-cell">${icon('chevron-right')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="rules-actions">
        <button class="btn btn-primary btn-new" data-action="blank">${icon('plus')}New rule</button>
      </div>
    </div>
  `;
}

function renderBuilder() {
  if (state.selected < 0 || !state.rules[state.selected]) {
    return `
      <div class="panel empty">
        <div>
          <h2>Select a rule to edit</h2>
          <p>Open My rules or use a template to start a guided builder session.</p>
          <button class="btn btn-primary" data-action="goRules">Go to rules</button>
        </div>
      </div>
    `;
  }
  const rule = state.rules[state.selected];
  return `
    <div class="builder-grid">
      <div class="builder-stack">
        <div class="builder-header">
          <div>
            <h2>${h(getRuleName(rule))}</h2>
            <p>Edit conditions, enforcement behavior, and metadata for this AutoModerator rule.</p>
          </div>
          <button class="btn btn-danger" data-action="deleteRule" data-index="${state.selected}">Delete</button>
        </div>
        ${renderBasics(rule)}
        ${renderConditions(rule)}
        ${renderAuthor(rule)}
        ${renderActions(rule)}
      </div>
      <aside class="side-panel">
        <div class="panel panel-pad logic-card">
          <div class="logic-title">Rule summary</div>
          <div class="logic-text" id="summaryText">${h(summarizeRule(rule))}</div>
        </div>
        <div class="panel panel-pad">
          <div class="logic-title">Test this rule</div>
          ${renderInlineTester()}
        </div>
        <div class="panel panel-pad">
          <div class="logic-title">YAML preview</div>
          <pre class="yaml-block" id="yamlPreview">${h(toYaml(rule))}</pre>
        </div>
      </aside>
    </div>
  `;
}

function renderBasics(rule) {
  return `
    <section class="section">
      <div class="section-head">Rule basics</div>
      <div class="section-body">
        <div class="form-grid">
          <label class="field">
            <span class="label">Rule name</span>
            <input class="input" value="${h(rule.action_reason || '')}" data-action="setField" data-key="action_reason" placeholder="Anti-spam basics">
          </label>
          <label class="field">
            <span class="label">Content type</span>
            <select class="select" data-action="setField" data-key="type">
              ${option('', 'Any content', rule.type)}
              ${option('comment', 'Comment', rule.type)}
              ${option('submission', 'Post', rule.type)}
              ${option('link', 'Link post', rule.type)}
            </select>
          </label>
        </div>
        <label class="field">
          <span class="label">Priority</span>
          <input class="input mono" type="number" value="${h(rule.priority != null ? String(rule.priority) : '')}" data-action="setPriority" placeholder="Default">
          <span class="hint">Lower priority values run earlier in AutoModerator.</span>
        </label>
      </div>
    </section>
  `;
}

function renderConditions(rule) {
  return `
    <section class="section">
      <div class="section-head">Post and comment conditions</div>
      <div class="section-body">
        <div class="form-grid">
          ${textareaField('Body contains', 'body (includes)', arr(rule, 'body (includes)'), 'One phrase per line')}
          ${textareaField('Body excludes', 'body (excludes)', arr(rule, 'body (excludes)'), 'Optional allowlist phrases')}
          ${textareaField('Title contains', 'title (includes)', arr(rule, 'title (includes)'), 'For posts and links')}
          ${textareaField('URL/domain contains', 'url (includes)', arr(rule, 'url (includes)'), 'Shorteners, tracking params, or domains')}
        </div>
        ${textareaField('Regex patterns', 'body (regex)', arr(rule, 'body (regex)'), 'Advanced matching, one pattern per line')}
      </div>
    </section>
  `;
}

function renderAuthor(rule) {
  const author = rule.author && typeof rule.author === 'object' ? rule.author : {};
  return `
    <section class="section">
      <div class="section-head">Author checks</div>
      <div class="section-body">
        <div class="form-grid">
          ${nestedField('Combined karma', 'author', 'combined_karma', author.combined_karma || '', '< 10')}
          ${nestedField('Comment karma', 'author', 'comment_karma', author.comment_karma || '', '< 5')}
          ${nestedField('Post karma', 'author', 'post_karma', author.post_karma || '', '< 5')}
          ${nestedField('Account age', 'author', 'account_age', author.account_age || '', '< 7 days')}
        </div>
        <label class="switch-row">
          <input type="checkbox" ${rule.moderators_exempt === false ? '' : 'checked'} data-action="setModExempt">
          Moderators are exempt from this rule
        </label>
      </div>
    </section>
  `;
}

function renderActions(rule) {
  const actions = ['remove', 'report', 'filter', 'approve', 'spam'];
  return `
    <section class="section">
      <div class="section-head">Enforcement action</div>
      <div class="section-body">
        <div class="action-picker">
          ${actions.map(function(action) {
            return `<button class="action-btn ${rule.action === action ? 'active' : ''}" data-action="setAction" data-value="${action}">${capitalize(action)}</button>`;
          }).join('')}
        </div>
        <label class="field">
          <span class="label">Report reason</span>
          <input class="input" value="${h(rule.report_reason || '')}" data-action="setField" data-key="report_reason" placeholder="Needs moderator review">
        </label>
        <label class="field">
          <span class="label">Auto-reply comment</span>
          <textarea class="textarea" data-action="setField" data-key="comment" placeholder="Explain why the content was actioned">${h(rule.comment || '')}</textarea>
        </label>
        <div class="grid-2">
          <label class="switch-row"><input type="checkbox" ${rule.lock ? 'checked' : ''} data-action="setCheckbox" data-key="lock">Lock matched content</label>
          <label class="switch-row"><input type="checkbox" ${rule.ban ? 'checked' : ''} data-action="setCheckbox" data-key="ban">Ban matched user</label>
        </div>
      </div>
    </section>
  `;
}

function renderInlineTester() {
  const result = state.sim.results && state.sim.results[state.selected];
  return `
    <div class="field">
      <span class="label">Sample body</span>
      <textarea class="textarea" id="inlineTestBody" placeholder="Paste a comment or post body">${h(state.sim.body)}</textarea>
    </div>
    <div style="height:10px"></div>
    <button class="btn btn-secondary" data-action="runInlineTest">Run test</button>
    ${result ? `<div class="test-result" style="margin-top:12px">${renderResult(result)}</div>` : ''}
  `;
}

function renderSimulator() {
  return `
    <div class="page-shell simulator-page">
      <div class="simulator-title-row">
        <div>
          <div class="page-kicker">Testing</div>
          <div class="page-heading" style="margin-bottom:0">
            <h1>Anti-spam basics</h1>
          </div>
        </div>
        <div class="simulator-note">Simulator · changes here never affect r/ModQueueLab.</div>
      </div>
      <div class="sim-shell">
        <section class="sim-column">
          <div class="page-kicker">Test input</div>
          <div class="segmented" role="tablist">
            <button class="segment active" type="button">Comment</button>
            <button class="segment" type="button">Post</button>
          </div>
          <div class="author-card">
            <div class="round-avatar">FM</div>
            <div>
              <div class="author-main">u/free_money_now</div>
              <div class="author-meta">4 days old · 12 karma <span class="new-badge">NEW</span></div>
            </div>
          </div>
          <div class="page-kicker">Comment body</div>
          <div class="comment-box">
            g ey everyone! I made $5000 last week with this one trick —
            <span class="highlight-red">click here</span> to find out how.
            <span class="highlight-red">DM me</span> if you want the link.
          </div>
          <div class="warning-line">${icon('alert-triangle')}2 phrases match your rule's trigger list.</div>
          <div class="sim-run-row">
            <button class="btn btn-primary" data-action="runSimulator">${icon('play')}Run test</button>
            <button class="btn btn-secondary icon-btn" type="button">${icon('refresh')}</button>
          </div>
          <div class="page-kicker">Quick examples</div>
          <div class="quick-pills">
            <button class="quick-pill active" type="button">Spam link comment</button>
            <button class="quick-pill" type="button">Civil post</button>
            <button class="quick-pill" type="button">New user, clean</button>
          </div>
        </section>
        <section class="sim-column result">
          <div class="page-kicker">Result</div>
          <div class="success-callout">
            <div class="success-icon">${icon('check')}</div>
            <div>
              <div class="success-title">Rule triggered — would remove this comment</div>
              <div class="success-copy">u/free_money_now would receive an automated modmail with your removal reason.</div>
            </div>
          </div>
          <div class="page-kicker">Conditions evaluated</div>
          <div class="condition-list">
            ${renderConditionRow('Item type', 'is', '<span class="code-pill">Comment</span>', 'The input is a comment.')}
            ${renderConditionRow('Body contains', '', '<span class="code-pill red-code">click here</span> <span class="code-pill red-code">DM me</span>', '2 of 5 trigger phrases found in the body.')}
            ${renderConditionRow('Author age', 'is less than', '<span class="code-pill">30 days</span>', 'u/free_money_now is 4 days old.')}
          </div>
          <div class="page-kicker">Modmail preview</div>
          <div class="modmail-card">
            <div class="modmail-head">
              <div class="round-avatar" style="width:40px;height:40px">AM</div>
              <div>
                <div class="modmail-title">Your comment was removed</div>
                <div class="modmail-meta">From AutoMod Studio · to u/free_money_now</div>
              </div>
              <div class="muted-cell">just now</div>
            </div>
            <div class="modmail-body">Your comment was removed automatically because it matched our anti-spam filter. If this was a mistake, reply here and a human mod will take a look.</div>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderConditionRow(label, joiner, value, detail) {
  return `
    <div class="condition-row">
      <div><span class="check-lite">${icon('check')}</span></div>
      <div class="condition-body">
        <strong>${h(label)}</strong> ${h(joiner)} ${value}
        <div class="muted-cell" style="margin-top:8px">${h(detail)}</div>
      </div>
      <div class="match-label">Matches</div>
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

function renderHistory() {
  const versions = [
    { version: 'v14', title: "Added rule 'Anti-spam basics'", meta: '8ordan M. · Today, 2:14 PM', current: true, ok: true },
    { version: 'v13', title: 'Loosened karma threshold to 50', meta: 'Priya T. · Yesterday, 6:02 PM' },
    { version: 'v12', title: 'Tried a regex on comment bodies (rolled back)', meta: 'Ullis K. · Wed, 11:48 AM', warn: true },
    { version: 'v11', title: "Added 'Require post flair'", meta: '8ordan M. · Tue, 9:21 AM' },
    { version: 'v10', title: "Onboarded 'No personal attacks' from template", meta: 'Priya T. · Mon, 4:55 PM' },
    { version: 'v9', title: 'Updated modmail copy', meta: '8ordan M. · Mon, 2:10 PM' },
  ];
  return `
    <div class="page-shell history-page">
      <div class="page-heading">
        <h1>Version history</h1>
        <p>Every save creates a new version. Roll back if something broke — your old config is one click away.</p>
      </div>
      <div class="history-layout">
        <aside class="version-list-card">
          <div class="version-list-head"><span>8 versions</span><span style="letter-spacing:0;text-transform:none">${icon('filter')} Filter</span></div>
          ${versions.map(function(item, index) {
            return `
              <div class="version-item ${index === 0 ? 'selected' : ''}">
                <div class="version-badges">
                  <span class="version-chip">${h(item.version)}</span>
                  ${item.current ? '<span class="version-chip brand">CURRENT</span>' : ''}
                  ${item.ok ? '<span style="color:var(--success);font-weight:800">' + icon('check-circle') + '</span>' : ''}
                  ${item.warn ? '<span style="color:var(--warning);font-weight:800">' + icon('alert-triangle') + '</span>' : ''}
                </div>
                <div class="version-title">${h(item.title)}</div>
                <div class="version-meta">${h(item.meta)}</div>
              </div>
            `;
          }).join('')}
        </aside>
        <section class="history-detail">
          <div class="history-detail-head">
            <div>
              <h2>v14 — Added rule 'Anti-spam basics'</h2>
              <div class="detail-meta">
                <span class="tiny-avatar">8M</span>
                <span>8ordan M. · Today, 2:14 PM</span>
                <span class="soft-pill">3 conditions</span>
                <span class="soft-pill">1 action</span>
              </div>
            </div>
            <button class="btn btn-secondary">${icon('diff')}Compare with v13</button>
          </div>
          <div class="change-card">
            <div class="change-head">
              <span>Changes from v13</span>
              <div class="tab-switch"><button class="active">Visual</button><button>YAML</button></div>
            </div>
            <div class="diff-visual">
              <h3>Anti-spam basics <span class="soft-pill" style="color:#166534;background:#dcfce7;border-radius:7px">APPUP</span></h3>
              <div class="diff-row"><span class="diff-label">WgUN</span><span><span class="green-code">item is comment</span></span></div>
              <div class="diff-row"><span class="diff-label">ANP</span><span><span class="green-code">body contains spam, scam, click here</span></span></div>
              <div class="diff-row"><span class="diff-label">ANP</span><span><span class="green-code">author age &lt; 30 days</span></span></div>
              <div class="diff-row"><span class="diff-label">TgUN</span><span><span class="green-code">remove + send modmail</span></span></div>
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
          <h2>r/ModQueueLab</h2>
          <p>5 mods · public. Sidebar and top navigation share the same avatar, count, and muted text tokens.</p>
          <button class="btn btn-secondary">Manage workspace</button>
        </article>
        <article class="panel settings-card">
          <div class="page-kicker">Deployment</div>
          <h2>AutoModerator wiki</h2>
          <p>Deploy writes generated YAML to <span class="mono">config/automoderator</span> through the existing Devvit integration.</p>
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
  if (action === 'resetDraft') {
    state.loading = true;
    state.dirty = false;
    state.notification = null;
    updateDirtyState();
    renderShell();
    requestRules();
  }
  if (action === 'useTemplate') useTemplate(el.dataset.template);
  if (action === 'goTemplates') setView('templates');
  if (action === 'goRules') setView('rules');
  if (action === 'editRule') {
    state.selected = Number(el.dataset.index);
    setView('builder');
  }
  if (action === 'deleteRule') {
    const index = Number(el.dataset.index);
    state.rules.splice(index, 1);
    state.selected = Math.min(index, state.rules.length - 1);
    markDirty();
    renderShell();
  }
  if (action === 'setAction') {
    const rule = selectedRule();
    if (!rule) return;
    rule.action = el.dataset.value;
    markDirty();
    renderShell();
  }
  if (action === 'runInlineTest') {
    const body = document.getElementById('inlineTestBody');
    state.sim.body = body ? body.value : '';
    state.sim.results = runSimulator(state.sim.contentType, state.sim.title, state.sim.body, state.sim.url);
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

function textareaField(label, key, value, hint) {
  return `
    <label class="field">
      <span class="label">${h(label)}</span>
      <textarea class="textarea mono" data-action="setArrayField" data-key="${h(key)}" placeholder="${h(hint)}">${h(value)}</textarea>
      <span class="hint">${h(hint)}</span>
    </label>
  `;
}

function nestedField(label, obj, key, value, placeholder) {
  return `
    <label class="field">
      <span class="label">${h(label)}</span>
      <input class="input mono" data-action="setNestedField" data-obj="${h(obj)}" data-key="${h(key)}" value="${h(value)}" placeholder="${h(placeholder)}">
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

  if (!conditions.length) return `${action} all ${type}.`;
  const shown = conditions.slice(0, 3).join(', ');
  const extra = conditions.length > 3 ? ` (+${conditions.length - 3} more)` : '';
  return `${action} ${type} where ${shown}${extra}.`;
}

function countRuleConditions(rule) {
  let count = 0;
  ['body (includes)', 'body (excludes)', 'title (includes)', 'url (includes)', 'body (regex)', 'link_flair_text (includes)'].forEach(function(key) {
    if (getArr(rule, key).length) count += 1;
  });
  if (rule.type) count += 1;
  if (rule.author && typeof rule.author === 'object') count += Object.keys(rule.author).length;
  return Math.max(count, 1);
}

function addCondition(target, values, label) {
  if (!values.length) return;
  target.push(`${label} "${values[0]}"${values.length > 1 ? ` or ${values.length - 1} more` : ''}`);
}

function runSimulator(contentType, title, body, url) {
  const bodyLow = (body || '').toLowerCase();
  const titleLow = (title || '').toLowerCase();
  const urlLow = (url || '').toLowerCase();

  return state.rules.map(function(rule, index) {
    const reasons = [];
    let fires = true;

    if (rule.type && rule.type !== contentType) {
      return { index, fires: false, action: rule.action, reasons: [{ status: 'fail', text: `Rule targets ${rule.type}, sample is ${contentType}` }] };
    }
    if (rule.type) reasons.push({ status: 'pass', text: `Type matches ${rule.type}` });

    checkIncludes(getArr(rule, 'body (includes)'), bodyLow, 'Body', reasons, function() { fires = false; });
    checkExcludes(getArr(rule, 'body (excludes)'), bodyLow, 'Body', reasons, function() { fires = false; });
    checkIncludes(getArr(rule, 'title (includes)'), titleLow, 'Title', reasons, function() { fires = false; });
    checkIncludes(getArr(rule, 'url (includes)'), urlLow, 'URL', reasons, function() { fires = false; });
    checkRegex(getArr(rule, 'body (regex)'), body || '', 'Body', reasons, function() { fires = false; });

    const author = rule.author;
    if (author && typeof author === 'object') {
      Object.keys(author).forEach(function(key) {
        reasons.push({ status: 'skip', text: `Author ${key.replace(/_/g, ' ')} requires Reddit account data` });
      });
    }
    if (!reasons.length) reasons.push({ status: 'pass', text: 'No conditions, matches all content' });
    return { index, fires, action: rule.action, reasons };
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
