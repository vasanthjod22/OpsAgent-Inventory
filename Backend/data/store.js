/**
 * In-memory data store for OpsAgent Backend
 * Seeded with sample data matching the UI's localStorage schema.
 * In production, replace with a real database (e.g. MongoDB, PostgreSQL).
 */

const { randomUUID: uuidv4 } = require('crypto');

const store = {
  users: [],
  inventory: [
    { sku: 'HYD-FLT-001', name: 'Hydraulic Oil Filter 10 Micron', category: 'Filters', qty: 18, unit: 'Nos', min: 10, max: 50 },
    { sku: 'HYD-FLT-002', name: 'Hydraulic Oil Filter 25 Micron', category: 'Filters', qty: 8,  unit: 'Nos', min: 10, max: 40 },
    { sku: 'ENG-OIL-SAE', name: 'Engine Oil SAE 15W-40',          category: 'Lubricants', qty: 45, unit: 'Ltrs', min: 20, max: 100 },
    { sku: 'AIR-FLT-JCB', name: 'Air Filter JCB 3DX',             category: 'Filters', qty: 6,  unit: 'Nos', min: 5,  max: 20  },
    { sku: 'SEAL-KIT-HYD', name: 'Hydraulic Cylinder Seal Kit',   category: 'Seals',    qty: 3,  unit: 'Set', min: 5,  max: 15  },
    { sku: 'BELT-FAN-001', name: 'Fan Belt V-Type Standard',       category: 'Belts',    qty: 12, unit: 'Nos', min: 5,  max: 25  },
    { sku: 'GREASE-EP2',  name: 'EP2 Grease 1Kg Tin',             category: 'Lubricants', qty: 25, unit: 'Kgs', min: 10, max: 50 },
    { sku: 'TIRE-TIPPER', name: 'Tipper Truck Tyre 10R20',         category: 'Tyres',    qty: 4,  unit: 'Nos', min: 6,  max: 20  },
    { sku: 'BATT-12V',    name: 'Battery 12V 150Ah',               category: 'Electrical', qty: 2, unit: 'Nos', min: 3, max: 10  },
    { sku: 'FUEL-FILTER', name: 'Fuel Filter Primary',             category: 'Filters', qty: 15, unit: 'Nos', min: 8,  max: 30  },
  ],
  finance: [
    { id: uuidv4(), date: '2026-05-20', type: 'Income',  category: 'Service Revenue', description: 'Excavator rental Site A',         customer: 'Kumar Constructions',    amount: 85000,   status: 'Completed' },
    { id: uuidv4(), date: '2026-05-19', type: 'Expense', category: 'Fuel',            description: 'Diesel weekly refill',             customer: 'HP Petrol Bunk',         amount: -22000,  status: 'Completed' },
    { id: uuidv4(), date: '2026-05-18', type: 'Income',  category: 'Logistics',       description: 'Transport of materials to Site B', customer: 'L&T Infrastructure',     amount: 45000,   status: 'Completed' },
    { id: uuidv4(), date: '2026-05-17', type: 'Expense', category: 'Maintenance',     description: 'Crane hydraulic repair',           customer: 'Heavy Equip Mechanics',  amount: -18500,  status: 'Processing' },
    { id: uuidv4(), date: '2026-05-15', type: 'Income',  category: 'Equipment Sales', description: 'Sale of old generator',            customer: 'Local Scrap Traders',    amount: 35000,   status: 'Completed' },
    { id: uuidv4(), date: '2026-05-14', type: 'Expense', category: 'Parts',           description: 'Bulk order of JCB Air Filters',    customer: 'JCB Spares',             amount: -15000,  status: 'Completed' },
    { id: uuidv4(), date: '2026-05-12', type: 'Income',  category: 'Service Revenue', description: 'Bulldozer rental Site C',          customer: 'Kumar Constructions',    amount: 110000,  status: 'Processing' },
    { id: uuidv4(), date: '2026-05-10', type: 'Expense', category: 'Wages',           description: 'Weekly labor payment',             customer: 'Site Workers',           amount: -45000,  status: 'Completed' },
    { id: uuidv4(), date: '2026-05-08', type: 'Expense', category: 'Taxes',           description: 'GST Payment Q1',                  customer: 'Govt of India',          amount: -32000,  status: 'Completed' },
    { id: uuidv4(), date: '2026-05-05', type: 'Income',  category: 'Logistics',       description: 'Transport of materials to Site A', customer: 'Mega Builders',          amount: 65000,   status: 'Completed' },
  ],
  bills: [],
  quotations: [],
  grn: [
    { id: 'GRN-1045', date: '2026-05-21', supplier: 'JCB Spares',    itemCount: 12, status: 'Processed', items: [] },
    { id: 'GRN-1046', date: '2026-05-20', supplier: 'HP Petrol Bunk', itemCount: 1,  status: 'Pending',   items: [] },
    { id: 'GRN-1047', date: '2026-05-19', supplier: 'Local Traders',  itemCount: 4,  status: 'Pending',   items: [] },
  ],
  company: {},
};

module.exports = store;
