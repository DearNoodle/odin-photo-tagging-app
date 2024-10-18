const jwt = require('jsonwebtoken');
const query = require('../models/query');
const { v4: uuidv4 } = require('uuid');

const jwtSecret = process.env.JWT_SECRET || 'your_secret_key';

async function getToken(req, res) {
  const payload = { id: uuidv4() };
  const token = jwt.sign(payload, jwtSecret, {
    expiresIn: '30m',
  });
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 60 * 1000,
    sameSite: 'none', // only when deploy
  });
  res.status(200).send('Token get successful');
}

async function createSession(req, res) {
  const response = await query.getRepeatedSession(req);
  if (!response) {
    await query.createSession(req);
    res.send('Session create successful');
  } else {
    res.send('Existing identical session');
  }
}

async function deleteSession(req, res) {
  const response = await query.getRepeatedSession(req);
  if (response) {
    await query.deleteSession(req);
    res.send('Session delete successful');
  } else {
    res.send('Session not found');
  }
}

async function checkClick(req, res) {
  const x = req.body.normalX;
  const y = req.body.normalY;

  const { bounds } = await query.getBoundsByCharacter(req);
  const match = x > bounds.xMin && x < bounds.xMax && y > bounds.yMin && y < bounds.yMax;

  if (match) {
    let { charactersClicked } = await query.getClickStatus(req);
    await query.updateClickStatus(req, charactersClicked);

    const updatedClickStatus = await query.getClickStatus(req);
    charactersClicked = updatedClickStatus.charactersClicked;

    const validateFinished = Object.values(charactersClicked).every((bool) => bool === true);
    if (validateFinished) {
      const { createdAt } = await query.getSessionCreatedTime(req);
      const createdTime = new Date(createdAt);
      const currentTime = Date.now();
      const time = Math.floor((currentTime - createdTime) / 1000);
      await query.putFinishTime(req, time);
    }
    res.send('Correct Click');
  } else {
    res.send('Incorrect Click');
  }
}

async function getLeaderboard(req, res) {
  const leaderboard = await query.getLeaderboard();
  res.send(leaderboard);
}

async function postLeaderboard(req, res) {
  const { finishTime } = await query.getFinishTime(req);
  await query.postLeaderboard(req, finishTime);
  res.send('Leaderboard add successful');
}

module.exports = {
  getToken,
  createSession,
  deleteSession,
  checkClick,
  getLeaderboard,
  postLeaderboard,
};
