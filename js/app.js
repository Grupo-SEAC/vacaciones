/* === app.js — Lógica principal (empleado + utilidades) === */

// ── Estado global ──────────────────────────────────────────
let currentEmployee = null;
let allVacaciones   = [];
let selectedWeeks   = [];   // índices de semanas seleccionadas (0..N)
let semanas         = [];   // array de {inicio: Date, fin: Date}
let confirmando     = false; // true solo mientras se está enviando la solicitud

// ── Inicialización ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Leer tema guardado
  if (localStorage.getItem('seac-theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }

  semanas = getWeeks(CONFIG.semanasAdelante);

  // Poblar dropdown de empleados
  const sel = document.getElementById('selectEmpleado');
  EMPLEADOS.forEach(nombre => {
    const opt = document.createElement('option');
    opt.value = nombre;
    opt.textContent = nombre;
    sel.appendChild(opt);
  });

  // Restaurar sesión desde sessionStorage
  const saved = sessionStorage.getItem('vac-empleado');
  if (saved && EMPLEADOS.includes(saved)) {
    currentEmployee = saved;
    showScreen('screen-empleado');
    initEmpleadoView();
  } else {
    showScreen('screen-login');
  }

  // Bind eventos de login
  document.getElementById('btnEntrar').addEventListener('click', handleLogin);
  document.getElementById('linkAdmin').addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('screen-admin-login');
    document.getElementById('inputAdminPass').value = '';
    document.getElementById('loginAdminError').classList.remove('visible');
  });

  // Toggle dark mode
  document.querySelectorAll('.btn-theme').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  // Botones salir
  document.getElementById('btnSalirEmpleado').addEventListener('click', salir);
  document.getElementById('btnSalirAdmin').addEventListener('click', salirAdmin);

  // Admin login form
  document.getElementById('btnAdminEntrar').addEventListener('click', handleAdminLogin);
  document.getElementById('inputAdminPass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdminLogin();
  });
  document.getElementById('linkVolverLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('screen-login');
  });
});

// ── Pantallas ──────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Tema ───────────────────────────────────────────────────
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('seac-theme', isDark ? 'dark' : 'light');
}

// ── Login empleado ─────────────────────────────────────────
function handleLogin() {
  const sel = document.getElementById('selectEmpleado');
  const nombre = sel.value;
  if (!nombre) return;
  currentEmployee = nombre;
  sessionStorage.setItem('vac-empleado', nombre);
  showScreen('screen-empleado');
  initEmpleadoView();
}

// ── Salir ──────────────────────────────────────────────────
function salir() {
  sessionStorage.removeItem('vac-empleado');
  currentEmployee = null;
  selectedWeeks = [];
  allVacaciones = [];
  showScreen('screen-login');
}

function salirAdmin() {
  sessionStorage.removeItem('vac-admin');
  allVacaciones = [];
  showScreen('screen-login');
}

// ── Vista empleado ─────────────────────────────────────────
function initEmpleadoView() {
  document.getElementById('headerNombreEmpleado').textContent = currentEmployee;
  setupTabs('tabsEmpleado', 'panelSolicitar');
  loadVacacionesYRenderEmpleado();
}

async function loadVacacionesYRenderEmpleado() {
  renderSolicitarLoading();
  renderMisSolicitudesLoading();
  try {
    allVacaciones = await fetchVacaciones();
  } catch (e) {
    renderSolicitarError(e.message);
    return;
  }
  selectedWeeks = [];
  confirmando = false;
  renderSolicitar();
  renderMisSolicitudes();
}

// ── Fetch ──────────────────────────────────────────────────
async function fetchVacaciones() {
  const url = CONFIG.webhookBase + CONFIG.webhookListar;
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  if (!text || !text.trim()) return [];
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : (data.vacaciones || []);
}

