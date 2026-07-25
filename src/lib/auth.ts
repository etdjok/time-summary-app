const PASSWORD_KEY = 'heartlight_password';
const DEFAULT_PASSWORD = 'xinguang2026';

export { PASSWORD_KEY, DEFAULT_PASSWORD };

export function getStoredPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
}

export function setStoredPassword(password: string): void {
  localStorage.setItem(PASSWORD_KEY, password);
}
