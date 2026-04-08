import React from 'react';
import { FaBox } from 'react-icons/fa';

const InventoryTab = ({ inventory, stats, setShowAddInventory }) => {
    return (
        <div className="card-white" style={{ position: 'relative' }}>
            <div className="card-header">
                <h5>Inventory & Stock Alerts</h5>
                <button className="btn-success-sm" onClick={() => setShowAddInventory(true)}>
                    <FaBox /> Add Item
                </button>
            </div>
            
            <div className="stats-grid" style={{ marginBottom: '20px' }}>
                <div className="stat-card" style={{ padding: '15px' }}>
                    <h3 style={{ color: '#dc3545' }}>{stats.lowStockItems}</h3><p>Low Stock Items</p>
                </div>
                <div className="stat-card" style={{ padding: '15px' }}><h3>{inventory.length}</h3><p>Total Items Tracked</p></div>
                <div className="stat-card" style={{ padding: '15px' }}><h3>0</h3><p>Expiring Soon</p></div>
            </div>
            
            <table className="custom-table">
                <thead>
                    <tr><th>Item Name</th><th>Category</th><th>Current Stock</th><th>Status</th></tr>
                </thead>
                <tbody>
                    {inventory.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No inventory data tracked yet. Click "Add Item" to begin tracking.</td></tr>
                    ) : (
                        inventory.map(item => (
                            <tr key={item._id}>
                                <td><strong>{item.name}</strong></td>
                                <td><span className="badge-custom staff">{item.category}</span></td>
                                <td>{item.quantity} {item.unit}</td>
                                <td><span className="status active">In Stock</span></td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default InventoryTab;