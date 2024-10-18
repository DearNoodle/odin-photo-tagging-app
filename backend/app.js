require('dotenv').config();
const express = require('express');
const cors = require('cors');
const router = require('./routes/routes');
const app = express();

app.use(
  cors({
    origin: 'https://taupe-medovik-26ae2d.netlify.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const passport = require('./configs/passportConfig');
app.use(passport.initialize());

const cookieParser = require('cookie-parser');
app.use(cookieParser());

app.use('/api', router);

const PORT = process.env.PORT || 3000;
// '0.0.0.0' host % 8080 POST required for railway deploy
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Listening on port ${PORT}!`);
});
