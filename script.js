const CAM_WIDTH = 640;
const CAM_HEIGHT = 480;
const MIN_DETECTION_CONFIDENCE = 0.5;
const ANIMATION_TIME = 500;
// Min number of seconds before we send another alert.
const MIN_ALERT_COOLDOWN_TIME = 10;

const STEP_1 = document.getElementById('step1');
const STEP_2 = document.getElementById('step2');
const STEP_3 = document.getElementById('step3');
const STEP_4 = document.getElementById('step4')

const DISABLE_WEBCAM_BTN = document.getElementById('disable_webcam')
const ENABLE_WEBCAM_BTN = document.getElementById('webcamButton');
const ENABLE_DETECTION_BTN = document.getElementById('enableDetection');


const CHOSEN_ITEM = document.getElementById('item');
const CHOSEN_ITEM_GUI = document.getElementById('chosenItem');
const CHOSEN_PET = document.getElementById('pet');
const MONITORING_TEXT = document.getElementById('monitoring');

const VIDEO = document.getElementById('webcam');
const LIVE_VIEW = document.getElementById('liveView');

const CANVAS = document.createElement('canvas');
const CTX = CANVAS.getContext('2d');

// Keep a reference of all the child elements we create
// so we can remove them easilly on each render.
var children = [];
var model = undefined;
var ratioX = 1;
var ratioY = 1;
var state = 'setup';
var lastNaughtyAnimalCount = 0;
var sendAlerts = true;
var foundMonitoredObjects = [];

// Before we can use COCO-SSD class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run. Only loaded once on page load.



const saveEmailBtn = document.getElementById('saveEmailButton');
var addressToSendTo = "christiantoleno@gmail.edu"; // Variable to store the email address

saveEmailBtn.addEventListener('click', function() {
    const emailInput = document.getElementById('emailInput');
    addressToSendTo = emailInput.value;
    console.log("Email address saved:", addressToSendTo); // Confirm email is saved
    // Optionally clear the input after saving
    emailInput.value = '';
});

cocoSsd.load().then(function(loadedModel) {
  model = loadedModel;
  // Show demo section now model is ready to use.
  ENABLE_WEBCAM_BTN.classList.remove('disabled');
});


// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}


// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  ENABLE_WEBCAM_BTN.addEventListener('click', enableCam);
  console.log('working')
} else {
  console.warn('getUserMedia() is not supported by your browser');
}

//trying to figure out how to disable the webcam 

// if (hasGetUserMedia()){
//   DISABLE_WEBCAM_BTN.addEventListener('click',disableCam)
// }
DISABLE_WEBCAM_BTN.addEventListener('click', disableCam);

function disableCam() {
  // Stop the video stream
  MONITORING_TEXT.classList.add("invisible")
  if (VIDEO.srcObject) {
    VIDEO.srcObject.getTracks().forEach(track => track.stop());
  }

  // Update the UI
  //DISABLE_WEBCAM_BTN.classList.add('removed');
  ENABLE_WEBCAM_BTN.classList.remove('removed');
  
  // if (hasGetUserMedia()) {
  //   ENABLE_WEBCAM_BTN.addEventListener('click', enableCam);
  //   console.log('working')
  // } else {
  //   console.warn('getUserMedia() is not supported by your browser');
  // }
  STEP_1.classList.remove('invisible');
  STEP_2.classList.add('invisible');
  STEP_3.classList.add('invisible');
  STEP_4.classList.add('invisible');

  // Reset the state
  //state = 'setup';
  lastNaughtyAnimalCount = 0;
  sendAlerts = true;
  foundMonitoredObjects = [];
  //  model = undefined; // Reset the model so it needs to be loaded again
}


// Enable the live webcam view and start classification.
function enableCam(event) {
  if (!model) {
    console.log('Wait! Model not loaded yet.');
    return;
  }
  // Optional: Go full screen.

  // document.documentElement.requestFullscreen({
  //   navigationUI: "hide"
  // });
  

  // Hide the enable button.
  event.target.classList.add('removed');
  
  // Fade GUI step 1 and setup step 2.
  //STEP_1.classList.add('invisible');
  STEP_1.classList.add('invisible')
  STEP_2.setAttribute('class', 'invisible');

  // getUsermedia parameters.
  const constraints = {
    video: {
      facingMode: 'environment',
      width: CAM_WIDTH,
      height: CAM_HEIGHT
    }
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    VIDEO.srcObject = stream;
    
    VIDEO.addEventListener('loadeddata', function() {
      recalculateVideoScale();

      setTimeout(function() {
        STEP_2.setAttribute('class', '');
      }, ANIMATION_TIME);
      
      predictWebcam();
    });
  });
}

