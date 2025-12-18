import axios from "axios";

const API = "http://localhost:3000/api";

export const api = {
  createUser: (userName) =>
    axios.post(`${API}/user/create`, { userName }),

  deleteUser: (userId) =>
    axios.delete(`${API}/user/${userId}`),

  logoutUser: (userId) =>
    axios.get(`${API}/user/logout`, {
      headers: { "x-user-id": userId },
    }),

  getQR: (userId) =>
    axios.get(`${API}/user/qr?userId=${userId}`),

  getContacts: (userId) =>
    axios.get(`${API}/user/contacts`, {
      headers: { "x-user-id": userId },
    }),

  sendMessage: (userId, formData) =>
    axios.post(`${API}/user/send`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        "x-user-id": userId,
      },
    }),
};
