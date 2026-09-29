const state = {
  scenarios: [], filtered: [], themes: [], characters: [],
  selectedThemes: new Set(), selectedCharacters: new Set(),
};
const $ = id => document.getElementById(id);
const text = value => (value ?? '').toString();

function searchable(s) {
  return [s.title, ...(s.authors || []), s.description,
    ...(s.content?.tags || []), ...(s.content?.characters || [])]
    .map(text).join(' ').toLowerCase();
}
function imageUrl(s) {
  const image = s.image || {};
  return /^https?:\/\//.test(image.source_url || '') ? image.source_url
    : /^(?:images\/)[^?#]+$/i.test(image.path || '') ? image.path : null;
}
function putImage(s, container) {
  const url = imageUrl(s); if (!url) return;
  const img = document.createElement('img');
  img.src = url; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
  img.onerror = () => img.remove(); container.prepend(img);
}
function formattedDate(s) {
  const value = s.dates?.updated || s.dates?.published;
  if (!value) return 'Date unknown';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value
    : date.toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
}
function badge(label, kind = '') {
  const element = document.createElement('span');
  element.className = `badge ${kind}`; element.textContent = label; return element;
}
function labelsInto(s, container, limit = 6) {
  container.replaceChildren();
  const values = [
    ...(s.content?.tags || []).map(value => [value, 'tag']),
    ...(s.content?.characters || []).map(value => [value, 'tag character']),
  ];
  for (const [value, className] of values.slice(0, limit)) {
    const element = document.createElement('span');
    element.className = className; element.textContent = value; container.append(element);
  }
}
function availabilityMatches(s, availableOnly) {
  if (!availableOnly) return true;
  const status = s.source?.link_status;
  return Boolean(s.source?.download_url) && status !== 'dead' && status !== 'unavailable';
}
function openDetails(s) {
  const dialog = $('detail-dialog'), art = dialog.querySelector('.detail-art');
  art.querySelector('img')?.remove(); putImage(s, art);
  dialog.querySelector('.detail-author').textContent = `By ${(s.authors || ['Unknown author']).join(', ')}`;
  dialog.querySelector('.detail-title').textContent = s.title;
  dialog.querySelector('.detail-description').textContent = s.description || 'A description is not yet available for this scenario.';
  dialog.querySelector('.detail-duration').textContent = s.content?.reading_time_display || 'Unknown';
  const advertised=s.release?.advertised_version, packaged=s.release?.package_version;
  dialog.querySelector('.detail-version').textContent = advertised && packaged && advertised!==packaged
    ? `${advertised} advertised · ${packaged} downloaded`
    : (advertised || packaged || s.release?.scenario_version || 'Unknown');
  dialog.querySelector('.detail-st-version').textContent = s.release?.target_st_version || 'Unknown';
  dialog.querySelector('.detail-date').textContent = formattedDate(s);
  labelsInto(s, dialog.querySelector('.detail-tags'), 20);
  const badges = dialog.querySelector('.detail-badges');
  badges.replaceChildren(
    badge(s.content?.completed ? 'Completed' : 'Incomplete', s.content?.completed ? 'good' : ''),
    badge(s.content?.nsfw === 'yes' ? '18+' : s.content?.nsfw === 'no' ? 'SFW' : 'Unrated', s.content?.nsfw === 'yes' ? 'adult' : '')
  );
  const download = dialog.querySelector('.detail-download'), forum = dialog.querySelector('.detail-forum');
  download.href = s.source?.download_url || '#'; download.hidden = !s.source?.download_url;
  forum.href = s.source?.forum_url || '#'; forum.hidden = !s.source?.forum_url;
  dialog.querySelector('.availability-note').textContent = s.availability?.archive_available && !s.source?.download_url
    ? 'A copy has been archived, but no public download host is currently linked.'
    : !s.source?.download_url ? 'No working public download has been cataloged yet.' : '';
  dialog.showModal();
}
function matchesAny(values, selected) {
  return !selected.size || (values || []).some(value => selected.has(value));
}
function render() {
  const query = $('search').value.trim().toLowerCase();
  const nsfwOnly = $('nsfw').checked, completedOnly = $('completed').checked, availableOnly = $('availability').checked;
  let rows = state.scenarios.filter(s => !query || searchable(s).includes(query));
  rows = rows.filter(s => matchesAny(s.content?.tags, state.selectedThemes));
  rows = rows.filter(s => matchesAny(s.content?.characters, state.selectedCharacters));
  rows = rows.filter(s => !nsfwOnly || s.content?.nsfw === 'yes');
  rows = rows.filter(s => !completedOnly || Boolean(s.content?.completed));
  rows = rows.filter(s => availabilityMatches(s, availableOnly));
  const sort = $('sort').value;
  rows.sort((a, b) => sort === 'title' ? text(a.title).localeCompare(text(b.title))
    : sort === 'duration' ? (b.content?.reading_time_minutes || -1) - (a.content?.reading_time_minutes || -1)
    : text(b.dates?.updated || b.dates?.published).localeCompare(text(a.dates?.updated || a.dates?.published)));
  state.filtered = rows;
  const grid = $('grid'); grid.replaceChildren();
  for (const s of rows) {
    const fragment = $('card-template').content.cloneNode(true), card = fragment.querySelector('.card'), art = card.querySelector('.art');
    putImage(s, art);
    card.querySelector('.author').textContent = `By ${(s.authors || ['Unknown author']).join(', ')}`;
    card.querySelector('h3').textContent = s.title;
    card.querySelector('.description').textContent = s.description || 'Description not yet available.';
    card.querySelector('.completion').textContent = s.content?.completed ? 'Completed' : 'Incomplete';
    card.querySelector('.completion').classList.toggle('good', Boolean(s.content?.completed));
    const rating = card.querySelector('.rating');
    rating.textContent = s.content?.nsfw === 'yes' ? '18+' : '';
    rating.hidden = !rating.textContent; rating.classList.toggle('adult', s.content?.nsfw === 'yes');
    labelsInto(s, card.querySelector('.tags'));
    card.querySelector('.duration').textContent = s.content?.reading_time_display || 'Length unknown';
    card.querySelector('.date').textContent = formattedDate(s);
    card.querySelector('.details').onclick = () => openDetails(s);
    card.onkeydown = event => { if (event.key === 'Enter') openDetails(s); };
    grid.append(fragment);
  }
  $('visible-count').textContent = rows.length; $('empty').hidden = rows.length > 0;
}
function facet(kind) {
  const character = kind === 'character';
  return {
    values: character ? state.characters : state.themes,
    selected: character ? state.selectedCharacters : state.selectedThemes,
    search: $(`${kind}-search`), options: $(`${kind}-options`),
    toggle: $(`${kind}-toggle`), menu: $(`${kind}-menu`),
    emptyLabel: character ? 'All characters' : 'All themes',
  };
}
function renderFacetOptions(kind) {
  const item = facet(kind), query = item.search.value.trim().toLowerCase();
  item.options.replaceChildren();
  for (const value of item.values.filter(value => value.toLowerCase().includes(query))) {
    const label = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.checked = item.selected.has(value);
    input.onchange = () => {
      input.checked ? item.selected.add(value) : item.selected.delete(value);
      renderSelectedLabels(); render();
    };
    label.append(input, document.createTextNode(value)); item.options.append(label);
  }
}
function renderSelectedLabels() {
  const box = $('selected-tags'); box.replaceChildren();
  for (const kind of ['theme', 'character']) {
    const item = facet(kind);
    for (const value of item.selected) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = `${value} ×`;
      if (kind === 'character') button.classList.add('character');
      button.onclick = () => { item.selected.delete(value); renderFacetOptions(kind); renderSelectedLabels(); render(); };
      box.append(button);
    }
    item.toggle.textContent = item.selected.size ? `${item.selected.size} selected` : item.emptyLabel;
  }
}
function toggleFacet(kind) {
  const item = facet(kind), opening = item.menu.hidden;
  for (const otherKind of ['theme', 'character']) {
    const other = facet(otherKind); other.menu.hidden = true; other.toggle.setAttribute('aria-expanded', 'false');
  }
  item.menu.hidden = !opening; item.toggle.setAttribute('aria-expanded', String(opening));
  if (opening) item.search.focus();
}
function reset() {
  $('search').value = ''; $('availability').checked = true; $('nsfw').checked = false; $('completed').checked = false;
  state.selectedThemes.clear(); state.selectedCharacters.clear();
  $('theme-search').value = ''; $('character-search').value = ''; $('sort').value = 'updated';
  renderFacetOptions('theme'); renderFacetOptions('character'); renderSelectedLabels(); render();
}

