const ensureLeadingSlash = (path) => {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

const parseLocation = (windowLike, mode) => {
  if (!windowLike || !windowLike.location) {
    return { pathname: '/', search: '' };
  }

  if (mode === 'hash') {
    const hash = windowLike.location.hash || '#/';
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    const value = raw || '/';
    const [pathnameRaw, searchRaw = ''] = value.split('?');
    return {
      pathname: ensureLeadingSlash(pathnameRaw || '/'),
      search: searchRaw ? `?${searchRaw}` : '',
    };
  }

  return {
    pathname: ensureLeadingSlash(windowLike.location.pathname || '/'),
    search: windowLike.location.search || '',
  };
};

const createHistory = ({ window: windowLike } = {}, mode = 'hash') => {
  const listeners = [];
  const eventName = mode === 'hash' ? 'hashchange' : 'popstate';

  const notify = () => {
    const location = parseLocation(windowLike, mode);
    listeners.forEach((listener) => listener({ location }));
  };

  if (windowLike && windowLike.addEventListener) {
    windowLike.addEventListener(eventName, notify);
  }

  return {
    get location() {
      return parseLocation(windowLike, mode);
    },
    listen(listener) {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    },
    push(path) {
      if (!windowLike || !windowLike.location) return;
      const target = ensureLeadingSlash(path);
      if (mode === 'hash') {
        windowLike.location.hash = target;
      } else if (windowLike.history && windowLike.history.pushState) {
        windowLike.history.pushState({}, '', target);
        notify();
      } else {
        windowLike.location.pathname = target;
      }
    },
    replace(path) {
      if (!windowLike || !windowLike.location) return;
      const target = ensureLeadingSlash(path);
      if (mode === 'hash') {
        const base = windowLike.location.href.split('#')[0];
        windowLike.location.replace(`${base}#${target}`);
      } else if (windowLike.history && windowLike.history.replaceState) {
        windowLike.history.replaceState({}, '', target);
        notify();
      } else {
        windowLike.location.pathname = target;
      }
    },
  };
};

const buildPathWithSearch = (location) => {
  const pathname = ensureLeadingSlash(location?.pathname || '/');
  const search = location?.search || '';
  return `${pathname}${search}`;
};

const parseQuery = (search) => {
  if (!search) return {};
  const qs = search.startsWith('?') ? search.slice(1) : search;
  const params = {};
  qs.split('&').forEach((pair) => {
    const [key, val] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = val ? decodeURIComponent(val) : '';
  });
  return params;
};

const findRoute = (routes, path) => {
  const normalized = ensureLeadingSlash(path.split('?')[0] || '/');
  const exact = routes.find((route) => ensureLeadingSlash(route.path) === normalized);
  if (exact) return exact;
  const fallback = routes.find((route) => ensureLeadingSlash(route.path) === '/pages/home/index');
  return fallback || routes[0];
};

/**
 * createRouter — initialises routing for the H5 app.
 *
 * Called by app.boot.js as:
 *   createRouter(history, inst, config, react)
 *
 * Before rendering pages we must trigger the Taro lifecycle:
 *   inst.onLaunch()  → calls renderReactRoot() inside createReactApp,
 *                       which mounts <AppWrapper> into <div id="app">.
 *   inst.onShow()    → marks the app as visible.
 *
 * After that, page mount calls (inst.mount) will work because AppWrapper
 * is now rendered and listening for page components.
 */
export const createRouter = (history, app, config, _react) => {
  const routes = Array.isArray(config?.routes) ? config.routes : [];
  let currentPageId = '';

  // --- 1. Trigger app lifecycle to bootstrap the React root ----
  // Build initial router options from current location
  const loc = history?.location || { pathname: '/', search: '' };
  const initialPath = ensureLeadingSlash(loc.pathname || '/');
  const launchOptions = {
    path: initialPath,
    query: parseQuery(loc.search),
  };

  // onLaunch triggers renderReactRoot() which mounts AppWrapper into DOM
  if (typeof app.onLaunch === 'function') {
    app.onLaunch(launchOptions);
  }
  // onShow marks the app visible
  if (typeof app.onShow === 'function') {
    app.onShow(launchOptions);
  }

  // --- 2. Page routing -------------------------------------------
  const render = async () => {
    const fullPath = buildPathWithSearch(history?.location);
    const route = findRoute(routes, fullPath);
    if (!route || typeof route.load !== 'function') return;

    const result = route.load({}, {});
    // Support both sync and async (Promise) return from route.load()
    const resolved = result instanceof Promise ? await result : result;
    const loaded = Array.isArray(resolved) ? resolved[0] : resolved;
    const moduleLike = loaded instanceof Promise ? await loaded : loaded;
    const PageComponent = moduleLike?.default || moduleLike?.component || moduleLike;
    if (!PageComponent) return;

    const nextId = ensureLeadingSlash(route.path || '/');
    if (currentPageId && currentPageId !== nextId && typeof app?.unmount === 'function') {
      app.unmount(currentPageId, () => { });
    }

    currentPageId = nextId;
    if (typeof app?.mount === 'function') {
      app.mount(PageComponent, nextId, () => { });
    }
  };

  render();
  if (history && typeof history.listen === 'function') {
    history.listen(render);
  }
};

export const createHashHistory = (options = {}) => createHistory(options, 'hash');
export const createBrowserHistory = (options = {}) => createHistory(options, 'browser');
export const createMpaHistory = (options = {}) => createHistory(options, 'browser');

/**
 * handleAppMountWithTabbar — called BEFORE createRouter by app.boot.js.
 *
 * The actual app lifecycle bootstrap (onLaunch/onShow) is handled inside
 * createRouter because that function receives the `inst` (app) reference.
 * This stub exists to satisfy the import without errors.
 */
export const handleAppMountWithTabbar = (_config, _history) => {
  // App lifecycle is triggered in createRouter which has access to the app instance.
};

export const handleAppMount = () => { };