function sendImageData(blob, email, subject) {
  const formData = new FormData();
  const imageFile = new File([blob], 'capture.png', { type: 'image/png' });
  formData.append('image', imageFile);
  formData.append('email', email);
  formData.append('subject', subject);

  fetch('http://localhost:3000/send-email', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => console.log('Email sent successfully to ', addressToSendTo))
  .catch(error => console.error('Error sending email:', error));
}

function renderFoundObject(prediction) {
  const p = document.createElement('p');
  p.innerText =
    prediction.class +
    ' - with ' +
    Math.round(parseFloat(prediction.score) * 100) +
    '% confidence.';

  // Set position to absolute and use percentages for left, top, width, and height
  p.style.position = 'absolute';
  p.style.left = (prediction.bbox[0] / VIDEO.videoWidth) * 100 + '%';
  p.style.top = (prediction.bbox[1] / VIDEO.videoHeight) * 100 + '%';
  p.style.width = (prediction.bbox[2] / VIDEO.videoWidth) * 100 + '%';

  // Draw the actual bounding box.
  const highlighter = document.createElement('div');
  highlighter.setAttribute('class', 'highlighter');
  highlighter.style.position = 'absolute';
  highlighter.style.left = (prediction.bbox[0] / VIDEO.videoWidth) * 100 + '%';
  highlighter.style.top = (prediction.bbox[1] / VIDEO.videoHeight) * 100 + '%';
  highlighter.style.width = (prediction.bbox[2] / VIDEO.videoWidth) * 100 + '%';
  highlighter.style.height = (prediction.bbox[3] / VIDEO.videoHeight) * 100 + '%';

  LIVE_VIEW.appendChild(highlighter);
  LIVE_VIEW.appendChild(p);

  // Store drawn objects in memory so we can delete them next time around.
  children.push(highlighter);
  children.push(p);
}


function predictWebcam() {
  // Now let's start classifying the stream.
  model.detect(VIDEO).then(function(predictions) {
    // Remove any highlighting we did previous frame.
    for (let i = 0; i < children.length; i++) {
      LIVE_VIEW.removeChild(children[i]);
    }
    
    // Reset the last rendered and found items.
    children.splice(0);
    foundMonitoredObjects.splice(0);
    
    // Now lets loop through predictions and draw them to the live view if
    // they have a high confidence score.
    for (let n = 0; n < predictions.length; n++) {
      // If we are over 75% sure we are sure we classified it right, draw
      // it and check for monitored items intersecting!
      if (predictions[n].score > MIN_DETECTION_CONFIDENCE) {
        
        if(state === 'searching') {
          renderFoundObject(predictions[n]);
          STEP_4.setAttribute('class','disabled')
          // Check to see if desired object is in frame.
          if (predictions[n].class === CHOSEN_ITEM.value) {
            state = 'monitoring';
            // We see the object we should be monitoring. Update GUI.
            //STEP_1.classList.remove('grayscale');
            STEP_1.classList.remove('disabled');
            STEP_3.classList.add('invisible');
            STEP_4.setAttribute('class','')
            MONITORING_TEXT.setAttribute('class', '');
            setTimeout(function() {
              STEP_3.setAttribute('class', 'removed');
              STEP_2.setAttribute('class', 'removed');
            }, ANIMATION_TIME)
          }
        } else if (state === 'monitoring') {
          // Check for intersection with pet
          if (predictions[n].class === CHOSEN_ITEM.value) {
            renderFoundObject(predictions[n]);
            foundMonitoredObjects.push(predictions[n]);
            huntForPets(predictions[n], predictions, CHOSEN_PET.value);
            // Assumes 1 monitored item only so we can break loop now.
            break;
          }
        }
      }
    }

    // Call this function again to keep predicting when the browser is ready.
    window.requestAnimationFrame(predictWebcam);
  });
}



