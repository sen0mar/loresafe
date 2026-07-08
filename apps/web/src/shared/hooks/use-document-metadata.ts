import { useEffect } from "react";

type DocumentMetadata = {
  title: string;
  description: string;
  canonicalPath: string;
  imageUrl?: string;
  robots?: "index, follow" | "noindex, nofollow";
  structuredData?: unknown;
};

const routeJsonLdId = "loresafe-route-json-ld";
const managedAttribute = "data-loresafe-managed";

export const useDocumentMetadata = ({
  title,
  description,
  canonicalPath,
  imageUrl,
  robots = "index, follow",
  structuredData
}: DocumentMetadata) => {
  useEffect(() => {
    const canonicalUrl = canonicalPath;

    document.title = title;
    setMetaTag("name", "description", description);
    setLinkTag("canonical", canonicalUrl);
    setMetaTag("name", "robots", robots);
    setMetaTag("property", "og:type", "website");
    setMetaTag("property", "og:site_name", "LoreSafe");
    setMetaTag("property", "og:title", title);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:url", canonicalUrl);
    setMetaTag("property", "og:image", imageUrl);
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", title);
    setMetaTag("name", "twitter:description", description);
    setMetaTag("name", "twitter:image", imageUrl);
    setJsonLd(structuredData);

    return () => {
      removeJsonLd();
    };
  }, [canonicalPath, description, imageUrl, robots, structuredData, title]);
};

const setMetaTag = (
  attribute: "name" | "property",
  key: string,
  content: string | undefined
) => {
  const selector = `meta[${attribute}="${key}"]`;
  const existingTag = document.head.querySelector<HTMLMetaElement>(selector);

  if (!content) {
    existingTag?.remove();
    return;
  }

  const tag = existingTag ?? document.createElement("meta");

  tag.setAttribute(attribute, key);
  tag.setAttribute("content", content);
  tag.setAttribute(managedAttribute, "true");

  if (!existingTag) {
    document.head.append(tag);
  }
};

const setLinkTag = (rel: string, href: string) => {
  const selector = `link[rel="${rel}"]`;
  const existingTag = document.head.querySelector<HTMLLinkElement>(selector);
  const tag = existingTag ?? document.createElement("link");

  tag.setAttribute("rel", rel);
  tag.setAttribute("href", href);
  tag.setAttribute(managedAttribute, "true");

  if (!existingTag) {
    document.head.append(tag);
  }
};

const setJsonLd = (structuredData: unknown) => {
  removeJsonLd();

  if (!structuredData) {
    return;
  }

  const script = document.createElement("script");

  script.id = routeJsonLdId;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(structuredData);
  document.head.append(script);
};

const removeJsonLd = () => {
  document.getElementById(routeJsonLdId)?.remove();
};
