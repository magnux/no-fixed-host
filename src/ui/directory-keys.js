// Directory rows remain ordinary tab-accessible buttons. Arrow and page keys
// select a row directly, including when the directory has its own scrollbar.
export function navigateDirectory(event, directory) {
  if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return false;
  const buttons = [...directory.children].filter(button => !button.hidden);
  const index = buttons.indexOf(event.target.closest('button'));
  if (index < 0) return false;
  const page = Math.max(1, Math.floor(directory.clientHeight / Math.max(1, buttons[index].offsetHeight)) - 1);
  const target = { ArrowUp: index - 1, ArrowDown: index + 1, PageUp: index - page, PageDown: index + page,
    Home: 0, End: buttons.length - 1 }[event.key];
  const button = buttons[Math.max(0, Math.min(target, buttons.length - 1))];
  event.preventDefault();
  button.focus();
  button.click();
  return true;
}