// Class to make bounding box distance checking easier.
class BBox {
  constructor(bbox) {
      let x = bbox[0];
      let y = bbox[1];
      this.width = bbox[2];
      this.height = bbox[3];
      this.midX = x + this.width / 2;
      this.midY = y + this.height / 2;
  }

  distance(bbox) {
      let xDiff = Math.abs(this.midX - bbox.midX) - this.width / 2 - bbox.width / 2;
      let yDiff = Math.abs(this.midY - bbox.midY) - this.height / 2 - bbox.height / 2;

      // If xDiff < 0, the boxes intersect in the x plane. Thus the distance is just the
      // y height, or 0 if the boxes intersect in the y plane, too.
      if(xDiff < 0) {
          return Math.max(yDiff, 0);
      }
    
      // In this case, boxes intersect in y plane but not x plane.
      if(yDiff < 0) {
          return xDiff;
      }
    
      // BBoxes intersect in neither plane. Return the Euclidean distance between
      // the closest corners.
      return Math.sqrt(xDiff**2 + yDiff**2);
  }
}


// Check if 2 bounding boxes are within a distance of eachother.
function checkIfNear(item1, item2, distance=0) {
  const BOUNDING_BOX_1 = new BBox(item1.bbox);
  const BOUNDING_BOX_2 = new BBox(item2.bbox);
  return BOUNDING_BOX_1.distance(BOUNDING_BOX_2) <= distance;
}


// Enable alerts once Timeout successfully calls this function.
function cooldown() {
  sendAlerts = true;
}


// Function to create the alert detection object we wish to send with all useful details.
function sendAlert(naughtyAnimals) {
  var detectionEvent = {};
  console.log("Your naughty " + CHOSEN_PET.value + " was near a " + CHOSEN_ITEM.value + "!");
  detectionEvent.dateTime = Date.now();
  detectionEvent.eventData = [];

  for (let i = 0; i < foundMonitoredObjects.length; i++) {
      var event = {};
      event.eventType = foundMonitoredObjects[i].class + '_' + CHOSEN_ITEM.value;
      event.score = foundMonitoredObjects[i].score;
      event.x1 = foundMonitoredObjects[i].bbox[0] / VIDEO.videoWidth;
      event.y1 = foundMonitoredObjects[i].bbox[1] / VIDEO.videoHeight;
      event.width = foundMonitoredObjects[i].bbox[2] / VIDEO.videoWidth;
      event.height = foundMonitoredObjects[i].bbox[3] / VIDEO.videoHeight;
      event.detections = [];

      for (let n = 0; n < naughtyAnimals.length; n++) {
          let animal = {};
          animal.objectType = naughtyAnimals[n].class;
          animal.score = naughtyAnimals[n].score;
          animal.x1 = naughtyAnimals[n].bbox[0] / VIDEO.videoWidth;
          animal.y1 = naughtyAnimals[n].bbox[1] / VIDEO.videoHeight;
          animal.width = naughtyAnimals[n].bbox[2] / VIDEO.videoWidth;
          animal.height = naughtyAnimals[n].bbox[3] / VIDEO.videoHeight;
          event.detections.push(animal);
      }

      detectionEvent.eventData.push(event);
  }

  // Capture the current video frame in the canvas
  CTX.drawImage(VIDEO, 0, 0, VIDEO.videoWidth, VIDEO.videoHeight);
  CANVAS.toBlob(function(blob) {
      // Convert the event data to JSON string
      const emailSubject = `Alert: Your ${CHOSEN_PET.value} is near a ${CHOSEN_ITEM.value}!`;
      const emailBody = JSON.stringify(detectionEvent);
      // Send the image and the detection data to your server
      sendImageData(blob, addressToSendTo, emailSubject, emailBody);

    const fullProductData = {
      "organizedNutrition": {
        "Cholesterol": {
          "category": "Cholesterol",
          "details": ["Omg"]
        },
        "Protein": {
          "category": "Protein",
          "details": ["4g"]
        },
        "Sodium": {
          "category": "Sodium",
          "details": ["280mg"]
        },
        "Total Carbohydrate": {
          "category": "Total Carbohydrate",
          "details": [
            "24g",
            "Dietary Fiber 19",
            "Total Sugars 5g",
            "Includes 5g Added Sugars"
          ]
        },
        "Total Fat": {
          "category": "Total Fat",
          "details": [
            "9g",
            "Saturated Fat 1.5g",
            "Trans Fat 0g",
            "Polyunsaturated Fat 11.6g",
            "Monounsaturated Fat 7.7g"
          ]
        }
      },
      "productTitle": "Keebler Crackers Keebler Sandwich Crackers, Toast and Peanut Butter, Snacking Made Easy Single Serve, 8ct 11oz",
      "ingredients": "enriched flour (wheat flour, niacin, reduced iron, vitamin b1 (thiamin mononitrate), vitamin b2 (riboflavin), folic acid), peanut butter (roasted peanuts), soybean oil (with TBHQ for freshness), sugar, dextrose.Contains 2% or less of salt, malt powder (malted barley flour, wheat flour, dextrose), leavening (baking soda, monocalcium phosphate), soy lecithin, whey.",
      "servingSize": "39.00 g",
      "userQuestion": "is this product vegetarian friendly"
    };
    


    console.log('Sending Full Product Data and Question:', JSON.stringify(fullProductData, null, 2)); // Debugging output

    // Send the data to the server
    fetch('http://localhost:3000/send-nutrition', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullProductData),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Server response:', JSON.stringify(data, null, 2));
            document.getElementById('aiResponse').textContent = data.aiResponse || "No response from AI.";
    })
    .catch(error => console.error('Error:', error));
      
      // const gptPrompt = `Please write me 2-3 sentences recommending what you would do given this alert: ${emailSubject}`

      // const requestBody = { prompt: gptPrompt };
      // console.log(JSON.stringify(requestBody, null, 2));
      // fetch('http://localhost:3000/get-gpt-advice', {
      //     method: 'POST',
      //     headers: {
      //         'Content-Type': 'application/json',
      //     },
      //     body: JSON.stringify(requestBody)
      // }).then(response => response.json())
      // .then(data => {
      //     console.log('GPT-3 Advice:', data);
      // }).catch(error => {
      //     console.error('Error getting advice from GPT-3:', error);
      // });
  }, 'image/png');
}



