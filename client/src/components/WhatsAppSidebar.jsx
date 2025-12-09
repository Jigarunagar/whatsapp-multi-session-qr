import React from "react";
import { HiOutlineUserCircle, HiOutlineLogout } from "react-icons/hi";
import { FiSearch } from "react-icons/fi";
import ContactItem from "./ContactItem";
import QRCodeDisplay from "./QRCodeDisplay";

const WhatsAppSidebar = ({
  activeUser,
  userName,
  status,
  qr,                  // 👈 अब इससे UI switch होगा
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

  // --------------------------------------------
  // 🔥 FIX: QR empty = Connected → Show CONTACTS UI
  // --------------------------------------------
  const isConnected = qr === "" && status === "Connected";

  return (
    <div className="wa-sidebar">
      <div className="sidebar-profile">
        <div className="profile-circle">{userName?.charAt(0) || 'U'}</div>
        <div className="profile-info">
          <h4>{userName || activeUser.userName}</h4>
          <small>{activeUser.userId}</small>
        </div>
        <button className="btn-logout" onClick={logoutUser} title="Logout">
          <HiOutlineLogout />
        </button>
      </div>

      {/* -------------------------------------------
         🔥 FIXED LOGIC:
         If QR is EMPTY → Show Contacts
         If QR exists → Show QR Code
      ------------------------------------------- */}
      {isConnected ? (
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
      ) : (
        <div className="qr-area">
          <p>Scan QR to connect {userName}</p>

          <QRCodeDisplay
            qrCode={qr}
            title={`Scan to connect ${userName}`}
            showRefresh={true}
            showDownload={true}
            onRefresh={fetchQr}
            isLoading={!qr}
            size="medium"
          />
        </div>
      )}

      <div className={`status-box ${isConnected ? "ok" : "not-ok"}`}>
        <strong>Status:</strong> {isConnected ? "Connected" : "Disconnected"}
      </div>
    </div>
  );
};

export default WhatsAppSidebar;
