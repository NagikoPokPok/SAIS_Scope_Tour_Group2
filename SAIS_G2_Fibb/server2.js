const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());

// API mới: chỉ tính toán đoạn cần dùng theo offset & limit
app.get('/fibonacci', (req, res) => {
    const offset = parseInt(req.query.offset);
    const limit = parseInt(req.query.limit);

    if (isNaN(offset) || isNaN(limit) || offset < 0 || limit < 1) {
        return res.status(400).json({ error: 'Invalid offset or limit' });
    }

    const fib = [0n, 1n];
    for (let i = 2; i < offset + limit; i++) {
        fib[i] = fib[i - 1] + fib[i - 2];
    }

    const result = [];
    for (let i = offset; i < offset + limit; i++) {
        result.push(fib[i].toString());
    }

    res.json({ fibonacci: result });
});

// Khởi động server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
