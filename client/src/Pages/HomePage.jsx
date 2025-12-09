import React, { useState } from "react";
import UserSidebar from "../components/UserSidebar";
import WhatsAppSidebar from "../components/WhatsAppSidebar";
import ChatArea from "../components/ChatArea";
import Modal from "../components/Modal";
import useUserManagement from "../hooks/useUserManagement";
import useWhatsApp from "../hooks/useWhatsApp";
import "../styles/App.css";
 

function HomePage() {
  const {
    users,
    activeUser,
    newUserName,
    setNewUserName,
    createNewUser,
    deleteUser,
    setActiveUser
  } = useUserManagement();

  const {
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
  } = useWhatsApp(activeUser);

  const [showModal, setShowModal] = useState(false);

  return (
    <div className="wa-main">
      <UserSidebar
        users={users}
        activeUser={activeUser}
        setActiveUser={setActiveUser}
        deleteUser={deleteUser}
        fetchQr={fetchQr}
        openModal={() => setShowModal(true)}
      />

      <WhatsAppSidebar
        activeUser={activeUser}
        userName={userName}
        status={status}
        qr={qr}
        contacts={filteredContacts}
        selectedChat={selectedChat}
        setSelectedChat={setSelectedChat}
        setNumber={setNumber}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        logoutUser={logoutUser}
        fetchQr={fetchQr}
      />

      <ChatArea
        activeUser={activeUser}
        status={status}
        selectedChat={selectedChat}
        chatHistory={chatHistory}
        message={message}
        setMessage={setMessage}
        file={file}
        setFile={setFile}
        handleSend={handleSend}
        messagesEndRef={messagesEndRef}
        openModal={() => setShowModal(true)}
      />

      {showModal && (
        <Modal
          title="Create New User"
          onClose={() => setShowModal(false)}
        >
          <input
            type="text"
            placeholder="Enter user name"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && createNewUser() && setShowModal(false)}
            className="modal-input"
          />
          <div className="modal-actions">
            <button 
              onClick={() => {
                createNewUser();
                setShowModal(false);
              }}
              className="btn-primary"
            >
              Create
            </button>
            <button 
              onClick={() => setShowModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default HomePage;