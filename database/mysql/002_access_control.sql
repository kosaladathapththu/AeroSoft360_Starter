USE aerosoft360_rebuild;

CREATE TABLE IF NOT EXISTS roles (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,code VARCHAR(40) NOT NULL UNIQUE,name VARCHAR(255) NOT NULL,created_at TIMESTAMP NULL,updated_at TIMESTAMP NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS permissions (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,code VARCHAR(80) NOT NULL UNIQUE,name VARCHAR(255) NOT NULL,created_at TIMESTAMP NULL,updated_at TIMESTAMP NULL) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS role_permissions (role_id BIGINT UNSIGNED NOT NULL,permission_id BIGINT UNSIGNED NOT NULL,PRIMARY KEY(role_id,permission_id),FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,role_id BIGINT UNSIGNED NOT NULL,name VARCHAR(255) NOT NULL,email VARCHAR(255) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,active TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP NULL,updated_at TIMESTAMP NULL,FOREIGN KEY(role_id) REFERENCES roles(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS access_tokens (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,user_id BIGINT UNSIGNED NOT NULL,token_hash VARCHAR(64) NOT NULL UNIQUE,last_used_at DATETIME NULL,expires_at DATETIME NOT NULL,created_at TIMESTAMP NULL,updated_at TIMESTAMP NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB;

INSERT INTO roles(id,code,name,created_at,updated_at) VALUES
(1,'administrator','Administrator',NOW(),NOW()),(2,'reporting','Reporting Only',NOW(),NOW()),(3,'stock_operator','Stock / GRN Operator',NOW(),NOW()),(4,'viewer','Full-System Viewer',NOW(),NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name),updated_at=NOW();
INSERT INTO permissions(id,code,name,created_at,updated_at) VALUES
(1,'workspace.view','View workspace and reports',NOW(),NOW()),(2,'suppliers.manage','Manage suppliers',NOW(),NOW()),(3,'purchases.manage','Manage purchase orders',NOW(),NOW()),(4,'purchases.approve','Approve purchase orders',NOW(),NOW()),(5,'stock.manage','Manage stock and goods receipts',NOW(),NOW()),(6,'accounting.manage','Manage accounting journals',NOW(),NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name),updated_at=NOW();
INSERT IGNORE INTO role_permissions(role_id,permission_id) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(2,1),(3,1),(3,5),(4,1);
INSERT INTO users(id,role_id,name,email,password,active,created_at,updated_at) VALUES
(1,1,'Administrator','admin@aerosoft360.lk','$2y$10$CLLeKcNxHCF10Jqv3W6MoeBzUBDm6Gr.Ha.Bx7VGTC8PxhduQEcRu',1,NOW(),NOW()),
(2,2,'Reporting User','reports@aerosoft360.lk','$2y$10$I5b4/Tan/TeZx75KLRfE9.CSbyhBO9t./MENOY5j6TBmrPhS7mZ9K',1,NOW(),NOW()),
(3,3,'Stock Operator','stock@aerosoft360.lk','$2y$10$/j6OEXLxHJHOHeWHBNyBTuBC/ogn9pxEIau/glhomayQGVFWQIPNy',1,NOW(),NOW()),
(4,4,'System Viewer','viewer@aerosoft360.lk','$2y$10$oa4ulM.4VyzK73a04OM8cO3cZbgOOoVeYUjcPHNOuXHsvTTkFTTI2',1,NOW(),NOW())
ON DUPLICATE KEY UPDATE role_id=VALUES(role_id),name=VALUES(name),password=VALUES(password),active=1,updated_at=NOW();
