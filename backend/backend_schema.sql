
-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'creator')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tests Table
CREATE TABLE tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    creator_id INTEGER REFERENCES users(id),
    duration_minutes INTEGER NOT NULL,
    total_marks INTEGER DEFAULT 0,
    instructions TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questions Table
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('MCQ', 'MSQ', 'NUMERICAL')),
    image_url TEXT, -- URL to the cropped image
    marks INTEGER NOT NULL,
    negative_marks INTEGER NOT NULL,
    options JSONB, -- Stores array of option text/images e.g. ["A", "B", "C", "D"]
    correct_answer TEXT, -- "A" or "A,C" or "4.5"
    solution_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student Test Attempts (Submissions)
CREATE TABLE submissions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES tests(id),
    student_id INTEGER REFERENCES users(id),
    score INTEGER,
    accuracy_percentage DECIMAL(5,2),
    time_taken_seconds INTEGER,
    status VARCHAR(50) DEFAULT 'completed',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Detailed Responses per Question
CREATE TABLE responses (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES questions(id),
    selected_option TEXT,
    is_correct BOOLEAN,
    time_spent_seconds INTEGER
);
