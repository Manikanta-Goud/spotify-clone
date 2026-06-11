const express=require('express');
const cors = require('cors');
const cookieparser=require('cookie-parser');
const authrouter=require('./routes/auth.routes');
const musicrouter=require('./routes/music.routes');

const app=express();

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieparser());

app.use('/api/auth', authrouter);
app.use('/api/music', musicrouter);

module.exports=app;