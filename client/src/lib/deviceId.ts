import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'mina-device-id';

export function getDeviceId(): string {
  let deviceId: string | null = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    const newDeviceId = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, newDeviceId);
    return newDeviceId;
  }
  return deviceId;
} 