/* Progressive enhancement only: the pages work without this file. */
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copia]');
  if (!button) return;
  const source = document.querySelector(button.dataset.copia);
  if (!source) return;
  try {
    await navigator.clipboard.writeText(source.textContent);
    const original = button.textContent;
    button.textContent = 'Copiato';
    setTimeout(() => { button.textContent = original; }, 1600);
  } catch {
    // Clipboard blocked: select the text so the user can copy it by hand.
    const range = document.createRange();
    range.selectNodeContents(source);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
});
