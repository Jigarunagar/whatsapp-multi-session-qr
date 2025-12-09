import React from "react";

const ChatBubble = ({ message }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`chat-bubble ${message.type === "incoming" ? "incoming" : "outgoing"}`}>
      <span className="bubble-text">{message.body}</span>
      <small className="bubble-time">
        {message.timestamp ? formatTime(message.timestamp) : 'Just now'}
      </small>
    </div>
  );
};

export default ChatBubble;