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

  // Cleanup function for user data - UPDATED
  const cleanupUserData = (userId) => {
    if (!userId) return;

    console.log(`🧹 Cleaning up localStorage for user: ${userId}`);

    // Get all localStorage keys
    const allKeys = Object.keys(localStorage);

    // Remove all user-specific keys
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

    // Also remove from general user names
    try {
      const userNamesStr = localStorage.getItem("wa_user_names");
      if (userNamesStr) {
        const userNamesObj = JSON.parse(userNamesStr);
        delete userNamesObj[userId];
        localStorage.setItem("wa_user_names", JSON.stringify(userNamesObj));

        // Update state
        setUserNames(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
      }
    } catch (error) {
      console.log("Error updating user names:", error);
    }

    // Clear any pending timeouts
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
  };

  // Reset user state
  const resetUserState = () => {
    setContacts([]);
    setSelectedChat(null);
    setNumber("");
    setChatHistory({});
    setSearchTerm("");
    setLastConnectionTime(null);
  };

  // Load user data from localStorage
  const loadUserData = (userId) => {
    if (!userId) return;

    try {
      // Load chat history
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

      // Load selected chat
      const selectedChatKey = `wa_selectedChat_${userId}`;
      const savedSelectedChat = localStorage.getItem(selectedChatKey);
      if (savedSelectedChat) {
        try {
          const chat = JSON.parse(savedSelectedChat);
          setSelectedChat(chat);
          setNumber(chat.number);
        } catch (e) {
          // Ignore parse error
        }
      }

      // Load contacts
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

  // Save user data to localStorage
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

    // Ensure UI/state is reset to a disconnected baseline when switching users
    setStatus("Disconnected");
    setQrLoadingUser(null);

    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state for new user
    resetUserState();

    // Load data for this user
    loadUserData(activeUser.userId);

    // Create new EventSource connection
    const events = new EventSource(
      `https://whatsapp-multi-session-qr-production.up.railway.app/api/user/status?userId=${activeUser.userId}`
    );
    eventSourceRef.current = events;

    // Check for existing QR
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

        // Handle phone logged out event
        if (data.type === "phone-logged-out") {
          console.log(`📱 Phone logged out for user: ${activeUser.userId}`);

          // Show notification
          toast.error(`WhatsApp logged out on phone for ${activeUser.userName || activeUser.userId}`);

          // Clean up localStorage data
          cleanupUserData(activeUser.userId);

          // Reset state
          resetUserState();

          // Update status
          setStatus("Disconnected");

          // Remove QR from state
          setQrMap(prev => {
            const copy = { ...prev };
            delete copy[activeUser.userId];
            return copy;
          });

          // Remove QR from localStorage
          localStorage.removeItem(qrKey);

          // Fetch new QR (only if still the active user)
          setTimeout(() => {
            if (currentUserIdRef.current !== activeUser.userId) return;
            setQrLoadingUser(activeUser.userId);
            fetchQr();
          }, 1000);

          return;
        }

        // Handle disconnection event
        if (data.type === "disconnected") {
          console.log(`User ${activeUser.userId} disconnected`);
          setStatus("Disconnected");

          // Set a timeout to clean up if still disconnected after 10 seconds
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

          // Clean up data
          cleanupUserData(activeUser.userId);
          resetUserState();

          setStatus("Disconnected");
          toast.error("Session expired. Please create a new session.");
          return;
        }

        if (data.type === "qr-update") {
          console.log(`New QR for user: ${activeUser.userId}`);

          // Save QR to localStorage
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

        // Connected event
        if (data.type === "connected") {
          console.log(`User ${activeUser.userId} connected`);

          // Clear any pending cleanup
          if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current);
            cleanupTimeoutRef.current = null;
          }

          // Remove QR
          localStorage.removeItem(qrKey);
          setQrMap(prev => {
            const copy = { ...prev };
            delete copy[activeUser.userId];
            return copy;
          });

          // Update status and timestamp
          setStatus("Connected");
          setLastConnectionTime(new Date().toISOString());

          // Load contacts
          loadContacts();
          return;
        }

        if (data.type === "init") {
          if (data.status === "connected") {
            setStatus("Connected");
            setLastConnectionTime(new Date().toISOString());

            // Remove QR
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

            // Save to localStorage
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

        // Handle ping events
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

      // If connection fails, mark as disconnected
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

  // Keep refs in sync to avoid stale-closure issues in async callbacks
  useEffect(() => {
    currentUserIdRef.current = activeUser ? activeUser.userId : null;
  }, [activeUser]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    qrMapRef.current = qrMap;
  }, [qrMap]);

  // Effect to monitor connection status
  useEffect(() => {
    if (!activeUser) return;

    // If status changes to Disconnected and we have data, schedule cleanup
    if (status === "Disconnected" && contacts.length > 0) {
      console.log(`Scheduling cleanup check for ${activeUser.userId}`);

      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }

      // Wait 15 seconds before cleaning up (in case it's temporary)
      cleanupTimeoutRef.current = setTimeout(() => {
        // Only clean up if still disconnected and no QR (use refs to avoid stale closure)
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
        `https://whatsapp-multi-session-qr-production.up.railway.app/api/user/qr?userId=${activeUser.userId}`
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

  // useWhatsApp.js में
  const fetchContacts = async () => {
    if (!activeUser?.userId) return;

    try {
      const response = await axios.get(
        `/api/user/contacts?userId=${activeUser.userId}&includeGroups=true`
      );
      if (response.data.success) {
        setContacts(response.data.contacts);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  const loadContacts = async () => {
    if (!activeUser) return;

    try {
      const response = await axios.get(`https://whatsapp-multi-session-qr-production.up.railway.app/api/user/contacts`, {
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

    // Send the number exactly as it is (with @g.us or @c.us suffix)
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

      const cleanNumber = number.replace("@c.us", "").replace("@g.us", "").replace("@s.whatsapp.net", "");

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
      await axios.get(`https://whatsapp-multi-session-qr-production.up.railway.app/api/user/logout`, {
        headers: { "x-user-id": activeUser.userId }
      });

      setStatus("Disconnected");

      // Clean up data
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