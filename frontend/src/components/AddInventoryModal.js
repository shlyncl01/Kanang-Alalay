import React, { useState } from 'react';

const AddInventoryModal = ({ isOpen, onClose, onSave }) => {
    const [form, setForm] = useState({
        name: '',
        category: '',
        quantity: '',
        unit: ''
    });

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!form.name || !form.quantity) {
            alert('Please fill required fields');
            return;
        }
        onSave(form);
        setForm({ name: '', category: '', quantity: '', unit: '' });
        onClose();
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <h3>Add Inventory Item</h3>

                <input placeholder="Item Name"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                />

                <input placeholder="Category"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                />

                <input type="number" placeholder="Quantity"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                />

                <input placeholder="Unit (pcs, box, etc)"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                />

                <button onClick={handleSubmit}>Save</button>
                <button onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
};

export default AddInventoryModal;