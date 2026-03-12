/* ═══════════════════════════════════════════════
   VIRAI – script.js
   Frontend Logic & API Integration
═══════════════════════════════════════════════ */

const API = 'http://localhost:8000';

// ── STATE ──────────────────────────────────────
const state = {
  compounds: [],        // { name, mw, logp, hbd, hba, tpsa, admetScore, classification }
  currentCompound: null,
  currentADMET: null,
};

// ── CHART INSTANCES ────────────────────────────
let admetHistoryChart = null;
let distributionChart = null;
let admetRadarChart   = null;
let analyticsDistChart  = null;
let analyticsRankChart  = null;
let analyticsScatterChart = null;

// ── NAVIGATION ─────────────────────────────────
const pageTitles = {
  dashboard: ['Dashboard', 'Overview of your drug discovery pipeline'],
  search:    ['Compound Search', 'Fetch real molecular data from PubChem'],
  admet:     ['ADMET Analysis', 'Absorption, Distribution, Metabolism, Excretion & Toxicity'],
  screening: ['Virtual Screening', 'Rank and compare multiple compounds'],
  analytics: ['Analytics', 'Charts and insights across all analyzed compounds'],
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    switchPage(item.dataset.page);
  });
});

function switchPage(pageId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
  document.getElementById(`page-${pageId}`).classList.add('active');

  const [title, sub] = pageTitles[pageId];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSub').textContent   = sub;

  if (pageId === 'dashboard') refreshDashboard();
  if (pageId === 'analytics') refreshAnalytics();
}

// ── COMPOUND SEARCH ─────────────────────────────
document.getElementById('compoundInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchCompound();
});

function quickSearch(name) {
  document.getElementById('compoundInput').value = name;
  searchCompound();
}

async function searchCompound() {
  const name = document.getElementById('compoundInput').value.trim();
  if (!name) return;

  setSearchLoading(true);
  hideElement('searchError');
  hideElement('compoundResult');

  try {
    const res  = await fetch(`${API}/compound/${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Compound not found.');
    displayCompoundResult(data);
  } catch (err) {
    showError('searchError', `❌ ${err.message}`);
  } finally {
    setSearchLoading(false);
  }
}

function setSearchLoading(on) {
  document.getElementById('searchLoading').classList.toggle('hidden', !on);
  document.getElementById('searchBtn').disabled = on;
}

function displayCompoundResult(data) {
  state.currentCompound = data;

  document.getElementById('structureImg').src = data.image_url;
  document.getElementById('resultName').textContent = data.name;
  document.getElementById('resultCid').textContent  = data.cid || 'N/A';

  document.getElementById('resMolFormula').textContent = data.molecular_formula || 'N/A';
  document.getElementById('resMW').textContent    = data.molecular_weight ? `${data.molecular_weight} g/mol` : 'N/A';
  document.getElementById('resLogP').textContent  = data.logp ?? 'N/A';
  document.getElementById('resHBD').textContent   = data.hbd ?? 'N/A';
  document.getElementById('resHBA').textContent   = data.hba ?? 'N/A';
  document.getElementById('resTpsa').textContent  = data.tpsa ? `${data.tpsa} Å²` : 'N/A';
  document.getElementById('resSmiles').textContent = data.smiles || 'N/A';

  // Lipinski badges
  const checks = [
    { label: 'MW ≤ 500', pass: data.molecular_weight <= 500 },
    { label: 'LogP ≤ 5',  pass: data.logp <= 5 },
    { label: 'HBD ≤ 5',  pass: data.hbd <= 5 },
    { label: 'HBA ≤ 10', pass: data.hba <= 10 },
  ];
  const lip = document.getElementById('lipinskiCheck');
  lip.innerHTML = checks.map(c =>
    `<div class="lip-badge ${c.pass ? 'pass' : 'fail'}">
      ${c.pass ? '✓' : '✗'} ${c.label}
    </div>`
  ).join('');

  showElement('compoundResult');
}

// ── ADMET ANALYSIS ──────────────────────────────
async function runADMET() {
  if (!state.currentCompound) return;
  const c = state.currentCompound;

  switchPage('admet');

  hideElement('admetEmpty');
  hideElement('admetResult');

  try {
    const res  = await fetch(`${API}/admet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: c.name,
        logp: c.logp ?? 0,
        mw:   c.molecular_weight ?? 0,
        hbd:  c.hbd ?? 0,
        hba:  c.hba ?? 0,
        tpsa: c.tpsa ?? 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'ADMET failed.');
    state.currentADMET = { ...data, compound: c };
    displayADMET(data, c);
    storeCompound(c, data);
    refreshDashboard();
  } catch (err) {
    showElement('admetEmpty');
    showError('admetEmpty', err.message);
  }
}

