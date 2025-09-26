// assistant-chip.js - legacy shim (chip markup now lives in index.html)
(function(){
  if (window.__ASSISTANT_CHIP_STUB__) return;
  window.__ASSISTANT_CHIP_STUB__ = true;
  const pruneDuplicates = () => {
    const chips = Array.from(document.querySelectorAll('#assistantChip'));
    chips.slice(1).forEach((node) => { try { node.remove(); } catch {} });
    const dock = document.getElementById('assistantDock');
    if (chips[0] && dock) {
      chips[0].setAttribute('aria-controls', dock.id);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pruneDuplicates);
  } else {
    pruneDuplicates();
  }
})();
