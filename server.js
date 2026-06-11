require('dotenv').config();
const app=require('./src/app');
const connectDB=require('./src/db/db');

connectDB();

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.send('Spotify Backend is working!');
});

app.listen(5000,() => {
    console.log("server is running on port 5000");
})