// ── Semanas ────────────────────────────────────────────────
function getWeeks(n) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay(); // 0=Dom, 1=Lun...
  let startMonday;
  if (day === 1) {
    startMonday = new Date(today);
  } else {
    startMonday = new Date(today);
    const diff = (8 - day) % 7 || 7;
    startMonday.setDate(today.getDate() + diff);
  }
  const weeks = [];
  for (let i = 0; i < n; i++) {
    const inicio = new Date(startMonday);
    inicio.setDate(startMonday.getDate() + i * 7);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 6);
    weeks.push({ inicio, fin });
  }
  return weeks;
}

function isoDate(d) {
  return d.toISOString().split('T')[0];
}

function formatDate(d) {
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatWeekRange(inicio, fin) {
  if (inicio.getFullYear() === fin.getFullYear()) {
    if (inicio.getMonth() === fin.getMonth()) {
      return `${inicio.getDate()} – ${formatDate(fin)} ${fin.getFullYear()}`;
    }
    return `${formatDate(inicio)} – ${formatDate(fin)} ${fin.getFullYear()}`;
  }
  return `${formatDate(inicio)} ${inicio.getFullYear()} – ${formatDate(fin)} ${fin.getFullYear()}`;
}

// Determina si una vacación ocupa la semana dada
function vacacionEnSemana(vac, semana) {
  const vi = vac.semana_inicio;
  const vf = vac.semana_fin;
  const si = isoDate(semana.inicio);
  const sf = isoDate(semana.fin);
  // overlap: inicio1 <= fin2 && fin1 >= inicio2
  return vi <= sf && vf >= si;
}

// ── Render: Solicitar ──────────────────────────────────────
function renderSolicitarLoading() {
  const p = document.getElementById('panelSolicitar');
  p.innerHTML = `<div class="loading-state"><div class="spinner"></div><div>Cargando disponibilidad…</div></div>`;
}

function renderSolicitarError(msg) {
  const p = document.getElementById('panelSolicitar');
  const detalle = msg ? `<br><small style="opacity:0.7">${msg}</small>` : '';
  p.innerHTML = `<div class="error-state visible">No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.${detalle}</div>`;
}

function apellido(nombreCompleto) {
  const partes = nombreCompleto.trim().split(' ');
  return partes[partes.length - 1];
}

function renderSolicitar() {
  const p = document.getElementById('panelSolicitar');

  const otrosVacaciones = allVacaciones;

  // Agrupar semanas por mes
  const meses = [];
  let mesActual = null;
  semanas.forEach((sem, i) => {
    const key = `${sem.inicio.getFullYear()}-${sem.inicio.getMonth()}`;
    if (!mesActual || mesActual.key !== key) {
      mesActual = { key, label: sem.inicio.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }), semanas: [] };
      meses.push(mesActual);
    }
    mesActual.semanas.push({ sem, i });
  });

  let gridHtml = `<div class="week-list" id="weekGrid">`;

  meses.forEach(mes => {
    gridHtml += `<div class="week-month-label">${mes.label.charAt(0).toUpperCase() + mes.label.slice(1)}</div>`;

    mes.semanas.forEach(({ sem, i }) => {
      const isSelected = selectedWeeks.includes(i);
      const range = formatWeekRange(sem.inicio, sem.fin);

      const ocupados = otrosVacaciones.filter(v => vacacionEnSemana(v, sem));
      const badgesHtml = ocupados.map(v => {
        const cls = v.estado === 'aprobada' ? 'badge-ocupado' : 'badge-pendiente-otro';
        return `<span class="${cls}">${apellido(v.empleado)}</span>`;
      }).join('');

      gridHtml += `
        <button class="week-row${isSelected ? ' week-row-selected' : ''}" data-week="${i}" onclick="handleWeekClick(${i})">
          <div class="week-row-check">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="week-row-range">${range}</div>
          <div class="week-row-names">${badgesHtml || '<span class="week-row-libre">Libre</span>'}</div>
        </button>`;
    });
  });

  gridHtml += `</div>`;

  let confirmHtml = `<div class="confirm-panel${confirmando ? ' visible' : ''}" id="confirmPanel">
    <div class="confirm-panel-info">
      <div class="confirm-panel-title">Solicitud de vacaciones</div>
      <div class="confirm-panel-dates" id="confirmDates"></div>
    </div>
    <div class="confirm-panel-actions">
      <button class="btn-confirm" id="btnConfirmarSolicitud" onclick="confirmarSolicitud()">Confirmar</button>
      <button class="btn-cancel-sel" onclick="cancelarSeleccion()">Cancelar</button>
    </div>
  </div>`;

  let errorHtml = `<div class="error-state" id="errorSolicitar"></div>`;

  let hintHtml = `<p class="hint-text">Seleccioná 1 o 2 semanas consecutivas. Verde = vacaciones aprobadas · Naranja = solicitud pendiente de aprobación.</p>`;

  p.innerHTML = errorHtml + gridHtml + hintHtml;

  // El confirm panel vive en el body para que position:fixed funcione correctamente
  let existingPanel = document.getElementById('confirmPanel');
  if (existingPanel) existingPanel.remove();
  const panelEl = document.createElement('div');
  panelEl.innerHTML = confirmHtml;
  document.body.appendChild(panelEl.firstElementChild);

  if (confirmando) updateConfirmPanel();
}