fetch('scenarios.json').then(response => {
  if (!response.ok) throw Error(response.status); return response.json();
}).then(rows => {
  state.scenarios = rows;
  $('total-count').textContent = rows.length;
  $('download-count').textContent = rows.filter(s => s.source?.download_url).length;
  $('completed-count').textContent = rows.filter(s => s.content?.completed).length;
  $('image-count').textContent = rows.filter(imageUrl).length;
  state.themes = [...new Set(rows.flatMap(s => s.content?.tags || []))].sort((a, b) => a.localeCompare(b));
  state.characters = [...new Set(rows.flatMap(s => s.content?.characters || []))].sort((a, b) => a.localeCompare(b));
  for (const kind of ['theme', 'character']) {
    renderFacetOptions(kind); facet(kind).search.oninput = () => renderFacetOptions(kind);
    facet(kind).toggle.onclick = () => toggleFacet(kind);
  }
  document.querySelectorAll('.controls>label input,.controls>label select').forEach(element => element.addEventListener('input', render));
  $('reset').onclick = reset; render();
}).catch(() => {
  $('empty').hidden = false; $('empty').textContent = 'The catalog could not be loaded.';
});
document.addEventListener('click', event => {
  if (!event.target.closest('.tag-filter')) {
    for (const kind of ['theme', 'character']) {
      const item = facet(kind); item.menu.hidden = true; item.toggle.setAttribute('aria-expanded', 'false');
    }
  }
});
$('detail-dialog').querySelector('.close').onclick = () => $('detail-dialog').close();
$('detail-dialog').onclick = event => { if (event.target === $('detail-dialog')) $('detail-dialog').close(); };
