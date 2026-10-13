CREATE DATABASE IF NOT EXISTS aerosoft360_rebuild CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aerosoft360_rebuild;

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NULL,
  payment_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS materials (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(30) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  type VARCHAR(20) NOT NULL,
  is_postable TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS accounting_periods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(40) NOT NULL UNIQUE,
  supplier_id BIGINT UNSIGNED NOT NULL,
  order_date DATE NOT NULL,
  expected_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  total DECIMAL(18,2) NOT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT po_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  received_quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(18,4) NOT NULL,
  line_total DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY po_material_unique (purchase_order_id, material_id),
  CONSTRAINT pol_po_fk FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT pol_material_fk FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS goods_receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(40) NOT NULL UNIQUE,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  received_on DATE NOT NULL,
  supplier_invoice VARCHAR(80) NULL,
  status VARCHAR(20) NOT NULL,
  total DECIMAL(18,2) NOT NULL,
  posted_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT gr_po_fk FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT gr_supplier_fk FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  goods_receipt_id BIGINT UNSIGNED NOT NULL,
  purchase_order_line_id BIGINT UNSIGNED NOT NULL,
  material_id BIGINT UNSIGNED NOT NULL,
  batch_number VARCHAR(80) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  unit_cost DECIMAL(18,4) NOT NULL,
  line_total DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT grl_gr_fk FOREIGN KEY (goods_receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  CONSTRAINT grl_pol_fk FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_lines(id),
  CONSTRAINT grl_material_fk FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  material_id BIGINT UNSIGNED NOT NULL,
  batch_number VARCHAR(80) NOT NULL,
  movement_type VARCHAR(40) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  unit_cost DECIMAL(18,4) NOT NULL,
  source_type VARCHAR(80) NOT NULL,
  source_id BIGINT UNSIGNED NOT NULL,
  event_key VARCHAR(180) NOT NULL UNIQUE,
  occurred_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT movement_material_fk FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_balances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  material_id BIGINT UNSIGNED NOT NULL,
  batch_number VARCHAR(80) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(18,4) NOT NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY material_batch_unique (material_id, batch_number),
  CONSTRAINT balance_material_fk FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(40) NOT NULL UNIQUE,
  accounting_period_id BIGINT UNSIGNED NOT NULL,
  source_type VARCHAR(80) NOT NULL,
  source_id BIGINT UNSIGNED NOT NULL,
  posting_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,
  posted_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY journal_source_unique (source_type, source_id),
  CONSTRAINT journal_period_fk FOREIGN KEY (accounting_period_id) REFERENCES accounting_periods(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id BIGINT UNSIGNED NOT NULL,
  account_id BIGINT UNSIGNED NOT NULL,
  debit DECIMAL(18,2) NOT NULL DEFAULT 0,
  credit DECIMAL(18,2) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  CONSTRAINT jl_journal_fk FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  CONSTRAINT jl_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO accounts (code,name,type,is_postable,created_at,updated_at) VALUES
 ('1000','Cash and Bank','asset',1,NOW(),NOW()),
 ('1100','Accounts Receivable','asset',1,NOW(),NOW()),
 ('1300','Inventory - Raw Materials','asset',1,NOW(),NOW()),
 ('1310','Inventory - Work in Progress','asset',1,NOW(),NOW()),
 ('1320','Inventory - Finished Goods','asset',1,NOW(),NOW()),
 ('2100','Goods Received Not Invoiced','liability',1,NOW(),NOW()),
 ('2200','Accounts Payable','liability',1,NOW(),NOW()),
 ('2300','Taxes Payable','liability',1,NOW(),NOW()),
 ('3000','Owner Capital','equity',1,NOW(),NOW()),
 ('3100','Retained Earnings','equity',1,NOW(),NOW()),
 ('4000','Domestic Sales','revenue',1,NOW(),NOW()),
 ('5000','Cost of Raw Materials','expense',1,NOW(),NOW()),
 ('5100','Direct Labour','expense',1,NOW(),NOW()),
 ('5200','Factory Overheads','expense',1,NOW(),NOW()),
 ('5300','Selling and Distribution','expense',1,NOW(),NOW()),
 ('5400','Administrative Expenses','expense',1,NOW(),NOW()),
 ('5500','Bank Charges','expense',1,NOW(),NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name),type=VALUES(type),is_postable=VALUES(is_postable);

INSERT INTO accounting_periods (id,name,starts_on,ends_on,status,created_at,updated_at)
VALUES (1,'Development period 2026/2027','2026-01-01','2027-03-31','open',NOW(),NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name),starts_on=VALUES(starts_on),ends_on=VALUES(ends_on),status='open';

INSERT INTO suppliers (id,code,name,phone,payment_days,status,created_at,updated_at) VALUES
 (1,'SUP-DEV-001','Lanka Polymer Supplies (Development)','011-000-0001',30,'active',NOW(),NOW()),
 (2,'SUP-DEV-002','Metro Packaging (Development)','011-000-0002',21,'active',NOW(),NOW()),
 (3,'SUP-DEV-003','ColourChem Lanka (Development)','011-000-0003',30,'active',NOW(),NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name),phone=VALUES(phone),payment_days=VALUES(payment_days);

INSERT INTO materials (id,code,name,category,unit,active,created_at,updated_at) VALUES
 (1,'SOLE-EVA-01','EVA Sole','raw_material','PCS',1,NOW(),NOW()),
 (2,'LEATHER-BLK-01','Black Upper Material','raw_material','M2',1,NOW(),NOW()),
 (3,'LACE-BLK-120','Black Lace 120 cm','raw_material','PAIR',1,NOW(),NOW()),
 (4,'BOX-YMAC-L','Y-MAC Shoe Box Large','packing','PCS',1,NOW(),NOW()),
 (5,'LABEL-YMAC-01','Y-MAC Product Label','packing','PCS',1,NOW(),NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),unit=VALUES(unit),active=1;

INSERT INTO purchase_orders (id,number,supplier_id,order_date,expected_date,status,total,approved_at,created_at,updated_at) VALUES
 (1,'PO-DEV-0001',1,'2026-10-10','2026-10-15','part_received',62500.00,'2026-10-10 10:00:00',NOW(),NOW()),
 (2,'PO-DEV-0002',2,'2026-10-13','2026-10-20','approved',45000.00,'2026-10-13 11:00:00',NOW(),NOW())
ON DUPLICATE KEY UPDATE supplier_id=VALUES(supplier_id),status=VALUES(status),total=VALUES(total);

INSERT INTO purchase_order_lines (id,purchase_order_id,material_id,quantity,received_quantity,unit_cost,line_total,created_at,updated_at) VALUES
 (1,1,1,500.0000,200.0000,125.0000,62500.00,NOW(),NOW()),
 (2,2,4,1000.0000,0.0000,45.0000,45000.00,NOW(),NOW())
ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),received_quantity=VALUES(received_quantity),unit_cost=VALUES(unit_cost),line_total=VALUES(line_total);

INSERT INTO goods_receipts (id,number,purchase_order_id,supplier_id,received_on,supplier_invoice,status,total,posted_at,created_at,updated_at)
VALUES (1,'GRN-DEV-0001',1,1,'2026-10-12','DEV-SINV-001','posted',25000.00,'2026-10-12 09:30:00',NOW(),NOW())
ON DUPLICATE KEY UPDATE total=VALUES(total),status='posted';

INSERT INTO goods_receipt_lines (id,goods_receipt_id,purchase_order_line_id,material_id,batch_number,quantity,unit_cost,line_total,created_at,updated_at)
VALUES (1,1,1,1,'RM-DEV-261012-A',200.0000,125.0000,25000.00,NOW(),NOW())
ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),unit_cost=VALUES(unit_cost),line_total=VALUES(line_total);

INSERT INTO stock_movements (material_id,batch_number,movement_type,quantity,unit_cost,source_type,source_id,event_key,occurred_at)
VALUES (1,'RM-DEV-261012-A','purchase_receipt',200.0000,125.0000,'goods_receipt',1,'grn:1:line:1','2026-10-12 09:30:00')
ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),unit_cost=VALUES(unit_cost);

