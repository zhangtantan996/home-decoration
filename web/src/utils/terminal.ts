export function detectTerminalType() {
  if (typeof navigator === 'undefined') {
    return 'pc_web';
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent)
    ? 'mobile_h5'
    : 'pc_web';
}
