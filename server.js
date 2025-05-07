import dotenv from 'dotenv';
import express from 'express';
import connectToMongoDB from './database/connectdb.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ImageModel from "./model_mon/usermodel.js"
import  axios from 'axios';


const PORT=process.env.PORT||4000;
dotenv.config(); 
const app=express();

async function detectAccident(imagePath) {
  try {
      const absolutePath = path.resolve(imagePath);
      const image = fs.readFileSync(absolutePath, { encoding: "base64" });

      const response = await axios({
          method: "POST",
          url: "https://serverless.roboflow.com/accident-classification-jbmo5/7",
          params: {
              api_key: process.env.MODEL_API,
          },
          data: image,
          headers: {
              "Content-Type": "application/x-www-form-urlencoded"
          }
      });

      const topPrediction = response.data?.predictions?.[0];
      if (!topPrediction) {
          throw new Error("No prediction found in response.");
      }

      return topPrediction.class === "accident";
  } catch (error) {
      console.error("Error during accident detection:", error.message);
      return false;
  }
}



const insertLocalData = async (name, path, tags, lat, long) => {
    try {

      const newData = {
        title: name,
        imagePath: path,
        tags: tags,
        location: {
          type: "Point",
          coordinates: [long, lat], // [longitude, latitude]
        },
        createdAt: new Date(),
      };
  
      // Insert the new document into MongoDB
      await ImageModel.insertMany([newData]);
      console.log(" Local data inserted successfully:", newData);

    } catch (error) {
      console.error("Error inserting data:", error);
    }
  };

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });

const upload = multer({ storage });

// Create "uploads" folder if it doesn't exist

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      if (await detectAccident(`./uploads/${req.file.filename}`)) {
          await insertLocalData(
              req.body.title,
              `./uploads/${req.file.filename}`,
              req.body.tags,
              req.body.lat,
              req.body.long
          );
      }
  } catch (err) {
      console.error("Error inserting data:", err);
  }

    res.json({
      message: 'File uploaded successfully',
      filePath: `/uploads/${req.file.filename}`,
      title: req.body.title,
      tags: req.body.tags,
      lat: req.body.lat,
      long: req.body.long
    });

  });
  
app.get("/", (req, res)=>{
    res.send("major project")
})

app.get("/events", async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    const userLocation = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };

    const maxDistance = 50000; // 50 km in meters

    const nearbyEvents = await ImageModel.find({
      location: {
        $near: {
          $geometry: userLocation,
          $maxDistance: maxDistance,
        },
      },
    });

    res.json(nearbyEvents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
    connectToMongoDB();
    console.log(`✅ Server running on port ${PORT}`);
});