INSERT INTO stock_balances (material_id,batch_number,quantity,unit_cost,updated_at)
VALUES (1,'RM-DEV-261012-A',200.0000,125.0000,NOW())
ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),unit_cost=VALUES(unit_cost),updated_at=NOW();

INSERT INTO journal_entries (id,number,accounting_period_id,source_type,source_id,posting_date,description,status,posted_at,created_at,updated_at)
VALUES (1,'JV-DEV-0001',1,'goods_receipt',1,'2026-10-12','Raw materials received under GRN-DEV-0001','posted','2026-10-12 09:30:00',NOW(),NOW())
ON DUPLICATE KEY UPDATE description=VALUES(description),status='posted';

INSERT INTO journal_lines (id,journal_entry_id,account_id,debit,credit,description,created_at,updated_at) VALUES
 (1,1,(SELECT id FROM accounts WHERE code='1300'),25000.00,0.00,'Raw material inventory received',NOW(),NOW()),
 (2,1,(SELECT id FROM accounts WHERE code='2100'),0.00,25000.00,'GRNI liability recognized',NOW(),NOW())
ON DUPLICATE KEY UPDATE debit=VALUES(debit),credit=VALUES(credit),description=VALUES(description);

INSERT INTO audit_logs (event,entity_type,entity_id,payload,created_at)
SELECT 'development_seed.loaded','database',1,JSON_OBJECT('purpose','local development only'),NOW()
WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE event='development_seed.loaded');
