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


export const saveUsersToLocal = (users) => {
  const encrypted = encryptData(users, ENCRYPTION_KEYS.USERS);
  localStorage.setItem("wa_users", encrypted);
};

export const getUsersFromLocal = () => {
  const encrypted = localStorage.getItem("wa_users");
  return decryptData(encrypted, ENCRYPTION_KEYS.USERS) || [];
};

export const saveChatHistoryToLocal = (data, userId) => {
  const encrypted = encryptData(data, `${ENCRYPTION_KEYS.CHAT}_${userId}`);
  localStorage.setItem(`wa_chatHistory_${userId}`, encrypted);
};

export const getChatHistoryFromLocal = (userId) => {
  const encrypted = localStorage.getItem(`wa_chatHistory_${userId}`);
  return decryptData(encrypted, `${ENCRYPTION_KEYS.CHAT}_${userId}`) || {};
};

export const saveContactsToLocal = (contacts, userId) => {
  const encrypted = encryptData(contacts, `${ENCRYPTION_KEYS.CONTACTS}_${userId}`);
  localStorage.setItem(`wa_contacts_${userId}`, encrypted);
};

export const getContactsFromLocal = (userId) => {
  const encrypted = localStorage.getItem(`wa_contacts_${userId}`);
  return decryptData(encrypted, `${ENCRYPTION_KEYS.CONTACTS}_${userId}`) || [];
};