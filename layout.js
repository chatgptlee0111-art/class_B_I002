// Keep overlays inside the actually visible area when mobile browser bars
// or the software keyboard resize/pan the visual viewport.
(() => {
  const viewport = window.visualViewport;
  let frame;
  function updateViewport() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--visual-height', `${viewport?.height || window.innerHeight}px`);
      document.documentElement.style.setProperty('--visual-top', `${viewport?.offsetTop || 0}px`);
    });
  }
  window.addEventListener('resize', updateViewport);
  viewport?.addEventListener('resize', updateViewport);
  viewport?.addEventListener('scroll', updateViewport);
  updateViewport();
})();
