import React from "react";
import { HiOutlineUserCircle } from "react-icons/hi";

const ContactItem = ({ contact, isSelected, onClick }) => {
  return (
    <div 
      className={`contact-item ${isSelected ? 'active' : ''}`} 
      onClick={onClick}
    >
      <div className="contact-avatar">
        <HiOutlineUserCircle size={22} />
      </div>
      <div className="contact-details">
        <strong>{contact.name}</strong>
        <small>{contact.number}</small>
      </div>
    </div>
  );
};

export default ContactItem;