USE aerosoft360_rebuild;

ALTER TABLE sales_order_size_lines
  ADD COLUMN IF NOT EXISTS invoiced_quantity DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER quantity;

ALTER TABLE sales_invoices ADD INDEX sales_invoices_sales_order_id_index (sales_order_id);
ALTER TABLE sales_invoices DROP INDEX sales_order_id;

CREATE TABLE IF NOT EXISTS sales_invoice_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sales_invoice_id BIGINT UNSIGNED NOT NULL,
  sales_order_size_line_id BIGINT UNSIGNED NOT NULL,
  article_id BIGINT UNSIGNED NOT NULL,
  size_label VARCHAR(30) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  rate DECIMAL(18,2) NOT NULL,
  line_total DECIMAL(18,2) NOT NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL,
  FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_size_line_id) REFERENCES sales_order_size_lines(id),
  FOREIGN KEY (article_id) REFERENCES articles(id)
) ENGINE=InnoDB;
