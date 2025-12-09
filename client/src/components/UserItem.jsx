import React from "react";
import { HiOutlineUserCircle, HiOutlineQrcode, HiOutlineTrash } from "react-icons/hi";

const UserItem = ({ user, isActive, onSelect, onDelete, onShowQR }) => {
  return (
    <div 
      className={`user-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(user)}
    >
      <div className="user-info">
        <HiOutlineUserCircle size={24} />
        <div className="user-details">
          <strong>{user.userName}</strong>
          <small className={`user-status ${user.status.toLowerCase()}`}>
            {user.status}
          </small>
        </div>
      </div>
      <div className="user-actions">
        {user.status === "Disconnected" && (
          <button 
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              onShowQR(user);
            }}
            title="Show QR"
          >
            <HiOutlineQrcode />
          </button>
        )}
        <button 
          className="btn-icon btn-danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(user.userId);
          }}
          title="Delete User"
        >
          <HiOutlineTrash />
        </button>
      </div>
    </div>
  );
};

export default UserItem;