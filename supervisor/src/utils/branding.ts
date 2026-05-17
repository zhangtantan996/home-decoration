import { useEffect } from "react";
import { buildAppPath } from "./env";

export const SUPERVISOR_BRAND_NAME = "禾泽云";
export const SUPERVISOR_BRAND_LOGO_PATH = buildAppPath("/company-logo.png");
export const SUPERVISOR_FAVICON_PATH = buildAppPath("/favicon-light-32x32.png");
export const SUPERVISOR_DEFAULT_PAGE_TITLE = `${SUPERVISOR_BRAND_NAME} · 监理工作台`;

const ensureIconLink = (rel: string) => {
  let element = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.type = "image/png";
  element.href = SUPERVISOR_FAVICON_PATH;
};

export const applySupervisorDocumentBranding = (pageTitle?: string) => {
  if (typeof document === "undefined") return;
  document.title = pageTitle?.trim() || SUPERVISOR_DEFAULT_PAGE_TITLE;
  ensureIconLink("icon");
  ensureIconLink("shortcut icon");
};

export const useSupervisorDocumentBranding = (pageTitle?: string) => {
  useEffect(() => {
    applySupervisorDocumentBranding(pageTitle);
  }, [pageTitle]);
};
