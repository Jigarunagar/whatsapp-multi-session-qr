import CryptoJS from "crypto-js";

const ENCRYPTION_KEYS = {
  USERS: "users_key_secure",
  CHAT: "chat_key_secure",
  CONTACTS: "contacts_key_secure"
};

export const encryptData = (data, key) => {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
};

export const decryptData = (encrypted, key) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch {
    return null;
  }
};

// Users encryption
export const saveUsersToLocal = (users) => {
  const encrypted = encryptData(users, ENCRYPTION_KEYS.USERS);
  localStorage.setItem("wa_users", encrypted);
};

export const getUsersFromLocal = () => {
  const encrypted = localStorage.getItem("wa_users");
  return decryptData(encrypted, ENCRYPTION_KEYS.USERS) || [];
};

// Chat history encryption
export const saveChatHistoryToLocal = (data, userId) => {
  const encrypted = encryptData(data, `${ENCRYPTION_KEYS.CHAT}_${userId}`);
  localStorage.setItem(`wa_chatHistory_${userId}`, encrypted);
};

export const getChatHistoryFromLocal = (userId) => {
  const encrypted = localStorage.getItem(`wa_chatHistory_${userId}`);
  return decryptData(encrypted, `${ENCRYPTION_KEYS.CHAT}_${userId}`) || {};
};

// Contacts encryption
export const saveContactsToLocal = (contacts, userId) => {
  const encrypted = encryptData(contacts, `${ENCRYPTION_KEYS.CONTACTS}_${userId}`);
  localStorage.setItem(`wa_contacts_${userId}`, encrypted);
};

export const getContactsFromLocal = (userId) => {
  const encrypted = localStorage.getItem(`wa_contacts_${userId}`);
  return decryptData(encrypted, `${ENCRYPTION_KEYS.CONTACTS}_${userId}`) || [];
};

// Add this function to encryption.js
export const removeLocalStorageForUser = (userId) => {
  if (!userId) return;
  
  // List all localStorage keys for this user
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.includes(`_${userId}`) || key === `wa_qr_${userId}`) {
      keysToRemove.push(key);
    }
  }
  
  // Remove each key
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Also update user names
  try {
    const userNames = JSON.parse(localStorage.getItem("wa_user_names") || "{}");
    delete userNames[userId];
    localStorage.setItem("wa_user_names", JSON.stringify(userNames));
  } catch (error) {
    console.log("Error updating user names:", error);
  }
  
  return keysToRemove.length;
};