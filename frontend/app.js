const API = 'http://localhost:3001/api/v1';
let selectedFile = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function showMain(name, btn) {
  ['food', 'health', 'history'].forEach(p =>
    document.getElementById(p + '-panel').style.display = p === name ? 'block' : 'none'
  );
  document.querySelectorAll('.main-tabs .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (name === 'history') loadHistory('food', document.querySelector('#history-panel .tab'));
}

function setMsg(id, text, type = '') {
  const el = document.getElementById(id);
  el.className = 'msg' + (type ? ' ' + type : '');
  el.innerHTML = text;
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  let res;
  try {
    res = await fetch(API + path, { ...opts, headers });
  } catch (e) {
    throw new Error('Cannot reach backend at ' + API + ' — is the server running on port 3000?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
  return data;
}

// ── File / Drag-drop ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('drop-zone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) loadPreview(e.dataTransfer.files[0]); });
});

function onFileSelect(e) { if (e.target.files[0]) loadPreview(e.target.files[0]); }

function loadPreview(file) {
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = document.getElementById('preview-img');
    img.src = ev.target.result;
    img.style.display = 'block';
    document.getElementById('preview-wrap').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Food Scan ─────────────────────────────────────────────────────────────────
async function scanFood() {
  if (!selectedFile) { setMsg('food-msg', 'Please select an image first.', 'error'); return; }
  const btn = document.getElementById('scan-btn');
  btn.disabled = true;
  setMsg('food-msg', '<span class="spinner"></span>Analysing with Gemini AI...', 'loading');
  document.getElementById('food-result').innerHTML = '';
  try {
    const image_base64 = await fileToBase64(selectedFile);
    const body = {
      image_base64,
      mime_type: selectedFile.type,
      goals: document.getElementById('food-goals').value.trim().split(',').map(s => s.trim()).filter(Boolean),
    };
    const diet = document.getElementById('food-diet').value.trim();
    if (diet) body.dietary_preferences = diet;
    const data = await api('/ai/food', { method: 'POST', body: JSON.stringify(body) });
    setMsg('food-msg', '✅ Scan complete', 'success');
    renderFoodResult(data.result);
  } catch (e) {
    setMsg('food-msg', e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function renderFoodResult(r) {
  if (!r) return;
  const el = document.getElementById('food-result');
  const n = r.nutrition || {};
  const nutFields = [
    ['calories_kcal','Calories','kcal'],['protein_g','Protein','g'],
    ['carbohydrates_g','Carbs','g'],['fat_g','Fat','g'],
    ['fibre_g','Fibre','g'],['sugar_g','Sugar','g'],['sodium_mg','Sodium','mg']
  ];
  const nutHTML = nutFields.map(([k, label, unit]) =>
    `<div class="nutrition-item"><div class="val">${n[k] != null ? n[k] : '—'}</div><div class="lbl">${label}<br/><small>${unit}</small></div></div>`
  ).join('');

  const items = (r.identified_items || []).map(i =>
    `<span class="badge badge-purple">${i.name}${i.estimated_portion ? ' · ' + i.estimated_portion : ''} (${i.identification_confidence})</span>`
  ).join('') || '<span style="color:#555">None identified</span>';

  const recs = (r.recommendations || []).map(rec =>
    `<div class="rec-item"><div class="rec-cat">${rec.category}</div><div class="rec-text">${rec.suggestion}</div></div>`
  ).join('') || '<p class="hint">No recommendations.</p>';

  const lims = [...(r.limitations || []), ...(r.assumptions || [])].map(l => `<li>${l}</li>`).join('') || '<li>None noted.</li>';

  el.innerHTML = `
    <div class="result-card">
      <h3>Image Analysis</h3>
      <div style="margin-bottom:10px">
        <span class="badge badge-blue">${r.image_category || 'unknown'}</span>
        <span class="badge ${r.image_quality === 'poor' ? 'badge-red' : 'badge-green'}">${r.image_quality || 'ok'}</span>
        <span class="badge ${r.nutrition_source === 'label_derived' ? 'badge-green' : 'badge-yellow'}">${r.nutrition_source === 'label_derived' ? 'Label derived' : 'AI estimate'}</span>
      </div>
      <div>${items}</div>
    </div>
    <div class="result-card"><h3>Nutrition</h3><div class="nutrition-grid">${nutHTML}</div></div>
    ${r.allergens?.length ? `<div class="result-card"><h3>Allergens</h3>${r.allergens.map(a => `<span class="badge badge-red">${a}</span>`).join('')}</div>` : ''}
    <div class="result-card"><h3>Recommendations</h3>${recs}</div>
    <div class="result-card"><h3>Limitations &amp; Assumptions</h3><ul style="padding-left:18px;font-size:0.85rem;color:#666;line-height:1.8">${lims}</ul></div>`;
}

// ── Health Analysis ───────────────────────────────────────────────────────────
async function analyseHealth() {
  const btn = document.getElementById('health-btn');
  btn.disabled = true;
  setMsg('health-msg', '<span class="spinner"></span>Analysing with Gemini AI...', 'loading');
  document.getElementById('health-result').innerHTML = '';
  try {
    const num = id => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? undefined : v; };
    const str = id => document.getElementById(id).value.trim() || undefined;
    const int = id => { const v = parseInt(document.getElementById(id).value); return isNaN(v) ? undefined : v; };
    const condRaw = document.getElementById('h-conditions').value.trim();
    const goalsRaw = document.getElementById('h-goals').value.trim();
    const body = {
      medical_conditions: condRaw ? condRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      goals: goalsRaw ? goalsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
      language_code: 'en',
    };
    if (int('h-age')) body.age = int('h-age');
    if (str('h-sex')) body.sex = str('h-sex');
    if (num('h-height')) body.height_cm = num('h-height');
    if (num('h-weight')) body.weight_kg = num('h-weight');
    if (num('h-sleep')) body.sleep_hours = num('h-sleep');
    if (num('h-water')) body.water_intake_litres = num('h-water');
    if (str('h-activity')) body.activity_level = str('h-activity');
    if (str('h-sleep-q')) body.sleep_quality = str('h-sleep-q');
    if (int('h-stress')) body.stress_level = int('h-stress');
    if (int('h-energy')) body.energy_level = int('h-energy');
    if (str('h-diet')) body.diet_preference = str('h-diet');
    if (str('h-notes')) body.notes = str('h-notes');

    const data = await api('/ai/health', { method: 'POST', body: JSON.stringify(body) });
    setMsg('health-msg', '✅ Analysis complete', 'success');
    renderHealthResult(data.result);
  } catch (e) {
    setMsg('health-msg', e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function renderHealthResult(r) {
  if (!r) return;
  const el = document.getElementById('health-result');
  const bmiHTML = r.bmi ? `
    <div class="bmi-box">
      <div class="bmi-val">${r.bmi.value}</div>
      <div class="bmi-info"><div class="cat">${r.bmi.category}</div><div class="note">${r.bmi.note || ''}</div></div>
    </div>` : '';

  const obs = (r.observations || []).map(o =>
    `<div class="obs-item"><div class="obs-cat">${o.category}</div><div class="obs-text">${o.observation}</div><div class="obs-basis">Source: ${o.basis}</div></div>`
  ).join('') || '<p class="hint">No observations.</p>';

  const recs = (r.recommendations || []).map(rec =>
    `<div class="rec-item"><div class="rec-cat">${rec.category}</div><div class="rec-text">${rec.suggestion}${rec.reasoning ? `<br/><small style="color:#555">${rec.reasoning}</small>` : ''}</div></div>`
  ).join('') || '<p class="hint">No recommendations.</p>';

  const pos = (r.positive_habits || []).map(h => `<span class="badge badge-green">${h}</span>`).join('') || '<span style="color:#555">None noted</span>';
  const areas = (r.areas_for_improvement || []).map(a => `<span class="badge badge-yellow">${a}</span>`).join('') || '<span style="color:#555">None noted</span>';
  const lims = [...(r.missing_information || []), ...(r.limitations || [])].map(l => `<li>${l}</li>`).join('');

  el.innerHTML = `
    <div class="result-card"><h3>Summary</h3>${bmiHTML}<p style="font-size:0.92rem;line-height:1.7;color:#c8c8e8">${r.summary || ''}</p></div>
    <div class="result-card"><h3>Observations</h3>${obs}</div>
    <div class="result-card">
      <h3>Positive Habits</h3><div style="margin-bottom:14px">${pos}</div>
      <h3>Areas for Improvement</h3><div>${areas}</div>
    </div>
    <div class="result-card"><h3>Recommendations</h3>${recs}</div>
    ${lims ? `<div class="result-card"><h3>Limitations</h3><ul style="padding-left:18px;font-size:0.85rem;color:#666;line-height:1.8">${lims}</ul></div>` : ''}`;
}

// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory(type, btn) {
  document.querySelectorAll('#history-panel .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('history-list');
  el.innerHTML = '<p class="msg loading"><span class="spinner"></span>Loading...</p>';
  try {
    const data = await api(type === 'food' ? '/ai/food' : '/ai/health');
    if (!data.length) { el.innerHTML = '<p class="hint" style="padding:12px">No records found.</p>'; return; }
    el.innerHTML = data.map(item => `
      <div class="history-item" onclick="loadHistoryItem('${type}','${item.id}')">
        <div>
          <div style="font-size:0.9rem;font-weight:600">${type === 'food' ? '🍱 Food Scan' : '❤️ Health Analysis'}</div>
          <div class="hi-id">${item.id}</div>
        </div>
        <div style="text-align:right">
          <span class="badge ${item.status === 'completed' ? 'badge-green' : 'badge-red'}">${item.status}</span>
          <div class="hi-date">${new Date(item.created_at).toLocaleString()}</div>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<p class="msg error">${e.message}</p>`;
  }
}

async function loadHistoryItem(type, id) {
  try {
    const data = await api(type === 'food' ? `/ai/food/${id}` : `/ai/health/${id}`);
    if (type === 'food') {
      showMain('food', document.querySelectorAll('.main-tabs .tab')[0]);
      renderFoodResult(data.result);
      setMsg('food-msg', '✅ Loaded from history', 'success');
    } else {
      showMain('health', document.querySelectorAll('.main-tabs .tab')[1]);
      renderHealthResult(data.result);
      setMsg('health-msg', '✅ Loaded from history', 'success');
    }
  } catch (e) {
    document.getElementById('history-list').innerHTML += `<p class="msg error">${e.message}</p>`;
  }
}
