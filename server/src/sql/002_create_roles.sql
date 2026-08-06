CREATE TABLE roles (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    role_name VARCHAR(30) NOT NULL UNIQUE,

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);