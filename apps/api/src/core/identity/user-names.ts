export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export const normalizeUsername = (username: string) =>
  username.trim().toLowerCase();

export const normalizeNameReservationKey = (name: string) =>
  name.trim().toLowerCase();
