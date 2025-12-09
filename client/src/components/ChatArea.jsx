import React from "react";
import { HiOutlineUserCircle, HiOutlineUserAdd } from "react-icons/hi";
import { IoCallOutline, IoVideocamOutline } from "react-icons/io5";
import { FiSearch } from "react-icons/fi";
import ChatBubble from "./ChatBubble";

const ChatArea = ({
  activeUser,
  status,
  selectedChat,
  chatHistory,
  message,
  setMessage,
  file,
  setFile,
  handleSend,
  messagesEndRef,
  openModal
}) => {
  if (!activeUser) {
    return (
      <div className="wa-chat-area">
        <div className="no-active-user">
          <h2>Welcome to Multi-User WhatsApp</h2>
          <p>Create a new user or select an existing one to start</p>
          <button className="btn-create-user" onClick={openModal}>
            <HiOutlineUserAdd /> Create New User
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wa-chat-area">
      <div className="chat-header">
        {selectedChat ? (
          <>
            <div className="chat-contact">
              <HiOutlineUserCircle size={32} />
              <div>
                <h3>{selectedChat.name}</h3>
                <small>{selectedChat.number}</small>
              </div>
            </div>
            <div className="header-actions">
              <IoVideocamOutline title="Video call" />
              <IoCallOutline title="Voice call" />
              <FiSearch title="Search" />
            </div>
          </>
        ) : (
          <h3>Select a contact to start chatting</h3>
        )}
      </div>

      <div className="chat-content">
        {!selectedChat && status === "Connected" && (
          <div className="chat-default">
            <img src="/img.jpg" alt="Welcome" />
            <p>Select a contact to view messages</p>
          </div>
        )}

        {selectedChat && chatHistory[selectedChat.number] && (
          <>
            {chatHistory[selectedChat.number].map((msg, idx) => (
              <ChatBubble key={idx} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {status === "Connected" && selectedChat && (
        <form className="chat-input-box" onSubmit={handleSend}>
          <textarea
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="3"
          />
          <div className="input-actions">
            <input
              type="file"
              id="fileInput"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
            <label htmlFor="fileInput" className="btn-attach">
              📎 Attach
            </label>
            <button type="submit" className="btn-send">
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ChatArea;