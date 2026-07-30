export function isIgnoredKeyboardTarget(target: EventTarget | null): boolean {
  if (
    typeof target !== 'object' ||
    target === null ||
    !('tagName' in target)
  ) {
    return false;
  }

  const element = target as { tagName?: unknown; isContentEditable?: unknown };

  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable === true
  );
}