function handleWeekClick(weekIndex) {
  if (confirmando) return;

  if (selectedWeeks.includes(weekIndex)) {
    // Deseleccionar
    selectedWeeks = selectedWeeks.filter(w => w !== weekIndex);
  } else if (selectedWeeks.length === 0) {
    selectedWeeks = [weekIndex];
  } else if (selectedWeeks.length === 1) {
    const existing = selectedWeeks[0];
    if (Math.abs(existing - weekIndex) === 1) {
      selectedWeeks = [Math.min(existing, weekIndex), Math.max(existing, weekIndex)];
    } else {
      selectedWeeks = [weekIndex];
    }
  } else {
    // Ya hay 2 seleccionadas: reemplazar
    selectedWeeks = [weekIndex];
  }

  updateWeekGrid();
}

function updateWeekGrid() {
  document.querySelectorAll('.week-row[data-week]').forEach(card => {
    if (selectedWeeks.includes(parseInt(card.dataset.week))) {
      card.classList.add('week-row-selected');
    } else {
      card.classList.remove('week-row-selected');
    }
  });

  if (selectedWeeks.length > 0 && !confirmando) {
    showConfirmPanel();
  } else if (selectedWeeks.length === 0) {
    hideConfirmPanel();
  }
}

function showConfirmPanel() {
  const panel = document.getElementById('confirmPanel');
  if (panel) {
    panel.classList.add('visible');
    updateConfirmPanel();
  }
}

function hideConfirmPanel() {
  confirmando = false;
  const panel = document.getElementById('confirmPanel');
  if (panel) panel.classList.remove('visible');
}

function updateConfirmPanel() {
  const datesEl = document.getElementById('confirmDates');
  if (!datesEl || selectedWeeks.length === 0) return;

  const first = semanas[Math.min(...selectedWeeks)];
  const last  = semanas[Math.max(...selectedWeeks)];
  datesEl.textContent = `Del ${formatDate(first.inicio)} al ${formatDate(last.fin)} ${last.fin.getFullYear()}`;
}

function cancelarSeleccion() {
  selectedWeeks = [];
  confirmando = false;
  hideConfirmPanel();
  updateWeekGrid();
}

