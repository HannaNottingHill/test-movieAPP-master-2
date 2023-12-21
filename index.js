require("dotenv").config();

const express = require("express"),
  bodyParser = require("body-parser");

const cors = require("cors");
const passport = require("passport");

const morgan = require("morgan");
const path = require("path");

const { check, validationResult } = require("express-validator");

const fs = require("fs");
const mongoose = require("mongoose");

require("./passport");

const Models = require("./models");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.use(bodyParser.json());
app.use(express.json());
require("./auth")(app);
const Movies = Models.Movie;
const Users = Models.User;

mongoose
  .connect(process.env.CONNECTION_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((e) => {
    console.log("successfully connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

app.use(express.static("public"));

// create a write stream (in append mode)
// a ‘log.txt’ file is created in root directory
const accessLogStream = fs.createWriteStream(path.join(__dirname, "log.txt"), {
  flags: "a",
});

app.use(morgan("combined", { stream: accessLogStream }));

//APIs

app.get("/", (req, res) => {
  res.send("Welcome to my movie API!");
});

//Get a list of ALL movies
app.get(
  "/movies",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const movies = await Movies.find();
      console.log("Movies found:", movies); // Log movies to the console
      if (movies && movies.length > 0) {
        res.status(200).json(movies);
      } else {
        res.status(404).send("No movies found");
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

//Get data about a single movie by title
app.get("/movies/:title", async (req, res) => {
  try {
    const movie = await Movies.findOne({ title: req.params.title });
    res.json(movie);
  } catch (error) {
    console.log(error);
    res.status(404).send("Not found");
  }
});

//Get data about genre by title
app.get("/movies/genre/:title", async (req, res) => {
  try {
    const title = req.params.title;
    const movie = await Movies.findOne({ title: title });

    if (!movie) {
      res.status(404).send("Movie not found");
    } else {
      const genre = movie.genre;
      res.json(genre);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error: " + error);
  }
});

//Get data about the director by name
app.get("/movies/director/:name", async (req, res) => {
  try {
    const directorName = req.params.name;
    const director = await Movies.find({
      "director.name": directorName,
    });

    res.status(200).json(director);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error: " + error);
  }
});

//Add a new user
app.post(
  "/users",
  [
    check("username", "Username is required.").isLength({ min: 5 }),
    check(
      "username",
      "Username contains non alphanumeric characters - not allowed."
    ).isAlphanumeric(),
    check("password", "Password is required.").not().isEmpty(),
    check("email", "Email does not appear to be valid.").isEmail(),
  ],
  async (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    let hashPassword = Users.hashPassword(req.body.password);
    try {
      const newUser = await Users.create({
        username: req.body.username,
        password: hashPassword,
        email: req.body.email,
        birthday: req.body.birthday,
      });
      res.status(201).json(newUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

// Endpoint to check if a username exists
app.get("/users/check-username/:username", async (req, res) => {
  const user = await Users.findOne({ username: req.params.username });
  if (user) {
    res.status(400).json({ message: "Username already exists" });
  } else {
    res.status(200).json({ message: "Username available" });
  }
});

// Endpoint to check if an email exists
app.get("/users/check-email/:email", async (req, res) => {
  const user = await Users.findOne({ email: req.params.email });
  if (user) {
    res.status(400).json({ message: "Email already exists" });
  } else {
    res.status(200).json({ message: "Email available" });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await Users.find();
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error: " + error);
  }
});

// Get a user by username
app.get("/users/:username", async (req, res) => {
  try {
    const user = await Users.findOne({ username: req.params.username });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error: " + error);
  }
});

//Update a user's information (username)
app.put(
  "/users/:username",
  passport.authenticate("jwt", {
    session: false,
  }),
  [
    check("username", "Username is required.").not().isEmpty(),
    check(
      "username",
      "Username contains nonalphanumeric characters - not allowed."
    ).isAlphanumeric(),
    check("password").optional(),
    check("email", "Email is required.").isEmail(),
  ],
  async (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    try {
      const existingUser = await Users.findOne({
        username: req.params.username,
      });

      //Check if the user exists
      if (!existingUser) {
        return res.status(404).send("User not found");
      }

      // Check if the username in the JWT payload matches the requested username
      if (req.user.username !== req.params.username) {
        return res.status(400).send("Permission denied");
      }

      // If updating the password, ensure it's processed correctly
      if (req.body.password) {
        try {
          let hashPassword = Users.hashPassword(req.body.password);
          existingUser.password = hashPassword;
        } catch (error) {
          console.error("Error hashing password:", error);
          return res.status(500).send("Error updating password");
        }
      }

      let hashPassword = Users.hashPassword(req.body.password);

      existingUser.username = req.body.username;
      existingUser.password = hashPassword;
      existingUser.email = req.body.email;
      existingUser.birthday = req.body.birthday;

      const updatedUser = await existingUser.save();

      res.json(updatedUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

// Add a movie to a user's favorites list
app.post("/users/:username/movies/:movieId", async (req, res) => {
  // Changed endpoint to be more RESTful
  try {
    const user = await Users.findOne({ username: req.params.username }); // Find the user first

    if (!user) {
      return res.status(404).send("User not found"); // Handle case where user doesn't exist
    }

    const updatedUser = await Users.findOneAndUpdate(
      { username: req.params.username },
      { $addToSet: { favorites: req.params.movieId } }, // Use $addToSet to avoid duplicates
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error: " + error);
  }
});

// Remove a movie from the favorites list
app.delete("/users/:username/movies/:movieId", async (req, res) => {
  // Changed endpoint to be more RESTful
  try {
    const user = await Users.findOne({ username: req.params.username });

    if (!user) {
      return res.status(404).send("User not found"); // Handle case where user doesn't exist
    }

    const updatedUser = await Users.findOneAndUpdate(
      { username: req.params.username },
      { $pull: { favorites: req.params.movieId } }, // Use $pull to remove the movieId from favorites
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error: " + error);
  }
});

// Delete a user by username
app.delete("/users/:username", async (req, res) => {
  try {
    const deleted = await Users.findOneAndRemove({
      username: req.params.username,
    });
    if (!deleted) {
      res.status(400).send(req.params.username + " was not found");
    }
    res.status(200).send(req.params.username + " was deleted.");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error: " + error);
  }
});

app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).send("Something went wrong!");
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("Listening on Port " + port);
});