function displayADMET(data, compound) {
  showElement('admetResult');

  // Score ring animation
  const arc = document.getElementById('scoreArc');
  const circumference = 314;
  const offset = circumference - (data.admet_score / 100) * circumference;
  setTimeout(() => { arc.style.strokeDashoffset = offset; }, 100);

  // Score color
  const colors = { Excellent: '#22c55e', Good: '#3b82f6', Moderate: '#f97316', Poor: '#ef4444' };
  arc.style.stroke = colors[data.classification] || '#22c55e';

  document.getElementById('admetScoreNum').textContent     = data.admet_score;
  document.getElementById('admetCompoundName').textContent = compound.name;

  const badge = document.getElementById('admetClassBadge');
  badge.textContent = data.classification;
  badge.className   = `admet-class-badge ${data.classification}`;

  // Component bars
  const compColors = {
    absorption:   '#22c55e',
    distribution: '#3b82f6',
    metabolism:   '#a855f7',
    excretion:    '#f97316',
    toxicity_risk:'#ef4444',
  };
  const compLabels = {
    absorption:   'Absorption',
    distribution: 'Distribution',
    metabolism:   'Metabolism',
    excretion:    'Excretion',
    toxicity_risk:'Toxicity Risk (lower=safer)',
  };

  const barsEl = document.getElementById('componentBars');
  barsEl.innerHTML = Object.entries(data.components).map(([key, val]) => `
    <div class="comp-bar-item">
      <div class="comp-bar-label">
        <span>${compLabels[key]}</span>
        <span>${val}</span>
      </div>
      <div class="comp-bar-outer">
        <div class="comp-bar-inner" style="width:${val}%; background:${compColors[key]}"></div>
      </div>
    </div>
  `).join('');

  // Radar chart
  if (admetRadarChart) admetRadarChart.destroy();
  const radarCtx = document.getElementById('admetRadarChart').getContext('2d');
  admetRadarChart = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: ['Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Safety'],
      datasets: [{
        label: compound.name,
        data: [
          data.components.absorption,
          data.components.distribution,
          data.components.metabolism,
          data.components.excretion,
          100 - data.components.toxicity_risk,
        ],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.15)',
        pointBackgroundColor: '#22c55e',
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0, max: 100,
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#4b6082', backdropColor: 'transparent', stepSize: 25 },
          pointLabels: { color: '#94a3b8', font: { family: 'DM Sans', size: 12 } },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
        },
      },
      plugins: { legend: { display: false } },
    },
  });

  // Lipinski rules checklist
  const rules = [
    { icon: '⚖️', label: 'Molecular Weight ≤ 500', value: `${compound.molecular_weight} g/mol`, pass: compound.molecular_weight <= 500 },
    { icon: '🔬', label: 'LogP ≤ 5',               value: compound.logp,                        pass: compound.logp <= 5 },
    { icon: '💧', label: 'H-Bond Donors ≤ 5',      value: compound.hbd,                         pass: compound.hbd <= 5 },
    { icon: '🧲', label: 'H-Bond Acceptors ≤ 10',  value: compound.hba,                         pass: compound.hba <= 10 },
    { icon: '🌐', label: 'TPSA ≤ 140 Å²',          value: `${compound.tpsa} Å²`,                pass: compound.tpsa <= 140 },
  ];
  document.getElementById('rulesChecklist').innerHTML = rules.map(r => `
    <div class="rule-item">
      <span class="rule-icon">${r.icon}</span>
      <span class="rule-label">${r.label}</span>
      <span class="rule-value">${r.value}</span>
      <span class="rule-status ${r.pass ? 'pass' : 'fail'}">${r.pass ? '✓ Pass' : '✗ Fail'}</span>
    </div>
  `).join('');
}

