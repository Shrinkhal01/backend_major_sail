import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import connectToMongoDB from './database/connectdb.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ImageModel from "./model_mon/usermodel.js"
import ort from 'onnxruntime-node';
import sharp from 'sharp';


 const PORT=process.env.PORT||4000;
 dotenv.config(); 
const app=express();

async function preprocessImage(imagePath) {
  const imageBuffer = await sharp(imagePath)
      .resize(640, 640)
      .toBuffer();

  const image = await sharp(imageBuffer).raw().toBuffer({ resolveWithObject: true });

  const pixels = new Float32Array(3 * 640 * 640);
  let idx = 0;

  for (let i = 0; i < image.data.length; i += 3) {
      const red = image.data[i] / 255.0;
      const green = image.data[i + 1] / 255.0;
      const blue = image.data[i + 2] / 255.0;

      pixels[idx] = red;
      pixels[idx + 1] = green;
      pixels[idx + 2] = blue;
      idx += 3;
  }

  return pixels;
}

async function isAccidentDetected(imagePath,title, tags,lat ,long) {
  const confidenceThreshold=0.5
  const pixels = await preprocessImage(imagePath);

    const session = await ort.InferenceSession.create('best_yolov8_model.onnx');
    const inputTensor = new ort.Tensor('float32', pixels, [1, 3, 640, 640]);

    const results = await session.run({ images: inputTensor });

    // Log the results to understand the structure
    console.log("Inference results:", results);

    // Assuming 'output0' is the actual key, adjust if needed
    const output = results['output0'];
    console.log('Model output:', output);

    // Now, let's extract bounding boxes, confidences, and class labels from the flattened output tensor
    const numClasses = 5; // Number of classes detected by YOLO
    const gridSize = 8400; // This matches the 8400 cells in the tensor
    const boxes = [];
    const confidences = [];
    const classIds = [];
    const outputData = output.data;

    // This logic assumes the tensor is structured as [1, numClasses, gridSize]
    for (let i = 0; i < gridSize; i++) {
        const confidence = output[i * numClasses + 0];  // Confidence score (index 0 for class detection)
        const classId = Math.floor(output[i * numClasses + 1]); // Class ID (index 1 for class prediction)
 // Extracting the bounding box (4 coordinates per box)
        const box = outputData.slice(i * 4, (i + 1) * 4); 
        // Optional: You can extract coordinates if needed (using box[0], box[1], etc.)
        if (confidence > confidenceThreshold) {
            boxes.push(box);
            confidences.push(confidence);
            classIds.push(classId);
        }
    }

    // Assuming the label for 'Accident' is 0 (you need to adjust based on your labels)
    const classNames = ['Accident', 'OtherClass1', 'OtherClass2', 'OtherClass3', 'OtherClass4'];

    for (let i = 0; i < boxes.length; i++) {
        const className = classNames[classIds[i]];
        const confidence = confidences[i];1

      if (className.toLowerCase() === 'accident' && confidence < confidenceThreshold) {
          console.log(`🚨 Accident Detected! Confidence: ${confidence.toFixed(2)}`);
          await insertLocalData(title,imagePath,tags,lat,long)
          return true;
      }
  }

  console.log("✅ No Accident Detected");
  return false;
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

    
    await insertLocalData(req.body.title,`./uploads/${req.file.filename}`,req.body.tags,req.body.lat,req.body.long)
    // isAccidentDetected(`./uploads/${req.file.filename}`,req.body.title,req.body.tags,req.body.lat, req.body.long)

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
