import { PET_SEXES, PET_SIZES, PET_STATUSES, ZONES } from "./data.js";
import {
  deletePublication,
  deleteSighting,
  getAllPets,
  getPetById,
  getSightings,
  getUserPublications,
  markPublicationReunited,
  savePublication,
  saveSighting,
} from "./storage.js";

const appRoot = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");

const HOME_DEFAULTS = {
  query: "",
  status: "Todos",
  zone: "Todas",
  size: "Todos",
  sort: "recent",
};

let homeFilters = { ...HOME_DEFAULTS };
let reportDraft = newReportDraft();
let reportErrors = {};
let reportImageData = "";
let reportSuccess = null;
let reportSubmitting = false;
let sightingDraft = null;
let sightingErrors = {};
let sightingSuccess = null;
let sightingSubmitting = false;

function newReportDraft() {
  return {
    status: "Perdido",
    name: "",
    eventDate: "",
    zone: "",
    location: "",
    breed: "",
    size: "Mediano",
    sex: "No se sabe",
    age: "",
    color: "",
    marks: "",
    description: "",
    contactName: "",
    phone: "",
    email: "",
    consent: false,
  };
}

function newSightingDraft(petId) {
  return {
    petId,
    name: "",
    phone: "",
    email: "",
    dateTime: "",
    zone: "",
    location: "",
    message: "",
    consent: false,
  };
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function maxLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function statusClass(status) {
  return `status-${normalize(status)}`;
}

function statusBadge(status) {
  const symbol = status === "Perdido" ? "●" : status === "Encontrado" ? "◆" : "✓";
  return `<span class="status-badge ${statusClass(status)}"><span aria-hidden="true">${symbol}</span>${escapeHtml(status)}</span>`;
}

function selectOptions(options, current, firstLabel = "") {
  const first = firstLabel ? `<option value="">${escapeHtml(firstLabel)}</option>` : "";
  return (
    first +
    options
      .map(
        (option) =>
          `<option value="${escapeAttribute(option)}" ${option === current ? "selected" : ""}>${escapeHtml(option)}</option>`,
      )
      .join("")
  );
}

function fieldError(name, errors) {
  return errors[name]
    ? `<p class="field-error" id="error-${escapeAttribute(name)}" role="alert">${escapeHtml(errors[name])}</p>`
    : "";
}

function invalidAttr(name, errors) {
  return errors[name]
    ? `aria-invalid="true" aria-describedby="error-${escapeAttribute(name)}"`
    : 'aria-invalid="false"';
}

function showToast(message) {
  toastRegion.innerHTML = `<div class="toast" role="status">${escapeHtml(message)}</div>`;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toastRegion.innerHTML = "";
  }, 3200);
}

function routeInfo() {
  const raw = (window.location.hash || "#/").slice(1);
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);

  if (parts.length === 0) return { name: "home", path: "/" };
  if (parts[0] === "pet" && parts[1]) return { name: "detail", id: parts[1], path };
  if (parts[0] === "report") return { name: "report", path };
  if (parts[0] === "sighting" && parts[1]) return { name: "sighting", id: parts[1], path };
  if (parts[0] === "publications") return { name: "publications", path };
  if (parts[0] === "mis-publicaciones") {
    window.location.replace("#/publications");
    return { name: "publications", path: "/publications" };
  }
  return { name: "notFound", path };
}

function setPageTitle(title) {
  document.title = `${title} — Five Dogs Pet Watch`;
}

function navCurrent(routeName, target) {
  return routeName === target ? 'aria-current="page"' : "";
}

function headerTemplate(route) {
  return `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#/" aria-label="Five Dogs Pet Watch, ir al inicio">
          <span class="brand-mark" aria-hidden="true">🐾</span>
          <span class="brand-copy">
            <span class="brand-name">Five Dogs</span>
            <span class="brand-tagline">Ayuda a encontrar mascotas perdidas</span>
          </span>
        </a>

        <nav class="desktop-nav" aria-label="Navegación principal">
          <a class="nav-link" href="#/" ${navCurrent(route.name, "home")}>Inicio</a>
          <a class="nav-link nav-cta" href="#/report" ${navCurrent(route.name, "report")}>Reportar mascota</a>
          <a class="nav-link" href="#/publications" ${navCurrent(route.name, "publications")}>Mis publicaciones</a>
        </nav>

        <button
          class="mobile-menu-button"
          id="mobile-menu-button"
          type="button"
          aria-expanded="false"
          aria-controls="mobile-menu"
          aria-label="Abrir menú"
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>
      <nav class="mobile-menu" id="mobile-menu" data-open="false" aria-label="Navegación móvil">
        <a class="nav-link" href="#/" ${navCurrent(route.name, "home")}>Inicio</a>
        <a class="nav-link nav-cta" href="#/report" ${navCurrent(route.name, "report")}>Reportar mascota</a>
        <a class="nav-link" href="#/publications" ${navCurrent(route.name, "publications")}>Mis publicaciones</a>
      </nav>
    </header>`;
}

function footerTemplate() {
  return `
    <footer class="site-footer">
      <div class="footer-inner">
        <div>
          <div class="footer-brand"><span aria-hidden="true">🐾</span> Five Dogs Pet Watch</div>
          <p class="footer-copy">Proyecto educativo — los datos de contacto de los perfiles demostrativos son ficticios.</p>
        </div>
        <p class="footer-safety">
          Seguridad: no publiques tu dirección privada. Coordina cualquier encuentro en un lugar público y acompañado.
          Cuando corresponda, contacta a una veterinaria, refugio o autoridad local.
        </p>
      </div>
    </footer>`;
}

function shell(content, route) {
  appRoot.innerHTML = `
    <div class="app-shell">
      ${headerTemplate(route)}
      <main class="page-main" id="main-content" tabindex="-1">${content}</main>
      ${footerTemplate()}
    </div>`;
  attachHeaderEvents();
}