// ── STORE COMPOUND ──────────────────────────────
function storeCompound(compound, admet) {
  const existing = state.compounds.findIndex(c => c.name === compound.name);
  const entry = {
    name:  compound.name,
    mw:    compound.molecular_weight,
    logp:  compound.logp,
    hbd:   compound.hbd,
    hba:   compound.hba,
    tpsa:  compound.tpsa,
    admetScore:     admet.admet_score,
    classification: admet.classification,
  };
  if (existing >= 0) state.compounds[existing] = entry;
  else state.compounds.push(entry);
}

// ── DASHBOARD ──────────────────────────────────
function refreshDashboard() {
  const list = state.compounds;

  document.getElementById('totalAnalyzed').textContent = list.length;

  if (list.length === 0) {
    document.getElementById('avgAdmet').textContent      = '—';
    document.getElementById('bestCandidate').textContent = '—';
    document.getElementById('lipinskiRate').textContent  = '—';
  } else {
    const avg   = list.reduce((s, c) => s + c.admetScore, 0) / list.length;
    const best  = [...list].sort((a, b) => b.admetScore - a.admetScore)[0];
    const passing = list.filter(c => c.mw <= 500 && c.logp <= 5 && c.hbd <= 5 && c.hba <= 10).length;

    document.getElementById('avgAdmet').textContent      = avg.toFixed(1);
    document.getElementById('bestCandidate').textContent = best.name.charAt(0).toUpperCase() + best.name.slice(1);
    document.getElementById('lipinskiRate').textContent  = `${Math.round((passing / list.length) * 100)}%`;
  }

  // Recent table
  const tbody = document.getElementById('recentTableBody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No compounds analyzed yet. Start with Compound Search.</td></tr>';
  } else {
    tbody.innerHTML = [...list].reverse().slice(0, 10).map(c => `
      <tr>
        <td style="text-transform:capitalize;font-weight:600">${c.name}</td>
        <td>${c.mw} g/mol</td>
        <td>${c.logp}</td>
        <td><strong>${c.admetScore}</strong></td>
        <td><span class="badge ${c.classification}">${c.classification}</span></td>
        <td><button class="btn-ghost" onclick="reloadCompound('${c.name}')">View</button></td>
      </tr>
    `).join('');
  }

  // Charts
  renderDashboardCharts();
}

function renderDashboardCharts() {
  const list = state.compounds;
  const labels = list.map(c => c.name.charAt(0).toUpperCase() + c.name.slice(1));
  const scores = list.map(c => c.admetScore);

  // History bar
  if (admetHistoryChart) admetHistoryChart.destroy();
  const hCtx = document.getElementById('admetHistoryChart').getContext('2d');
  admetHistoryChart = new Chart(hCtx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No data'],
      datasets: [{
        label: 'ADMET Score',
        data: scores.length ? scores : [0],
        backgroundColor: scores.map(s => s > 80 ? 'rgba(34,197,94,0.7)' : s >= 60 ? 'rgba(59,130,246,0.7)' : s >= 40 ? 'rgba(249,115,22,0.7)' : 'rgba(239,68,68,0.7)'),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: chartDefaults({ yMax: 100, label: 'Score' }),
  });

  // Distribution donut
  const tiers = { Excellent: 0, Good: 0, Moderate: 0, Poor: 0 };
  list.forEach(c => tiers[c.classification]++);
  if (distributionChart) distributionChart.destroy();
  const dCtx = document.getElementById('distributionChart').getContext('2d');
  distributionChart = new Chart(dCtx, {
    type: 'doughnut',
    data: {
      labels: ['Excellent', 'Good', 'Moderate', 'Poor'],
      datasets: [{
        data: Object.values(tiers),
        backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(59,130,246,0.8)', 'rgba(249,115,22,0.8)', 'rgba(239,68,68,0.8)'],
        borderColor: '#111827',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { family: 'DM Sans', size: 11 } } },
      },
    },
  });
}

