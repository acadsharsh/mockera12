require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper: Verify Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) return res.status(400).json({ error: 'User not found' });
    
    // In production use bcrypt.compare
    // const validPassword = await bcrypt.compare(password, user.password_hash);
    const validPassword = password === user.password_hash; // Simple check for prototype if not hashed yet
    
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret');
    res.json({ token, role: user.role, name: user.email.split('@')[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    // In production hash password
    const newUser = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email',
      [email, password, role]
    );
    res.json(newUser.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- STUDENT ROUTES ---

// Get All Published Tests
app.get('/api/student/tests', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.title, t.duration_minutes, t.total_marks, 
      (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) as question_count
      FROM tests t 
      WHERE t.is_published = TRUE
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Single Test details (for attempting)
app.get('/api/test/:id', authenticateToken, async (req, res) => {
  try {
    const testId = req.params.id;
    const testResult = await pool.query('SELECT * FROM tests WHERE id = $1', [testId]);
    const questionsResult = await pool.query('SELECT id, question_type, image_url, options FROM questions WHERE test_id = $1 ORDER BY id ASC', [testId]);
    
    if (testResult.rows.length === 0) return res.status(404).json({ error: 'Test not found' });

    res.json({
      test: testResult.rows[0],
      questions: questionsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit Test
app.post('/api/student/submit', authenticateToken, async (req, res) => {
    const { testId, responses, timeTaken } = req.body;
    const studentId = req.user.id;

    try {
        // Calculate Score
        let score = 0;
        let correctCount = 0;
        
        // Fetch correct answers
        const questionsRes = await pool.query('SELECT id, correct_answer, marks, negative_marks FROM questions WHERE test_id = $1', [testId]);
        const questionMap = new Map();
        questionsRes.rows.forEach(q => questionMap.set(q.id, q));

        const processedResponses = [];

        for (const resp of responses) {
            const q = questionMap.get(resp.questionId);
            if (!q) continue;

            let isCorrect = false;
            if (resp.selectedOption === q.correct_answer) {
                score += q.marks;
                isCorrect = true;
                correctCount++;
            } else if (resp.selectedOption) {
                score -= q.negative_marks;
            }

            processedResponses.push({
                questionId: resp.questionId,
                selectedOption: resp.selectedOption,
                isCorrect,
                timeSpent: resp.timeSpent || 0
            });
        }

        // Save Submission
        const subResult = await pool.query(
            'INSERT INTO submissions (test_id, student_id, score, time_taken_seconds) VALUES ($1, $2, $3, $4) RETURNING id',
            [testId, studentId, score, timeTaken]
        );
        const submissionId = subResult.rows[0].id;

        // Save Responses (Batch insert preferred in prod, simple loop here)
        for (const pr of processedResponses) {
            await pool.query(
                'INSERT INTO responses (submission_id, question_id, selected_option, is_correct, time_spent_seconds) VALUES ($1, $2, $3, $4, $5)',
                [submissionId, pr.questionId, pr.selectedOption, pr.isCorrect, pr.timeSpent]
            );
        }

        res.json({ success: true, submissionId });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Result
app.get('/api/student/result/:submissionId', authenticateToken, async (req, res) => {
    try {
        const subId = req.params.submissionId;
        const subRes = await pool.query(`
            SELECT s.*, t.title, t.total_marks 
            FROM submissions s 
            JOIN tests t ON s.test_id = t.id 
            WHERE s.id = $1
        `, [subId]);

        if (subRes.rows.length === 0) return res.status(404).json({ error: 'Result not found' });

        res.json(subRes.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- CREATOR ROUTES ---

app.get('/api/creator/stats', authenticateToken, async (req, res) => {
    // Check role in real app
    try {
        const userId = req.user.id;
        const stats = {
            totalTests: 12, // Replace with count query
            activeStudents: 340,
            avgScore: 145
        };
        res.json(stats);
    } catch(err) {
        res.status(500).json({error: err.message});
    }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
