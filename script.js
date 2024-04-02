const CAM_WIDTH = 640;
const CAM_HEIGHT = 480;
const MIN_DETECTION_CONFIDENCE = 0.5;
const ANIMATION_TIME = 500;
// Min number of seconds before we send another alert.
const MIN_ALERT_COOLDOWN_TIME = 3;

const STEP_1 = document.getElementById('step1');
const STEP_2 = document.getElementById('step2');
const STEP_3 = document.getElementById('step3');

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
  STEP_1.classList.add('disabled');
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


function renderFoundObject(prediction) {
  const p = document.createElement('p');
  p.innerText =
    prediction.class +
    ' - with ' +
    Math.round(parseFloat(prediction.score) * 100) +
    '% confidence.';
  // Draw in top left of bounding box outline.
  p.style =
    'left: ' +
    prediction.bbox[0] * ratioX +
    'px;' +
    'top: ' +
    prediction.bbox[1] * ratioY +
    'px;' +
    'width: ' +
    (prediction.bbox[2] * ratioX - 10) +
    'px;';

  // Draw the actual bounding box.
  const highlighter = document.createElement('div');
  highlighter.setAttribute('class', 'highlighter');
  highlighter.style =
    'left: ' +
    prediction.bbox[0] * ratioX +
    'px; top: ' +
    prediction.bbox[1] * ratioY +
    'px; width: ' +
    prediction.bbox[2] * ratioX +
    'px; height: ' +
    prediction.bbox[3] * ratioY +
    'px;';

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
          
          // Check to see if desired object is in frame.
          if (predictions[n].class === CHOSEN_ITEM.value) {
            state = 'monitoring';
            // We see the object we should be monitoring. Update GUI.
            STEP_1.classList.remove('grayscale');
            STEP_1.classList.remove('disabled');
            STEP_3.classList.add('invisible');
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
  // Epoch of detection time.
  detectionEvent.dateTime = Date.now();

  detectionEvent.eventData = [];
 
  for (let i = 0; i < foundMonitoredObjects.length; i++) {
    var event = {};

    // A meaningful string for the event that occured. For example:
    // 'couch_cat'
    event.eventType = foundMonitoredObjects[i].class + '_' + CHOSEN_ITEM.value;
    
    // How confident are we in our detection of the animal.
    event.score = foundMonitoredObjects[i].score;
    
    // Bounding box data for monitord object eg "couch".
    // Here we convert values to be represented as  percentage poisitons 
    // and widths/heights so agnostic to any image resizing when shown in
    // Admin GUI vs original image size from webcam.
    event.x1 = foundMonitoredObjects[i].bbox[0] / VIDEO.videoWidth;
    event.y1 = foundMonitoredObjects[i].bbox[1] / VIDEO.videoHeight;
    event.width = foundMonitoredObjects[i].bbox[2] / VIDEO.videoWidth;
    event.height = foundMonitoredObjects[i].bbox[3] / VIDEO.videoHeight;
   
    // Array of bounding boxes as multiple objects possibly being 
    // detected for a given monitore region
    event.detections = [];
    
    for (let n = 0; n < naughtyAnimals.length; n ++) {
      let animal = {};
      // Class of animal detected.
      animal.objectType = naughtyAnimals[n].class;
      // Confidence of found animal as percentage.
      animal.score = naughtyAnimals[n].score;
      // Bounding box for this found animal.
      animal.x1 = naughtyAnimals[n].bbox[0] / VIDEO.videoWidth;
      animal.y1 = naughtyAnimals[n].bbox[1] / VIDEO.videoHeight;
      animal.width = naughtyAnimals[n].bbox[2] / VIDEO.videoWidth;
      animal.height = naughtyAnimals[n].bbox[3] / VIDEO.videoHeight;
      
      event.detections.push(animal);
    }
    
    detectionEvent.eventData.push(event);
  }

  
  CTX.drawImage(VIDEO, 0, 0);
  // Get image from canvas as blob.
  CANVAS.toBlob(function(blob) {
    detectionEvent.img = blob;
  
  
    var timestamp = new Date().toISOString().replace(/:/g, '-'); // Replace colons with dashes to make it a valid filename
    var filename = 'PetCamCapture_' + timestamp + '.png';
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);

    // Finally print the full object we constructed or actually send the JSON version of it to the backend.
    console.log(detectionEvent);
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


window.addEventListener("resize", recalculateVideoScale);
ENABLE_DETECTION_BTN.addEventListener('click', enableDetection);
