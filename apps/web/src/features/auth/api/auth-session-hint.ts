const authSessionHintKey = "loresafe:auth-session";
const authSessionHintValue = "present";

export const hasAuthSessionHint = () => {
  try {
    return (
      window.localStorage.getItem(authSessionHintKey) === authSessionHintValue
    );
  } catch {
    // If storage is unavailable, keep the existing behavior and verify with the API.
    return true;
  }
};

export const rememberAuthSessionHint = () => {
  try {
    window.localStorage.setItem(authSessionHintKey, authSessionHintValue);
  } catch {
    // The hint is only an optimization; auth still depends on the HttpOnly cookie.
  }
};

export const clearAuthSessionHint = () => {
  try {
    window.localStorage.removeItem(authSessionHintKey);
  } catch {
    // The hint is only an optimization; auth still depends on the HttpOnly cookie.
  }
};
