import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";

import {
  saveChatHistoryToLocal,
  getChatHistoryFromLocal,
  saveContactsToLocal,
  getContactsFromLocal
} from "../utils/encryption";

const useWhatsApp = (activeUser) => {
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatHistory, setChatHistory] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [userName, setUserName] = useState("");

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!activeUser) return;

    const events = new EventSource(
      `https://whatsapp-multi-session-qr-production.up.railway.app/api/user/status?userId=${activeUser.userId}`
    );

    events.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "qr-update") {
          setQr(data.qr);
          setStatus("Disconnected");
          return;
        }

        if (data.type === "init") {
          if (data.status === "connected") {
            setStatus("Connected");
            setUserName(data.userName || activeUser.userName);
            setQr("");
            loadContacts();
          } else if (data.status === "disconnected" && data.qrCode) {
            setQr(data.qrCode);
            setStatus("Disconnected");
          }
          return;
        }

        if (data.type === "connected") {
          setStatus("Connected");
          setQr("");
          loadContacts();
          return;
        } else if (e.data === "qr") {
          setStatus("Disconnected");
          fetchQr();
        } else {
          const msg = JSON.parse(e.data);
          if (msg.type === "user-info") {
            const updatedName = msg.name;
            setUserName(updatedName);
          } else {
            saveIncomingMessage(msg);
          }
        }
      } catch (err) {
        console.log("SSE parse error:", err);
      }
    };

    events.onerror = () => {
      console.log("SSE connection error");
      events.close();
    };

    return () => events.close();
  }, [activeUser]);

  useEffect(() => {
    if (activeUser) {
      const savedHistory = getChatHistoryFromLocal(activeUser.userId);
      setChatHistory(savedHistory);

      const savedSelectedChat = localStorage.getItem(
        `wa_selectedChat_${activeUser.userId}`
      );
      if (savedSelectedChat) {
        const chat = JSON.parse(savedSelectedChat);
        setSelectedChat(chat);
        setNumber(chat.number);
      }

      const savedContacts = getContactsFromLocal(activeUser.userId);
      if (savedContacts.length > 0) {
        setContacts(savedContacts);
      }
    }
  }, [activeUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, selectedChat]);

  const fetchQr = async () => {
    if (!activeUser) return;

    try {
      const res = await axios.get(
        `https://whatsapp-multi-session-qr-production.up.railway.app/api/user/qr?userId=${activeUser.userId}`
      );


      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(res.data, "text/html");
      const img = htmlDoc.querySelector("img");

      if (img) setQr(img.src);
    } catch (err) {
      toast.error("QR fetch error");
      console.log("QR fetch error:", err);
    }
  };

  const loadContacts = async () => {
    if (!activeUser) return;

    try {
      const response = await axios.get(`https://whatsapp-multi-session-qr-production.up.railway.app/api/user/contacts`, {
        headers: { "x-user-id": activeUser.userId }
      }
      );

      const cleanedContacts = response.data.contacts.map((c) => ({
        ...c,
        number: c.number.replace("@c.us", "").replace("@s.whatsapp.net", "")
      }));

      setContacts(cleanedContacts);
      saveContactsToLocal(cleanedContacts, activeUser.userId);
    } catch (err) {
      toast.error("Failed to load contacts");
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!activeUser || !number) {
      toast.error("Select a user and enter number!");
      return;
    }

    const formData = new FormData();
    formData.append("number", number);
    formData.append("message", message);
    if (file) formData.append("file", file);

    try {
      await axios.post(
        `https://whatsapp-multi-session-qr-production.up.railway.app/api/user/send`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "x-user-id": activeUser.userId
          }
        }
      );


      const cleanNumber = number.replace("@c.us", "").replace("@s.whatsapp.net", "");

      const updatedHistory = {
        ...chatHistory,
        [cleanNumber]: [
          ...(chatHistory[cleanNumber] || []),
          {
            type: "outgoing",
            body: message,
            to: number,
            timestamp: new Date().toISOString()
          }
        ]
      };

      setChatHistory(updatedHistory);
      saveChatHistoryToLocal(updatedHistory, activeUser.userId);

      setMessage("");
      setFile(null);
      toast.success("Message sent!");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const saveIncomingMessage = (msg) => {
    if (!activeUser) return;

    const cleanFrom = msg.from
      .replace("@c.us", "")
      .replace("@s.whatsapp.net", "");

    const updatedHistory = {
      ...chatHistory,
      [cleanFrom]: [
        ...(chatHistory[cleanFrom] || []),
        { ...msg, timestamp: new Date().toISOString() }
      ]
    };

    setChatHistory(updatedHistory);
    saveChatHistoryToLocal(updatedHistory, activeUser.userId);
  };

  const logoutUser = async () => {
    if (!activeUser) return;

    try {
      await axios.get(`https://whatsapp-multi-session-qr-production.up.railway.app/api/user/logout`, {
        headers: { "x-user-id": activeUser.userId }
      });

      setStatus("Disconnected");
      setQr("");

      toast.success("Logged out. New QR will be generated.");
    } catch (error) {
      toast.error("Failed to logout: " + error.message);
    }
  };

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.number?.includes(searchTerm)
  );

  return {
    qr,
    status,
    number,
    setNumber,
    message,
    setMessage,
    file,
    setFile,
    contacts,
    selectedChat,
    setSelectedChat,
    chatHistory,
    searchTerm,
    setSearchTerm,
    userName,
    handleSend,
    logoutUser,
    fetchQr,
    messagesEndRef,
    filteredContacts,
    saveIncomingMessage
  };
};

export default useWhatsApp;
