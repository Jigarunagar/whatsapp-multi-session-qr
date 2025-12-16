import React from "react";
import { HiOutlineUserCircle, HiOutlineLogout } from "react-icons/hi";
import { FiSearch } from "react-icons/fi";
import ContactItem from "./ContactItem";
import QRCodeDisplay from "./QRCodeDisplay";

const WhatsAppSidebar = ({
  activeUser,
  userName,
  status,
  qrMap,
  qrLoadingUser,
  contacts,
  selectedChat,
  setSelectedChat,
  setNumber,
  searchTerm,
  setSearchTerm,
  logoutUser,
  fetchQr
}) => {
  if (!activeUser) {
    return (
      <div className="wa-sidebar">
        <div className="select-user-prompt">
          <HiOutlineUserCircle size={64} />
          <h3>Select or Create a User</h3>
          <p>Choose a user from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  const userQr = qrMap?.[activeUser.userId];
  const isGenerating = qrLoadingUser === activeUser.userId;
  const isConnected = status === "Connected";

  const showQR = !isConnected || userQr;

  return (
    <div className="wa-sidebar">
      <div className="sidebar-profile">
        <div className="profile-circle">{userName?.charAt(0) || 'U'}</div>
        <div className="profile-info">
          <h4>
            {userName || activeUser.userName}
          </h4>
          <small>{activeUser.userId}</small>
        </div>
        <button className="btn-logout" onClick={logoutUser} title="Logout">
          <HiOutlineLogout />
        </button>
      </div>


      {showQR ? (
        <div className="qr-area">
          <div className="qr-header">
            <h4>WhatsApp Connection</h4>
            <p className="qr-status">
              {isConnected ? "Reconnect" : "Scan QR Code to Connect"}
            </p>
          </div>


          {userQr && (
            <div className="qr-container">
              <QRCodeDisplay
                qrCode={userQr}
                title={`Scan for ${userName}`}
              />
              <div className="qr-instructions">
                <br />
                <p>1. Open WhatsApp on your phone</p>
                <p>2. Tap Menu → Linked Devices</p>
              </div>
            </div>
          )}

          {!userQr && !isGenerating && (
            <div className="no-qr">
              🔄 QR code generating...
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="search">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="contacts-header">
            <h4>Contacts</h4>
            <span className="contact-count">{contacts.length}</span>
          </div>

          <div className="contact-list">
            {contacts.map((contact, index) => (
              <ContactItem
                key={index}
                contact={contact}
                isSelected={selectedChat?.number === contact.number}
                onClick={() => {
                  setSelectedChat(contact);
                  setNumber(contact.number);
                  localStorage.setItem(
                    `wa_selectedChat_${activeUser.userId}`,
                    JSON.stringify(contact)
                  );
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className={`status-box ${isConnected ? "ok" : "not-ok"}`}>
        <strong>Status:</strong> {isConnected ? "Connected" : "Disconnected"}
      </div>
    </div>
  );
};

export default WhatsAppSidebar;