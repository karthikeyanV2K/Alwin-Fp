import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys for storage
const STORAGE_KEYS = {
  SERVER_IP: 'SERVER_IP',
  AUTO_DETECT_DONE: 'AUTO_DETECT_DONE',
};

/**
 * Get saved server IP from storage
 */
export const getServerIp = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.SERVER_IP);
  } catch (error) {
    console.error('Error getting server IP:', error);
    return null;
  }
};

/**
 * Save server IP to storage
 */
export const saveServerIp = async (ip) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_IP, ip);
    return true;
  } catch (error) {
    console.error('Error saving server IP:', error);
    return false;
  }
};

/**
 * Clear saved server IP
 */
export const clearServerIp = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.SERVER_IP);
    return true;
  } catch (error) {
    console.error('Error clearing server IP:', error);
    return false;
  }
};

/**
 * Build full API URL from server IP
 */
export const getApiUrl = (serverIp, endpoint = '') => {
  const baseUrl = `http://${serverIp}`;
  return endpoint ? `${baseUrl}${endpoint}` : baseUrl;
};