// ── ANALYTICS ──────────────────────────────────
function refreshAnalytics() {
  const list = state.compounds;
  if (list.length === 0) {
    showElement('analyticsEmpty');
    hideElement('analyticsContent');
    return;
  }
  hideElement('analyticsEmpty');
  showElement('analyticsContent');

  // Distribution histogram (buckets: 0-40, 40-60, 60-80, 80-100)
  const buckets = [0, 0, 0, 0];
  list.forEach(c => {
    if (c.admetScore < 40) buckets[0]++;
    else if (c.admetScore < 60) buckets[1]++;
    else if (c.admetScore < 80) buckets[2]++;
    else buckets[3]++;
  });
  if (analyticsDistChart) analyticsDistChart.destroy();
  analyticsDistChart = new Chart(document.getElementById('analyticsDistChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Poor (0–40)', 'Moderate (40–60)', 'Good (60–80)', 'Excellent (80–100)'],
      datasets: [{
        label: 'Compounds',
        data: buckets,
        backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(249,115,22,0.7)', 'rgba(59,130,246,0.7)', 'rgba(34,197,94,0.7)'],
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: chartDefaults({ label: 'Count', yMax: Math.max(...buckets) + 2 }),
  });

  // Top compounds (sorted)
  const sorted = [...list].sort((a, b) => b.admetScore - a.admetScore).slice(0, 8);
  if (analyticsRankChart) analyticsRankChart.destroy();
  analyticsRankChart = new Chart(document.getElementById('analyticsRankChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: sorted.map(c => c.name.charAt(0).toUpperCase() + c.name.slice(1)),
      datasets: [{
        label: 'ADMET Score',
        data: sorted.map(c => c.admetScore),
        backgroundColor: 'rgba(34,197,94,0.7)',
        borderRadius: 6,
        borderSkipped: false,
        indexAxis: 'y',
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, border: { color: 'transparent' } },
        y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'DM Sans' } }, border: { color: 'transparent' } },
      },
      plugins: { legend: { display: false } },
    },
  });

  // Scatter: LogP vs MW
  const scatterData = list.map(c => ({ x: c.logp, y: c.mw, label: c.name }));
  if (analyticsScatterChart) analyticsScatterChart.destroy();
  analyticsScatterChart = new Chart(document.getElementById('analyticsScatterChart').getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Compounds',
        data: scatterData,
        backgroundColor: list.map(c =>
          c.admetScore > 80 ? 'rgba(34,197,94,0.8)' :
          c.admetScore >= 60 ? 'rgba(59,130,246,0.8)' :
          c.admetScore >= 40 ? 'rgba(249,115,22,0.8)' : 'rgba(239,68,68,0.8)'
        ),
        pointRadius: 7,
        pointHoverRadius: 10,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: 'LogP', color: '#94a3b8', font: { family: 'DM Sans' } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' },
          border: { color: 'transparent' },
        },
        y: {
          title: { display: true, text: 'Molecular Weight (g/mol)', color: '#94a3b8', font: { family: 'DM Sans' } },
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8' },
          border: { color: 'transparent' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.raw.label}: LogP=${ctx.raw.x}, MW=${ctx.raw.y}`,
          },
        },
      },
    },
  });
}

// ── VIRTUAL SCREENING ──────────────────────────
async function runScreening() {
  const raw = document.getElementById('screeningInput').value.trim();
  if (!raw) return;
  const names = [...new Set(raw.split('\n').map(n => n.trim()).filter(Boolean))];
  if (names.length === 0) return;

  document.getElementById('screeningBtn').disabled = true;
  showElement('screeningProgress');
  hideElement('screeningTable');
  hideElement('screeningEmpty');

  const results = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const pct  = Math.round(((i + 1) / names.length) * 100);
    document.getElementById('screeningProgressBar').style.width  = `${pct}%`;
    document.getElementById('screeningProgressLabel').textContent = `Processing ${name} (${i + 1}/${names.length})…`;

    try {
      const compRes  = await fetch(`${API}/compound/${encodeURIComponent(name)}`);
      const compData = await compRes.json();
      if (!compRes.ok) { results.push({ name, error: compData.detail }); continue; }

      const admetRes  = await fetch(`${API}/admet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: compData.name,
          logp: compData.logp ?? 0,
          mw:   compData.molecular_weight ?? 0,
          hbd:  compData.hbd ?? 0,
          hba:  compData.hba ?? 0,
          tpsa: compData.tpsa ?? 0,
        }),
      });
      const admetData = await admetRes.json();
      results.push({ ...compData, ...admetData });
      storeCompound(compData, admetData);
    } catch {
      results.push({ name, error: 'Network error' });
    }
  }

  document.getElementById('screeningBtn').disabled = false;
  hideElement('screeningProgress');
  renderScreeningTable(results);
  refreshDashboard();
}

