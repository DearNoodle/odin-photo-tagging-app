const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getRepeatedSession(req) {
  return await prisma.session.findUnique({
    where: {
      id: req.user.id,
    },
    select: {
      id: true,
    },
  });
}

async function createSession(req) {
  await prisma.session.create({
    data: {
      id: req.user.id,
      charactersClicked: {
        'Hinanawi Tenshi': false,
        'Reiuji Utsuho': false,
        'Mystia Lorelei': false,
        'Flandre Scarlet': false,
        'Shiki Eiki': false,
      },
    },
  });
}

async function getBoundsByCharacter(req) {
  return await prisma.characterLocation.findUnique({
    where: {
      character: req.body.character,
    },
    select: {
      bounds: true,
    },
  });
}

async function getClickStatus(req) {
  return await prisma.session.findUnique({
    where: { id: req.user.id },
    select: {
      charactersClicked: true,
    },
  });
}

async function updateClickStatus(req, charactersClicked) {
  await prisma.session.update({
    where: { id: req.user.id },
    data: {
      charactersClicked: { ...charactersClicked, [req.body.character]: true },
    },
  });
}

async function getLeaderboard() {
  return await prisma.leaderboard.findMany({
    orderBy: {
      time: 'asc',
    },
    take: 10,
  });
}

async function postLeaderboard(req, time) {
  await prisma.leaderboard.create({
    data: {
      name: req.body.name,
      time,
    },
  });
}

async function getSessionCreatedTime(req) {
  return await prisma.session.findUnique({
    where: {
      id: req.user.id,
    },
    select: {
      createdAt: true,
    },
  });
}

async function putFinishTime(req, time) {
  return await prisma.session.update({
    where: {
      id: req.user.id,
    },
    data: {
      finishTime: time,
    },
  });
}

async function getFinishTime(req) {
  return await prisma.session.findUnique({
    where: {
      id: req.user.id,
    },
    select: {
      finishTime: true,
    },
  });
}

module.exports = {
  getRepeatedSession,
  createSession,
  getBoundsByCharacter,
  getClickStatus,
  updateClickStatus,
  getLeaderboard,
  postLeaderboard,
  getSessionCreatedTime,
  putFinishTime,
  getFinishTime,
};
