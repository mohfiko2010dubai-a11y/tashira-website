import { flushSync } from 'react-dom';

let active: { skipTransition: () => void } | undefined;
/** CSS owns the animation; commits never await data or animation completion. */
export function motionCommit(update: () => void, back = false) {
  if (typeof document === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
  const screen = document.querySelector<HTMLElement>('[data-motion-screen]');
  if (!screen) { update(); return; }
  active?.skipTransition();
  document.documentElement.style.setProperty('--motion-direction', back ? '-1' : '1');
  if (document.startViewTransition) {
    const transition = document.startViewTransition(() => flushSync(update));
    active = transition;
    void transition.finished.catch(() => undefined);
  } else {
    flushSync(update);
    const incoming = document.querySelector<HTMLElement>('[data-motion-screen]');
    if (!incoming) return;
    incoming.classList.remove('motion-enter');
    // A separate task applies the class after the committed screen is already usable.
    setTimeout(() => { incoming.classList.add('motion-enter'); }, 0);
    incoming.addEventListener('animationend', () => incoming.classList.remove('motion-enter'), { once: true });
  }
}
