import { useState, useEffect } from "react";
import axios from "axios";
import { saveUsersToLocal, getUsersFromLocal } from "../utils/encryption";
import toast  from "react-hot-toast";

const useUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [newUserName, setNewUserName] = useState("");

  
  useEffect(() => {
    const savedUsers = getUsersFromLocal();
    if (savedUsers.length > 0) {
      setUsers(savedUsers);

      const lastActiveUser = localStorage.getItem("wa_activeUser");
      if (lastActiveUser) {
        const user = savedUsers.find((u) => u.userId === lastActiveUser);
        if (user) {
          setActiveUser(user);
        }
      }
    }
  }, []);

  const createNewUser = async () => {
    if (!newUserName.trim()) {
      toast.error("Please enter a user name");
      return;
    }

    try {
      const response = await axios.post("https://whatsapp-multi-session-qr-1.onrender.com/api/user/create", {
        userName: newUserName,
      });

      const newUser = {
        userId: response.data.userId,
        userName: newUserName,
        status: "Disconnected",
        createDate: new Date().toISOString(),
      };

      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      saveUsersToLocal(updatedUsers);
      setActiveUser(newUser);
      localStorage.setItem("wa_activeUser", newUser.userId);
      setNewUserName("");

      toast.success("New user created! Scan QR to login.");
    } catch (error) {
      toast.error("Failed to create user: " + error.message);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await axios.delete(`https://whatsapp-multi-session-qr-1.onrender.com/api/user/${userId}`);

      const updatedUsers = users.filter((user) => user.userId !== userId);
      setUsers(updatedUsers);
      saveUsersToLocal(updatedUsers);

      if (activeUser && activeUser.userId === userId) {
        setActiveUser(null);
        localStorage.removeItem("wa_activeUser");
      }

      toast.success("User deleted successfully");
    } catch (error) {
      toast.error("Failed to delete user: " + error.message);
    }
  };

  return {
    users,
    activeUser,
    newUserName,
    setNewUserName,
    setActiveUser,
    createNewUser,
    deleteUser,
  };
};

export default useUserManagement;
