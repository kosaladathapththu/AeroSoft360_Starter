USE aerosoft360_rebuild;

ALTER TABLE customer_po_lines
  ADD COLUMN IF NOT EXISTS order_mode VARCHAR(20) NOT NULL DEFAULT 'badge' AFTER article_id,
  ADD COLUMN IF NOT EXISTS set_item_id BIGINT UNSIGNED NULL AFTER set_template_id;

ALTER TABLE customer_po_lines
  ADD CONSTRAINT customer_po_lines_set_item_fk
  FOREIGN KEY (set_item_id) REFERENCES article_set_items(id);
