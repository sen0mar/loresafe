const defaultPublicSiteOrigin = "https://loresafe-web.vercel.app";

export const getPublicSiteOrigin = () =>
  (import.meta.env.VITE_PUBLIC_SITE_ORIGIN || defaultPublicSiteOrigin).replace(
    /\/+$/,
    ""
  );

export const toPublicUrl = (path: string) => `${getPublicSiteOrigin()}${path}`;
