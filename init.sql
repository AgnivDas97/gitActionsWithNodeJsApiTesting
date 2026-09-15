-- Table Definition: users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    maiden_name VARCHAR(100),
    age INTEGER,
    gender VARCHAR(20),
    email VARCHAR(255),
    phone VARCHAR(50),
    username VARCHAR(100),
    birth_date DATE
);

-- Optional initial seed data (insert if not already present)
INSERT INTO users (id, first_name, last_name, maiden_name, age, gender, email, phone, username, birth_date)
VALUES
  (1, 'Emily', 'Johnson', 'Smith', 29, 'female', 'emily.johnson@x.dummyjson.com', '+81 965-431-3024', 'emilys', '1996-05-30'),
  (2, 'Michael', 'Williams', NULL, 36, 'male', 'michael.williams@x.dummyjson.com', '+49 258-627-6644', 'michaelw', '1989-08-10'),
  (3, 'Sophia', 'Brown', NULL, 43, 'female', 'sophia.brown@x.dummyjson.com', '+81 210-652-2785', 'sophiab', '1982-11-05')
ON CONFLICT (id) DO NOTHING;
