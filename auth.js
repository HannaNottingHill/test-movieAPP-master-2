require("dotenv").config();
const jwt = require("jsonwebtoken");
const passport = require("passport");

require("./passport"); // Your local passport file
const jwtSecret = process.env.JWT_SECRET;

let generateJWTToken = (user) => {
  return jwt.sign(user, jwtSecret, {
    subject: user.username, // This is the username you’re encoding in the JWT
    expiresIn: "7d", // This specifies that the token will expire in 7 days
    algorithm: "HS256", // This is the algorithm used to “sign” or encode the values of the JWT
  });
};

/* POST login. */
module.exports = (router) => {
  router.post("/login", (req, res) => {
    console.log("Login route called");
    passport.authenticate("local", { session: false }, (error, user, info) => {
      if (error || !user) {
        console.log("Auth failed");
        return res.status(403).json({
          message: "Something is not right",
          user: user,
        });
      }
      req.login(user, { session: false }, (error) => {
        if (error) {
          console.log("Login failed");
          res.send(error);
        }
        let token = generateJWTToken(user.toJSON());
        console.log("User logged in succesfully", { username: user.username });
        return res.json({ user, token });
      });
    })(req, res);
  });
};