function attachHeaderEvents() {
  const button = document.querySelector("#mobile-menu-button");
  const menu = document.querySelector("#mobile-menu");
  if (!button || !menu) return;

  button.addEventListener("click", () => {
    const isOpen = menu.dataset.open === "true";
    menu.dataset.open = String(!isOpen);
    button.setAttribute("aria-expanded", String(!isOpen));
    button.setAttribute("aria-label", isOpen ? "Abrir menú" : "Cerrar menú");
    button.querySelector("span").textContent = isOpen ? "☰" : "×";
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      menu.dataset.open = "false";
      button.setAttribute("aria-expanded", "false");
    }
  });
}

function petCard(pet) {
  return `
    <article class="pet-card">
      <a class="pet-card-link" href="#/pet/${encodeURIComponent(pet.id)}" aria-label="Ver perfil de ${escapeAttribute(pet.name)}">
        <div class="pet-image-wrap">
          <img class="pet-image" src="${escapeAttribute(pet.photo)}" alt="Fotografía de ${escapeAttribute(pet.name)}" />
          ${statusBadge(pet.status)}
        </div>
        <div class="pet-card-body">
          <div class="pet-card-heading">
            <h3>${escapeHtml(pet.name)}</h3>
            <span class="pet-date">${escapeHtml(formatDate(pet.eventDate))}</span>
          </div>
          <p class="pet-location"><span aria-hidden="true">⌖</span> ${escapeHtml(pet.zone)} · ${escapeHtml(pet.location)}</p>
          <p class="pet-marks"><strong>Señas:</strong> ${escapeHtml(pet.marks)}</p>
          <span class="card-arrow">Ver perfil <span aria-hidden="true">→</span></span>
        </div>
      </a>
    </article>`;
}

function getFilteredPets() {
  const query = normalize(homeFilters.query);
  const filtered = getAllPets().filter((pet) => {
    const searchable = normalize(
      [
        pet.name,
        pet.breed,
        pet.color,
        pet.marks,
        pet.description,
        pet.location,
        pet.zone,
        pet.status,
      ].join(" "),
    );
    return (
      (!query || searchable.includes(query)) &&
      (homeFilters.status === "Todos" || pet.status === homeFilters.status) &&
      (homeFilters.zone === "Todas" || pet.zone === homeFilters.zone) &&
      (homeFilters.size === "Todos" || pet.size === homeFilters.size)
    );
  });

  return filtered.sort((a, b) => {
    if (homeFilters.sort === "name") return a.name.localeCompare(b.name, "es");
    if (homeFilters.sort === "oldest") return a.reportDate.localeCompare(b.reportDate);
    return b.reportDate.localeCompare(a.reportDate);
  });
}

function homeTemplate() {
  const pets = getFilteredPets();
  setPageTitle("Inicio");

  return `
    <div class="page-container">
      <section class="hero" aria-labelledby="home-title">
        <p class="eyebrow"><span aria-hidden="true">⌖</span> Santa Cruz, Bolivia</p>
        <h1 id="home-title">Ayuda a encontrar <em>mascotas</em> en Santa Cruz</h1>
        <p class="hero-text">
          Publica una mascota perdida o encontrada, revisa perfiles de la comunidad y comparte información útil sobre un avistamiento.
        </p>
        <div class="hero-actions">
          <a class="button button-primary" href="#/report"><span aria-hidden="true">＋</span> Reportar mascota</a>
          <a class="button button-secondary" href="#pet-list"><span aria-hidden="true">⌕</span> Ver perfiles</a>
        </div>
      </section>

      <section class="section" id="pet-list" aria-labelledby="profiles-title">
        <div class="section-heading">
          <div>
            <h2 id="profiles-title">Perfiles de Pet Watch</h2>
            <p>Busca por nombre, raza, color, seña particular, ubicación o zona.</p>
          </div>
        </div>

        <div class="filters-panel" aria-label="Filtros de mascotas">
          <div class="search-field">
            <span class="field-icon" aria-hidden="true">⌕</span>
            <label class="visually-hidden" for="filter-query">Buscar mascotas</label>
            <input
              class="input"
              id="filter-query"
              type="search"
              value="${escapeAttribute(homeFilters.query)}"
              placeholder="Buscar nombre, raza, color, zona o seña…"
              autocomplete="off"
            />
          </div>
          <div class="filters-grid">
            <div class="field">
              <label for="filter-status">Estado</label>
              <select class="select" id="filter-status">
                <option value="Todos" ${homeFilters.status === "Todos" ? "selected" : ""}>Todos</option>
                ${selectOptions(PET_STATUSES, homeFilters.status)}
              </select>
            </div>
            <div class="field">
              <label for="filter-zone">Zona</label>
              <select class="select" id="filter-zone">
                <option value="Todas" ${homeFilters.zone === "Todas" ? "selected" : ""}>Todas</option>
                ${selectOptions(ZONES, homeFilters.zone)}
              </select>
            </div>
            <div class="field">
              <label for="filter-size">Tamaño</label>
              <select class="select" id="filter-size">
                <option value="Todos" ${homeFilters.size === "Todos" ? "selected" : ""}>Todos</option>
                ${selectOptions(PET_SIZES, homeFilters.size)}
              </select>
            </div>
            <div class="field">
              <label for="filter-sort">Ordenar</label>
              <select class="select" id="filter-sort">
                <option value="recent" ${homeFilters.sort === "recent" ? "selected" : ""}>Reporte más reciente</option>
                <option value="oldest" ${homeFilters.sort === "oldest" ? "selected" : ""}>Reporte más antiguo</option>
                <option value="name" ${homeFilters.sort === "name" ? "selected" : ""}>Nombre A–Z</option>
              </select>
            </div>
          </div>
          <div class="filter-footer">
            <p class="results-count" id="results-count" aria-live="polite">
              ${pets.length} ${pets.length === 1 ? "perfil encontrado" : "perfiles encontrados"}
            </p>
            <button class="text-button" id="clear-filters" type="button">Limpiar filtros</button>
          </div>
        </div>

        <div class="section">
          ${
            pets.length
              ? `<div class="pet-grid">${pets.map(petCard).join("")}</div>`
              : `<div class="empty-state">
                  <div class="empty-state-icon" aria-hidden="true">🐾</div>
                  <h2>No encontramos perfiles con esos filtros</h2>
                  <p>Prueba otra búsqueda o restablece los filtros para volver a ver todas las mascotas.</p>
                  <button class="button button-soft" id="empty-clear-filters" type="button">Restablecer filtros</button>
                </div>`
          }
        </div>
      </section>
    </div>`;
}

