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
  const [qrMap, setQrMap] = useState({});
  const [qrLoadingUser, setQrLoadingUser] = useState(null);
  const [status, setStatus] = useState("Disconnected");
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatHistory, setChatHistory] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [userNames, setUserNames] = useState({});


  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!activeUser) return;

    const events = new EventSource(
      `https://whatsapp-multi-session-qr-production.up.railway.app/api/user/status?userId=${activeUser.userId}`
    );


    const savedQr = getQrFromLocal(activeUser.userId);

    if (savedQr) {
      setQrMap(prev => ({
        ...prev,
        [activeUser.userId]: savedQr
      }));
    } else {
      
      setQrLoadingUser(activeUser.userId);
      fetchQr();
    }

    events.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "qr-update" && data.userId === activeUser.userId) {
          setQrMap(prev => ({
            ...prev,
            [activeUser.userId]: data.qr
          }));

          saveQrToLocal(activeUser.userId, data.qr);

          setQrLoadingUser(null);
          setStatus("Disconnected");
          return;
        }

        
        if (data.type === "connected" && data.userId === activeUser.userId) {
          setStatus("Connected");

          
          setQrMap(prev => {
            const copy = { ...prev };
            delete copy[activeUser.userId];
            return copy;
          });

          removeQrFromLocal(activeUser.userId);
          loadContacts();
          return;
        }

        if (data.type === "init") {
          if (data.status === "connected") {
            setStatus("Connected");
            
            loadContacts();

            setQrMap(prev => {
              const copy = { ...prev };
              delete copy[activeUser.userId];
              return copy;
            });

            removeQrFromLocal(activeUser.userId);
          } else if (data.status === "disconnected" && data.qrCode) {
            setQr(data.qrCode);
            setStatus("Disconnected");
          }
          return;
        }

        if (data.type === "connected") {
          setStatus("Connected");

          setQrMap(prev => {
            const copy = { ...prev };
            delete copy[activeUser.userId];
            return copy;
          });

          removeQrFromLocal(activeUser.userId);
          loadContacts();
          return;
        }
        else if (e.data === "qr") {
          setStatus("Disconnected");
          fetchQr();
        } else {
          const msg = JSON.parse(e.data);
          if (msg.type === "user-info") {
            const updatedName = msg.name;

            setUserNames(prev => {
              const updated = {
                ...prev,
                [activeUser.userId]: updatedName
              };

              localStorage.setItem(
                "wa_user_names",
                JSON.stringify(updated)
              );

              return updated;
            });
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

  const prevUserIdRef = useRef(null);
  useEffect(() => {
    if (!activeUser) return;

    if (
      prevUserIdRef.current &&
      prevUserIdRef.current !== activeUser.userId
    ) {
      setContacts([]);
      setSelectedChat(null);
      setNumber("");
      setStatus("Disconnected");
    }

    prevUserIdRef.current = activeUser.userId;
  }, [activeUser]);

  useEffect(() => {
    const savedNames = localStorage.getItem("wa_user_names");
    if (savedNames) {
      setUserNames(JSON.parse(savedNames));
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, selectedChat]);

  const fetchQr = async () => {
    if (!activeUser) return;

    setQrLoadingUser(activeUser.userId);

    try {
      const res = await axios.get(
        `https://whatsapp-multi-session-qr-production.up.railway.app/api/user/qr?userId=${activeUser.userId}`
      );

      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(res.data, "text/html");
      const img = htmlDoc.querySelector("img");

      if (img) {
        setQrMap(prev => ({
          ...prev,
          [activeUser.userId]: img.src
        }));

        saveQrToLocal(activeUser.userId, img.src);
      }
    } catch {
      toast.error("QR fetch error");
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

  const saveQrToLocal = (userId, qr) => {
    localStorage.setItem(`wa_qr_${userId}`, qr);
  };

  const getQrFromLocal = (userId) => {
    return localStorage.getItem(`wa_qr_${userId}`);
  };

  const removeQrFromLocal = (userId) => {
    localStorage.removeItem(`wa_qr_${userId}`);
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
    qrMap,
    qrLoadingUser,
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
    userNames,
    handleSend,
    logoutUser,
    fetchQr,
    messagesEndRef,
    filteredContacts,
    saveIncomingMessage
  };
};

export default useWhatsApp;
