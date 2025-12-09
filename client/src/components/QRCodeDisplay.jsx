import React, { useState, useEffect } from "react";
import { HiOutlineQrcode, HiOutlineRefresh } from "react-icons/hi";
import { FiAlertCircle } from "react-icons/fi";

const QRCodeDisplay = ({
  qrCode,
  title = "Scan QR Code",
  description = "Scan this QR code with WhatsApp to connect",
  onRefresh,
  onClose,
  showRefreshButton = true,
  isLoading = false,
  error = null,
  userName = "",
  expirationTime = null
}) => {
  const [copied, setCopied] = useState(false);
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
        <HiOutlineQrcode className="qr-icon" />
        <h3>{title}</h3>
        <p>{description}</p>
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

const QRCodeDisplayStyled = (props) => {
  return (
    <>
      <QRCodeDisplay {...props} />
      <style jsx>{`
        .qr-display-container {
          padding: 30px;
          background: linear-gradient(135deg, #202c33 0%, #111b21 100%);
          border-radius: 20px;
          border: 1px solid #2a3942;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          text-align: center;
          max-width: 320px;
          margin: 0 auto;
          animation: fadeIn 0.5s ease;
          position: relative;
          overflow: hidden;
        }

        .qr-display-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #00a884, #00d394);
        }

        .qr-display-container.error::before {
          background: linear-gradient(90deg, #ff453a, #d32f2f);
        }

        .qr-display-container.loading::before {
          background: linear-gradient(90deg, #ff9500, #ffcc00);
          animation: loadingBar 2s infinite;
        }

        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .qr-header {
          margin-bottom: 20px;
          color: #00a884;
        }

        .qr-icon, .qr-error-icon, .qr-empty-icon {
          font-size: 40px;
          margin-bottom: 15px;
          display: block;
          margin: 0 auto 15px;
        }

        .qr-error-icon {
          color: #ff453a;
        }

        .qr-empty-icon {
          color: #8696a0;
          opacity: 0.5;
        }

        .qr-header h3 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
          color: white;
        }

        .qr-header p {
          font-size: 14px;
          color: #8696a0;
          margin: 0;
          line-height: 1.4;
        }

        .qr-user-info {
          margin-top: 8px !important;
          padding: 6px 12px;
          background: rgba(0, 168, 132, 0.1);
          border-radius: 8px;
          display: inline-block;
        }

        .qr-user-info strong {
          color: #00d394;
        }

        .qr-timer {
          margin: 15px auto;
          padding: 10px 15px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid #2a3942;
          transition: all 0.3s ease;
        }

        .qr-timer.expiring {
          background: rgba(255, 149, 0, 0.1);
          border-color: #ff9500;
          animation: pulseWarning 1s infinite;
        }

        @keyframes pulseWarning {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0); }
          50% { box-shadow: 0 0 0 5px rgba(255, 149, 0, 0.2); }
        }

        .timer-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #8696a0;
          font-size: 13px;
        }

        .timer-icon {
          font-size: 16px;
        }

        .timer-value {
          font-weight: 600;
          font-size: 16px;
          color: white;
          font-family: monospace;
          position: relative;
        }

        .expiring-indicator {
          margin-left: 6px;
          color: #ff9500;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .qr-image-container {
          padding: 15px;
          background: white;
          border-radius: 15px;
          display: inline-block;
          margin: 15px 0;
          position: relative;
          overflow: hidden;
          animation: pulseBorder 2s infinite;
        }

        @keyframes pulseBorder {
          0% { box-shadow: 0 0 0 0 rgba(0, 168, 132, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(0, 168, 132, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 168, 132, 0); }
        }

        .qr-image {
          width: 200px;
          height: 200px;
          border-radius: 10px;
          display: block;
          object-fit: contain;
        }

        .qr-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .qr-image-container:hover .qr-overlay {
          opacity: 1;
        }

        .qr-overlay-text {
          color: white;
          font-weight: 600;
          background: rgba(0, 168, 132, 0.9);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
        }

        .qr-fallback {
          width: 200px;
          height: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #666;
          font-size: 40px;
        }

        .qr-fallback p {
          font-size: 14px;
          margin-top: 10px;
        }       

        .qr-actions {
          margin-top: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .qr-refresh-btn,
        .qr-download-btn,
        .qr-copy-btn {
          flex: 1;
          min-width: 120px;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s ease;
          border: none;
          color: white;
        }

        .qr-refresh-btn {
          background: linear-gradient(135deg, #00a884 0%, #00d394 100%);
        }

        .qr-download-btn {
          background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
        }

        .qr-copy-btn {
          background: linear-gradient(135deg, #8E8E93 0%, #636366 100%);
        }

        .qr-copy-btn.copied {
          background: linear-gradient(135deg, #34C759 0%, #30D158 100%);
        }

        .qr-refresh-btn:hover,
        .qr-download-btn:hover,
        .qr-copy-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
        }

        .qr-refresh-btn:active,
        .qr-download-btn:active,
        .qr-copy-btn:active {
          transform: translateY(0);
        }

        .qr-security-note {
          margin-top: 15px;
          padding: 10px;
          background: rgba(255, 59, 48, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(255, 59, 48, 0.3);
        }

        .qr-security-note small {
          font-size: 11px;
          color: #ff453a;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .qr-loading {
          padding: 40px;
          text-align: center;
          color: #8696a0;
        }

        .qr-loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 168, 132, 0.3);
          border-top-color: #00a884;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .qr-loading h3 {
          margin-bottom: 8px;
          color: white;
        }

        /* Responsive styles */
        @media (max-width: 480px) {
          .qr-display-container {
            padding: 20px;
            max-width: 280px;
          }

          .qr-image {
            width: 180px;
            height: 180px;
          }

          .qr-refresh-btn,
          .qr-download-btn,
          .qr-copy-btn {
            min-width: 100px;
            padding: 10px;
            font-size: 13px;
          }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

// Export both versions
export { QRCodeDisplayStyled };
export default QRCodeDisplay;