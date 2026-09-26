/* Progressive enhancement only: the pages work without this file. */

/** Texts come from the page, so the confirmation is in the page's language. */
const T = document.body.dataset;

/** One polite live region: screen readers announce the outcome of a copy. */
const announcer = document.createElement('div');
announcer.className = 'visually-hidden';
announcer.setAttribute('role', 'status');
announcer.setAttribute('aria-live', 'polite');
document.body.appendChild(announcer);
const announce = (text) => {
  announcer.textContent = '';
  // Re-setting the text is what makes the reader speak it again.
  setTimeout(() => { announcer.textContent = text; }, 50);
};

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const source = document.querySelector(button.dataset.copy);
  if (!source) return;
  try {
    await navigator.clipboard.writeText(source.textContent);
    const original = button.dataset.label ?? button.textContent;
    button.dataset.label = original;
    button.textContent = T.copied;
    button.classList.add('button--copied');
    announce(T.copied);
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove('button--copied');
    }, 1600);
  } catch {
    // Clipboard blocked: select the text so it can be copied by hand, and say so.
    const range = document.createRange();
    range.selectNodeContents(source);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    announce(T.copyBlocked);
    const note = document.createElement('p');
    note.className = 'meta';
    note.textContent = T.copyBlocked;
    button.closest('li, td, div')?.appendChild(note);
    setTimeout(() => note.remove(), 6000);
  }
});

/*
 * The selectors are plain links, so every choice has its own URL and works
 * without JavaScript. Here we fetch that page and swap only <main>: no full
 * reload, the scroll position stays, and a choice already seen is served from
 * memory without asking the server again.
 */
const pages = new Map();
const load = (url) => {
  if (!pages.has(url)) {
    pages.set(url, fetch(url, { headers: { Accept: 'text/html' } }).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    }).catch((err) => { pages.delete(url); throw err; }));
  }
  return pages.get(url);
};

let latest = 0;
const show = async (url, push) => {
  const main = document.querySelector('main');
  const ticket = ++latest;
  main.setAttribute('aria-busy', 'true');
  try {
    const html = await load(url);
    // A later click wins: an older answer arriving late is dropped.
    if (ticket !== latest) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const next = doc.querySelector('main');
    if (!next) throw new Error('no main');
    main.innerHTML = next.innerHTML;
    document.title = doc.title;
    if (push) history.pushState({ swap: true }, '', url);
    const line = main.querySelector('.answer__line');
    if (line) announce(line.textContent);
  } catch {
    // Whatever went wrong, the link still works the ordinary way.
    if (ticket === latest) location.href = url;
  } finally {
    if (ticket === latest) main.removeAttribute('aria-busy');
  }
};

document.addEventListener('click', (event) => {
  const link = event.target.closest('a.choice');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname !== location.pathname) return;
  event.preventDefault();
  // Immediate feedback: the new choice is highlighted before the answer arrives.
  for (const sibling of link.parentElement.querySelectorAll('.choice')) {
    const on = sibling === link;
    sibling.classList.toggle('choice--active', on);
    if (on) sibling.setAttribute('aria-current', 'true'); else sibling.removeAttribute('aria-current');
  }
  show(url.pathname + url.search, true);
});

// Warm the cache when a choice is about to be clicked.
const warm = (event) => {
  const link = event.target.closest?.('a.choice');
  if (!link || link.classList.contains('choice--active')) return;
  const url = new URL(link.href, location.href);
  if (url.origin === location.origin && url.pathname === location.pathname) load(url.pathname + url.search).catch(() => {});
};
document.addEventListener('pointerover', warm);
document.addEventListener('focusin', warm);

// Back and forward replay the swaps instead of leaving the page.
history.replaceState({ swap: true }, '', location.href);
window.addEventListener('popstate', (event) => {
  if (event.state?.swap) show(location.pathname + location.search, false);
});
