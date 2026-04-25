type MenuRoute = {
  path?: string;
  children?: MenuRoute[];
  hideInMenu?: boolean;
};

const isDynamicDetailPath = (path?: string) => typeof path === 'string' && /\/:[^/]+/.test(path);

export const resolveMenuTargetPath = (route?: MenuRoute): string | undefined => {
  if (!route) {
    return undefined;
  }
  if (Array.isArray(route.children) && route.children.length > 0) {
    for (const child of route.children) {
      if (child.hideInMenu) {
        continue;
      }
      const childPath = resolveMenuTargetPath(child);
      if (childPath) {
        return childPath;
      }
    }
  }
  if (route.path && !isDynamicDetailPath(route.path)) {
    return route.path;
  }
  return undefined;
};
