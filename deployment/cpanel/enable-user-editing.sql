-- Run against the ERP database to enable business editing for all existing roles.
-- Existing administration and purchase approval grants are preserved.
START TRANSACTION;

INSERT INTO role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM roles
CROSS JOIN permissions
LEFT JOIN role_permissions AS existing_grant
    ON existing_grant.role_id = roles.id
    AND existing_grant.permission_id = permissions.id
WHERE permissions.code IN (
    'workspace.view',
    'suppliers.manage',
    'purchases.manage',
    'stock.manage',
    'accounting.manage'
)
AND existing_grant.role_id IS NULL;

COMMIT;

SELECT roles.name AS role_name, permissions.code AS permission
FROM role_permissions
JOIN roles ON roles.id = role_permissions.role_id
JOIN permissions ON permissions.id = role_permissions.permission_id
ORDER BY roles.name, permissions.code;
