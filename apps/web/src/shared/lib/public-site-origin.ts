const defaultPublicSiteOrigin = "https://www.loresafe.org";

export const getPublicSiteOrigin = () =>
  (import.meta.env.VITE_PUBLIC_SITE_ORIGIN || defaultPublicSiteOrigin).replace(
    /\/+$/,
    ""
  );

export const toPublicUrl = (path: string) => `${getPublicSiteOrigin()}${path}`;
