-- Ensure you're in the correct DB
CREATE DATABASE IF NOT EXISTS testmgmt;
USE testmgmt;

-- 1. Users table (No changes needed)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Folders table (No FK to modules)
DROP TABLE IF EXISTS folders;

CREATE TABLE folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tests table (Remove module_id, keep folder_id FK optional)
DROP TABLE IF EXISTS tests;

CREATE TABLE tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  test_case_id VARCHAR(50),
  title VARCHAR(255),
  steps TEXT,
  expected TEXT,
  comments TEXT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50),
  test_status VARCHAR(50),
  folder_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- 4. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  session_id varchar(128) COLLATE utf8mb4_bin NOT NULL,
  expires int(11) unsigned NOT NULL,
  data text COLLATE utf8mb4_bin,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- 5. Optional indexes
CREATE INDEX idx_tests_folder_id ON tests(folder_id);


SELECT * FROM tests;

ALTER TABLE tests ADD UNIQUE (test_case_id);


CREATE TABLE IF NOT EXISTS issue_testcases (
  issue_key VARCHAR(255),
  test_id VARCHAR(255),
  test_case_id VARCHAR(255),
  title TEXT,
  PRIMARY KEY(issue_key, test_id)
);

SELECT * FROM issue_testcases;

