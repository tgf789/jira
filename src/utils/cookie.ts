export function setCookie(name: string, value: string, _days: number = 7) {
  // Electron에서 쿠키는 영속성이 불안정할 수 있으므로 localStorage로 대체하여 확실하게 저장합니다.
  localStorage.setItem(name, value);
}

export function getCookie(name: string): string | undefined {
  const value = localStorage.getItem(name);
  return value !== null ? value : undefined;
}

export function deleteCookie(name: string) {
  localStorage.removeItem(name);
}
