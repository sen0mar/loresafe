export const AUTHENTICATED_HOME_PATH = "/";

export const getSafeInternalRedirectPath = (
  redirectTo: string | null | undefined
) => {
  if (
    !redirectTo ||
    !redirectTo.startsWith("/") ||
    redirectTo.startsWith("//") ||
    redirectTo.includes("\\")
  ) {
    return null;
  }

  return redirectTo;
};
