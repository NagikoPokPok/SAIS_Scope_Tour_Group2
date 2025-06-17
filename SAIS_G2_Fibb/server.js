const express = require('express');
const app = express();

const cors = require('cors');
app.use(cors());

const MAX_CACHE = 100000;
const fibonacciCache = new Array(MAX_CACHE);
let cacheReady = false;

// Hàm sinh cache dãy Fibonacci
function generateFibonacciCache() {
    fibonacciCache[0] = 0n;
    fibonacciCache[1] = 1n;
    for (let i = 2; i < MAX_CACHE; i++) {
        fibonacciCache[i] = fibonacciCache[i - 1] + fibonacciCache[i - 2];
    }
    cacheReady = true;
    console.log(`✅ Cached ${MAX_CACHE} Fibonacci numbers.`);
}

// Gọi hàm sinh cache sau khi server khởi động
setTimeout(() => {
    console.log("⏳ Starting cache precomputation...");
    generateFibonacciCache();
}, 0);


app.get('/fibonacci', (req, res) => {
    // Lấy tham số n từ query, ví dụ /fibonacci?n=10
    const n = parseInt(req.query.n);

    if (isNaN(n) || n < 1) {
        return res.status(400).json({ error: 'Invalid parameter n' });
    }

    const result = [];

    if (cacheReady && n <= MAX_CACHE) {
        for (let i = 0; i < n; i++) {
            result.push(fibonacciCache[i].toString());
        }
    } else {
        // Trường hợp cache chưa sẵn sàng hoặc n > MAX_CACHE
        const fib = [0n, 1n];
        for (let i = 2; i < n; i++) {
            fib[i] = fib[i - 1] + fib[i - 2];
        }
        for (let i = 0; i < n; i++) {
            result.push(fib[i].toString());
        }
    }

    res.json({ fibonacci: result });
});

// Khởi động server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
