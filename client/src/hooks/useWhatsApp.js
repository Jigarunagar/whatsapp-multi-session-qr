import { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";

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
  const [lastConnectionTime, setLastConnectionTime] = useState(null);
  
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const cleanupTimeoutRef = useRef(null);
  const currentUserIdRef = useRef(null);
  const statusRef = useRef(status);
  const qrMapRef = useRef(qrMap);

  const cleanupUserData = (userId) => {
    if (!userId) return;
    
    console.log(`🧹 Cleaning up localStorage for user: ${userId}`);
    
    const allKeys = Object.keys(localStorage);
    
    allKeys.forEach(key => {
      if (key.includes(userId) || 
          key.startsWith(`wa_chatHistory_${userId}`) ||
          key.startsWith(`wa_contacts_${userId}`) ||
          key.startsWith(`wa_selectedChat_${userId}`) ||
          key.startsWith(`wa_qr_${userId}`) ||
          key === `wa_qr_${userId}`) {
        localStorage.removeItem(key);
        console.log(`Removed: ${key}`);
      }
    });
    
    try {
      const userNamesStr = localStorage.getItem("wa_user_names");
      if (userNamesStr) {
        const userNamesObj = JSON.parse(userNamesStr);
        delete userNamesObj[userId];
        localStorage.setItem("wa_user_names", JSON.stringify(userNamesObj));
        
        setUserNames(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      }
    } catch (error) {
      console.log("Error updating user names:", error);
    }
    
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
  };

  const resetUserState = () => {
    setContacts([]);
    setSelectedChat(null);
    setNumber("");
    setChatHistory({});
    setSearchTerm("");
    setLastConnectionTime(null);
  };

  const loadUserData = (userId) => {
    if (!userId) return;
    
    try {
      const chatHistoryKey = `wa_chatHistory_${userId}`;
      const savedHistory = localStorage.getItem(chatHistoryKey);
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          setChatHistory(parsed);
        } catch (e) {
          setChatHistory({});
        }
      }

      const selectedChatKey = `wa_selectedChat_${userId}`;
      const savedSelectedChat = localStorage.getItem(selectedChatKey);
      if (savedSelectedChat) {
        try {
          const chat = JSON.parse(savedSelectedChat);
          setSelectedChat(chat);
          setNumber(chat.number);
        } catch (e) {
        }
      }

      const contactsKey = `wa_contacts_${userId}`;
      const savedContacts = localStorage.getItem(contactsKey);
      if (savedContacts) {
        try {
          const contacts = JSON.parse(savedContacts);
          setContacts(contacts);
        } catch (e) {
          setContacts([]);
        }
      }
    } catch (error) {
      console.log("Error loading user data:", error);
    }
  };

  const saveUserData = (userId, dataType, data) => {
    if (!userId) return;
    
    try {
      const key = `wa_${dataType}_${userId}`;
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.log(`Error saving ${dataType}:`, error);
    }
  };

  useEffect(() => {
    if (!activeUser) return;

    setStatus("Disconnected");
    setQrLoadingUser(null);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    resetUserState();
    loadUserData(activeUser.userId);

    const events = new EventSource(
      `https://whatsapp-multi-session-qr-1.onrender.com/api/user/status?userId=${activeUser.userId}`
    );
    eventSourceRef.current = events;

    const qrKey = `wa_qr_${activeUser.userId}`;
    const savedQr = localStorage.getItem(qrKey);
    if (savedQr) {
      setQrMap(prev => ({
        ...prev,
        [activeUser.userId]: savedQr
      }));
      setStatus("Disconnected");
    } else {
      setQrLoadingUser(activeUser.userId);
      fetchQr();
    }

    events.onopen = () => {
      console.log(`SSE connected for user: ${activeUser.userId}`);
    };

    events.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log(`SSE Event for ${activeUser.userId}:`, data.type);
        
        if (data.type === "phone-logged-out") {
          console.log(`📱 Phone logged out for user: ${activeUser.userId}`);
          
          toast.error(`WhatsApp logged out on phone for ${activeUser.userName || activeUser.userId}`);
          
          cleanupUserData(activeUser.userId);
          
          resetUserState();
          
          setStatus("Disconnected");
          
          setQrMap(prev => {
            const copy = { ...prev };
            delete copy[activeUser.userId];
            return copy;
          });
          
          localStorage.removeItem(qrKey);
          
          setTimeout(() => {
            if (currentUserIdRef.current !== activeUser.userId) return;
            setQrLoadingUser(activeUser.userId);
            fetchQr();
          }, 1000);
          
          return;
        }
        
        if (data.type === "disconnected") {
          console.log(`User ${activeUser.userId} disconnected`);
          setStatus("Disconnected");
          
          if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current);
          }
          
          cleanupTimeoutRef.current = setTimeout(() => {
            if (statusRef.current === "Disconnected" && !(qrMapRef.current && qrMapRef.current[activeUser.userId])) {
              console.log(`Auto-cleaning up disconnected user: ${activeUser.userId}`);
              cleanupUserData(activeUser.userId);
              resetUserState();
            }
          }, 10000);
          
          return;
        }

        if (data.type === "max-reconnect") {
          console.log(`Max reconnection attempts for user: ${activeUser.userId}`);
          
          cleanupUserData(activeUser.userId);
          resetUserState();
          
          setStatus("Disconnected");
          toast.error("Session expired. Please create a new session.");
          return;
        }

        if (data.type === "qr-update") {
          console.log(`New QR for user: ${activeUser.userId}`);
          
          if (data.qr) {
            localStorage.setItem(qrKey, data.qr);
            setQrMap(prev => ({
              ...prev,
              [activeUser.userId]: data.qr
            }));
          }
          
          setQrLoadingUser(null);
          setStatus("Disconnected");
          return;
        }

        if (data.type === "connected") {
          console.log(`User ${activeUser.userId} connected`);
          
          if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current);
            cleanupTimeoutRef.current = null;
          }
          
          localStorage.removeItem(qrKey);
          setQrMap(prev => {
            const copy = { ...prev };
            delete copy[activeUser.userId];
            return copy;
          });
          
          setStatus("Connected");
          setLastConnectionTime(new Date().toISOString());
          
          loadContacts();
          return;
        }

        if (data.type === "init") {
          if (data.status === "connected") {
            setStatus("Connected");
            setLastConnectionTime(new Date().toISOString());
            
            localStorage.removeItem(qrKey);
            setQrMap(prev => {
              const copy = { ...prev };
              delete copy[activeUser.userId];
              return copy;
            });
            
            loadContacts();
          } else if (data.status === "disconnected" && data.qrCode) {
            setQrMap(prev => ({
              ...prev,
              [activeUser.userId]: data.qrCode
            }));
            setStatus("Disconnected");
          }
          return;
        }
        
        if (data.type === "user-info") {
          const updatedName = data.name;
          setUserNames(prev => {
            const updated = {
              ...prev,
              [activeUser.userId]: updatedName
            };
            
            try {
              localStorage.setItem("wa_user_names", JSON.stringify(updated));
            } catch (error) {
              console.log("Error saving user names:", error);
            }
            
            return updated;
          });
        } else if (data.type === "incoming") {
          saveIncomingMessage(data);
        }
        
        if (data.type === "ping") {
          // Connection is alive
          return;
        }
      } catch (err) {
        console.log("SSE parse error:", err);
      }
    };

    events.onerror = (error) => {
      console.log("SSE connection error:", error);
      events.close();
      
      setStatus("Disconnected");
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    };
  }, [activeUser]);

  useEffect(() => {
    currentUserIdRef.current = activeUser ? activeUser.userId : null;
  }, [activeUser]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    qrMapRef.current = qrMap;
  }, [qrMap]);

  useEffect(() => {
    if (!activeUser) return;
    
    if (status === "Disconnected" && contacts.length > 0) {
      console.log(`Scheduling cleanup check for ${activeUser.userId}`);
      
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      
      cleanupTimeoutRef.current = setTimeout(() => {
        if (statusRef.current === "Disconnected" && !(qrMapRef.current && qrMapRef.current[activeUser.userId])) {
          console.log(`Executing delayed cleanup for ${activeUser.userId}`);
          cleanupUserData(activeUser.userId);
          resetUserState();
        }
      }, 15000);
    }
    
    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [status, activeUser, contacts.length, qrMap]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, selectedChat]);

  const fetchQr = async () => {
    if (!activeUser) return;

    setQrLoadingUser(activeUser.userId);

    try {
      const res = await axios.get(
        `https://whatsapp-multi-session-qr-1.onrender.com/api/user/qr?userId=${activeUser.userId}`
      );

      const parser = new DOMParser();
      const htmlDoc = parser.parseFromString(res.data, "text/html");
      const img = htmlDoc.querySelector("img");

      if (img && img.src) {
        const qrKey = `wa_qr_${activeUser.userId}`;
        localStorage.setItem(qrKey, img.src);
        setQrMap(prev => ({
          ...prev,
          [activeUser.userId]: img.src
        }));
      }
    } catch (error) {
      toast.error("QR fetch error: " + error.message);
    } finally {
      setQrLoadingUser(null);
    }
  };

  const loadContacts = async () => {
    if (!activeUser) return;

    try {
      const response = await axios.get(`https://whatsapp-multi-session-qr-1.onrender.com/api/user/contacts`, {
        headers: { "x-user-id": activeUser.userId }
      });

      const cleanedContacts = response.data.contacts.map((c) => ({
        ...c,
        number: c.number.replace("@c.us", "").replace("@s.whatsapp.net", "")
      }));

      setContacts(cleanedContacts);
      saveUserData(activeUser.userId, "contacts", cleanedContacts);
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
        `https://whatsapp-multi-session-qr-1.onrender.com/api/user/send`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "x-user-id": activeUser.userId
          }
        }
      );

      const cleanNumber = number.replace("@c.us", "").replace("@s.whatsapp.net", "");

      const newEntry = {
        type: "outgoing",
        body: message,
        to: number,
        timestamp: new Date().toISOString()
      };

      setChatHistory((prev) => {
        const updatedHistory = {
          ...prev,
          [cleanNumber]: [...(prev[cleanNumber] || []), newEntry]
        };
        saveUserData(activeUser.userId, "chatHistory", updatedHistory);
        return updatedHistory;
      });

      setMessage("");
      setFile(null);
      toast.success("Message sent!");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const saveIncomingMessage = (msg) => {
    if (!activeUser || !msg.from) return;

    const cleanFrom = msg.from.replace("@c.us", "").replace("@s.whatsapp.net", "");

    const incoming = { ...msg, timestamp: new Date().toISOString() };

    setChatHistory((prev) => {
      const updatedHistory = {
        ...prev,
        [cleanFrom]: [...(prev[cleanFrom] || []), incoming]
      };
      saveUserData(activeUser.userId, "chatHistory", updatedHistory);
      return updatedHistory;
    });
  };

  const logoutUser = async () => {
    if (!activeUser) return;

    try {
      await axios.get(`https://whatsapp-multi-session-qr-1.onrender.com/api/user/logout`, {
        headers: { "x-user-id": activeUser.userId }
      });

      setStatus("Disconnected");
      
      cleanupUserData(activeUser.userId);
      resetUserState();
      
      toast.success("Logged out successfully.");
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
    filteredContacts
  };
};

export default useWhatsApp;