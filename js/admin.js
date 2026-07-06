/* === admin.js — Panel de administración === */

// ── Admin login ────────────────────────────────────────────
function handleAdminLogin() {
  const input = document.getElementById('inputAdminPass');
  const error = document.getElementById('loginAdminError');

  if (input.value === CONFIG.adminPassword) {
    sessionStorage.setItem('vac-admin', '1');
    error.classList.remove('visible');
    showScreen('screen-admin');
    initAdminView();
  } else {
    error.textContent = 'Contraseña incorrecta.';
    error.classList.add('visible');
    input.value = '';
    input.focus();
  }
}

// ── Inicializar vista admin ────────────────────────────────
function initAdminView() {
  setupTabs('tabsAdmin', 'panelPendientes');
  loadVacacionesAdmin();
}

async function loadVacacionesAdmin() {
  renderPendientesLoading();
  renderCalendarioLoading();
  try {
    allVacaciones = await fetchVacaciones();
  } catch (e) {
    document.getElementById('panelPendientes').innerHTML =
      `<div class="error-state visible">No se pudo conectar con el servidor.</div>`;
    return;
  }
  renderPendientes();
  renderCalendario();
  renderEmpleadosAdmin();
}

// ── Pendientes ─────────────────────────────────────────────
function renderPendientesLoading() {
  document.getElementById('panelPendientes').innerHTML =
    `<div class="loading-state"><div class="spinner"></div><div>Cargando solicitudes…</div></div>`;
}

function renderPendientes() {
  const p = document.getElementById('panelPendientes');
  const pendientes = allVacaciones
    .filter(v => v.estado === 'pendiente')
    .sort((a, b) => a.fecha_solicitud.localeCompare(b.fecha_solicitud));

  if (pendientes.length === 0) {
    p.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">✅</span>
        <div class="empty-state-title">Todo al día</div>
        <div>No hay solicitudes pendientes de aprobación.</div>
      </div>`;
    return;
  }

  const rows = pendientes.map(v => {
    const periodo = formatRangeSolicitud(v.semana_inicio, v.semana_fin);
    const fecha   = formatFechaSolicitud(v.fecha_solicitud);
    return `<tr id="row-${v.id}">
      <td><strong>${v.empleado}</strong></td>
      <td>${periodo}</td>
      <td>${fecha}</td>
      <td>
        <div style="display:flex;gap:6px;" id="actions-${v.id}">
          <button class="btn-aprobar" onclick="iniciarAccion('${v.id}', 'aprobada')">✓ Aprobar</button>
          <button class="btn-rechazar" onclick="iniciarAccion('${v.id}', 'rechazada')">✗ Rechazar</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  p.innerHTML = `
    <div class="seac-tabla-wrapper">
      <table class="seac-tabla">
        <thead>
          <tr>
            <th>Empleado</th>
            <th>Período solicitado</th>
            <th>Fecha solicitud</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function iniciarAccion(id, estado) {
  const actionsDiv = document.getElementById(`actions-${id}`);
  if (!actionsDiv) return;

  const label = estado === 'aprobada' ? 'aprobar' : 'rechazar';
  actionsDiv.innerHTML = `
    <div class="inline-confirm">
      <strong>¿${label.charAt(0).toUpperCase() + label.slice(1)}?</strong>
      <button class="btn-yes" onclick="ejecutarAccion('${id}', '${estado}')">Sí</button>
      <button class="btn-no" onclick="cancelarAccion('${id}')">No</button>
    </div>`;
}

function cancelarAccion(id) {
  const actionsDiv = document.getElementById(`actions-${id}`);
  if (!actionsDiv) return;
  actionsDiv.innerHTML = `
    <button class="btn-aprobar" onclick="iniciarAccion('${id}', 'aprobada')">✓ Aprobar</button>
    <button class="btn-rechazar" onclick="iniciarAccion('${id}', 'rechazada')">✗ Rechazar</button>`;
}

async function ejecutarAccion(id, estado) {
  const actionsDiv = document.getElementById(`actions-${id}`);
  if (actionsDiv) {
    actionsDiv.innerHTML = `<div class="loading-state" style="padding:4px 0;"><div class="spinner-sm"></div></div>`;
  }

  try {
    const url = CONFIG.webhookBase + CONFIG.webhookActualizar;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const verb = estado === 'aprobada' ? 'aprobada' : 'rechazada';
    showToast(`Solicitud ${verb} correctamente.`, estado === 'aprobada' ? 'success' : 'error');
    await loadVacacionesAdmin();
  } catch (e) {
    showToast('Error al actualizar. Intentá de nuevo.', 'error');
    cancelarAccion(id);
  }
}

// ── Calendario general ─────────────────────────────────────
let calendarioFiltro = 'aprobada';

function renderCalendarioLoading() {
  document.getElementById('panelCalendario').innerHTML =
    `<div class="loading-state"><div class="spinner"></div><div>Cargando calendario…</div></div>`;
}

function renderCalendario() {
  const p = document.getElementById('panelCalendario');

  const filterHtml = `
    <div class="calendar-filter">
      <label>Mostrar:</label>
      <select id="filtroCalendario" onchange="cambiarFiltroCalendario(this.value)">
        <option value="aprobada"${calendarioFiltro === 'aprobada' ? ' selected' : ''}>Solo aprobadas</option>
        <option value="pendiente"${calendarioFiltro === 'pendiente' ? ' selected' : ''}>Solo pendientes</option>
        <option value="todas"${calendarioFiltro === 'todas' ? ' selected' : ''}>Todas</option>
      </select>
    </div>`;

  const vacFiltradas = calendarioFiltro === 'todas'
    ? allVacaciones
    : allVacaciones.filter(v => v.estado === calendarioFiltro);

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

  let listHtml = `<div class="week-list">`;
  meses.forEach(mes => {
    listHtml += `<div class="week-month-label">${mes.label.charAt(0).toUpperCase() + mes.label.slice(1)}</div>`;
    mes.semanas.forEach(({ sem }) => {
      const range = formatWeekRange(sem.inicio, sem.fin);
      const ocupados = vacFiltradas.filter(v => vacacionEnSemana(v, sem));
      const badgesHtml = ocupados.map(v => {
        const cls = v.estado === 'aprobada' ? 'badge-ocupado' : 'badge-pendiente-otro';
        return `<span class="${cls}">${apellido(v.empleado)}</span>`;
      }).join('');

      listHtml += `
        <div class="week-row" style="cursor:default;">
          <div class="week-row-range">${range}</div>
          <div class="week-row-names">${badgesHtml || '<span class="week-row-libre">Libre</span>'}</div>
        </div>`;
    });
  });
  listHtml += `</div>`;

  const legend = `<p class="hint-text" style="margin-top:12px;">Verde = aprobadas · Naranja = pendientes.</p>`;

  p.innerHTML = filterHtml + listHtml + legend;
}

function cambiarFiltroCalendario(valor) {
  calendarioFiltro = valor;
  renderCalendario();
}

// ── Lista de empleados ─────────────────────────────────────
function renderEmpleadosAdmin() {
  const p = document.getElementById('panelEmpleados');

  const items = EMPLEADOS.map(nombre => {
    const initials = nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div class="employee-item">
        <div class="employee-avatar">${initials}</div>
        <div class="employee-name">${nombre}</div>
      </div>`;
  }).join('');

  p.innerHTML = `
    <div class="employee-list">${items}</div>
    <p class="hint-text" style="margin-top:16px;">Para agregar o quitar empleados, editá <code>js/empleados.js</code>.</p>`;
}
