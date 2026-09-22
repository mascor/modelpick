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
