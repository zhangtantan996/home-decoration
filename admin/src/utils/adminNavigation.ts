import type { MenuItem } from '../stores/authStore';

export const isDynamicDetailPath = (path?: string) =>
  typeof path === 'string' && /\/:[^/]+/.test(path);

export const pickAdminLandingPath = (menus: MenuItem[] = []) => {
  const preferPath = '/supervision/projects';
  const queue = [...menus];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (current.path === preferPath && !isDynamicDetailPath(current.path)) {
      return preferPath;
    }
    if (Array.isArray(current.children) && current.children.length > 0) {
      queue.unshift(...current.children);
    }
  }

  queue.push(...menus);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (current.path && current.type === 2 && !isDynamicDetailPath(current.path)) {
      return current.path;
    }
    if (Array.isArray(current.children) && current.children.length > 0) {
      queue.unshift(...current.children);
    }
  }

  return '/dashboard';
};
