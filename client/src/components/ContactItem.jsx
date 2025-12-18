import React from "react";
import { HiOutlineUserCircle, HiOutlineUserGroup } from "react-icons/hi";

const ContactItem = ({ contact, isSelected, onClick }) => {
  const getDisplayName = () => {
    if (contact.name) return contact.name;
    if (contact.isGroup) return `Group: ${contact.number}`;
    return contact.number;
  };

  const getDisplayInfo = () => {
    if (contact.isGroup) {
      return `${contact.participants?.length || 0} members`;
    }
    // New line: Show total messages if the data exists
    if (contact.totalMessages !== undefined) {
      return `${contact.totalMessages} messages total`;
    }
    return contact.number.replace("@c.us", "").replace("@g.us", "");
  };

  return (
    <div
      className={`contact-item ${contact.isGroup ? 'group-item' : ''} ${isSelected ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="contact-avatar">
        {contact.isGroup ? (
          <HiOutlineUserGroup size={35} className="group-icon" />
        ) : (
          <HiOutlineUserCircle size={35} />
        )}
      </div>
      <div className="contact-details">
        <div className="contact-name-row">
          <strong className="contact-name">{getDisplayName()}</strong>
          {contact.pinned && (
            <span className="pinned-indicator" title="Pinned"></span>
          )}
        </div>
        <div className="contact-info-row">
          <small className="contact-info">{getDisplayInfo()}</small>
          {contact.unreadCount > 0 && (
            <span className="unread-badge">{contact.unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactItem;