const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const jwtStrategyOptions = {
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(),
    ExtractJwt.fromBodyField('token'),
    ExtractJwt.fromUrlQueryParameter('token'),
    ExtractJwt.fromHeader('Authorization'),
    ExtractJwt.fromExtractors([
      (req) => {
        var token = null;
        if (req && req.cookies) {
          token = req.cookies['accessToken'];
        }
        return token;
      },
    ]),
  ]),
  secretOrKey: process.env.JWT_SECRET || 'your_secret_key',
};

const verifyJwt = async (payload, done) => {
  try {
    if (!payload.id) {
      return done(null, false);
    }
    return done(null, payload);
  } catch (err) {
    return done(err);
  }
};

passport.use(new JwtStrategy(jwtStrategyOptions, verifyJwt));

module.exports = passport;
