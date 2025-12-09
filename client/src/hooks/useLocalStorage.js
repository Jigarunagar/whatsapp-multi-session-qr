import { useState, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEYS = {
  USERS: 'wa_users_key_v1',
  CHAT: 'wa_chat_key_v1',
  CONTACTS: 'wa_contacts_key_v1',
  SETTINGS: 'wa_settings_key_v1'
};

const useLocalStorage = (key, initialValue, encryptionKey = null) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      
      if (!item) {
        return initialValue;
      }
      
      if (encryptionKey) {
        try {
          const bytes = CryptoJS.AES.decrypt(item, encryptionKey);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          
          if (!decrypted) {
            return JSON.parse(item);
          }
          
          return JSON.parse(decrypted);
        } catch (decryptError) {
          try {
            return JSON.parse(item);
          } catch (parseError) {
            console.warn(`Failed to parse localStorage item "${key}":`, parseError);
            return initialValue;
          }
        }
      }
      
      return JSON.parse(item);
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      let valueToSave;
      if (encryptionKey) {
        const encrypted = CryptoJS.AES.encrypt(
          JSON.stringify(valueToStore),
          encryptionKey
        ).toString();
        valueToSave = encrypted;
      } else {
        valueToSave = JSON.stringify(valueToStore);
      }
      
      localStorage.setItem(key, valueToSave);
      setStoredValue(valueToStore);
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, encryptionKey, storedValue]);

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  const clearAll = useCallback(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('wa_'));
      keys.forEach(k => localStorage.removeItem(k));
      setStoredValue(initialValue);
    } catch (error) {
      console.warn('Error clearing localStorage:', error);
    }
  }, [initialValue]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        try {
          const newValue = e.newValue ? JSON.parse(e.newValue) : initialValue;
          setStoredValue(newValue);
        } catch (error) {
          console.warn(`Error syncing localStorage key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue, clearAll];
};

export const useUsersStorage = () => {
  return useLocalStorage('wa_users', [], ENCRYPTION_KEYS.USERS);
};

export const useChatHistoryStorage = (userId) => {
  const key = userId ? `wa_chatHistory_${userId}` : 'wa_chatHistory_temp';
  return useLocalStorage(key, {}, `${ENCRYPTION_KEYS.CHAT}_${userId || 'temp'}`);
};

export const useContactsStorage = (userId) => {
  const key = userId ? `wa_contacts_${userId}` : 'wa_contacts_temp';
  return useLocalStorage(key, [], `${ENCRYPTION_KEYS.CONTACTS}_${userId || 'temp'}`);
};

export const useSettingsStorage = () => {
  const defaultSettings = {
    theme: 'dark',
    language: 'en',
    notifications: true,
    autoDownload: true,
    fontSize: 'medium',
    soundEnabled: true,
    vibrateEnabled: true
  };
  
  return useLocalStorage('wa_settings', defaultSettings, ENCRYPTION_KEYS.SETTINGS);
};

export const useActiveUserStorage = () => {
  return useLocalStorage('wa_activeUser', null);
};

export const useSelectedChatStorage = (userId) => {
  const key = userId ? `wa_selectedChat_${userId}` : 'wa_selectedChat_temp';
  return useLocalStorage(key, null);
};

export const useMessageDrafts = (userId, contactId) => {
  const key = `wa_draft_${userId}_${contactId}`;
  return useLocalStorage(key, '');
};

export const getAllStorageData = () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('wa_')) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
  }
  return data;
};

export const exportStorageData = () => {
  const data = getAllStorageData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `whatsapp-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importStorageData = (jsonData) => {
  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    const backup = getAllStorageData();
    localStorage.setItem(`wa_backup_${Date.now()}`, JSON.stringify(backup));
    
    Object.keys(data).forEach(key => {
      if (key.startsWith('wa_')) {
        const value = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
        localStorage.setItem(key, value);
      }
    });
    
    return { success: true, message: 'Data imported successfully' };
  } catch (error) {
    console.error('Import failed:', error);
    return { success: false, message: error.message };
  }
};

export const clearAllWhatsAppData = () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('wa_'));
  keys.forEach(k => localStorage.removeItem(k));
  return keys.length;
};

export default useLocalStorage;