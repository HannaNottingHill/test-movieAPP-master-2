const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const Models = require("./models.js");
const passportJWT = require("passport-jwt");

const jwtSecret = process.env.JWT_SECRET;
const Users = Models.User;
const JWTStrategy = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;

passport.use(
  new LocalStrategy(
    {
      usernameField: "username",
      passwordField: "password",
    },
    async (username, password, callback) => {
      console.log(`${username} ${password}`);
      try {
        const user = await Users.findOne({ username: username });
        if (!user) {
          console.log("Incorrect username");
          return callback(null, false, {
            message: "Incorrect username or password.",
          });
        }
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
          console.log("Incorrect password");
          return callback(null, false, { message: "Incorrect password." });
        }
        console.log("Finished");
        return callback(null, user);
      } catch (error) {
        console.error(error);
        return callback(error);
      }
    }
  )
);

passport.use(
  new JWTStrategy(
    {
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret,
    },
    async (jwtPayload, callback) => {
      try {
        const user = await Users.findById(jwtPayload._id);
        if (!user) {
          console.log("User not found");
          return callback(null, false);
        }
        return callback(null, user);
      } catch (error) {
        console.error(error);
        return callback(error);
      }
    }
  )
);
