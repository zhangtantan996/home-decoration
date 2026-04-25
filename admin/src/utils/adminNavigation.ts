import type { MenuItem } from '../stores/authStore';

export const isDynamicDetailPath = (path?: string) =>
  typeof path === 'string' && /\/:[^/]+/.test(path);

const findMenuPath = (menus: MenuItem[] = [], matcher: (menu: MenuItem) => boolean) => {
  const queue = [...menus];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (matcher(current)) {
      return current.path;
    }
    if (Array.isArray(current.children) && current.children.length > 0) {
      queue.unshift(...current.children);
    }
  }

  return undefined;
};

export const pickAdminLandingPath = (menus: MenuItem[] = []) => {
  const dashboardPath = findMenuPath(
    menus,
    (menu) => menu.path === '/dashboard' && !isDynamicDetailPath(menu.path),
  );
  if (dashboardPath) {
    return dashboardPath;
  }

  return (
    findMenuPath(
      menus,
      (menu) => Boolean(menu.path) && menu.type === 2 && !isDynamicDetailPath(menu.path),
    ) || '/dashboard'
  );
};
