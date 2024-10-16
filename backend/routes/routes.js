const { Router } = require('express');
const controller = require('../controllers/controller');
const { jwtAuth } = require('./middlewares/routeAuth');

const router = Router();

router.get('/token', controller.getToken);
router.post('/session', jwtAuth, controller.createSession);
router.put('/click', jwtAuth, controller.checkClick);
router.get('/leaderboard', jwtAuth, controller.getLeaderboard);
router.post('/leaderboard', jwtAuth, controller.postLeaderboard);
module.exports = router;
