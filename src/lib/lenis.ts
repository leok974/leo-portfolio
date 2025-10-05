import Lenis from 'lenis';

export function startLenis() {
  const lenis = new Lenis({
    smoothWheel: true,
    syncTouch: true,
    lerp: 0.1,
  });

  const raf = (t: number) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };

  requestAnimationFrame(raf);
  return lenis;
}
