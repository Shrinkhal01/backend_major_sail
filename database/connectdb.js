import mongoose from "mongoose";


const connectToMongoDB=async()=>{
    try{        
            await mongoose.connect(process.env.MONGO_URL, )
            console.log("Connecgted to mongo db");
    }catch(error){
        console.log("Error connceting to MongoDb", error.message);
    }
};
export default connectToMongoDB; 