function attachHomeEvents() {
  const query = document.querySelector("#filter-query");
  const status = document.querySelector("#filter-status");
  const zone = document.querySelector("#filter-zone");
  const size = document.querySelector("#filter-size");
  const sort = document.querySelector("#filter-sort");

  const update = (key, value) => {
    homeFilters[key] = value;
    renderApp({ preserveScroll: true });
    if (key === "query") {
      const nextQuery = document.querySelector("#filter-query");
      nextQuery?.focus();
      nextQuery?.setSelectionRange(value.length, value.length);
    }
  };

  query?.addEventListener("input", (event) => update("query", event.target.value));
  status?.addEventListener("change", (event) => update("status", event.target.value));
  zone?.addEventListener("change", (event) => update("zone", event.target.value));
  size?.addEventListener("change", (event) => update("size", event.target.value));
  sort?.addEventListener("change", (event) => update("sort", event.target.value));

  const clear = () => {
    homeFilters = { ...HOME_DEFAULTS };
    renderApp({ preserveScroll: true });
    showToast("Filtros restablecidos.");
  };
  document.querySelector("#clear-filters")?.addEventListener("click", clear);
  document.querySelector("#empty-clear-filters")?.addEventListener("click", clear);
}

function detailTemplate(id) {
  const pet = getPetById(id);
  if (!pet) return notFoundTemplate("No encontramos esa mascota.");
  setPageTitle(pet.name);

  const contactLines = [
    `<strong>${escapeHtml(pet.contactName)}</strong>`,
    `<span>${escapeHtml(pet.phone)}${pet.email ? ` · ${escapeHtml(pet.email)}` : ""}</span>`,
  ].join("");

  return `
    <div class="page-container page-top">
      <a class="back-link" href="#/"><span aria-hidden="true">←</span> Volver a los perfiles</a>
      <article class="detail-card">
        <div class="detail-hero">
          <div class="detail-photo-wrap">
            <img class="detail-photo" src="${escapeAttribute(pet.photo)}" alt="Fotografía grande de ${escapeAttribute(pet.name)}" />
          </div>
          <div class="detail-summary">
            ${statusBadge(pet.status)}
            <h1>${escapeHtml(pet.name)}</h1>
            <p class="lead">${escapeHtml(pet.description)}</p>
            <div class="detail-actions">
              ${
                pet.status !== "Reunido"
                  ? `<a class="button button-primary" href="#/sighting/${encodeURIComponent(pet.id)}"><span aria-hidden="true">⌖</span> Tengo información</a>`
                  : ""
              }
              <button class="button button-secondary" id="share-pet" type="button"><span aria-hidden="true">↗</span> Compartir</button>
              ${
                pet.isUserCreated && pet.status !== "Reunido"
                  ? `<button class="button button-success" id="mark-reunited" type="button"><span aria-hidden="true">✓</span> Marcar como Reunido</button>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div class="detail-content">
          <section class="info-panel" aria-labelledby="pet-information">
            <h2 id="pet-information">Información del perfil</h2>
            <dl class="info-list">
              <div class="info-row"><dt>Estado</dt><dd>${escapeHtml(pet.status)}</dd></div>
              <div class="info-row"><dt>Fecha del hecho</dt><dd>${escapeHtml(formatDate(pet.eventDate))}</dd></div>
              <div class="info-row"><dt>Fecha del reporte</dt><dd>${escapeHtml(formatDate(pet.reportDate))}</dd></div>
              <div class="info-row"><dt>Zona</dt><dd>${escapeHtml(pet.zone)}</dd></div>
              <div class="info-row"><dt>Ubicación</dt><dd>${escapeHtml(pet.location)}</dd></div>
              <div class="info-row"><dt>Raza</dt><dd>${escapeHtml(pet.breed)}</dd></div>
              <div class="info-row"><dt>Tamaño</dt><dd>${escapeHtml(pet.size)}</dd></div>
              <div class="info-row"><dt>Sexo</dt><dd>${escapeHtml(pet.sex)}</dd></div>
              <div class="info-row"><dt>Edad aproximada</dt><dd>${escapeHtml(pet.age)}</dd></div>
              <div class="info-row"><dt>Color</dt><dd>${escapeHtml(pet.color)}</dd></div>
              <div class="info-row"><dt>Señas particulares</dt><dd>${escapeHtml(pet.marks)}</dd></div>
            </dl>
          </section>

          <aside>
            <section class="info-panel" aria-labelledby="contact-title">
              <h2 id="contact-title">Contacto</h2>
              <div class="contact-box">${contactLines}</div>
              <p class="field-help">Los perfiles demostrativos usan datos ficticios. Las publicaciones creadas en este dispositivo muestran la información ingresada en el formulario.</p>
            </section>
            <div class="security-note" style="margin-top: 14px">
              <strong>Encuentro seguro:</strong> no compartas una dirección privada. Coordina en un lugar público y verifica que la persona pueda demostrar su relación con la mascota.
            </div>
          </aside>
        </div>
      </article>
    </div>`;
}

function attachDetailEvents(id) {
  const pet = getPetById(id);
  if (!pet) return;

  document.querySelector("#share-pet")?.addEventListener("click", async () => {
    const url = window.location.href;
    const shareData = {
      title: `${pet.name} — Five Dogs Pet Watch`,
      text: `${pet.name}: ${pet.status}. Zona ${pet.zone}. ${pet.marks}`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      throw new Error("share-not-supported");
    } catch (error) {
      if (error?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        showToast("Enlace copiado para compartir.");
      } catch {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.append(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
        showToast("Enlace copiado para compartir.");
      }
    }
  });

  document.querySelector("#mark-reunited")?.addEventListener("click", () => {
    if (!window.confirm(`¿Confirmas que ${pet.name} ya se reunió con su familia?`)) return;
    markPublicationReunited(id);
    renderApp({ preserveScroll: true });
    showToast(`${pet.name} fue marcado como Reunido.`);
  });
}

function reportTemplate() {
  setPageTitle("Reportar mascota");
  if (reportSuccess) return reportSuccessTemplate();

  const errors = reportErrors;
  const hasErrors = Object.keys(errors).length > 0;
  return `
    <div class="page-container page-top">
      <a class="back-link" href="#/"><span aria-hidden="true">←</span> Volver al inicio</a>
      <div class="page-heading">
        <h1>Reportar mascota perdida o encontrada</h1>
        <p>Crea un perfil para que la comunidad pueda reconocerla y compartir información útil.</p>
      </div>

      <form class="form-card" id="report-form" novalidate>
        ${hasErrors ? `<div class="form-alert" role="alert">Revisa los campos marcados antes de publicar.</div>` : ""}

        <div class="form-intro">
          <div>
            <strong>Los datos se guardan en este dispositivo.</strong>
            <p class="field-help">Esta versión escolar funciona sin servidor. La publicación permanecerá disponible en el mismo navegador mediante localStorage.</p>
          </div>
          <span class="status-badge status-encontrado">Proyecto educativo</span>
        </div>

        <div class="form-grid">
          <div class="form-field">
            <span class="field-label">Foto de la mascota *</span>
            <div class="photo-uploader">
              <div class="photo-preview" id="photo-preview">
                ${
                  reportImageData
                    ? `<img src="${escapeAttribute(reportImageData)}" alt="Vista previa de la mascota" />`
                    : `<span><span style="font-size: 2rem" aria-hidden="true">▧</span><br />La vista previa aparecerá aquí</span>`
                }
              </div>
              <div>
                <label class="field-label" for="report-photo">Seleccionar imagen</label>
                <input class="file-input" id="report-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" ${invalidAttr("photo", errors)} />
                <p class="field-help">JPG, PNG o WEBP. Tamaño máximo: 3 MB.</p>
                ${fieldError("photo", errors)}
              </div>
            </div>
          </div>

          <div class="form-section">
            <h2>Datos principales</h2>
            <p>Indica si la mascota se perdió o si fue encontrada.</p>
          </div>

          <div class="form-grid two-columns">
            <div class="form-field">
              <label for="report-status">Estado *</label>
              <select class="select" id="report-status" name="status">
                ${selectOptions(["Perdido", "Encontrado"], reportDraft.status)}
              </select>
            </div>
            <div class="form-field">
              <label for="report-name">Nombre, si se conoce</label>
              <input class="input" id="report-name" name="name" value="${escapeAttribute(reportDraft.name)}" placeholder="Ej: Rocco" ${invalidAttr("name", errors)} />
              ${fieldError("name", errors)}
            </div>
            <div class="form-field">
              <label for="report-event-date">Fecha en que se perdió o encontró *</label>
              <input class="input" id="report-event-date" name="eventDate" type="date" max="${todayIso()}" value="${escapeAttribute(reportDraft.eventDate)}" ${invalidAttr("eventDate", errors)} />
              ${fieldError("eventDate", errors)}
            </div>
            <div class="form-field">
              <label for="report-zone">Zona o barrio *</label>
              <select class="select" id="report-zone" name="zone" ${invalidAttr("zone", errors)}>
                ${selectOptions(ZONES, reportDraft.zone, "Selecciona una zona")}
              </select>
              ${fieldError("zone", errors)}
            </div>
          </div>

          <div class="form-field">
            <label for="report-location">Ubicación o referencia exacta *</label>
            <input class="input" id="report-location" name="location" value="${escapeAttribute(reportDraft.location)}" placeholder="Ej: parque, avenida y punto de referencia" ${invalidAttr("location", errors)} />
            ${fieldError("location", errors)}
          </div>

          <div class="form-grid three-columns">
            <div class="form-field">
              <label for="report-breed">Raza</label>
              <input class="input" id="report-breed" name="breed" value="${escapeAttribute(reportDraft.breed)}" placeholder="Mestizo / no se sabe" />
            </div>
            <div class="form-field">
              <label for="report-size">Tamaño *</label>
              <select class="select" id="report-size" name="size">${selectOptions(PET_SIZES, reportDraft.size)}</select>
            </div>
            <div class="form-field">
              <label for="report-sex">Sexo *</label>
              <select class="select" id="report-sex" name="sex">${selectOptions(PET_SEXES, reportDraft.sex)}</select>
            </div>
          </div>

          <div class="form-grid two-columns">
            <div class="form-field">
              <label for="report-age">Edad aproximada</label>
              <input class="input" id="report-age" name="age" value="${escapeAttribute(reportDraft.age)}" placeholder="Ej: 3 años" />
            </div>
            <div class="form-field">
              <label for="report-color">Color principal *</label>
              <input class="input" id="report-color" name="color" value="${escapeAttribute(reportDraft.color)}" placeholder="Ej: negro con pecho blanco" ${invalidAttr("color", errors)} />
              ${fieldError("color", errors)}
            </div>
          </div>

          <div class="form-field">
            <label for="report-marks">Señas particulares *</label>
            <input class="input" id="report-marks" name="marks" value="${escapeAttribute(reportDraft.marks)}" placeholder="Collar, manchas, cicatriz o rasgo fácil de reconocer" ${invalidAttr("marks", errors)} />
            <p class="field-help">Mínimo 10 caracteres.</p>
            ${fieldError("marks", errors)}
          </div>

          <div class="form-field">
            <label for="report-description">Descripción detallada *</label>
            <textarea class="textarea" id="report-description" name="description" placeholder="Explica qué ocurrió y cómo se comporta la mascota." ${invalidAttr("description", errors)}>${escapeHtml(reportDraft.description)}</textarea>
            <p class="field-help">Mínimo 20 caracteres.</p>
            ${fieldError("description", errors)}
          </div>

          <div class="form-section">
            <h2>Datos de contacto</h2>
            <p>Usa información demostrativa para una entrega escolar pública.</p>
          </div>

          <div class="form-grid three-columns">
            <div class="form-field">
              <label for="report-contact-name">Nombre de contacto *</label>
              <input class="input" id="report-contact-name" name="contactName" value="${escapeAttribute(reportDraft.contactName)}" ${invalidAttr("contactName", errors)} />
              ${fieldError("contactName", errors)}
            </div>
            <div class="form-field">
              <label for="report-phone">Teléfono boliviano *</label>
              <input class="input" id="report-phone" name="phone" type="tel" inputmode="tel" value="${escapeAttribute(reportDraft.phone)}" placeholder="70012345" ${invalidAttr("phone", errors)} />
              ${fieldError("phone", errors)}
            </div>
            <div class="form-field">
              <label for="report-email">Correo electrónico</label>
              <input class="input" id="report-email" name="email" type="email" value="${escapeAttribute(reportDraft.email)}" placeholder="correo@ejemplo.com" ${invalidAttr("email", errors)} />
              ${fieldError("email", errors)}
            </div>
          </div>

          <div class="form-field">
            <div class="checkbox-row">
              <input id="report-consent" name="consent" type="checkbox" ${reportDraft.consent ? "checked" : ""} ${invalidAttr("consent", errors)} />
              <label for="report-consent">Acepto publicar los datos de contacto ingresados en esta demostración educativa. *</label>
            </div>
            ${fieldError("consent", errors)}
          </div>

          <div class="security-note">
            No incluyas una dirección privada. Para encuentros, usa un lugar público, verifica la identidad de la otra persona y asiste acompañado/a.
          </div>

          <div class="form-actions">
            <button class="button button-primary" id="report-submit" type="submit" ${reportSubmitting ? "disabled" : ""}>
              <span aria-hidden="true">🐾</span> ${reportSubmitting ? "Publicando…" : "Publicar perfil"}
            </button>
            <a class="button button-plain" href="#/">Cancelar</a>
          </div>
        </div>
      </form>
    </div>`;
}

function reportSuccessTemplate() {
  setPageTitle("Publicación creada");
  return `
    <div class="page-container">
      <section class="success-card" aria-labelledby="report-success-title">
        <div class="success-icon" aria-hidden="true">✓</div>
        <h1 id="report-success-title">¡Publicación creada!</h1>
        <p>El perfil quedó guardado en este dispositivo y ya aparece en el inicio y en Mis publicaciones.</p>
        <span class="reference-number">${escapeHtml(reportSuccess.id)}</span>
        <p class="demo-note">Proyecto educativo: la publicación se guardó en este dispositivo; no se envió a un servidor.</p>
        <div class="success-actions">
          <a class="button button-primary" href="#/pet/${encodeURIComponent(reportSuccess.id)}">Ver publicación</a>
          <a class="button button-soft" href="#/publications">Mis publicaciones</a>
          <a class="button button-plain" href="#/">Ir al inicio</a>
        </div>
      </section>
    </div>`;
}

function isBolivianPhone(value) {
  const compact = String(value).replace(/[\s()-]/g, "");
  return /^(?:\+?591)?[67]\d{7}$/.test(compact);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
}

function validateReport() {
  const errors = {};
  if (!reportImageData) errors.photo = "Carga una fotografía JPG, PNG o WEBP de máximo 3 MB.";
  if (reportDraft.name.trim() && reportDraft.name.trim().length < 3)
    errors.name = "El nombre debe tener al menos 3 caracteres.";
  if (!reportDraft.eventDate) errors.eventDate = "Selecciona la fecha del hecho.";
  else if (reportDraft.eventDate > todayIso()) errors.eventDate = "La fecha no puede ser futura.";
  if (!reportDraft.zone) errors.zone = "Selecciona una zona.";
  if (reportDraft.location.trim().length < 3) errors.location = "Escribe una ubicación o referencia.";
  if (reportDraft.color.trim().length < 3) errors.color = "Describe el color principal.";
  if (reportDraft.marks.trim().length < 10) errors.marks = "Escribe al menos 10 caracteres.";
  if (reportDraft.description.trim().length < 20) errors.description = "Escribe al menos 20 caracteres.";
  if (reportDraft.contactName.trim().length < 3) errors.contactName = "Escribe al menos 3 caracteres.";
  if (!isBolivianPhone(reportDraft.phone)) errors.phone = "Usa 8 dígitos; puedes incluir +591.";
  if (reportDraft.email.trim() && !isValidEmail(reportDraft.email)) errors.email = "Escribe un correo válido.";
  if (!reportDraft.consent) errors.consent = "Debes aceptar antes de publicar.";
  return errors;
}

function attachReportEvents() {
  const form = document.querySelector("#report-form");
  if (!form) return;

  const syncDraft = (target) => {
    if (!target.name || target.name === "photo") return;
    reportDraft[target.name] = target.type === "checkbox" ? target.checked : target.value;
    if (reportErrors[target.name]) delete reportErrors[target.name];
  };

  form.addEventListener("input", (event) => syncDraft(event.target));
  form.addEventListener("change", (event) => syncDraft(event.target));

  document.querySelector("#report-photo")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      reportImageData = "";
      reportErrors.photo = "La imagen debe ser JPG, PNG o WEBP.";
      renderApp({ preserveScroll: true });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      reportImageData = "";
      reportErrors.photo = "La imagen supera el máximo de 3 MB.";
      renderApp({ preserveScroll: true });
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      reportImageData = String(reader.result);
      delete reportErrors.photo;
      renderApp({ preserveScroll: true });
      showToast("Imagen cargada correctamente.");
    });
    reader.addEventListener("error", () => {
      reportErrors.photo = "No se pudo leer la imagen. Prueba otro archivo.";
      renderApp({ preserveScroll: true });
    });
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (reportSubmitting) return;
    [...form.elements].forEach((element) => syncDraft(element));
    reportErrors = validateReport();
    if (Object.keys(reportErrors).length) {
      renderApp({ preserveScroll: false });
      document.querySelector("[aria-invalid='true']")?.focus();
      return;
    }

    reportSubmitting = true;
    const publication = savePublication({
      name: reportDraft.name.trim() || (reportDraft.status === "Perdido" ? "Sin nombre" : "Mascota encontrada"),
      photo: reportImageData,
      status: reportDraft.status,
      reportDate: todayIso(),
      eventDate: reportDraft.eventDate,
      zone: reportDraft.zone,
      location: reportDraft.location.trim(),
      breed: reportDraft.breed.trim() || "Mestizo / no se sabe",
      size: reportDraft.size,
      sex: reportDraft.sex,
      age: reportDraft.age.trim() || "No se sabe",
      color: reportDraft.color.trim(),
      marks: reportDraft.marks.trim(),
      description: reportDraft.description.trim(),
      contactName: reportDraft.contactName.trim(),
      phone: reportDraft.phone.trim(),
      email: reportDraft.email.trim(),
    });
    reportSuccess = publication;
    reportDraft = newReportDraft();
    reportImageData = "";
    reportErrors = {};
    reportSubmitting = false;
    renderApp({ preserveScroll: false });
  });
}

function sightingTemplate(id) {
  const pet = getPetById(id);
  if (!pet) return notFoundTemplate("No encontramos la mascota seleccionada.");
  if (!sightingDraft || sightingDraft.petId !== id) sightingDraft = newSightingDraft(id);
  setPageTitle(`Tengo información sobre ${pet.name}`);
  if (sightingSuccess) return sightingSuccessTemplate(pet);

  const errors = sightingErrors;
  const hasErrors = Object.keys(errors).length > 0;
  return `
    <div class="page-container page-top">
      <a class="back-link" href="#/pet/${encodeURIComponent(pet.id)}"><span aria-hidden="true">←</span> Volver al perfil</a>
      <div class="page-heading">
        <h1>Tengo información sobre ${escapeHtml(pet.name)}</h1>
        <p>Registra un avistamiento o un dato que pueda ayudar a la persona responsable del perfil.</p>
      </div>

      <form class="form-card" id="sighting-form" novalidate>
        ${hasErrors ? `<div class="form-alert" role="alert">Revisa los campos marcados antes de guardar el reporte.</div>` : ""}
        <div class="form-intro">
          <div class="form-intro-pet">
            <img src="${escapeAttribute(pet.photo)}" alt="${escapeAttribute(pet.name)}" />
            <div>
              <strong>${escapeHtml(pet.name)} · ${escapeHtml(pet.status)}</strong>
              <span>${escapeHtml(pet.zone)} · ${escapeHtml(pet.location)}</span>
            </div>
          </div>
          ${statusBadge(pet.status)}
        </div>

        <div class="form-grid">
          <div class="form-grid three-columns">
            <div class="form-field">
              <label for="sighting-name">Tu nombre *</label>
              <input class="input" id="sighting-name" name="name" value="${escapeAttribute(sightingDraft.name)}" ${invalidAttr("name", errors)} />
              ${fieldError("name", errors)}
            </div>
            <div class="form-field">
              <label for="sighting-phone">Teléfono</label>
              <input class="input" id="sighting-phone" name="phone" type="tel" inputmode="tel" value="${escapeAttribute(sightingDraft.phone)}" placeholder="70012345" ${invalidAttr("phone", errors)} />
              ${fieldError("phone", errors)}
            </div>
            <div class="form-field">
              <label for="sighting-email">Correo electrónico</label>
              <input class="input" id="sighting-email" name="email" type="email" value="${escapeAttribute(sightingDraft.email)}" placeholder="correo@ejemplo.com" ${invalidAttr("email", errors)} />
              ${fieldError("email", errors)}
            </div>
          </div>
          <p class="field-help" style="margin-top: -10px">Ingresa por lo menos un teléfono boliviano válido o un correo válido.</p>

          <div class="form-grid two-columns">
            <div class="form-field">
              <label for="sighting-date-time">Fecha y hora del avistamiento *</label>
              <input class="input" id="sighting-date-time" name="dateTime" type="datetime-local" max="${maxLocalDateTime()}" value="${escapeAttribute(sightingDraft.dateTime)}" ${invalidAttr("dateTime", errors)} />
              ${fieldError("dateTime", errors)}
            </div>
            <div class="form-field">
              <label for="sighting-zone">Zona *</label>
              <select class="select" id="sighting-zone" name="zone" ${invalidAttr("zone", errors)}>
                ${selectOptions(ZONES, sightingDraft.zone, "Selecciona una zona")}
              </select>
              ${fieldError("zone", errors)}
            </div>
          </div>

          <div class="form-field">
            <label for="sighting-location">Ubicación o referencia *</label>
            <input class="input" id="sighting-location" name="location" value="${escapeAttribute(sightingDraft.location)}" placeholder="Ej: esquina, parque, negocio cercano" ${invalidAttr("location", errors)} />
            ${fieldError("location", errors)}
          </div>

          <div class="form-field">
            <label for="sighting-message">Mensaje detallado *</label>
            <textarea class="textarea" id="sighting-message" name="message" placeholder="Describe dónde la viste, hacia dónde iba y cualquier detalle útil." ${invalidAttr("message", errors)}>${escapeHtml(sightingDraft.message)}</textarea>
            <p class="field-help">Mínimo 15 caracteres.</p>
            ${fieldError("message", errors)}
          </div>

          <div class="form-field">
            <div class="checkbox-row">
              <input id="sighting-consent" name="consent" type="checkbox" ${sightingDraft.consent ? "checked" : ""} ${invalidAttr("consent", errors)} />
              <label for="sighting-consent">Acepto ser contactado/a sobre este reporte. *</label>
            </div>
            ${fieldError("consent", errors)}
          </div>

          <div class="demo-note">
            Esta es una demostración escolar. El reporte se almacenará únicamente en este dispositivo y aparecerá en Mis publicaciones.
          </div>

          <div class="form-actions">
            <button class="button button-primary" type="submit" ${sightingSubmitting ? "disabled" : ""}>
              <span aria-hidden="true">⌖</span> ${sightingSubmitting ? "Guardando…" : "Guardar avistamiento"}
            </button>
            <a class="button button-plain" href="#/pet/${encodeURIComponent(pet.id)}">Cancelar</a>
          </div>
        </div>
      </form>
    </div>`;
}

function validateSighting() {
  const errors = {};
  const phoneFilled = sightingDraft.phone.trim().length > 0;
  const emailFilled = sightingDraft.email.trim().length > 0;
  const phoneOk = phoneFilled && isBolivianPhone(sightingDraft.phone);
  const emailOk = emailFilled && isValidEmail(sightingDraft.email);

  if (sightingDraft.name.trim().length < 3) errors.name = "Escribe al menos 3 caracteres.";
  if (phoneFilled && !phoneOk) errors.phone = "Usa 8 dígitos; puedes incluir +591.";
  if (emailFilled && !emailOk) errors.email = "Escribe un correo válido.";
  if (!phoneOk && !emailOk) {
    if (!errors.phone) errors.phone = "Ingresa un teléfono válido o completa el correo.";
    if (!errors.email) errors.email = "Ingresa un correo válido o completa el teléfono.";
  }
  if (!sightingDraft.dateTime) errors.dateTime = "Selecciona fecha y hora.";
  else if (new Date(sightingDraft.dateTime).getTime() > Date.now()) errors.dateTime = "La fecha y hora no pueden ser futuras.";
  if (!sightingDraft.zone) errors.zone = "Selecciona una zona.";
  if (sightingDraft.location.trim().length < 3) errors.location = "Escribe una referencia del lugar.";
  if (sightingDraft.message.trim().length < 15) errors.message = "Escribe al menos 15 caracteres.";
  if (!sightingDraft.consent) errors.consent = "Debes aceptar antes de guardar.";
  return errors;
}

function attachSightingEvents(id) {
  const form = document.querySelector("#sighting-form");
  if (!form || !sightingDraft) return;

  const syncDraft = (target) => {
    if (!target.name) return;
    sightingDraft[target.name] = target.type === "checkbox" ? target.checked : target.value;
    if (sightingErrors[target.name]) delete sightingErrors[target.name];
  };

  form.addEventListener("input", (event) => syncDraft(event.target));
  form.addEventListener("change", (event) => syncDraft(event.target));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (sightingSubmitting) return;
    [...form.elements].forEach((element) => syncDraft(element));
    sightingErrors = validateSighting();
    if (Object.keys(sightingErrors).length) {
      renderApp({ preserveScroll: false });
      document.querySelector("[aria-invalid='true']")?.focus();
      return;
    }

    const pet = getPetById(id);
    if (!pet) return;
    sightingSubmitting = true;
    sightingSuccess = saveSighting({
      petId: pet.id,
      petName: pet.name,
      name: sightingDraft.name.trim(),
      phone: sightingDraft.phone.trim(),
      email: sightingDraft.email.trim(),
      dateTime: sightingDraft.dateTime,
      zone: sightingDraft.zone,
      location: sightingDraft.location.trim(),
      message: sightingDraft.message.trim(),
    });
    sightingDraft = newSightingDraft(id);
    sightingErrors = {};
    sightingSubmitting = false;
    renderApp({ preserveScroll: false });
  });
}

function sightingSuccessTemplate(pet) {
  setPageTitle("Avistamiento guardado");
  return `
    <div class="page-container">
      <section class="success-card" aria-labelledby="sighting-success-title">
        <div class="success-icon" aria-hidden="true">✓</div>
        <h1 id="sighting-success-title">Reporte guardado</h1>
        <p>Registraste información sobre ${escapeHtml(pet.name)}.</p>
        <span class="reference-number">${escapeHtml(sightingSuccess.id)}</span>
        <p class="demo-note">Proyecto educativo: el reporte se guardó en este dispositivo; no se envió a un servidor.</p>
        <div class="success-actions">
          <a class="button button-primary" href="#/publications">Ver mis reportes</a>
          <a class="button button-soft" href="#/pet/${encodeURIComponent(pet.id)}">Volver al perfil</a>
          <a class="button button-plain" href="#/">Ir al inicio</a>
        </div>
      </section>
    </div>`;
}

function publicationsTemplate() {
  setPageTitle("Mis publicaciones");
  const publications = getUserPublications();
  const sightings = getSightings();

  const publicationItems = publications
    .map(
      (pet) => `
      <article class="dashboard-item">
        <div class="dashboard-pet-main">
          <img src="${escapeAttribute(pet.photo)}" alt="${escapeAttribute(pet.name)}" />
          <div>
            <h3>${escapeHtml(pet.name)}</h3>
            <div class="dashboard-meta">
              ${statusBadge(pet.status)}
              <span>${escapeHtml(pet.zone)}</span>
              <span>${escapeHtml(formatDate(pet.eventDate))}</span>
              <span>${escapeHtml(pet.id)}</span>
            </div>
          </div>
        </div>
        <div class="dashboard-actions">
          <a class="button button-plain" href="#/pet/${encodeURIComponent(pet.id)}">Abrir</a>
          ${pet.status !== "Reunido" ? `<button class="button button-success" type="button" data-action="reunited" data-id="${escapeAttribute(pet.id)}">Marcar Reunido</button>` : ""}
          <button class="button button-danger" type="button" data-action="delete-publication" data-id="${escapeAttribute(pet.id)}">Eliminar</button>
        </div>
      </article>`,
    )
    .join("");

  const sightingItems = sightings
    .map(
      (report) => `
      <article class="dashboard-item">
        <div class="dashboard-report-main">
          <h3>${escapeHtml(report.petName)}</h3>
          <div class="dashboard-meta">
            <span>${escapeHtml(formatDateTime(report.dateTime))}</span>
            <span>${escapeHtml(report.zone)}</span>
            <span>${escapeHtml(report.id)}</span>
          </div>
          <p><strong>Referencia:</strong> ${escapeHtml(report.location)}<br />${escapeHtml(report.message)}</p>
        </div>
        <div class="dashboard-actions">
          ${getPetById(report.petId) ? `<a class="button button-plain" href="#/pet/${encodeURIComponent(report.petId)}">Ver mascota</a>` : ""}
          <button class="button button-danger" type="button" data-action="delete-sighting" data-id="${escapeAttribute(report.id)}">Eliminar</button>
        </div>
      </article>`,
    )
    .join("");

  return `
    <div class="page-container page-top">
      <div class="page-heading">
        <h1>Mis publicaciones</h1>
        <p>Administra los perfiles y reportes guardados en este navegador.</p>
      </div>

      <section class="dashboard-section" aria-labelledby="my-pets-title">
        <div class="section-heading">
          <div>
            <h2 id="my-pets-title">Perfiles creados</h2>
            <p>${publications.length} ${publications.length === 1 ? "publicación" : "publicaciones"}</p>
          </div>
          <a class="button button-primary" href="#/report"><span aria-hidden="true">＋</span> Reportar mascota</a>
        </div>
        ${
          publications.length
            ? `<div class="dashboard-list">${publicationItems}</div>`
            : `<div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">▧</div>
                <h3>Todavía no creaste un perfil</h3>
                <p>Usa el formulario para publicar una mascota perdida o encontrada.</p>
                <a class="button button-soft" href="#/report">Reportar mascota</a>
              </div>`
        }
      </section>

      <section class="dashboard-section section" aria-labelledby="my-sightings-title">
        <div class="section-heading">
          <div>
            <h2 id="my-sightings-title">Mis reportes de avistamiento</h2>
            <p>${sightings.length} ${sightings.length === 1 ? "reporte" : "reportes"}</p>
          </div>
        </div>
        ${
          sightings.length
            ? `<div class="dashboard-list">${sightingItems}</div>`
            : `<div class="empty-state">
                <div class="empty-state-icon" aria-hidden="true">⌖</div>
                <h3>No guardaste avistamientos</h3>
                <p>Abre el perfil de una mascota y usa el botón “Tengo información”.</p>
                <a class="button button-soft" href="#/">Ver perfiles</a>
              </div>`
        }
      </section>
    </div>`;
}

function attachPublicationsEvents() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const { action, id } = button.dataset;
      if (action === "reunited") {
        const pet = getPetById(id);
        if (!pet || !window.confirm(`¿Confirmas que ${pet.name} ya se reunió con su familia?`)) return;
        markPublicationReunited(id);
        renderApp({ preserveScroll: true });
        showToast(`${pet.name} fue marcado como Reunido.`);
      }
      if (action === "delete-publication") {
        const pet = getPetById(id);
        if (!pet || !window.confirm(`¿Eliminar definitivamente la publicación de ${pet.name}?`)) return;
        deletePublication(id);
        renderApp({ preserveScroll: true });
        showToast("Publicación eliminada.");
      }
      if (action === "delete-sighting") {
        if (!window.confirm("¿Eliminar definitivamente este reporte de avistamiento?")) return;
        deleteSighting(id);
        renderApp({ preserveScroll: true });
        showToast("Reporte eliminado.");
      }
    });
  });
}

function notFoundTemplate(message = "La página solicitada no existe.") {
  setPageTitle("Página no encontrada");
  return `
    <div class="page-container">
      <section class="success-card">
        <div class="success-icon" aria-hidden="true">?</div>
        <h1>No encontramos esta página</h1>
        <p>${escapeHtml(message)}</p>
        <div class="success-actions"><a class="button button-primary" href="#/">Volver al inicio</a></div>
      </section>
    </div>`;
}

function renderApp({ preserveScroll = false } = {}) {
  const scrollY = window.scrollY;
  const route = routeInfo();
  let content = "";

  if (route.name !== "report") reportSuccess = null;
  if (route.name !== "sighting") sightingSuccess = null;

  switch (route.name) {
    case "home":
      content = homeTemplate();
      break;
    case "detail":
      content = detailTemplate(route.id);
      break;
    case "report":
      content = reportTemplate();
      break;
    case "sighting":
      content = sightingTemplate(route.id);
      break;
    case "publications":
      content = publicationsTemplate();
      break;
    default:
      content = notFoundTemplate();
  }

  shell(content, route);

  switch (route.name) {
    case "home":
      attachHomeEvents();
      break;
    case "detail":
      attachDetailEvents(route.id);
      break;
    case "report":
      attachReportEvents();
      break;
    case "sighting":
      attachSightingEvents(route.id);
      break;
    case "publications":
      attachPublicationsEvents();
      break;
  }

  if (preserveScroll) window.scrollTo(0, scrollY);
  else window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => renderApp({ preserveScroll: false }));
window.addEventListener("DOMContentLoaded", () => {
  if (!window.location.hash) window.location.hash = "#/";
  renderApp();
});
