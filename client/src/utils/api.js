import axios from "axios";

const API_BASE = import.meta.env.VITE_API + "/api";

export const api = {
  createUser: (userName) =>
    axios.post(`${API_BASE}/user/create`, { userName }),

  deleteUser: (userId) =>
    axios.delete(`${API_BASE}/user/${userId}`),

  logoutUser: (userId) =>
    axios.get(`${API_BASE}/user/logout`, { headers: { "x-user-id": userId } }),

  getQR: (userId) =>
    axios.get(`${API_BASE}/user/qr?userId=${userId}`),

  getContacts: (userId) =>
    axios.get(`${API_BASE}/user/contacts`, { headers: { "x-user-id": userId } }),

  sendMessage: (userId, formData) =>
    axios.post(`${API_BASE}/user/send`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        "x-user-id": userId,
      },
    }),
};
