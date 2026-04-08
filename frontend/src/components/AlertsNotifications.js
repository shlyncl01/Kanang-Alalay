import React, { useState, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";

const AlertsNotifications = () => {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await axios.get("/api/alerts");
      setAlerts(response.data);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    }
  };

  const handleAlertClick = async (alert) => {
    setSelectedAlert(alert);
    if (!alert.isRead) {
      try {
        await axios.patch(`/api/alerts/${alert._id}/read`);
        fetchAlerts(); // Refresh list to reflect read status
      } catch (error) {
        console.error("Error updating alert status:", error);
      }
    }
  };

  const closeDetails = () => {
    setSelectedAlert(null);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("System Alerts & Notifications Report", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Alerts: ${alerts.length}`, 14, 36);

    const tableColumn = ["Date & Time", "Type", "Title", "Status"];
    const tableRows = [];

    alerts.forEach(alert => {
      const alertData = [
        new Date(alert.createdAt).toLocaleString(),
        alert.type,
        alert.title,
        alert.isRead ? "Read" : "Unread"
      ];
      tableRows.push(alertData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 42,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`Alerts_Report_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="alerts-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Alerts & Notifications</h2>
        <button 
          onClick={generatePDF} 
          style={{ padding: "10px 15px", backgroundColor: "#2980b9", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Convert to PDF
        </button>
      </div>

      <div className="alerts-list" style={{ border: "1px solid #ccc", borderRadius: "4px" }}>
        {alerts.length === 0 ? (
          <p style={{ padding: "15px" }}>No alerts found.</p>
        ) : (
          alerts.map(alert => (
            <div 
              key={alert._id} 
              onClick={() => handleAlertClick(alert)}
              style={{ 
                padding: "15px", 
                borderBottom: "1px solid #eee", 
                cursor: "pointer", 
                backgroundColor: alert.isRead ? "#ffffff" : "#f0f8ff",
                fontWeight: alert.isRead ? "normal" : "bold"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>[{alert.type}] {alert.title}</span>
                <span style={{ fontSize: "0.85em", color: "#666" }}>
                  {new Date(alert.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center"
        }}>
          <div style={{ backgroundColor: "#fff", padding: "25px", borderRadius: "5px", width: "500px", maxWidth: "90%" }}>
            <h3 style={{ marginTop: 0 }}>Alert Details</h3>
            <p><strong>Timestamp:</strong> {new Date(selectedAlert.createdAt).toLocaleString()}</p>
            <p><strong>Type:</strong> {selectedAlert.type}</p>
            <p><strong>Title:</strong> {selectedAlert.title}</p>
            <p><strong>Message:</strong> {selectedAlert.message}</p>
            
            {selectedAlert.details && (
              <div style={{ marginTop: "15px" }}>
                <strong>Related Data:</strong>
                <pre style={{ backgroundColor: "#f4f4f4", padding: "10px", borderRadius: "4px", overflowX: "auto" }}>
                  {JSON.stringify(selectedAlert.details, null, 2)}
                </pre>
              </div>
            )}
            
            {selectedAlert.relatedUser && (
              <p style={{ marginTop: "15px" }}>
                <strong>Related User:</strong> {selectedAlert.relatedUser.username} ({selectedAlert.relatedUser.email})
              </p>
            )}

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button 
                onClick={closeDetails} 
                style={{ padding: "8px 16px", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsNotifications;