import tensorflow as tf
import numpy as np
from tensorflow.keras.preprocessing import image
import sys
import json

model = tf.keras.models.load_model('saved_model/my_model.keras')

def predict(img_path):
    img = image.load_img(img_path, target_size=(720, 1280))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255.0

    predictions = model.predict(img_array)
    accident = predictions[0][0] > 0.5
    print(json.dumps({"accident": accident}))  # output as JSON

if __name__ == "__main__":
    predict(sys.argv[1])