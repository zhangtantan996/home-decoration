export async function loadTinodeService() {
  const mod = await import('./TinodeService');
  return mod.default;
}
