const DEVICE_ID_KEY = "home_decoration_device_id";

export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    // 使用浏览器原生 UUID 生成或随机字符串回退
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      deviceId =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
    }
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};
