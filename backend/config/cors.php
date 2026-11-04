<?php

return [
    "paths" => ["api/*", "sanctum/csrf-cookie"],
    "allowed_methods" => ["*"],
    "allowed_origins" => ["*"],
    "allowed_origins_patterns" => [],
    "allowed_headers" => ["*"],
    "exposed_headers" => ["Content-Disposition", "Retry-After"],
    "max_age" => 0,
    "supports_credentials" => false,
];
