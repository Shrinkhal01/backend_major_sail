import mongoose from "mongoose";
const imageSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    imagePath: {
        type: String,  
        required: true,
    },
    tags: {
        type: String,
        required: true,
    },
    location: {
        type: {
          type: String,
          enum: ["Point"], // Must be "Point"
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: true,
        },
      },
}, { timestamps: true });

const ImageModel = mongoose.model("Image", imageSchema);
export default ImageModel;