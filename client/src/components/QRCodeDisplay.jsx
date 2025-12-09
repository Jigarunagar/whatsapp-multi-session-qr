import React, { useState, useEffect } from "react";
import { HiOutlineQrcode, HiOutlineRefresh } from "react-icons/hi";
import { FiAlertCircle } from "react-icons/fi";

const QRCodeDisplay = ({
  qrCode,
  onRefresh,
  onClose,
  showRefreshButton = true,
  isLoading = false,
  error = null,
  userName = "",
  expirationTime = null
}) => {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isExpiring, setIsExpiring] = useState(false);

  useEffect(() => {
    if (!expirationTime) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expire = new Date(expirationTime).getTime();
      const difference = expire - now;

      if (difference <= 0) {
        setTimeLeft("Expired");
        setIsExpiring(true);
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      setIsExpiring(minutes < 1);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [expirationTime]);

  if (error) {
    return (
      <div className="qr-display-container error">
        <div className="qr-header">
          <FiAlertCircle className="qr-error-icon" />
          <h3>QR Code Error</h3>
          <p>{error}</p>
        </div>
        <div className="qr-actions">
          {showRefreshButton && (
            <button 
              className="qr-refresh-btn"
              onClick={onRefresh}
            >
              <HiOutlineRefresh /> Retry
            </button>
          )}
          {onClose && (
            <button 
              className="qr-copy-btn"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="qr-display-container loading">
        <div className="qr-loading">
          <div className="qr-loading-spinner"></div>
          <h3>Generating QR Code...</h3>
          <p>Please wait a moment</p>
        </div>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="qr-display-container empty">
        <div className="qr-header">
          <HiOutlineQrcode className="qr-empty-icon" />
          <h3>No QR Code Available</h3>
          <p>Generate a QR code to start</p>
        </div>
        <div className="qr-actions">
          {showRefreshButton && (
            <button 
              className="qr-refresh-btn"
              onClick={onRefresh}
            >
              <HiOutlineQrcode /> Generate QR
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="qr-display-container">
      <div className="qr-header">
        {userName && (
          <p className="qr-user-info">User: <strong>{userName}</strong></p>
        )}
      </div>

      {expirationTime && (
        <div className={`qr-timer ${isExpiring ? 'expiring' : ''}`}>
          <div className="timer-label">
            <span className="timer-icon">⏱</span>
            <span>QR expires in:</span>
          </div>
          <div className="timer-value">
            {timeLeft}
            {isExpiring && <span className="expiring-indicator">!</span>}
          </div>
        </div>
      )}

      <div className="qr-image-container">
        <img 
          src={qrCode} 
          alt="WhatsApp QR Code" 
          className="qr-image"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = `
              <div class="qr-fallback">
                <HiOutlineQrcode />
                <p>Failed to load QR image</p>
              </div>
            `;
          }}
        />
        {expirationTime && (
          <div className="qr-overlay">
            <div className="qr-overlay-text">
              {isExpiring ? "Expiring soon!" : "Active"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


export default QRCodeDisplay;