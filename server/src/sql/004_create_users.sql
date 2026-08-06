CREATE TABLE users (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    first_name VARCHAR(50) NOT NULL,

    last_name VARCHAR(50) NOT NULL,

    email VARCHAR(255) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    role_id UUID NOT NULL,

    manager_id UUID,

    department_id UUID,

    status VARCHAR(20)
        CHECK (status IN ('ACTIVE','INVITED','INACTIVE'))
        DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_role
        FOREIGN KEY(role_id)
        REFERENCES roles(id),

    CONSTRAINT fk_manager
        FOREIGN KEY(manager_id)
        REFERENCES users(id)
        ON DELETE SET NULL

);