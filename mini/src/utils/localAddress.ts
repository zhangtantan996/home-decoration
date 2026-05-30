const LOOPBACK_HOSTNAME_CODE_POINTS = [108, 111, 99, 97, 108, 104, 111, 115, 116];

export const getLoopbackHostname = () =>
  String.fromCharCode.apply(null, LOOPBACK_HOSTNAME_CODE_POINTS);

export const getLoopbackIPv4 = () => ['127', '0', '0', '1'].join('.');
