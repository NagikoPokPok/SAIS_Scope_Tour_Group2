const express = require('express');
const app = express();

const cors = require('cors');
app.use(cors());


app.get('/fibonacci', (req, res) => {
    // Lấy tham số n từ query, ví dụ /fibonacci?n=10
    const n = parseInt(req.query.n);

    if (isNaN(n) || n < 1) {
        return res.status(400).json({ error: 'Invalid parameter n' });
    }

    // Hàm tính dãy Fibonacci
    function fibonacciSequence(n) {
        const fib = [0n, 1n];
        for (let i = 2; i < n; i++) {
            fib[i] = fib[i-1] + fib[i-2];
        }
        return fib.slice(0, n).map(num => num.toString());
    }

    const result = fibonacciSequence(n);

    res.json({ fibonacci: result });
});

// Khởi động server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
