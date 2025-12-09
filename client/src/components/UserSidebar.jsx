import React from "react";
import { HiOutlineUserCircle, HiOutlineUserAdd, HiOutlineQrcode, HiOutlineTrash } from "react-icons/hi";

const UserSidebar = ({ users, activeUser, setActiveUser, deleteUser, fetchQr, openModal }) => {
  return (
    <div className="wa-users-sidebar">
      <div className="sidebar-header">
        <h3><HiOutlineUserCircle /> Users</h3>
        <button className="btn-new-user" onClick={openModal}>
          <HiOutlineUserAdd /> New
        </button>
      </div>

      {users.length === 0 && (
        <div className="no-users">
          <HiOutlineUserCircle size={48} />
          <p>No users found. Please add a user.</p>
        </div>
      )}

      <div className="users-list">
        {users.map((user) => (
          <div
            key={user.userId}
            className={`user-item ${activeUser?.userId === user.userId ? 'active' : ''}`}
            onClick={() => {
              setActiveUser(user);
              localStorage.setItem("wa_activeUser", user.userId);
            }}
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
                    setActiveUser(user);
                    fetchQr();
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
                  deleteUser(user.userId);
                }}
                title="Delete User"
              >
                <HiOutlineTrash />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserSidebar;