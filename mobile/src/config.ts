/**
 * API URL:
 * - Android emulator: 10.0.2.2 = host machine localhost
 * - Device fisik: ganti dengan IP komputer Anda (mis. 192.168.1.100)
 */
import { Platform } from 'react-native';

const getDefaultDevUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api/v1'; // Android emulator → host
  }
  return 'http://localhost:5000/api/v1';
};

const devUrl = getDefaultDevUrl();
const prodUrl = 'https://your-api.com/api/v1';

export const API_BASE_URL = typeof __DEV__ !== 'undefined' && __DEV__ ? devUrl : prodUrl;
