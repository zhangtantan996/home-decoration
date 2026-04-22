export interface ParsedUrlParts {
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  href: string;
}

const ABSOLUTE_URL_PATTERN =
  /^([a-zA-Z][a-zA-Z\d+.-]*):\/\/([^/?#]+)([^?#]*)?(\?[^#]*)?(#.*)?$/;

const splitHost = (host: string) => {
  const value = String(host || "").trim();
  if (!value) {
    return { hostname: "", port: "" };
  }

  const lastColonIndex = value.lastIndexOf(":");
  if (lastColonIndex <= 0 || value.includes("]")) {
    return { hostname: value, port: "" };
  }

  const hostname = value.slice(0, lastColonIndex);
  const port = value.slice(lastColonIndex + 1);
  if (!/^\d+$/.test(port)) {
    return { hostname: value, port: "" };
  }

  return { hostname, port };
};

export const parseAbsoluteUrl = (raw: string): ParsedUrlParts | null => {
  const input = String(raw || "").trim();
  if (!input) {
    return null;
  }

  const matched = input.match(ABSOLUTE_URL_PATTERN);
  if (!matched) {
    return null;
  }

  const protocol = `${matched[1].toLowerCase()}:`;
  const host = matched[2];
  const pathname = matched[3] || "/";
  const search = matched[4] || "";
  const hash = matched[5] || "";
  const { hostname, port } = splitHost(host);
  const origin = `${protocol}//${host}`;
  const href = `${origin}${pathname}${search}${hash}`;

  return {
    protocol,
    host,
    hostname,
    port,
    pathname,
    search,
    hash,
    origin,
    href,
  };
};

const normalizePathname = (value: string) => {
  const pathname = String(value || "").trim();
  if (!pathname) {
    return "/";
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
};

export const buildAbsoluteUrl = (base: string, path: string) => {
  const parsedBase = parseAbsoluteUrl(base);
  if (!parsedBase) {
    return String(path || "").trim();
  }

  const normalizedPath = normalizePathname(path);
  return `${parsedBase.origin}${normalizedPath}`;
};

export const replaceAbsoluteUrlOrigin = (target: string, base: string) => {
  const parsedTarget = parseAbsoluteUrl(target);
  const parsedBase = parseAbsoluteUrl(base);
  if (!parsedTarget || !parsedBase) {
    return String(target || "").trim();
  }

  return `${parsedBase.origin}${parsedTarget.pathname}${parsedTarget.search}${parsedTarget.hash}`;
};
