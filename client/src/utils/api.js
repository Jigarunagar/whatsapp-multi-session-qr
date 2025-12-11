import axios from "axios";

// const API_BASE = "http://localhost:3000/api";

export const api = {
  // User management
  createUser: (userName) =>
    axios.post(`https://whatsapp-multi-session-qr.onrender.com/api/user/create`, { userName }),

  deleteUser: (userId) =>
    axios.delete(`https://whatsapp-multi-session-qr.onrender.com/api/user/${userId}`),

  logoutUser: (userId) =>
    axios.get(`https://whatsapp-multi-session-qr.onrender.com/api/user/logout`, { headers: { 'x-user-id': userId } }),

  // WhatsApp operations
  getQR: (userId) =>
    axios.get(`https://whatsapp-multi-session-qr.onrender.com/api/user/qr?userId=${userId}`),

  getContacts: (userId) =>
    axios.get(`https://whatsapp-multi-session-qr.onrender.com/api/user/contacts`, { headers: { 'x-user-id': userId } }),

  sendMessage: (userId, formData) =>
    axios.post(`https://whatsapp-multi-session-qr.onrender.com/api/user/send`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        'x-user-id': userId
      }
    })
};