function renderScreeningTable(results) {
  const valid  = results.filter(r => !r.error).sort((a, b) => b.admet_score - a.admet_score);
  const errors = results.filter(r => r.error);

  if (valid.length === 0 && errors.length > 0) {
    document.getElementById('screeningEmpty').textContent = `All compounds failed: ${errors.map(e => e.name).join(', ')}`;
    showElement('screeningEmpty');
    return;
  }

  showElement('screeningTable');

  const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

  document.getElementById('screeningTableBody').innerHTML = valid.map((c, i) => `
    <tr>
      <td><span class="rank-num ${rankClass(i)}">${i + 1}</span></td>
      <td style="text-transform:capitalize;font-weight:600">${c.name}</td>
      <td>${c.molecular_weight} g/mol</td>
      <td>${c.logp}</td>
      <td>${c.tpsa}</td>
      <td><strong>${c.admet_score}</strong></td>
      <td><span class="badge ${c.classification}">${c.classification}</span></td>
    </tr>
  `).join('') + errors.map(e => `
    <tr>
      <td>—</td>
      <td style="text-transform:capitalize">${e.name}</td>
      <td colspan="5" style="color:#f87171;font-size:12px">⚠ ${e.error}</td>
    </tr>
  `).join('');
}

// ── RELOAD FROM DASHBOARD ───────────────────────
async function reloadCompound(name) {
  document.getElementById('compoundInput').value = name;
  switchPage('search');
  searchCompound();
}

// ── CHART DEFAULTS ──────────────────────────────
function chartDefaults({ yMax = null, label = '' } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'DM Sans', size: 11 } },
        border: { color: 'transparent' },
      },
      y: {
        max: yMax,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'DM Sans', size: 11 } },
        border: { color: 'transparent' },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#e5e7eb',
        bodyColor: '#94a3b8',
        borderColor: '#374151',
        borderWidth: 1,
      },
    },
  };
}

// ── UTILS ───────────────────────────────────────
function showElement(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hideElement(id) { document.getElementById(id)?.classList.add('hidden'); }
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

// ── INIT ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refreshDashboard();

  // Health check
  fetch(`${API}/health`)
    .then(r => r.json())
    .then(d => {
      if (d.status !== 'ok') console.warn('Backend not healthy');
    })
    .catch(() => {
      document.querySelector('.api-badge').style.background = 'rgba(239,68,68,0.1)';
      document.querySelector('.api-badge').style.borderColor = 'rgba(239,68,68,0.3)';
      document.querySelector('.api-badge').style.color = '#f87171';
      document.querySelector('.api-badge').textContent = '⚠ Backend Offline';
    });
});