async function confirmarSolicitud() {
  if (selectedWeeks.length === 0) return;
  confirmando = true;

  const btn = document.getElementById('btnConfirmarSolicitud');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-sm"></span> Enviando…`;

  const first = semanas[Math.min(...selectedWeeks)];
  const last  = semanas[Math.max(...selectedWeeks)];

  const body = {
    empleado: currentEmployee,
    semana_inicio: isoDate(first.inicio),
    semana_fin: isoDate(last.fin),
    fecha_solicitud: isoDate(new Date())
  };

  try {
    const url = CONFIG.webhookBase + CONFIG.webhookSolicitar;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    showToast('¡Solicitud enviada! Vas a recibir confirmación cuando sea aprobada.', 'success');
    selectedWeeks = [];
    confirmando = false;
    await loadVacacionesYRenderEmpleado();
    // Ir a tab "Mis solicitudes"
    switchTab('tabsEmpleado', 'panelMisSolicitudes');
  } catch (e) {
    const errEl = document.getElementById('errorSolicitar');
    if (errEl) {
      errEl.textContent = 'No se pudo enviar la solicitud. Intentá de nuevo.';
      errEl.classList.add('visible');
    }
    btn.disabled = false;
    btn.innerHTML = 'Confirmar solicitud';
    confirmando = false;
  }
}

// ── Render: Mis solicitudes ────────────────────────────────
function renderMisSolicitudesLoading() {
  const p = document.getElementById('panelMisSolicitudes');
  p.innerHTML = `<div class="loading-state"><div class="spinner"></div><div>Cargando solicitudes…</div></div>`;
}

function renderMisSolicitudes() {
  const p = document.getElementById('panelMisSolicitudes');
  const misSolicitudes = allVacaciones
    .filter(v => v.empleado === currentEmployee)
    .sort((a, b) => b.fecha_solicitud.localeCompare(a.fecha_solicitud));

  if (misSolicitudes.length === 0) {
    p.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🌴</span>
        <div class="empty-state-title">No tenés solicitudes todavía</div>
        <div>Usá la pestaña "Solicitar" para pedir tus vacaciones.</div>
      </div>`;
    return;
  }

  const rows = misSolicitudes.map(v => {
    const badgeClass = { aprobada: 'badge-aprobada', pendiente: 'badge-pendiente', rechazada: 'badge-rechazada' }[v.estado] || 'badge-pendiente';
    const periodo = formatRangeSolicitud(v.semana_inicio, v.semana_fin);
    const fecha = formatFechaSolicitud(v.fecha_solicitud);
    return `<tr>
      <td>${periodo}</td>
      <td>${fecha}</td>
      <td><span class="badge-estado ${badgeClass}">${v.estado}</span></td>
    </tr>`;
  }).join('');

  p.innerHTML = `
    <div class="seac-tabla-wrapper">
      <table class="seac-tabla">
        <thead>
          <tr>
            <th>Período</th>
            <th>Fecha de solicitud</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── Helpers de formato ─────────────────────────────────────
function formatRangeSolicitud(ini, fin) {
  // ini y fin son strings "2026-07-06"
  const d1 = new Date(ini + 'T00:00:00');
  const d2 = new Date(fin + 'T00:00:00');
  return `${formatDate(d1)} – ${formatDate(d2)} ${d2.getFullYear()}`;
}

function formatFechaSolicitud(fecha) {
  const d = new Date(fecha + 'T00:00:00');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Tabs ───────────────────────────────────────────────────
function setupTabs(containerId, defaultPanel) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const tabs = container.querySelectorAll('.seac-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const panelId = tab.dataset.tab;
      switchTab(containerId, panelId);
    });
  });
  if (defaultPanel) switchTab(containerId, defaultPanel, false);
}

function switchTab(containerId, panelId, animate = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Update tab buttons
  container.querySelectorAll('.seac-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === panelId);
  });

  // Update panels (look in entire document for the panel)
  const allPanels = document.querySelectorAll('.seac-tab-panel');
  allPanels.forEach(panel => {
    const isTarget = panel.id === panelId;
    panel.classList.toggle('active', isTarget);
    if (isTarget && animate) {
      panel.classList.remove('seac-panel-entering');
      void panel.offsetWidth;
      panel.classList.add('seac-panel-entering');
    }
  });
}

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
