/** Brings the top of el into view, if the page has been scrolled past it. */
export function scrollToTopIfPast(el: HTMLElement): void {
  // SharePoint scrolls the page inside its own box, not the window.
  const scroller = el.closest('[data-is-scrollable="true"]');
  const visibleTop = scroller ? scroller.getBoundingClientRect().top : 0;
  if (el.getBoundingClientRect().top < visibleTop) el.scrollIntoView({ block: 'start' });
}
