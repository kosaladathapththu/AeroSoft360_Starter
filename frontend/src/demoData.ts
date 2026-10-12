export type DemoTable = { columns: string[]; rows: string[][] };

export const demoKpis = [
  { title: 'Sales today', value: 'LKR 482,500', note: '12 posted invoices' },
  { title: 'Production output', value: '1,240 pcs', note: '96.8% accepted' },
  { title: 'Inventory value', value: 'LKR 8.42M', note: 'Across 3 stock types' },
  { title: 'Outstanding AR', value: 'LKR 2.16M', note: 'LKR 340K overdue' },
];

export const demoTables: Record<string, DemoTable> = {
  Manufacturing: {
    columns: ['Batch', 'Product', 'Planned', 'Accepted', 'Rejected', 'Status'],
    rows: [
      ['PB-260101', 'Aero Runner / Black', '600', '420', '8', 'In production'],
      ['PB-260102', 'Cloud Slip-On / Navy', '400', '400', '5', 'QA complete'],
      ['PB-260103', 'Classic Slipper / Brown', '300', '0', '0', 'Materials reserved'],
    ],
  },
  Inventory: {
    columns: ['SKU', 'Batch', 'Location', 'Saleable', 'Blocked', 'Unit cost'],
    rows: [
      ['AR-BLK-08', 'FG-260091', 'FG-A01', '184', '6', 'LKR 1,245.00'],
      ['CS-NVY-09', 'FG-260088', 'FG-A02', '96', '4', 'LKR 1,410.00'],
      ['SOLE-EVA-01', 'RM-260044', 'RM-B03', '2,450', '0', 'LKR 185.50'],
    ],
  },
  Purchasing: {
    columns: ['PO', 'Supplier', 'Order date', 'Expected', 'Total', 'Status'],
    rows: [
      ['PO-260041', 'Lanka Polymer Supplies', '08 Oct 2026', '15 Oct 2026', 'LKR 685,000', 'Part received'],
      ['PO-260042', 'Metro Packaging', '09 Oct 2026', '18 Oct 2026', 'LKR 214,500', 'Approved'],
      ['PO-260043', 'ColourChem Lanka', '10 Oct 2026', '20 Oct 2026', 'LKR 96,800', 'Draft'],
    ],
  },
  'Sales & Reps': {
    columns: ['Invoice', 'Customer', 'Channel', 'Representative', 'Amount', 'Status'],
    rows: [
      ['INV-260812', 'City Footwear', 'Head Office', 'N. Perera', 'LKR 185,000', 'Part paid'],
      ['INV-260813', 'Southern Shoes', 'Direct Sales', 'S. Fernando', 'LKR 142,500', 'Posted'],
      ['INV-260814', 'Kandy Traders', 'Direct Sales', 'A. Silva', 'LKR 155,000', 'Posted'],
    ],
  },
  Collections: {
    columns: ['Receipt', 'Invoice', 'Collected', 'Cleared', 'Allocated', 'Commission'],
    rows: [
      ['RCT-260312', 'INV-260812', '10 Oct 2026', '10 Oct 2026', 'LKR 92,500', 'LKR 2,312.50'],
      ['RCT-260313', 'INV-260799', '09 Oct 2026', 'Pending', 'LKR 75,000', 'Pending clearance'],
      ['RCT-260314', 'INV-260701', '08 Oct 2026', '08 Oct 2026', 'LKR 48,000', 'Late - zero'],
    ],
  },
  'Financial Accounting': {
    columns: ['Journal', 'Source', 'Posting date', 'Debit', 'Credit', 'Status'],
    rows: [
      ['JNL-260901', 'Sales invoice INV-260812', '10 Oct 2026', 'LKR 185,000', 'LKR 185,000', 'Posted'],
      ['JNL-260902', 'Receipt RCT-260312', '10 Oct 2026', 'LKR 92,500', 'LKR 92,500', 'Posted'],
      ['JNL-260903', 'GRN GRN-260118', '11 Oct 2026', 'LKR 342,500', 'LKR 342,500', 'Approved'],
    ],
  },
  'HR & Payroll': {
    columns: ['Employee', 'Department', 'Work date', 'Late', 'Single OT', 'Double OT'],
    rows: [
      ['EMP-014 / K. Nimal', 'Production', '09 Oct 2026', '00:12', '01:20', '00:00'],
      ['EMP-027 / R. Kumari', 'Stores', '09 Oct 2026', '00:00', '00:45', '00:00'],
      ['EMP-031 / D. Saman', 'Production', '11 Oct 2026', '00:00', '00:00', '08:00'],
    ],
  },
  'Management Accounting': {
    columns: ['Cost centre', 'Budget', 'Actual', 'Variance', 'Utilization', 'Status'],
    rows: [
      ['Factory - Cutting', 'LKR 1.20M', 'LKR 1.08M', 'LKR 120K', '90.0%', 'Within budget'],
      ['Factory - Assembly', 'LKR 1.80M', 'LKR 1.92M', '-LKR 120K', '106.7%', 'Review'],
      ['Sales - Direct', 'LKR 650K', 'LKR 602K', 'LKR 48K', '92.6%', 'Within budget'],
    ],
  },
  'Settings & Roles': {
    columns: ['Role / setting', 'Type', 'Effective date', 'Value', 'Owner', 'Status'],
    rows: [
      ['Finance Manager', 'Role', '01 Oct 2026', 'Approve / Post / Reverse', 'Super Admin', 'Active'],
      ['Commission window', 'Business rule', '01 Oct 2026', '100 days', 'Sales Manager', 'Active'],
      ['Base currency', 'Company setting', '01 Oct 2026', 'LKR', 'Super Admin', 'Active'],
    ],
  },
};
