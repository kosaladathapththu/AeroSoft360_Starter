<?php
return [
    // Optional full path for hosted servers where mysqldump is not on PATH.
    'mysql_binary' => env('DB_BACKUP_MYSQL_BINARY'),
    'timeout' => 300,
];
