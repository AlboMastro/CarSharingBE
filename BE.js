const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const cors = require("cors");
const fs = require("fs");

dotenv.config();

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.get("origin") || "Unknown Origin";

  console.log(
    `----------------------------------------------------------------`
  );
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Origin: ${origin}`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`Request Body: ${JSON.stringify(req.body)}`);
  console.log(
    `----------------------------------------------------------------`
  );
  next();
});

const usersFilePath = "./users.json";

const readUsersFile = () => {
  try {
    const usersData = fs.readFileSync(usersFilePath);
    return JSON.parse(usersData);
  } catch (error) {
    return [];
  }
};

const findUserByUsername = (username) => {
  const users = readUsersFile();
  return users.find((user) => user.username === username);
};

const writeUsersFile = (data) => {
  fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2));
};

const saveUser = (user) => {
  const users = readUsersFile();
  users.push(user);
  writeUsersFile(users);
};

// User registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const existingUser = findUserByUsername(username);
  if (existingUser) {
    return res.status(400).json({ message: "User already exists" });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = {
      id: uuidv4(),
      username,
      password: hashedPassword,
      assignedVehicle: {},
      vehicleHistory: []
    };
    await saveUser(newUser);
    res.json({ message: "Registration successful" });
  } catch (error) {
    res.status(500).json({ message: "Error occurred while registering user" });
    console.log(error);
  }
});

const generateVehicleHistory = () => {
  let vehicleHistory = [];
  for (let i = 1; i < 90; i++) {
    let historyEntry = {
      day: new Date() - i,
      vehicle: chooseVehicleType(),
      Kilometres: Math.random() * 50
    };
    vehicleHistory.push(historyEntry);
  }
  return vehicleHistory;
}

// User login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = findUserByUsername(username);

  if (user) {
    try {
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (passwordMatch) {
        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            assignedVehicle: user.assignedVehicle,
            vehicleHistory: generateVehicleHistory()
          },
          JWT_SECRET_KEY
        );
        return res.json({ token });
      }
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: "Error occurred while checking password" });
    }
  }

  res.status(401).json({ message: "Invalid credentials" });
});

app.get("/profile", (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : undefined;

  if (token) {
    try {
      // Verify the token and extract user information
      const decoded = jwt.verify(token, JWT_SECRET_KEY);

      // Find the user in the users file using the decoded username
      const user = findUserByUsername(decoded.username);
      if (user) {
        let fetchedUser = {
          id: user.id,
          username: user.username,
          assignedVehicle: user.assignedVehicle,
        };
        res.json({ fetchedUser });
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      res.status(403).json({ message: "Invalid token" });
    }
  } else {
    res.status(401).json({ message: "Authorization header missing" });
  }
});

// Vehicle type
const chooseVehicleType = () => {
  let randomInt = Math.floor(Math.random() * 3);

  switch (randomInt) {
    case 0:
      vehicle = "car";
      break;
    case 1:
      vehicle = "motorbike";
      break;
    case 2:
      vehicle = "scooter";
      break;
    default:
      console.log("There was an error");
  }
};

const generateVehicles = (lat, lng, radius) => {
  const vehicles = [];
  const toRadians = (degrees) => {
    return (degrees * Math.PI) / 180;
  };

  const toDegrees = (radians) => {
    return (radians * 180) / Math.PI;
  };
  // 6731 = Earth's radius in km
  const radiusInRadians = radius / 6371;
  const latInRadians = toRadians(lat);
  const lngInRadians = toRadians(lng);

  for (let i = 0; i < 60; i++) {
    let vehicle;

    // Latitude and longitude
    const randomAngle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusInRadians;

    const newLat = Math.asin(
      Math.sin(latInRadians) * Math.cos(distance) +
      Math.cos(latInRadians) * Math.sin(distance) * Math.cos(randomAngle)
    );
    const newLng =
      lngInRadians +
      Math.atan2(
        Math.sin(randomAngle) * Math.sin(distance) * Math.cos(latInRadians),
        Math.cos(distance) - Math.sin(latInRadians) * Math.sin(newLat)
      );
    chooseVehicleType();

    vehicles.push({
      lat: newLat * (180 / Math.PI),
      lng: newLng * (180 / Math.PI),
      vehicle: vehicle,
      percent: `${Math.floor(Math.random() * 100)}%`,
    });
  }

  return vehicles;
};

app.get("/vehicles", (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : undefined;

  if (token) {
    try {
      jwt.verify(token, JWT_SECRET_KEY);

      // Accessing the lat and lng query parameters from req.query
      const { lat, lng, radius } = req.query;

      const vehicles = generateVehicles(lat, lng, radius);
      res.json(vehicles);
    } catch (error) {
      res.status(403).json({ message: "Invalid token" });
    }
  } else {
    res.status(401).json({ message: "Authorization header missing" });
  }
});

app.post("/addVehicle", (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : undefined;

  if (token) {
    try {
      // Verify the token and extract user information
      const decoded = jwt.verify(token, JWT_SECRET_KEY);

      const { lat, lng, vehicle, percent } = req.body;

      // Create the new vehicle object
      const newVehicle = {
        lat,
        lng,
        vehicle: vehicle,
        percent: percent,
      };

      // Find the user and update their assignedVehicle property
      const users = readUsersFile();
      const updatedUsers = users.map((user) => {
        if (user.username === decoded.username) {
          user.assignedVehicle = newVehicle;
        }
        return user;
      });

      writeUsersFile(updatedUsers);
      res.json({ message: "Vehicle added successfully" });
    } catch (error) {
      res.status(403).json({ message: "Invalid token" });
    }
  } else {
    res.status(401).json({ message: "Authorization header missing" });
  }
});

app.post("/removeVehicle", (req, res) => {
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : undefined;

  if (token) {
    try {
      // Verify the token and extract user information
      const decoded = jwt.verify(token, JWT_SECRET_KEY);


      // Find the user and remove their assignedVehicle property
      const users = readUsersFile();
      const updatedUsers = users.map((user) => {
        if (user.username === decoded.username) {
          user.assignedVehicle = {};
        }
        return user;
      });

      writeUsersFile(updatedUsers);
      res.json({ message: "Vehicle removed successfully" });
    } catch (error) {
      res.status(403).json({ message: "Invalid token" });
    }
  } else {
    res.status(401).json({ message: "Authorization header missing" });
  }

});