// Look for naughty animals in the image!
function huntForPets(monitoredItem, detectionArray, target) {
  var naughtyAnimals = [];
  
  for (let i = 0; i < detectionArray.length; i++) {
    if (detectionArray[i].class === target && detectionArray[i].score > MIN_DETECTION_CONFIDENCE) {
      renderFoundObject(detectionArray[i]);
      if (checkIfNear(monitoredItem, detectionArray[i])) {
        naughtyAnimals.push(detectionArray[i]);
      }
    }
  }
  
  // Only send alerts if new animals entered the scene. We do not send alert if animal(s) left
  // unless the last count was 0.
  if (naughtyAnimals.length > lastNaughtyAnimalCount) {
    lastNaughtyAnimalCount = naughtyAnimals.length;

    // If allowed, send the alert!
    if (sendAlerts) {
      sendAlerts = false;
      sendAlert(naughtyAnimals);
      setTimeout(cooldown, MIN_ALERT_COOLDOWN_TIME * 1000);
    }
  } else if (naughtyAnimals.length === 0) {
    // If all animals left, reset animal counter so we start triggering events 
    // again when one comes back in frame.
    lastNaughtyAnimalCount = 0;
  }
}


// Handle browser resizing for bounding box and video rendering.
function recalculateVideoScale() {
  ratioY = VIDEO.clientHeight / VIDEO.videoHeight;
  ratioX = VIDEO.clientWidth / VIDEO.videoWidth;
  CANVAS.width = VIDEO.videoWidth;
  CANVAS.height = VIDEO.videoHeight;
}


// Update GUI once detection enabled.
function enableDetection() {
  CHOSEN_ITEM_GUI.innerText = CHOSEN_ITEM.value;
  STEP_1.classList.add('grayscale');
  STEP_2.setAttribute('class', 'invisible');
  STEP_3.setAttribute('class', 'invisible');
  setTimeout(function() {
    STEP_3.setAttribute('class', '');
    state = 'searching';
  }, ANIMATION_TIME);
}





// Example usage when you want to send an email
const videoElement = document.querySelector('video');  // Assuming you have a video element
const canvas = document.createElement('canvas');
canvas.width = videoElement.videoWidth;
canvas.height = videoElement.videoHeight;
const ctx = canvas.getContext('2d');
ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);




window.addEventListener("resize", recalculateVideoScale);
ENABLE_DETECTION_BTN.addEventListener('click', enableDetection);